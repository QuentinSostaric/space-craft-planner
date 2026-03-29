import { errorResponse } from '../../_shared/gameData.js';
import {
  handleAccountRequest,
  handleAccountUpdateRequest,
  handleDeleteAccountRequest,
} from '../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    return await handleAccountRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to load the account.',
    );
  }
}

export async function onRequestPut(context) {
  try {
    return await handleAccountUpdateRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to update the account.',
    );
  }
}

export async function onRequestDelete(context) {
  try {
    return await handleDeleteAccountRequest(context.request, context.env);
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'Failed to delete the account.',
    );
  }
}
