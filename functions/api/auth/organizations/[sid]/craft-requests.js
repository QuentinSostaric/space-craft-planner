import { errorResponse } from '../../../../_shared/gameData.js';
import { handleOrganizationCraftRequestCreateRequest } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    return await handleOrganizationCraftRequestCreateRequest(
      context.request,
      context.env,
      context.params.sid,
      context,
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to create the craft request.',
    );
  }
}
