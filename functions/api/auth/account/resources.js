import { errorResponse } from '../../../_shared/gameData.js';
import { handleAccountResourcesUpdateRequest } from '../../../_shared/auth.js';

export async function onRequestPut(context) {
  try {
    return await handleAccountResourcesUpdateRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to update account resources.',
    );
  }
}
