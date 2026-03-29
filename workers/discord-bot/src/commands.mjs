export const DISCORD_APPLICATION_COMMAND_TYPE_CHAT_INPUT = 1;
export const DISCORD_APPLICATION_COMMAND_OPTION_TYPE_STRING = 3;
export const DISCORD_INTERACTION_TYPE_PING = 1;
export const DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND = 2;
export const DISCORD_INTERACTION_TYPE_MESSAGE_COMPONENT = 3;
export const DISCORD_INTERACTION_RESPONSE_TYPE_PONG = 1;
export const DISCORD_INTERACTION_RESPONSE_TYPE_CHANNEL_MESSAGE_WITH_SOURCE = 4;
export const DISCORD_INTERACTION_RESPONSE_TYPE_UPDATE_MESSAGE = 7;
export const DISCORD_MESSAGE_FLAG_EPHEMERAL = 1 << 6;

export const COMMAND_DEFINITIONS = [
  {
    name: 'ping',
    description: 'Check whether the ItemFab Discord bot is online.',
    type: DISCORD_APPLICATION_COMMAND_TYPE_CHAT_INPUT,
  },
  {
    name: 'open',
    description: 'Get a direct link to an ItemFab page.',
    type: DISCORD_APPLICATION_COMMAND_TYPE_CHAT_INPUT,
    options: [
      {
        type: DISCORD_APPLICATION_COMMAND_OPTION_TYPE_STRING,
        name: 'page',
        description: 'The ItemFab page to open.',
        required: true,
        choices: [
          { name: 'Site', value: 'site' },
          { name: 'Account', value: 'account' },
          { name: 'Blueprints', value: 'blueprints' },
          { name: 'Organizations', value: 'organizations' },
          { name: 'Resources', value: 'resources' },
          { name: 'Missions', value: 'missions' },
        ],
      },
    ],
  },
  {
    name: 'dataset',
    description: 'Show the latest imported dataset summary for LIVE or PTU.',
    type: DISCORD_APPLICATION_COMMAND_TYPE_CHAT_INPUT,
    options: [
      {
        type: DISCORD_APPLICATION_COMMAND_OPTION_TYPE_STRING,
        name: 'channel',
        description: 'Dataset channel to inspect.',
        required: true,
        choices: [
          { name: 'LIVE', value: 'live' },
          { name: 'PTU', value: 'ptu' },
        ],
      },
    ],
  },
  {
    name: 'help',
    description: 'See what the ItemFab Discord bot currently supports.',
    type: DISCORD_APPLICATION_COMMAND_TYPE_CHAT_INPUT,
  },
];

export function getCommandOption(interaction, optionName) {
  const options = interaction?.data?.options ?? [];
  return options.find((option) => option?.name === optionName) ?? null;
}
