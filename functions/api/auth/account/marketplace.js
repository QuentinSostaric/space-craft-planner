import { handleMarketplaceRequest } from '../../../_shared/auth.js';
export const onRequestPut = ({ request, env }) => handleMarketplaceRequest(request, env, 'update');
