import { errorResponse } from '../../../../_shared/gameData.js';
import { handleOrganizationSharedResourcesRequest } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    return await handleOrganizationSharedResourcesRequest(
      context.request,
      context.env,
      context.params.sid,
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to load shared organization resources.',
    );
  }
}
