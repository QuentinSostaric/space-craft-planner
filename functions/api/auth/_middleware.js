import { isTrustedAuthMutationRequest } from '../../../shared/authRequestSecurity.mjs';
import { errorResponse } from '../../_shared/gameData.js';

export async function onRequest(context) {
  if (!isTrustedAuthMutationRequest(context.request, context.env)) {
    return errorResponse(403, 'Untrusted request origin.');
  }
  return context.next();
}
