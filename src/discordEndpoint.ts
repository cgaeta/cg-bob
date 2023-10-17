import type { Elysia } from "elysia";
import { z } from "zod";
import {
  verifyKey,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  InteractionResponseFlags,
  EmojiInfo,
} from "discord-interactions";
import { eq, and, like } from "drizzle-orm";
import { AsyncLocalStorage } from "async_hooks";

import {
  discordRouterRoot,
  discordRoute,
  type DiscordContext,
  schema,
  sub,
  subgroup,
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

const emoji = (name: string) => ({ id: undefined, name });

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

const discordRouter = discordRouterRoot({
  applicationCmds: [
    discordRoute("list", sub, [
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
            content:
              "- " + characterList.map((c) => capitalize(c.name)).join("\n- "),
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
      const interaction = i.type === 2 ? i : YEET("Wrong interaction type");

      interaction.type;
      if (!thisGame) throw new Error("No game in this server");

      if (thisGame.gmDiscordId === interaction.member.user.id) {
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
              eq(games.discordServerId, interaction.guild_id),
              eq(userPlayers.discordId, interaction.member.user.id)
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
    discordRoute(
      "moves",
      z.tuple([schema.stringOption, schema.stringOption, schema.stringOption]),
      async ([char, act, mov]) => {
        const { thisGame } = context.getStore() ?? YEET("Fucking context");
        if (!thisGame) YEET("No game in this server");

        if (act.value === "list") {
          try {
            const m = movesSchema.parse(mov.value);
            const general = generalMoves[m];
            const [c] = await db
              .select()
              .from(characters)
              .where(eq(characters.id, char.value));
            if (!c) YEET("Character not found");
            const name = c.name;
            const isKey = (n: string): n is keyof typeof uniqueMoves =>
              n in uniqueMoves;
            const validName = isKey(name) ? name : YEET("Invalid name");
            const unique = uniqueMoves[validName][m];

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
                        emoji: emoji("💪"),
                        custom_id: `move-strong-${c.name}`,
                      },
                      {
                        type: MessageComponentTypes.BUTTON,
                        label: "Make a Normal Move",
                        style: 2,
                        emoji: emoji("😐"),
                        custom_id: `move-normal-${c.name}`,
                      },
                      {
                        type: MessageComponentTypes.BUTTON,
                        label: "Make a Weak Move",
                        style: 2,
                        emoji: emoji("😭"),
                        custom_id: `move-weak-${c.name}`,
                      },
                    ],
                  },
                ],
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            };
          } catch (err) {
            console.error(err);
          }
        } else if (act.value === "do") {
          const c = nerdSchema.parse(char.value);

          const thisGame = context.getStore()?.thisGame;
          if (!thisGame) throw new Error("No game in this server");

          const count = await selectCharacterTokens.get({
            name: c,
            gameId: thisGame.id,
          });

          if (!count) throw new Error("Character not found!");
          if (!count.tokenCount) throw new Error("Tokens not found!");

          let content;
          if (mov.value === "strongMoves") {
            if (count.tokenCount.tokens < 1) {
              content = `${capitalize(
                c
              )} can't make a strong move without a token!`;
            } else {
              await db
                .update(tokenCount)
                .set({ tokens: count.tokenCount.tokens - 1 })
                .where(
                  eq(tokenCount.characterId, count.tokenCount.characterId)
                );
            }

            content = `${capitalize(
              c
            )} has spent a token and made a strong move!`;
          } else if (mov.value === "weakMoves") {
            await db
              .update(tokenCount)
              .set({ tokens: count.tokenCount.tokens + 1 })
              .where(eq(tokenCount.characterId, count.tokenCount.characterId));

            content = `${capitalize(
              c
            )} has made a weak move and earned a token!`;
          } else if (mov.value === "normalMoves") {
            content = `${capitalize(c)} has made a normal move.`;
          } else if (mov.value === "socialMoves") {
            content = `${capitalize(
              c
            )} has made a normal move? Ask your GM what happens next.`;
          }

          return {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content },
          };
        }
      }
    ),
    discordRoute("gm", z.tuple([subgroup]), [
      discordRoute("game", z.tuple([sub]), [
        discordRoute("init", z.tuple([]), async () => {
          const { interaction: i } =
            context.getStore() ?? YEET("Fucking context");
          const interaction =
            i.type === InteractionType.APPLICATION_COMMAND
              ? i
              : YEET("Wrong interaction type");

          await db.insert(games).values({
            discordServerId: interaction.guild_id,
            gmDiscordId: interaction.member.user.id,
          });

          return {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Started a new game run by <@${interaction.member.user.id}>`,
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          };
        }),
        discordRoute("info", z.tuple([]), async () => {
          const thisGame =
            context.getStore()?.thisGame ?? YEET("Fucking context");

          return {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: thisGame
                ? `This server has a game run by <@${thisGame.gmDiscordId}>`
                : "No game running in this server",
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          };
        }),
      ]),
      discordRoute("assign", sub, [
        discordRoute(
          "character",
          z.tuple([schema.userOption, schema.stringOption]),
          async ([user, char]) => {
            const thisGame =
              context.getStore()?.thisGame ?? YEET("No game in this server");

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
              .values({ discordId: user.value, characterId: char.value });

            const [character] = await db
              .select()
              .from(characters)
              .where(eq(characters.id, char.value));

            return {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: character
                  ? `Assigned ${character.name} to <@${user.value}>`
                  : "Character not found",
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            };
          }
        ),
        discordRoute(
          "tokens",
          z.tuple([schema.stringOption, schema.integerOption]),
          async ([char, tkns]) => {
            const thisGame =
              context.getStore()?.thisGame ?? YEET("No game in this server");

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
              .set({ tokens: tkns.value })
              .where(eq(tokenCount.characterId, id));

            return {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `${capitalize(char.value)} has ${tkns.value} tokens`,
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            };
          }
        ),
      ]),
      discordRoute("create", sub, [
        discordRoute(
          "character",
          z.tuple([schema.stringOption]),
          async ([name]) => {
            const thisGame =
              context.getStore()?.thisGame ?? YEET("No game in this server");

            const [{ id: characterId }] = await db
              .insert(characters)
              .values({
                name: name.value.toLowerCase(),
                gameId: thisGame.id,
              })
              .returning();
            await db.insert(tokenCount).values({ characterId });

            return {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Created new character: ${name.value}`,
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            };
          }
        ),
      ]),
    ]),
  ],
  componentCmds: [discordRoute("meme", z.tuple([]), async () => {})],
  autocompleteCmds: [
    discordRoute("gm", subgroup, [
      discordRoute("assign", sub, [
        discordRoute(
          "tokens",
          z.tuple([schema.stringOption]).rest(schema.integerOption),
          async ([char]) => {
            const { interaction: i } =
              context.getStore() ?? YEET("Fucking context");
            const interaction =
              i.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE
                ? i
                : YEET("Wrong interaction type");

            const { guild_id } = interaction;

            const focusedOption = char.focused
              ? char
              : YEET("Option not focused");

            const { value } = focusedOption;

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
        ),
      ]),
    ]),
    discordRoute(
      "moves",
      z.tuple([schema.stringOption]).rest(schema.stringOption),
      async ([char]) => {
        const { interaction: i } =
          context.getStore() ?? YEET("Fucking context");
        const interaction =
          i.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE
            ? i
            : YEET("Wrong interaction type");

        const { guild_id } = interaction;

        const focusedOption = char.focused ? char : YEET("Option not focused");

        const { value } = focusedOption;

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
    ),
  ],
});

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

    console.log(req.body);

    const interaction = schema.interaction.parse(req.body);

    const res = await discordRouter(interaction, context, async () => {
      const [thisGame] =
        interaction.type === InteractionType.PING
          ? [undefined]
          : await selectGame.execute({ guild_id: interaction.guild_id });
      return { thisGame };
    });
    if (res) {
      return res;
    }
  });
