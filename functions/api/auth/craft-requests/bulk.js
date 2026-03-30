import { errorResponse } from '../../../_shared/gameData.js';
import { handleCraftRequestBulkDecisionRequest } from '../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    return await handleCraftRequestBulkDecisionRequest(
      context.request,
      context.env,
      context,
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to answer the craft requests.',
    );
  }
}
