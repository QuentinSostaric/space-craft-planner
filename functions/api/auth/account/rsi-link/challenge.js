import { errorResponse } from '../../../../_shared/gameData.js';
import { handleRsiVerificationChallengeRequest } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    return await handleRsiVerificationChallengeRequest(context.request, context.env);
  } catch {
    return errorResponse(500, 'Failed to create the RSI verification code.');
  }
}
