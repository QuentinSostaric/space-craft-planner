import * as auth from './auth.js';
import { errorResponse } from './gameData.js';
import { isTrustedAuthMutationRequest } from '../../shared/authRequestSecurity.mjs';

const routes = [
  ['GET', /^\/api\/auth\/account$/, auth.handleAccountRequest],
  ['PUT', /^\/api\/auth\/account$/, auth.handleAccountUpdateRequest],
  ['DELETE', /^\/api\/auth\/account$/, auth.handleDeleteAccountRequest],
  ['PUT', /^\/api\/auth\/account\/onboarding$/, auth.handleAccountOnboardingUpdateRequest],
  ['PUT', /^\/api\/auth\/account\/shared-blueprints$/, auth.handleAccountSharedBlueprintsUpdateRequest],
  ['PUT', /^\/api\/auth\/account\/resources$/, auth.handleAccountResourcesUpdateRequest],
  ['PUT', /^\/api\/auth\/account\/shared-resources$/, auth.handleAccountSharedResourcesUpdateRequest],
  ['POST', /^\/api\/auth\/account\/copy-live-to-ptu$/, auth.handleAccountCopyLiveToPtuRequest],
  ['POST', /^\/api\/auth\/account\/rsi-link\/challenge$/, auth.handleRsiVerificationChallengeRequest],
  ['POST', /^\/api\/auth\/account\/rsi-link$/, auth.handleRsiLinkRequest],
  ['DELETE', /^\/api\/auth\/account\/rsi-link$/, auth.handleRsiUnlinkRequest],
  ['POST', /^\/api\/auth\/account\/organizations$/, auth.handleAccountOrganizationsCreateRequest],
  ['DELETE', /^\/api\/auth\/account\/organizations\/([^/]+)$/, auth.handleAccountOrganizationDeleteRequest],
  ['DELETE', /^\/api\/auth\/organizations\/([^/]+)$/, auth.handleOrganizationDeleteRequest],
  ['PUT', /^\/api\/auth\/organizations\/([^/]+)\/sharing$/, auth.handleOrganizationSharingUpdateRequest],
  ['POST', /^\/api\/auth\/organizations\/([^/]+)\/claim$/, auth.handleOrganizationClaimRequest],
  ['POST', /^\/api\/auth\/organizations\/([^/]+)\/refresh$/, auth.handleOrganizationRefreshRequest],
  ['GET', /^\/api\/auth\/organizations\/([^/]+)\/shared-blueprints$/, auth.handleOrganizationSharedBlueprintsRequest],
  ['GET', /^\/api\/auth\/organizations\/([^/]+)\/shared-resources$/, auth.handleOrganizationSharedResourcesRequest],
  ['POST', /^\/api\/auth\/organizations\/([^/]+)\/craft-requests$/, auth.handleOrganizationCraftRequestCreateRequest],
  ['POST', /^\/api\/auth\/craft-requests\/bulk$/, auth.handleCraftRequestBulkDecisionRequest],
  ['POST', /^\/api\/auth\/craft-requests\/([^/]+)$/, auth.handleCraftRequestDecisionRequest],
  ['GET', /^\/api\/auth\/marketplace$/, (request, env) => auth.handleMarketplaceRequest(request, env, 'list')],
  ['PUT', /^\/api\/auth\/account\/marketplace$/, (request, env) => auth.handleMarketplaceRequest(request, env, 'update')],
  ['POST', /^\/api\/auth\/marketplace\/craft-requests$/, (request, env) => auth.handleMarketplaceRequest(request, env, 'create')],
  ['POST', /^\/api\/auth\/marketplace\/block$/, (request, env) => auth.handleMarketplaceRequest(request, env, 'block')],
  ['GET', /^\/api\/auth\/marketplace\/reports$/, (request, env) => auth.handleMarketplaceRequest(request, env, 'reports')],
  ['POST', /^\/api\/auth\/marketplace\/reports$/, (request, env) => auth.handleMarketplaceRequest(request, env, 'report')],
  ['PATCH', /^\/api\/auth\/marketplace\/reports\/([^/]+)$/, (request, env, id) => auth.handleMarketplaceRequest(request, env, 'moderate', id)],
];

export function isSharedAccountRoute(path) {
  return /^\/api\/auth\/(?:account|organizations|craft-requests|marketplace)(?:\/|$)/.test(path);
}

// Used by the Node dev server so scoped account behavior stays identical to
// Pages Functions. Individual Pages route files continue to call these same handlers.
export async function dispatchAccountRoute(request, env) {
  if (!isTrustedAuthMutationRequest(request, env)) return errorResponse(403, 'Untrusted request origin.');
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  for (const [method, pattern, handler] of routes) {
    const match = path.match(pattern);
    if (method !== request.method || !match) continue;
    try {
      return await handler(request, env, ...match.slice(1).map(decodeURIComponent));
    } catch (error) {
      return errorResponse(Number.isInteger(error?.status) ? error.status : 500, error instanceof Error ? error.message : 'Account request failed.');
    }
  }
  return errorResponse(routes.some(([, pattern]) => pattern.test(path)) ? 405 : 404, 'Account route not found.');
}
