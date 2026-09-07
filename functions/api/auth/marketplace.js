import { handleMarketplaceRequest } from '../../_shared/auth.js';
export const onRequestGet = ({ request, env }) => handleMarketplaceRequest(request, env, 'list');
