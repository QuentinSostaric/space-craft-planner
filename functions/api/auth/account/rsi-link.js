import { errorResponse } from '../../../_shared/gameData.js';
import {
  handleRsiLinkRequest,
  handleRsiUnlinkRequest,
} from '../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    return await handleRsiLinkRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to link the RSI account.',
    );
  }
}

export async function onRequestDelete(context) {
  try {
    return await handleRsiUnlinkRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to unlink the RSI account.',
    );
  }
}
