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

export type DiscordContext<
  T extends Record<string, unknown> = {},
  I extends schema.Interaction = schema.Interaction
> = T & {
  interaction: I;
};

export const discordRouterRoot = (handlers: {
  applicationCmds: DiscordRoute[];
  componentCmds: DiscordRoute[];
  autocompleteCmds: DiscordRoute[];
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

  return async <
    I extends schema.Interaction,
    C extends Record<string, unknown> = {}
  >(
    interaction: I,
    context: AsyncLocalStorage<DiscordContext<C, I>>,
    getContext: () => Promise<C> | C
  ) => {
    const ctx = await getContext();
    return await context.run({ interaction, ...ctx }, async () => {
      if (interaction.type === InteractionType.PING) {
        return { type: InteractionResponseType.PONG };
      } else if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        const data = interaction.data;

        const handler = applicationCommandServer.get(data.name);
        if (!handler) throw new Error("Route not found");

        return handler(...(data.options ?? []));
      } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        console.log(interaction);
        const handler = componentServer.get(
          interaction.message.interaction.name
        );
        if (!handler) throw new Error("Route not found");

        return handler(interaction.data);
      } else if (
        interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE
      ) {
        const data = interaction.data;

        const handler = autoCompleteServer.get(data.name);
        if (!handler) throw new Error("Route not found");

        return handler(...(data.options ?? []));
      }
    });
  };
};

export const subgroup = z.union([schema.subcommand, schema.subcommandGroup]);

export * as schema from "./schema";
