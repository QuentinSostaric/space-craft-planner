import { errorResponse } from '../../../_shared/gameData.js';
import { handleCitizenIdCallbackRequest } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    return await handleCitizenIdCallbackRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to finish Citizen iD auth.',
    );
  }
}
