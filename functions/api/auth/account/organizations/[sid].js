import { errorResponse } from '../../../../_shared/gameData.js';
import { handleAccountOrganizationDeleteRequest } from '../../../../_shared/auth.js';

export async function onRequestDelete(context) {
  try {
    return await handleAccountOrganizationDeleteRequest(
      context.request,
      context.env,
      context.params.sid,
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to remove the organization.',
    );
  }
}
