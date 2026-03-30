import { errorResponse } from '../../../_shared/gameData.js';
import { handleOrganizationDeleteRequest } from '../../../_shared/auth.js';

export async function onRequestDelete(context) {
  try {
    return await handleOrganizationDeleteRequest(
      context.request,
      context.env,
      context.params.sid,
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to delete the organization.',
    );
  }
}
