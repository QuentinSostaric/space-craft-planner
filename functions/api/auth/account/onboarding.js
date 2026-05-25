import { errorResponse } from '../../../_shared/gameData.js';
import { handleAccountOnboardingUpdateRequest } from '../../../_shared/auth.js';

export async function onRequestPut(context) {
  try {
    return await handleAccountOnboardingUpdateRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      400,
      error instanceof Error ? error.message : 'Failed to update onboarding state.',
    );
  }
}
