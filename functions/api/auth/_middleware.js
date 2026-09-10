import { isTrustedAuthMutationRequest } from '../../../shared/authRequestSecurity.mjs';
import { errorResponse } from '../../_shared/gameData.js';
import { MarketplaceError } from '../../../shared/marketplaceStorage.mjs';

export async function onRequest(context) {
  if (!isTrustedAuthMutationRequest(context.request, context.env)) {
    return errorResponse(403, 'Untrusted request origin.');
  }
  try { return await context.next(); }
  catch (error) {
    if (error instanceof MarketplaceError) return errorResponse(error.status, error.message);
    return errorResponse(500, 'Account request failed. Please try again.');
  }
}
