import { errorResponse } from '../../../_shared/gameData.js';
import { handleCitizenIdLoginRequest } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    return await handleCitizenIdLoginRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to start Citizen iD auth.',
    );
  }
}
