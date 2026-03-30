import { errorResponse } from '../../../../_shared/gameData.js';
import { handleOrganizationSharingUpdateRequest } from '../../../../_shared/auth.js';

export async function onRequestPut(context) {
  try {
    return await handleOrganizationSharingUpdateRequest(
      context.request,
      context.env,
      context.params.sid,
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to update organization blueprint sharing.',
    );
  }
}
