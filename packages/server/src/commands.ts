import minimist from "minimist";
import { z } from "zod";

import { env } from "./env";

enum COMMAND_TYPE {
  CHAT_INPUT = 1,
  USER = 2,
  MESSAGE = 3,
}

enum OPTION_TYPE {
  SUB_COMMAND = 1,
  SUB_COMMAND_GROUP = 2,
  STRING = 3,
  INTEGER = 4,
  BOOLEAN = 5,
  USER = 6,
}

const GM_COMMANDS = {
  name: "gm",
  description: "Commands for the game master",
  options: [
    {
      name: "game",
      description: "Commands for the game",
      type: OPTION_TYPE.SUB_COMMAND_GROUP,
      options: [
        {
          name: "init",
          description: "Start a new game for the discord server",
          type: OPTION_TYPE.SUB_COMMAND,
        },
        {
          name: "info",
          description: "Information about the game",
          type: OPTION_TYPE.SUB_COMMAND,
        },
      ],
    },
    {
      name: "assign",
      description: "Assign something to a player or character",
      type: OPTION_TYPE.SUB_COMMAND_GROUP,
      options: [
        {
          name: "character",
          description: "Assign a character to a player",
          type: OPTION_TYPE.SUB_COMMAND,
          options: [
            {
              name: "user",
              description: "(Required) User to assign a character to",
              required: true,
              type: OPTION_TYPE.USER,
            },
            {
              name: "character",
              description: "(Required) Character to assign to user",
              required: true,
              autocomplete: true,
              type: OPTION_TYPE.STRING,
            },
          ],
        },
        {
          name: "tokens",
          description: "Set a character's tokens to a specified amount",
          type: OPTION_TYPE.SUB_COMMAND,
          options: [
            {
              name: "character",
              description: "(Required) Character to assign tokens to",
              required: true,
              autocomplete: true,
              type: OPTION_TYPE.STRING,
            },
            {
              name: "tokens",
              description: "(Required) Number of tokens to assign",
              required: true,
              type: OPTION_TYPE.INTEGER,
            },
          ],
        },
      ],
    },
    {
      name: "create",
      description: "Create a resource",
      type: OPTION_TYPE.SUB_COMMAND_GROUP,
      options: [
        {
          name: "character",
          description: "Create a new character",
          type: OPTION_TYPE.SUB_COMMAND,
          options: [
            {
              name: "name",
              description: "(Required) Character name",
              required: true,
              type: OPTION_TYPE.STRING,
            },
          ],
        },
      ],
    },
  ],
};

const COMMANDS = [
  {
    name: "tokens",
    description: "Render how many tokens the players have",
  },
  {
    name: "moves",
    description: "Render moves for a given character",
    type: OPTION_TYPE.SUB_COMMAND_GROUP,
    options: [
      {
        name: "list",
        description: "List character's moves",
        type: OPTION_TYPE.SUB_COMMAND,
        options: [
          {
            name: "character",
            description: "(Required) Name of character in game",
            required: true,
            type: OPTION_TYPE.STRING,
            autocomplete: true,
          },
          {
            name: "moveset",
            description: "(Required) Moveset to list or perform",
            required: true,
            choices: [
              { name: "strong", value: "strongMoves" },
              { name: "normal", value: "normalMoves" },
              { name: "weak", value: "weakMoves" },
              { name: "social", value: "socialMoves" },
            ],
            type: OPTION_TYPE.STRING,
          },
        ],
      },
      {
        name: "do",
        description: "Perform a move",
        type: OPTION_TYPE.SUB_COMMAND,
        options: [
          {
            name: "character",
            description: "(Required) Name of character in game",
            required: true,
            type: OPTION_TYPE.STRING,
            autocomplete: true,
          },
          {
            name: "moveset",
            description: "(Required) Moveset to list or perform",
            required: true,
            choices: [
              { name: "strong", value: "strongMoves" },
              { name: "normal", value: "normalMoves" },
              { name: "weak", value: "weakMoves" },
              { name: "social", value: "socialMoves" },
            ],
            type: OPTION_TYPE.STRING,
          },
        ],
      },
    ],
  },
  {
    name: "list",
    description: "List resources",
    options: [
      {
        name: "characters",
        description: "List characters",
        type: OPTION_TYPE.SUB_COMMAND,
      },
      {
        name: "players",
        description: "List players",
        type: OPTION_TYPE.SUB_COMMAND,
      },
    ],
  },
  GM_COMMANDS,
];

const baseUrl = "https://discord.com/api/v10";
const appEndpoint = `applications/${env.DISCORD_ID}`;
const globalEndpoint = `${appEndpoint}/commands`;
const guildEndpoint = `${appEndpoint}/guilds/${env.DISCORD_SERVER_ID}/commands`;

const headers = {
  Authorization: `Bot ${env.DISCORD_TOKEN}`,
  "Content-Type": "application/json; charset=UTF-8",
  "User-Agent": "DiscordBot (https://github.com/cgaeta/cg-bob, 1.0.0)",
};

const handleRes = async (res: Response) => {
  if (!res.ok) {
    const data = await res.json();
    throw new Error(JSON.stringify(data, undefined, 2));
  }

  console.log(JSON.stringify(await res.json(), undefined, 2));
};

const installGuildCommands = async (
  commands: {
    name: string;
    description: string;
  }[]
) => {
  const url = `${baseUrl}/${guildEndpoint}`;

  try {
    const res = await fetch(url, {
      headers,
      method: "PUT",
      body: JSON.stringify(commands),
    });

    handleRes(res);
  } catch (err) {
    console.error(err);
  }
};

const listGlobalCommands = async () => {
  const url = `${baseUrl}/${globalEndpoint}`;

  try {
    const res = await fetch(url, {
      headers,
      method: "GET",
    });

    handleRes(res);
  } catch (err) {
    console.error(err);
  }
};

const listGuildCommands = async () => {
  const url = `${baseUrl}/${guildEndpoint}`;

  try {
    const res = await fetch(url, { headers, method: "GET" });

    handleRes(res);
  } catch (err) {
    console.error(err);
  }
};

const deleteGlobalCommand = async (commandId: string) => {
  const url = `${baseUrl}/${globalEndpoint}/${commandId}`;

  try {
    const res = await fetch(url, {
      headers,
      method: "DELETE",
    });

    handleRes(res);
  } catch (err) {
    console.error(err);
  }
};

const argsSchema = z.object({
  _: z.array(z.enum(["install", "list", "delete"])).length(1),
  guild: z.boolean().optional(),
  id: z.string().optional(),
});

const args = argsSchema.parse(minimist(Bun.argv.slice(2)));

if (args._.includes("install") && args.guild) {
  installGuildCommands(COMMANDS);
} else if (args._.includes("list") && !args.guild) {
  listGlobalCommands();
} else if (args._.includes("list") && args.guild) {
  listGuildCommands();
} else if (args._.includes("delete") && args.id && !args.guild) {
  deleteGlobalCommand(args.id);
}
