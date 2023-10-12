import type { Config } from "drizzle-kit";

import { env } from "../env";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/turso/drizzle",
  driver: "turso",
  dbCredentials: {
    url: env.TURSO_URL,
    authToken: env.TURSO_KEY,
  },
} satisfies Config;
