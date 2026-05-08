import { buildBlueprintCatalogPage } from '../../../../../shared/blueprintCatalog.mjs';
import {
  errorResponse,
  getDatasetVisibilityNamespace,
  isValidChannel,
  publicApiJsonResponse,
} from '../../../../_shared/gameData.js';
import {
  CACHE_CONTROL_MUTABLE,
  getChannelChunk,
} from '../../../../_shared/r2Datasets.js';
import { getBlueprintCatalogAliasKey, getJson } from '../../../../_shared/r2Store.js';

export async function onRequestGet(context) {
  const { channel } = context.params;

  if (!isValidChannel(channel)) {
    return errorResponse(404, `Unknown dataset channel "${channel}".`);
  }

  try {
    const core = await getChannelChunk(context.request, context.env, channel, 'core');
    if (!core) {
      return errorResponse(404, `No published dataset for channel "${channel}".`);
    }

    const namespace = getDatasetVisibilityNamespace(context.request, context.env);
    const catalog = await getJson(
      context.env,
      getBlueprintCatalogAliasKey(namespace, channel),
      60,
      context.request,
    );

    if (!catalog) {
      return errorResponse(404, `No blueprint catalog for channel "${channel}".`);
    }

    return publicApiJsonResponse(buildBlueprintCatalogPage(catalog, context.request.url), {
      headers: {
        'Cache-Control': CACHE_CONTROL_MUTABLE,
      },
    });
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load blueprint catalog.');
  }
}
