import type { Elysia } from "elysia";
import { z } from "zod";
import {
  verifyKey,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  InteractionResponseFlags,
} from "discord-interactions";
import { eq, and, like } from "drizzle-orm";
import { AsyncLocalStorage } from "async_hooks";

import {
  discordRouterRoot,
  discordRoute,
  type DiscordContext,
  schema,
} from "./discord-router";
import { players } from "./tokens";
import { generalMoves, uniqueMoves } from "./moves";
import { db } from "./db";
import {
  characters,
  users,
  userPlayers,
  tokenCount,
  games,
  gamesUsers,
} from "./db/schema";
import {
  selectAllCharacterTokens,
  selectCharacterTokens,
  selectGame,
} from "./queries";
import { env } from "./env";
import { capitalize } from "./utils";

const nerdSchema = z.enum(players);
const movesSchema = z.enum([
  "strongMoves",
  "normalMoves",
  "weakMoves",
  "socialMoves",
]);

const choiceSchema = z
  .object({
    name: z.string(),
    value: nerdSchema,
  })
  .optional();

const UNDER_CONSTRUCTION_RESP = {
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: {
    content: "Working, but not implemented",
    flags: InteractionResponseFlags.EPHEMERAL,
  },
};

const YEET = (e: string) => {
  throw new Error(e);
};

const getTokenContent = (
  c: {
    tokenCount: typeof tokenCount.$inferSelect;
    characters: typeof characters.$inferSelect;
  }[]
) => {
  if (!c) throw new Error("Character not found!");
  if (c.some((cc) => !cc.tokenCount))
    throw new Error("Tokens missing in list!");

  return c
    .map(
      ({ characters, tokenCount }) =>
        `- ${capitalize(characters.name)}: ${tokenCount?.tokens}`
    )
    .join("\n");
};

const context = new AsyncLocalStorage<
  DiscordContext<{ thisGame: typeof games.$inferSelect }>
>();

const discordRouter = discordRouterRoot([
  discordRoute("list", z.tuple([schema.subcommandOption]), [
    discordRoute("characters", z.tuple([]), async () => {
      const thisGame =
        context.getStore()?.thisGame ?? YEET("No game in this server");

      const characterList = await db
        .select()
        .from(characters)
        .where(eq(characters.gameId, thisGame.id));

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "- " + characterList.map((c) => c.name).join("\n- "),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      };
    }),
    discordRoute("players", z.tuple([]), async () => {
      const thisGame =
        context.getStore()?.thisGame ?? YEET("No game in this server");

      const playerList = await db
        .select()
        .from(users)
        .innerJoin(gamesUsers, eq(gamesUsers.userId, users.discordId))
        .where(eq(gamesUsers.gameId, thisGame.id));

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            "- " +
            playerList.map((p) => `<@${p.users.discordId}>`).join("\n- "),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      };
    }),
  ]),
  discordRoute("tokens", z.tuple([]), async () => {
    const { interaction: i, thisGame } =
      context.getStore() ?? YEET("Fucking context");

    if (!thisGame) throw new Error("No game in this server");

    if (thisGame.gmDiscordId === i.member.user.id) {
      const count = await selectAllCharacterTokens.execute({
        gameId: thisGame.id,
      });

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: getTokenContent(count),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      };
    } else {
      const [count] = await db
        .select()
        .from(characters)
        .innerJoin(tokenCount, eq(characters.id, tokenCount.characterId))
        .innerJoin(userPlayers, eq(characters.id, userPlayers.characterId))
        .innerJoin(gamesUsers, eq(userPlayers.discordId, gamesUsers.userId))
        .innerJoin(games, eq(games.id, gamesUsers.gameId))
        .where(
          and(
            eq(games.discordServerId, i.guild_id),
            eq(userPlayers.discordId, i.member.user.id)
          )
        );

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `${capitalize(count.characters.name)} has ${
            count.tokenCount.tokens
          } token${count.tokenCount.tokens > 1 ? "s" : ""}!`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      };
    }
  }),
]);

