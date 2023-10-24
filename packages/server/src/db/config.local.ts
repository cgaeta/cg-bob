import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/local/drizzle",
  driver: "turso",
  dbCredentials: {
    url: "file:sqlite.db",
  },
} satisfies Config;
