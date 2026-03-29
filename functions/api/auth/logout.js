import { errorResponse } from '../../_shared/gameData.js';
import { handleLogoutRequest } from '../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    return handleLogoutRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to clear auth session.',
    );
  }
}
