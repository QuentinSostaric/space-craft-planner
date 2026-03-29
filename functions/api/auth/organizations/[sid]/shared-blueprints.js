import { errorResponse } from '../../../../_shared/gameData.js';
import { handleOrganizationSharedBlueprintsRequest } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    return await handleOrganizationSharedBlueprintsRequest(
      context.request,
      context.env,
      context.params.sid,
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to load shared organization blueprints.',
    );
  }
}
