import "dotenv/config";
import { z } from "zod";

export const env = z
  .object({
    DISCORD_ID: z.string(),
    DISCORD_PUBLIC_KEY: z.string(),
    DISCORD_TOKEN: z.string(),
    DISCORD_SERVER_ID: z.string(),
    TURSO_KEY: z.string(),
    TURSO_URL: z.string(),
    NODE_ENV: z.string().optional(),
  })
  .parse(process.env);
