import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzleBun } from "drizzle-orm/bun-sqlite";
import { createClient } from "@libsql/client";
import { Database } from "bun:sqlite";

import { env } from "./env";

const getTursoDb = () => {
  const client = createClient({
    url: env.TURSO_URL || "",
    authToken: env.TURSO_KEY,
  });

  return drizzleLibsql(client);
};

const getLocalDb = () => {
  const db = new Database("sqlite.db", { create: true });
  return drizzleBun(db);
};

export const db = env.NODE_ENV === "development" ? getLocalDb() : getTursoDb();
