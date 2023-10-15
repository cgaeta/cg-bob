import { z } from "zod";

import { AsyncLocalStorage } from "async_hooks";

import * as schema from "./schema";

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

export type DiscordContext<T extends Record<string, unknown> = {}> = T & {
  interaction: schema.MessageInteraction;
};

export const discordRouterRoot = (handler: DiscordRoute[]) => {
  const server = handler.reduce(reduceRoutes, new Map());

  return async <
    I extends schema.Interaction = schema.Interaction,
    C extends Record<string, unknown> = {}
  >(
    interaction: I,
    context: AsyncLocalStorage<DiscordContext<C>>,
    getContext: () => Promise<C> | C
  ) => {
    try {
      const i = schema.messageInteraction.parse(interaction);
      const ctx = await getContext();

      return await context.run({ interaction: i, ...ctx }, async () => {
        const { data } = i;
        const { name } = data;

        const handler = server.get(name);
        if (!handler) throw new Error("Route not found");

        return handler(data.options ?? []);
      });
    } catch (err) {
      console.error(err);
    }
  };
};

export * as schema from "./schema";
