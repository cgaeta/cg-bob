import { type Elysia, ws } from "elysia";
import { html } from "@elysiajs/html";
import { z } from "zod";

import { players, tokens } from "./tokens";
import { generalMoves, uniqueMoves } from "./moves";
import { Characters } from "./templates/components/characters";
import { Moves } from "./templates/components/moves";

const index = () => (
  <html>
    <head>
      <meta charset="utf-8" />
      <link href="./styles.css" rel="stylesheet" />
      <script src="https://unpkg.com/htmx.org@1.9.5" defer="true" />
    </head>
    <body class="flex flex-col items-center bg-gray-700">
      <form class="flex gap-5 max-w-7xl m-5" hx-ws="connect:/ws">
        <div class="p-5 bg-gray-50 rounded">
          <Characters tokens={tokens} checked="azrael" />
        </div>
        <div class="p-5 bg-gray-50 rounded">
          <Moves moves={generalMoves} unique={uniqueMoves.none} disabled />
        </div>
      </form>
    </body>
  </html>
);

const nerdSchema = z.enum(players);

const moveBodySchema = z.object({
  nerd: nerdSchema,
});

export const siteEndpoints = (app: Elysia) =>
  app
    .use(html())
    .use(ws())
    .get("/", () => {
      return index();
    })
    .get("/actions", (req) => {
      const { nerd } = moveBodySchema.parse(req.query);
      return (
        <Moves
          moves={generalMoves}
          unique={uniqueMoves[nerd]}
          disabled={tokens[nerd] < 1}
        />
      );
    })
    .post("/weak-move", (req) => {
      const { nerd } = moveBodySchema.parse(req.body);
      tokens[nerd] = tokens[nerd] + 1;

      return (
        <>
          <Characters tokens={tokens} checked={nerd} />
          <Moves
            moves={generalMoves}
            unique={uniqueMoves[nerd]}
            disabled={false}
            swapOb
          />
        </>
      );
    })
    .ws("/ws", {
      open: (ws) => {
        ws.subscribe("tokens");
      },
      message: (ws, message) => {},
      close: (ws) => {
        ws.unsubscribe("tokens");
      },
    })
    .get("/styles.css", () => Bun.file("./src/templates/output.css").text());
