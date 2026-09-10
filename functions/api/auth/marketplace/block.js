import { handleMarketplaceRequest } from '../../../_shared/auth.js';
export const onRequestPost = ({ request, env }) => handleMarketplaceRequest(request, env, 'block');
