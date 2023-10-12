import "dotenv/config";
import Fastify from "fastify";
import formbody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import pug from "pug";
import * as z from "zod";
import * as path from "path";
import {
  verifyKey,
  InteractionResponseType,
  InteractionType,
} from "discord-interactions";

import { tokens, players } from "./tokens";
import { generalMoves, uniqueMoves } from "./moves";

const router = Fastify({ logger: true });

router.register(fastifyWs);
router.register(formbody);

const movesTemplate = pug.compileFile(
  path.join(__dirname, "./templates/components/moves.pug")
);

const charactersTemplate = pug.compileFile(
  path.join(__dirname, "./templates/components/characters.pug")
);

router.get("/", async (_req, reply) => {
  reply.type("text/html");
  return pug.renderFile(path.join(__dirname, "./templates/index.pug"), {
    tokens,
    checked: "azrael",
    generalMoves,
    uniqueMoves: uniqueMoves.none,
    disable: true,
  });
});

const nerdSchema = z.enum(players);

const moveBodySchema = z.object({
  nerd: nerdSchema,
});
router.get("/actions", async (req, reply) => {
  reply.type("text/html");
  const body = moveBodySchema.parse(req.query);
  return movesTemplate({
    generalMoves,
    uniqueMoves: uniqueMoves[body.nerd],
    disable: tokens[body.nerd] < 1,
    swapOb: false,
  });
});

router.post("/strong-move", async (req, reply) => {
  reply.type("text/html");
  const body = moveBodySchema.parse(req.body);
  if (tokens[body.nerd] < 1)
    throw new Error(`No strong move for ${body.nerd}!`);

  tokens[body.nerd] = tokens[body.nerd] - 1;
  return `${movesTemplate({
    generalMoves,
    uniqueMoves: uniqueMoves[body.nerd],
    disable: tokens[body.nerd] < 1,
    swapOb: true,
  })}
    ${charactersTemplate({
      tokens,
      checked: body.nerd,
    })}`;
});

router.post("/weak-move", async (req, reply) => {
  reply.type("text/html");
  const body = moveBodySchema.parse(req.body);
  tokens[body.nerd] = tokens[body.nerd] + 1;
  return `${movesTemplate({
    generalMoves,
    uniqueMoves: uniqueMoves[body.nerd],
    disable: false,
    swapOb: true,
  })}
  ${pug.renderFile(
    path.join(__dirname, "./templates/components/characters.pug"),
    {
      tokens,
      checked: body.nerd,
    }
  )}`;
});

const choiceSchema = z
  .object({
    name: z.string(),
    value: nerdSchema,
  })
  .optional();
router.post("/api/interactions", async (req, reply) => {
  const signature = req.headers["x-signature-ed25519"] as string;
  const timestamp = req.headers["x-signature-timestamp"] as string;
  const body = JSON.stringify(req.body as any);

  const isValid = verifyKey(
    body,
    signature,
    timestamp,
    process.env.DISCORD_PUBLIC_KEY as string
  );

  if (!isValid) {
    reply.status(401).send("Bad request signature");
    throw new Error("Bad request signature");
  }
  const { type, id, data } = req.body as any;

  if (type === InteractionType.PING) {
    return reply.send({ type: InteractionResponseType.PONG });
  } else if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    const choice = choiceSchema.parse(data.options?.[0]);

    if (name === "tokens") {
      return reply.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: choice
            ? `${choice.value.slice(0, 1).toUpperCase()}${choice.value.slice(
                1
              )} has ${tokens[choice.value]} tokens`
            : JSON.stringify(tokens),
        },
      });
    }
  }
});

const start = async () => {
  try {
    await router.listen({ port: 3000 });
  } catch (err) {
    router.log.error(err);
    process.exit(1);
  }
};
start();
