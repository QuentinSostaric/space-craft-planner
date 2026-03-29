import { errorResponse } from '../../../../_shared/gameData.js';
import { handleOrganizationClaimRequest } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    return await handleOrganizationClaimRequest(
      context.request,
      context.env,
      context.params.sid,
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to claim the organization.',
    );
  }
}
