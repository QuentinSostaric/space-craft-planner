import { errorResponse } from '../../../_shared/gameData.js';
import { handleAccountSharedBlueprintsUpdateRequest } from '../../../_shared/auth.js';

export async function onRequestPut(context) {
  try {
    return await handleAccountSharedBlueprintsUpdateRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to update shared blueprints.',
    );
  }
}
