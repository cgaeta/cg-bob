import { z } from "zod";
import {
  ButtonStyleTypes,
  InteractionResponseType,
  MessageComponentTypes,
  TextStyleTypes,
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
type BaseOption<T extends number = number> = typeof baseOption.shape & {
  type: z.ZodLiteral<T>;
};
type BaseObjectType<T extends number = number> = z.ZodObject<BaseOption<T>>;

type ZodOptions<T extends z.ZodDiscriminatedUnionOption<"type">[]> = z.ZodArray<
  z.ZodLazy<z.ZodDiscriminatedUnion<"type", T>>
>;

export const subcommand: z.ZodObject<
  BaseOption<1> & {
    options: z.ZodOptional<
      ZodOptions<
        [
          BaseObjectType<3>,
          BaseObjectType<4>,
          BaseObjectType<5>,
          BaseObjectType<6>
        ]
      >
    >;
  }
> = z.object({
  type: z.literal(1),
  name: z.string(),
  options: z.array(z.lazy(() => flagOption)).optional(),
});
export const subcommandGroup: z.ZodObject<
  BaseOption<2> & {
    options: ZodOptions<[BaseObjectType<1>, BaseObjectType<2>]>;
  }
> = z.object({
  type: z.literal(2),
  name: z.string(),
  options: z.array(z.lazy(() => subcommandOption)).min(1),
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

export const subcommandOption = z.discriminatedUnion("type", [
  subcommand,
  subcommandGroup,
]);

export const autoCompletableOption = z.discriminatedUnion("type", [
  stringOption,
  integerOption,
]);
export type AutoCompletableOption = z.infer<typeof autoCompletableOption>;

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
  component_type: z.number(),
  custom_id: z.string(),
  values: z.array(z.string()).optional(),
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
  member,
  guild_id: z.string(),
  message: z.object({
    interaction: z
      .object({
        name: z.string(),
        type: z.number(),
        user: z.object({
          id: z.string(),
        }),
      })
      .optional(),
  }),
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

export const modalSubmitInteraction = z.object({
  type: z.literal(5),
  member,
  guild_id: z.string(),
  data: z.object({
    custom_id: z.string(),
    components: z
      .object({
        type: z.literal(1),
        components: z
          .object({
            custom_id: z.string(),
            type: z.literal(4),
            value: z.string(),
          })
          .array()
          .length(1),
      })
      .array()
      .min(1)
      .max(5),
  }),
});
export type ModalSubmitInteraction = z.infer<typeof modalSubmitInteraction>;

export const interaction = z.discriminatedUnion("type", [
  ping,
  messageInteraction,
  messageComponentInteraction,
  autoCompleteInteraction,
  modalSubmitInteraction,
]);
export type Interaction = z.infer<typeof interaction>;

const emoji = z.object({
  id: z.string().optional(),
  name: z.string(),
  animated: z.boolean().optional(),
});

const textInput = z.object({
  type: z.literal(MessageComponentTypes.INPUT_TEXT),
  custom_id: z.string(),
  style: z.nativeEnum(TextStyleTypes),
  label: z.string(),
  min_length: z.number().optional(),
  max_length: z.number().optional(),
  required: z.boolean().optional(),
  value: z.string().optional(),
  placeholder: z.string().optional(),
});

const actionRowBase = z.object({
  type: z.literal(MessageComponentTypes.ACTION_ROW),
});

const actionRow = actionRowBase.merge(
  z.object({
    components: z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal(MessageComponentTypes.BUTTON),
          style: z.nativeEnum(ButtonStyleTypes),
          label: z.string(),
          emoji: emoji.optional(),
          custom_id: z.string().optional(),
          disabled: z.boolean().optional(),
        }),
        z.object({
          type: z.literal(MessageComponentTypes.STRING_SELECT),
          custom_id: z.string(),
          placeholder: z.string().optional(),
          min_values: z.number().optional(),
          max_values: z.number().optional(),
          disabled: z.boolean().optional(),
          options: z
            .object({
              label: z.string(),
              value: z.string(),
              description: z.string().optional(),
              emoji: emoji.optional(),
              default: z.boolean().optional(),
            })
            .array(),
        }),
        textInput,
      ])
      .array(),
  })
);

export const messageInteractionResponse = z.object({
  type: z.literal(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE),
  data: z.object({
    content: z.string().optional(),
    components: actionRow.array().optional(),
    flags: z.number().optional(),
  }),
});
export type MessageInteractionResponse = z.infer<
  typeof messageInteractionResponse
>;

export const autoCompleteInteractionResponse = z.object({
  type: z.literal(
    InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT
  ),
  data: z.object({
    choices: z
      .object({
        name: z.string(),
        value: z.string(),
      })
      .array(),
  }),
});
export type AutoCompleteInteractionResponse = z.infer<
  typeof autoCompleteInteractionResponse
>;

export const modalInteractionResponse = z.object({
  type: z.literal(InteractionResponseType.MODAL),
  data: z.object({
    custom_id: z.string(),
    title: z.string(),
    components: actionRowBase
      .merge(z.object({ components: textInput.array().length(1) }))
      .array()
      .min(1)
      .max(5),
  }),
});
export type ModalInteractionResponse = z.infer<typeof modalInteractionResponse>;

export const interactionResponse = z.discriminatedUnion("type", [
  messageInteractionResponse,
  autoCompleteInteractionResponse,
  modalInteractionResponse,
]);
export type InteractionResponse = z.infer<typeof interactionResponse>;
