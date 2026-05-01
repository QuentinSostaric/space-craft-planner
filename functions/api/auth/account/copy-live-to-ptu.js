import { errorResponse } from '../../../_shared/gameData.js';
import { handleAccountCopyLiveToPtuRequest } from '../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    return await handleAccountCopyLiveToPtuRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to copy LIVE account data to PTU.',
    );
  }
}
