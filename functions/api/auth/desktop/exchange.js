import { handleDesktopExchangeRequest } from '../../../_shared/auth.js';

export async function onRequestPost({ request, env }) {
  return handleDesktopExchangeRequest(request, env);
}
