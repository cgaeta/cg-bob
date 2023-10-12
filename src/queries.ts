import { and, eq, sql } from "drizzle-orm";

import { db } from "./db";
import { characters, games, tokenCount } from "./db/schema";

export const selectAllCharacterTokens = db
  .select()
  .from(characters)
  .innerJoin(tokenCount, eq(characters.id, tokenCount.characterId))
  .where(eq(characters.gameId, sql.placeholder("gameId")))
  .prepare();

export const selectCharacterTokens = db
  .select()
  .from(characters)
  .innerJoin(tokenCount, eq(characters.id, tokenCount.characterId))
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
