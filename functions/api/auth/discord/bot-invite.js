import { errorResponse } from '../../../_shared/gameData.js';
import { handleDiscordBotInviteRequest } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    return handleDiscordBotInviteRequest(context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to start Discord bot invite.',
    );
  }
}
