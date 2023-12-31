import { z } from "zod";

import { AsyncLocalStorage } from "async_hooks";

import * as schema from "./schema";
import { InteractionResponseType, InteractionType } from "discord-interactions";

type DiscordRouteHandler = (
  ...args: any[]
) => Promise<schema.InteractionResponse>;
type DiscordRoute = [string, DiscordRouteHandler];

interface DiscordRouteFn {
  (path: string, handler: DiscordRouteHandler | DiscordRoute[]): DiscordRoute;
}

const reduceRoutes = (
  acc: Map<string, DiscordRouteHandler>,
  [path, fn]: DiscordRoute
) => {
  acc.set(path, fn);
  return acc;
};

export const discordRoute: DiscordRouteFn = (path, handler) => {
  if (typeof handler === "function") {
    return [path, handler];
  }

  const server = handler.reduce(
    reduceRoutes,
    new Map<string, DiscordRouteHandler>()
  );

  const fnHandler = async (opt: schema.DiscordOptions) => {
    const parsedOpt = subgroup.parse(opt);
    const route = server.get(parsedOpt.name);

    if (!route) throw new Error("Route not found");

    return route(...(parsedOpt.options ?? []));
  };

  return [path, fnHandler] satisfies DiscordRoute;
};

export type DiscordContext<T extends Record<string, unknown> = {}> = T & {
  interaction: schema.Interaction;
};

export const discordRouterRoot = (handlers: {
  applicationCmds: DiscordRoute[];
  componentCmds: DiscordRoute[];
  autocompleteCmds: DiscordRoute[];
  modalsubmitCmds: DiscordRoute[];
}) => {
  const applicationCommandServer = handlers.applicationCmds.reduce(
    reduceRoutes,
    new Map()
  );
  const componentServer = handlers.componentCmds.reduce(
    reduceRoutes,
    new Map()
  );
  const autoCompleteServer = handlers.autocompleteCmds.reduce(
    reduceRoutes,
    new Map()
  );
  const modalSubmitServer = handlers.modalsubmitCmds.reduce(
    reduceRoutes,
    new Map()
  );

  const routeError = new Error("Route not found");

  return async <C extends Record<string, unknown> = {}>(
    interaction: schema.Interaction,
    context: AsyncLocalStorage<DiscordContext<C>>,
    getContext: () => Promise<C> | C
  ) => {
    const ctx = await getContext();
    return await context.run({ interaction, ...ctx }, async () => {
      if (interaction.type === InteractionType.PING) {
        return { type: InteractionResponseType.PONG };
      } else if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        const data = interaction.data;

        const handler = applicationCommandServer.get(data.name);
        if (!handler) throw routeError;

        return handler(...(data.options ?? []));
      } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        const handler = componentServer.get(
          interaction.message.interaction?.name ?? interaction.data.custom_id
        );
        if (!handler) throw routeError;

        return handler();
      } else if (
        interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE
      ) {
        const data = interaction.data;

        const handler = autoCompleteServer.get(data.name);
        if (!handler) throw routeError;

        return handler(...(data.options ?? []));
      } else if (interaction.type === InteractionType.MODAL_SUBMIT) {
        const data = interaction.data;

        const handler = modalSubmitServer.get(data.custom_id);
        if (!handler) throw routeError;

        return handler(...data.components.map((c) => c.components[0].value));
      }
    });
  };
};

export const subgroup = z.union([schema.subcommand, schema.subcommandGroup]);

export * as schema from "./schema";
