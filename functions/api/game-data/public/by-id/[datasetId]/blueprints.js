import { buildBlueprintCatalogPage } from '../../../../../../shared/blueprintCatalog.mjs';
import { errorResponse, publicApiJsonResponse } from '../../../../../_shared/gameData.js';
import {
  CACHE_CONTROL_IMMUTABLE,
  getVisibleDatasetCore,
  TTL_IMMUTABLE,
} from '../../../../../_shared/r2Datasets.js';
import { getBlueprintCatalogKey, getJson } from '../../../../../_shared/r2Store.js';

export async function onRequestGet(context) {
  const { datasetId } = context.params;

  if (!datasetId) {
    return errorResponse(400, 'Missing datasetId.');
  }

  try {
    const dataset = await getVisibleDatasetCore(context.request, context.env, datasetId);
    if (!dataset) {
      return errorResponse(404, `No dataset for id "${datasetId}".`);
    }

    const catalog = await getJson(
      context.env,
      getBlueprintCatalogKey(datasetId),
      TTL_IMMUTABLE,
      context.request,
    );

    if (!catalog) {
      return errorResponse(404, `No blueprint catalog for dataset "${datasetId}".`);
    }

    return publicApiJsonResponse(
      buildBlueprintCatalogPage(catalog, context.request.url),
      {
        headers: {
          'Cache-Control': CACHE_CONTROL_IMMUTABLE,
        },
      },
    );
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to load blueprint catalog.');
  }
}
