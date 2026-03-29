import { errorResponse } from '../../../_shared/gameData.js';
import { handleAccountOrganizationsCreateRequest } from '../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    return await handleAccountOrganizationsCreateRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to add the organization.',
    );
  }
}
