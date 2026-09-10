import { handleMarketplaceRequest } from '../../../../_shared/auth.js';
export const onRequestPatch = ({ request, env, params }) => handleMarketplaceRequest(request, env, 'moderate', params.id);
