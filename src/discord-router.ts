import { z } from "zod";

import { AsyncLocalStorage } from "async_hooks";

import * as schema from "./schema";
import { InteractionResponseType, InteractionType } from "discord-interactions";

type DiscordRouteHandler<
  A extends z.ZodTypeAny = typeof schema.discordOptions
> = (a: z.infer<A>) => Promise<schema.InteractionResponse | void>;
type DiscordRoute = [string, DiscordRouteHandler];

interface DiscordRouteFn {
  <Z extends z.ZodTypeAny>(
    path: string,
    parser: Z,
    handler: DiscordRouteHandler<Z> | DiscordRoute[]
  ): DiscordRoute;
}

const reduceRoutes = (
  acc: Map<string, DiscordRouteHandler>,
  [path, fn]: DiscordRoute
) => {
  acc.set(path, fn);
  return acc;
};

export const discordRoute: DiscordRouteFn = (path, parser, handler) => {
  if (typeof handler === "function") {
    const fnHandler = async (opt: schema.DiscordOptions) => {
      const parsedOpt = parser.parse(opt);
      return handler(parsedOpt);
    };

    return [path, fnHandler];
  }

  const server = handler.reduce(reduceRoutes, new Map());

  const fnHandler = async (opt: schema.DiscordOptions) => {
    const [parsedOpt] = parser.parse(opt);
    const route = server.get(parsedOpt.name);

    if (!route) throw new Error("Route not found");

    return await route(parsedOpt.options ?? []);
  };

  return [path, fnHandler];
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

        return handler(data.options ?? []);
      } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        const custom_id = interaction.data.custom_id;

        const handler = componentServer.get(custom_id);
        if (!handler) throw new Error("Route not found");

        return handler([]);
      } else if (
        interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE
      ) {
        const data = interaction.data;

        const handler = autoCompleteServer.get(data.name);
        if (!handler) throw new Error("Route not found");

        return handler(data.options ?? []);
      }
    });
  };
};

export const sub = z.tuple([schema.subcommand]);
export const subgroup = z.tuple([schema.subcommandGroup]);

export * as schema from "./schema";
