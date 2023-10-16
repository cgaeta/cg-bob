import { z } from "zod";
import {
  ActionRow,
  InteractionResponseFlags,
  InteractionResponseType,
} from "discord-interactions";

export const member = z.object({
  user: z.object({
    id: z.string(),
    username: z.string(),
  }),
});

export const baseOption = z.object({
  name: z.string(),
});
type BaseOption<T extends number = number> = z.infer<typeof baseOption> & {
  type: T;
  focused?: boolean;
};

export const subcommand: z.ZodType<
  BaseOption<1> & { options?: BaseOption<3 | 4 | 5 | 6 | 7>[] }
> = z.object({
  type: z.literal(1),
  name: z.string(),
  options: z.lazy(() => flagOption.array()).optional(),
});
export const subcommandGroup: z.ZodType<
  BaseOption<2> & { options: BaseOption<1 | 2>[] }
> = z.object({
  type: z.literal(2),
  name: z.string(),
  options: z.lazy(() => subcommandOption.array().min(1)),
});
export const stringOption = z
  .object({
    type: z.literal(3),
    value: z.string(),
    focused: z.boolean().optional(),
  })
  .merge(baseOption);
export const integerOption = z
  .object({
    type: z.literal(4),
    value: z.number(),
    focused: z.boolean().optional(),
  })
  .merge(baseOption);
export const booleanOption = z
  .object({
    type: z.literal(5),
    value: z.boolean(),
  })
  .merge(baseOption);
export const userOption = z
  .object({
    type: z.literal(6),
    value: z.string(),
  })
  .merge(baseOption);

export const subcommandOption = z.union([subcommand, subcommandGroup]);

export const autoCompletableOption = z.discriminatedUnion("type", [
  stringOption,
  integerOption,
]);

export const flagOption = z.discriminatedUnion("type", [
  stringOption,
  integerOption,
  booleanOption,
  userOption,
]);
export type FlagOption = z.infer<typeof flagOption>;

export const option = z.union([subcommandOption, flagOption]);
export type Option = z.infer<typeof option>;

export const messageData = z.object({
  type: z.number(),
  name: z.string(),
  options: z.array(option).optional(),
});

export const discordOption = z.union([option, messageData]);
export const discordOptions = discordOption.array();
export type DiscordOptions = z.infer<typeof discordOptions>;

export const messageComponentInteractionData = z.object({
  custom_id: z.string(),
  values: z.array(z.string()),
});

export const ping = z.object({
  type: z.literal(1),
});

export const messageInteraction = z.object({
  type: z.literal(2),
  member: member,
  guild_id: z.string(),
  data: messageData,
});
export type MessageInteraction = z.infer<typeof messageInteraction>;

export const messageComponentInteraction = z.object({
  type: z.literal(3),
  member: member,
  guild_id: z.string(),
  data: messageComponentInteractionData,
});
export type MessageComponentInteraction = z.infer<
  typeof messageComponentInteraction
>;

export const autoCompleteInteraction = z.object({
  type: z.literal(4),
  guild_id: z.string(),
  data: messageData,
});

export const interaction = z.discriminatedUnion("type", [
  ping,
  messageInteraction,
  messageComponentInteraction,
  autoCompleteInteraction,
]);
export type Interaction = z.infer<typeof interaction>;

export type InteractionResponse = {
  type: InteractionResponseType;
  data: {
    content?: string;
    components?: ActionRow[];
    flags?: InteractionResponseFlags;
  };
};
