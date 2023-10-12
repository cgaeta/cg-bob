import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const games = sqliteTable("game", {
  id: text("id")
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  discordServerId: text("discordServerId").notNull(),
  gmDiscordId: text("gmDiscordId")
    .references(() => users.discordId)
    .notNull(),
});

export const characters = sqliteTable("characters", {
  id: text("id")
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  name: text("name").notNull(),
  gameId: text("gameId")
    .references(() => games.id)
    .notNull(),
});

export const users = sqliteTable("users", {
  discordId: text("discordId").primaryKey(),
});

export const userPlayers = sqliteTable(
  "userPlayers",
  {
    discordId: text("discordId")
      .references(() => users.discordId)
      .notNull(),
    characterId: text("characterId")
      .references(() => characters.id)
      .notNull(),
  },
  (t) => ({
    unq: unique().on(t.discordId, t.characterId),
  })
);

export const gamesUsers = sqliteTable(
  "gameUsers",
  {
    gameId: text("gameId")
      .references(() => games.id)
      .notNull(),
    userId: text("userId")
      .references(() => users.discordId)
      .notNull(),
  },
  (t) => ({
    unq: unique().on(t.gameId, t.userId),
  })
);

export const tokenCount = sqliteTable(
  "tokenCount",
  {
    characterId: text("characterId")
      .references(() => characters.id)
      .notNull(),
    tokens: integer("tokens").notNull().default(0),
  },
  (t) => ({
    unq: unique().on(t.characterId),
  })
);

export const moves = sqliteTable("moves", {
  id: text("id")
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  category: text("category", {
    enum: ["weak", "normal", "strong", "social"],
  }).notNull(),
  description: text("description").notNull(),
});