export const discordEndpoint = (app: Elysia) =>
  app.post("/api/interactions", async (req) => {
    const signature = req.headers["x-signature-ed25519"] as string;
    const timestamp = req.headers["x-signature-timestamp"] as string;
    const body = JSON.stringify(req.body as any);

    const isValid = verifyKey(
      body,
      signature,
      timestamp,
      env.DISCORD_PUBLIC_KEY
    );

    if (!isValid) {
      req.set.status = 401;
      throw new Error("Bad request signature");
    }

    const interaction = schema.interaction.parse(req.body);
    const { type } = interaction;

    if (type === InteractionType.PING) {
      return { type: InteractionResponseType.PONG };
    } else if (type === InteractionType.APPLICATION_COMMAND) {
      const { member, guild_id, data } =
        schema.messageInteraction.parse(interaction);
      const { name } = data;

      const res = await discordRouter(interaction, context, async () => {
        const [thisGame] = await selectGame.execute({ guild_id });
        return { thisGame };
      });
      if (res) {
        return res;
      }

      switch (name) {
        case "gm": {
          const option0 = schema.subcommandOption.parse(data.options?.[0]);

          switch (option0.name) {
            case "game": {
              const option1 = schema.subcommand.parse(option0.options?.[0]);

              switch (option1.name) {
                case "init": {
                  await db.insert(games).values({
                    discordServerId: guild_id,
                    gmDiscordId: member.user.id,
                  });

                  return {
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                      content: `Started a new game run by <@${member.user.id}>`,
                      flags: InteractionResponseFlags.EPHEMERAL,
                    },
                  };
                }
                case "info": {
                  const [thisGame] = await selectGame.execute({ guild_id });

                  return {
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                      content: thisGame
                        ? `This server has a game run by <@${thisGame.gmDiscordId}>`
                        : "No game running in this server",
                      flags: InteractionResponseFlags.EPHEMERAL,
                    },
                  };
                }
              }
            }
            case "assign": {
              const option1 = schema.subcommand.parse(option0.options?.[0]);

              switch (option1.name) {
                case "character": {
                  try {
                    const [user, { value: characterId }] = z
                      .tuple([schema.userOption, schema.stringOption])
                      .parse(option1.options);

                    const [thisGame] = await selectGame.execute({ guild_id });
                    if (!thisGame) throw new Error("No game in this server");

                    await db
                      .insert(users)
                      .values({ discordId: user.value })
                      .onConflictDoNothing();
                    await db
                      .insert(gamesUsers)
                      .values({ gameId: thisGame.id, userId: user.value })
                      .onConflictDoNothing();
                    await db
                      .insert(userPlayers)
                      .values({ discordId: user.value, characterId });

                    const [character] = await db
                      .select()
                      .from(characters)
                      .where(eq(characters.id, characterId));

                    return {
                      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                      data: {
                        content: character
                          ? `Assigned ${character.name} to <@${user.value}>`
                          : "Character not found",
                        flags: InteractionResponseFlags.EPHEMERAL,
                      },
                    };
                  } catch (err) {
                    console.error(err);
                  }
                }
                case "tokens": {
                  const [char, tokens] = z
                    .tuple([schema.stringOption, schema.integerOption])
                    .parse(option1.options);

                  const [thisGame] = await db
                    .select()
                    .from(games)
                    .where(eq(games.discordServerId, guild_id));
                  if (!thisGame) throw new Error("No game in this server");

                  const { id } = (
                    await db
                      .select()
                      .from(characters)
                      .where(
                        and(
                          eq(characters.name, char.value.toLowerCase()),
                          eq(characters.gameId, thisGame.id)
                        )
                      )
                  )[0];

                  if (!id) throw new Error("Character not found!");

                  await db
                    .update(tokenCount)
                    .set({ tokens: tokens.value })
                    .where(eq(tokenCount.characterId, id));

                  return {
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                      content: `${capitalize(char.value)} has ${
                        tokens.value
                      } tokens`,
                      flags: InteractionResponseFlags.EPHEMERAL,
                    },
                  };
                }
                default:
                  throw new Error("Missing assign subcommand!");
              }
            }
            case "create": {
              const option1 = schema.subcommand.parse(option0.options?.[0]);

              switch (option1.name) {
                case "character": {
                  const [{ value: name }] = z
                    .tuple([schema.stringOption])
                    .parse(option1.options);

                  const [thisGame] = await selectGame.execute({ guild_id });

                  if (!thisGame) throw new Error("No game in this server");

                  const [{ id: characterId }] = await db
                    .insert(characters)
                    .values({
                      name: name.toLowerCase(),
                      gameId: thisGame.id,
                    })
                    .returning();
                  await db.insert(tokenCount).values({ characterId });

                  return {
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                      content: `Created new character: ${name}`,
                      flags: InteractionResponseFlags.EPHEMERAL,
                    },
                  };
                }
                default:
                  throw new Error("wtf");
              }
            }
            default:
              throw new Error("Missing gm subcommand!");
          }
        }
        case "moves":
          const [{ value: character }, { value: action }, { value: moves }] = z
            .tuple([
              schema.stringOption,
              schema.stringOption,
              schema.stringOption,
            ])
            .parse(data.options);
          if (action === "list") {
            const m = movesSchema.parse(moves);
            const general = generalMoves[m];
            const c = nerdSchema.parse(character);
            const unique = uniqueMoves[c][m];

            return {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `${general.concat(unique).map((g) => `\n- ${g}`)}`,
                components: [
                  {
                    type: MessageComponentTypes.ACTION_ROW,
                    components: [
                      {
                        type: MessageComponentTypes.BUTTON,
                        label: "Make a Strong Move",
                        style: 2,
                        emoji: {
                          id: null,
                          name: "💪",
                          animated: false,
                        },
                        custom_id: `move-strong-${c}`,
                      },
                      {
                        type: MessageComponentTypes.BUTTON,
                        label: "Make a Normal Move",
                        style: 2,
                        emoji: {
                          id: null,
                          name: "😐",
                          animated: false,
                        },
                        custom_id: `move-normal-${c}`,
                      },
                      {
                        type: MessageComponentTypes.BUTTON,
                        label: "Make a Weak Move",
                        style: 2,
                        emoji: {
                          id: null,
                          name: "😭",
                          animated: false,
                        },
                        custom_id: `move-weak-${c}`,
                      },
                    ],
                  },
                ],
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            };
          } else if (action === "do") {
            const c = nerdSchema.parse(character);

            const [thisGame] = await selectGame.execute({ guild_id });

            if (!thisGame) throw new Error("No game in this server");

            const count = await selectCharacterTokens.get({
              name: c,
              gameId: thisGame.id,
            });

            if (!count) throw new Error("Character not found!");
            if (!count.tokenCount) throw new Error("Tokens not found!");

            if (moves === "strongMoves") {
              if (count.tokenCount.tokens < 1) {
                return {
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: {
                    content: `${capitalize(
                      c
                    )} can't make a strong move without a token!`,
                  },
                };
              } else {
                await db
                  .update(tokenCount)
                  .set({ tokens: count.tokenCount.tokens - 1 })
                  .where(
                    eq(tokenCount.characterId, count.tokenCount.characterId)
                  );
              }

              return {
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: `${capitalize(
                    c
                  )} has spent a token and made a strong move!`,
                },
              };
            } else if (moves === "weakMoves") {
              await db
                .update(tokenCount)
                .set({ tokens: count.tokenCount.tokens + 1 })
                .where(
                  eq(tokenCount.characterId, count.tokenCount.characterId)
                );

              return {
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: `${capitalize(
                    c
                  )} has made a weak move and earned a token!`,
                },
              };
            } else if (moves === "normalMoves") {
              return {
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: `${capitalize(c)} has made a normal move.`,
                },
              };
            } else if (moves === "socialMoves") {
              return {
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: `${capitalize(
                    c
                  )} has made a normal move? Ask Chris what happens next.`,
                },
              };
            }
          }
          break;
        case "list":
          {
            const option1 = schema.subcommand.parse(data.options?.[0]);

            const [thisGame] = await selectGame.execute({ guild_id });
            if (!thisGame) throw new Error("No game in this server");

            if (option1.name === "players") {
              try {
                const playerList = await db
                  .select()
                  .from(users)
                  .innerJoin(gamesUsers, eq(gamesUsers.userId, users.discordId))
                  .where(eq(gamesUsers.gameId, thisGame.id));

                return {
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: {
                    content:
                      "- " + playerList.map((p) => `<@${p.users.discordId}>`),
                    flags: InteractionResponseFlags.EPHEMERAL,
                  },
                };
              } catch (err) {
                console.log(err);
              }
            }
          }
          break;
        default:
          throw new Error("wtf");
      }
    } else if (type === InteractionType.MESSAGE_COMPONENT) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `UNDER CONSTRUCTION`,
        },
      };
    } else if (type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
      const getOptions = (opts: schema.Option[]): schema.FlagOption[] => {
        return opts
          .map((o) => {
            const optWithOptions = schema.subcommandOption.safeParse(o);

            if (optWithOptions.success) {
              return optWithOptions.data.options
                ? getOptions(
                    schema.option.array().parse(optWithOptions.data.options)
                  )
                : [];
            } else {
              return schema.flagOption.parse(o);
            }
          })
          .flat();
      };
      const autoCompleteInteraction =
        schema.autoCompleteInteraction.parse(interaction);
      const { guild_id } = interaction;

      const flatOptions = getOptions(
        autoCompleteInteraction.data.options ?? []
      );
      const focusedOption = flatOptions.find((o) => {
        const opt = schema.autoCompletableOption.safeParse(o);
        if (opt.success) return opt.data.focused;
        return false;
      });

      if (focusedOption?.name === "character") {
        const { value } = schema.stringOption.parse(focusedOption);

        const filteredCharacters = await db
          .select()
          .from(characters)
          .innerJoin(games, eq(characters.gameId, games.id))
          .where(
            and(
              eq(games.discordServerId, guild_id),
              like(characters.name, `%${value.toLowerCase()}%`)
            )
          );

        return {
          type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
          data: {
            choices: filteredCharacters.map((c) => ({
              name: c.characters.name.toUpperCase(),
              value: c.characters.id,
            })),
          },
        };
      }

      return {
        type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: {
          choices: [],
        },
      };
    }
  });
