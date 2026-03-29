import { errorResponse } from '../../../_shared/gameData.js';
import { handleCraftRequestDecisionRequest } from '../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    return await handleCraftRequestDecisionRequest(
      context.request,
      context.env,
      context.params.requestId,
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to answer the craft request.',
    );
  }
}
