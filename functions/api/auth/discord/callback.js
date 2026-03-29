import { errorResponse } from '../../../_shared/gameData.js';
import { handleDiscordCallbackRequest } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    return await handleDiscordCallbackRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to finish Discord auth.',
    );
  }
}
