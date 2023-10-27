import { and, eq, sql, like } from "drizzle-orm";

import { db } from "./db";
import {
  characters,
  games,
  tokenCount,
  users,
  gamesUsers,
  userPlayers,
} from "./db/schema";

const selectCharacters = () => db.select().from(characters);
const selectCharacterTokens = () =>
  selectCharacters().innerJoin(
    tokenCount,
    eq(characters.id, tokenCount.characterId)
  );

export const selectCharacterById = selectCharacters()
  .where(eq(characters.id, sql.placeholder("charId")))
  .prepare();

export const selectGameCharacters = selectCharacters()
  .where(eq(characters.gameId, sql.placeholder("gameId")))
  .prepare();

export const selectUserCharacter = selectCharacters()
  .innerJoin(userPlayers, eq(userPlayers.characterId, characters.id))
  .where(
    and(
      eq(characters.gameId, sql.placeholder("gameId")),
      eq(userPlayers.discordId, sql.placeholder("discordId"))
    )
  )
  .prepare();

export const selectAllCharacterTokens = selectCharacterTokens()
  .where(eq(characters.gameId, sql.placeholder("gameId")))
  .prepare();

export const searchCharacterByName = selectCharacters()
  .innerJoin(games, eq(characters.gameId, games.id))
  .where(
    and(
      eq(games.discordServerId, sql.placeholder("guild_id")),
      like(characters.name, sql.placeholder("name"))
    )
  )
  .prepare();

export const selectCharacterWithTokens = selectCharacterTokens()
  .where(
    and(
      eq(characters.name, sql.placeholder("name")),
      eq(characters.gameId, sql.placeholder("gameId"))
    )
  )
  .prepare();

export const selectGame = db
  .select()
  .from(games)
  .where(eq(games.discordServerId, sql.placeholder("guild_id")))
  .prepare();

export const selectGameUsers = db
  .select()
  .from(users)
  .innerJoin(gamesUsers, eq(gamesUsers.userId, users.discordId))
  .where(eq(gamesUsers.gameId, sql.placeholder("gameId")))
  .prepare();

export const updateTokenCount = (characterId: string, tokens: number) =>
  db
    .update(tokenCount)
    .set({ tokens })
    .where(eq(tokenCount.characterId, characterId));
