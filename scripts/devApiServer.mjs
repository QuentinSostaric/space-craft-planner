import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createR2Client,
  getJsonObject,
  getR2Config,
} from '../shared/r2Storage.mjs';

const PORT = 8788;

function loadDevVars() {
  const envPath = resolve('.dev.vars');
  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, status, message) {
  sendJson(response, status, { message });
}

loadDevVars();

const r2Config = getR2Config(process.env);
const client = createR2Client(process.env);

async function readJson(key) {
  return getJsonObject(client, r2Config.bucketName, key);
}

async function listDatasets(response) {
  const index = await readJson('indexes/all.json');
  sendJson(
    response,
    200,
    index ?? {
      datasets: [],
      defaultChannel: null,
      latestByChannel: { live: null, ptu: null },
    },
  );
}

async function getDatasetByChannel(response, channel) {
  const dataset = await readJson(`aliases/all/${channel}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No published dataset for channel "${channel}".`);
    return;
  }

  sendJson(response, 200, { dataset });
}

async function getDatasetById(response, datasetId) {
  const dataset = await readJson(`datasets/${datasetId}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No published dataset for id "${datasetId}".`);
    return;
  }

  sendJson(response, 200, { dataset });
}

async function getChunkById(response, datasetId, chunkName, payloadBuilder) {
  const dataset = await readJson(`datasets/${datasetId}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No dataset for id "${datasetId}".`);
    return;
  }

  const chunk = await readJson(`datasets/${datasetId}/${chunkName}.json`);
  sendJson(response, 200, payloadBuilder(chunk));
}

async function getBlueprintDetail(response, datasetId, blueprintId) {
  const dataset = await readJson(`datasets/${datasetId}/core.json`);
  if (!dataset) {
    sendError(response, 404, `No dataset for id "${datasetId}".`);
    return;
  }

  const blueprint = await readJson(
    `datasets/${datasetId}/blueprints/${encodeURIComponent(blueprintId)}.json`,
  );
  if (!blueprint) {
    sendError(response, 404, `No blueprint "${blueprintId}" for dataset "${datasetId}".`);
    return;
  }

  sendJson(response, 200, {
    datasetId,
    blueprint,
  });
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendError(response, 400, 'Missing request URL.');
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? '127.0.0.1'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      response.end();
      return;
    }

    if (request.method !== 'GET') {
      sendError(response, 405, 'Method not allowed.');
      return;
    }

    if (path === '/api/game-data/public') {
      await listDatasets(response);
      return;
    }

    const blueprintDetailMatch = path.match(
      /^\/api\/game-data\/public\/by-id\/([^/]+)\/blueprints\/([^/]+)$/,
    );
    if (blueprintDetailMatch) {
      await getBlueprintDetail(
        response,
        decodeURIComponent(blueprintDetailMatch[1]),
        decodeURIComponent(blueprintDetailMatch[2]),
      );
      return;
    }

    const byIdResourceDataMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)\/resource-data$/);
    if (byIdResourceDataMatch) {
      const datasetId = decodeURIComponent(byIdResourceDataMatch[1]);
      await getChunkById(response, datasetId, 'resource-data', (chunk) => ({
        datasetId,
        resourceInsights: chunk?.resourceInsights ?? null,
        materialSources: chunk?.materialSources ?? null,
      }));
      return;
    }

    const byIdShipComponentsMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)\/ship-components$/);
    if (byIdShipComponentsMatch) {
      const datasetId = decodeURIComponent(byIdShipComponentsMatch[1]);
      await getChunkById(response, datasetId, 'ship-components', (chunk) => ({
        datasetId,
        shipComponents: chunk?.shipComponents ?? null,
      }));
      return;
    }

    const byIdMissionRewardsMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)\/mission-rewards$/);
    if (byIdMissionRewardsMatch) {
      const datasetId = decodeURIComponent(byIdMissionRewardsMatch[1]);
      await getChunkById(response, datasetId, 'mission-rewards', (chunk) => ({
        datasetId,
        missionRewards: chunk?.missionRewards ?? null,
      }));
      return;
    }

    const byIdChangelogMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)\/changelog$/);
    if (byIdChangelogMatch) {
      const datasetId = decodeURIComponent(byIdChangelogMatch[1]);
      await getChunkById(response, datasetId, 'changelog', (chunk) => ({
        datasetId,
        changelog: chunk?.changelog ?? null,
      }));
      return;
    }

    const datasetByIdMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)$/);
    if (datasetByIdMatch) {
      await getDatasetById(response, decodeURIComponent(datasetByIdMatch[1]));
      return;
    }

    const resourceDataByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/resource-data$/);
    if (resourceDataByChannelMatch) {
      const channel = resourceDataByChannelMatch[1];
      const dataset = await readJson(`aliases/all/${channel}/core.json`);
      if (!dataset) {
        sendError(response, 404, `No dataset for channel "${channel}".`);
        return;
      }
      const chunk = await readJson(`aliases/all/${channel}/resource-data.json`);
      sendJson(response, 200, {
        datasetId: dataset.datasetId,
        resourceInsights: chunk?.resourceInsights ?? null,
        materialSources: chunk?.materialSources ?? null,
      });
      return;
    }

    const shipComponentsByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/ship-components$/);
    if (shipComponentsByChannelMatch) {
      const channel = shipComponentsByChannelMatch[1];
      const dataset = await readJson(`aliases/all/${channel}/core.json`);
      if (!dataset) {
        sendError(response, 404, `No dataset for channel "${channel}".`);
        return;
      }
      const chunk = await readJson(`aliases/all/${channel}/ship-components.json`);
      sendJson(response, 200, {
        datasetId: dataset.datasetId,
        shipComponents: chunk?.shipComponents ?? null,
      });
      return;
    }

    const missionRewardsByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/mission-rewards$/);
    if (missionRewardsByChannelMatch) {
      const channel = missionRewardsByChannelMatch[1];
      const dataset = await readJson(`aliases/all/${channel}/core.json`);
      if (!dataset) {
        sendError(response, 404, `No dataset for channel "${channel}".`);
        return;
      }
      const chunk = await readJson(`aliases/all/${channel}/mission-rewards.json`);
      sendJson(response, 200, {
        datasetId: dataset.datasetId,
        missionRewards: chunk?.missionRewards ?? null,
      });
      return;
    }

    const changelogByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/changelog$/);
    if (changelogByChannelMatch) {
      const channel = changelogByChannelMatch[1];
      const dataset = await readJson(`aliases/all/${channel}/core.json`);
      if (!dataset) {
        sendError(response, 404, `No dataset for channel "${channel}".`);
        return;
      }
      const chunk = await readJson(`aliases/all/${channel}/changelog.json`);
      sendJson(response, 200, {
        datasetId: dataset.datasetId,
        changelog: chunk?.changelog ?? null,
      });
      return;
    }

    const datasetByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)$/);
    if (datasetByChannelMatch) {
      await getDatasetByChannel(response, datasetByChannelMatch[1]);
      return;
    }

    sendError(response, 404, 'Not found.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local API failure.';
    console.error(`[dev-api] ${message}`);
    sendError(response, 500, message);
  }
});

server.on('error', (error) => {
  console.error(`[dev-api] ${error instanceof Error ? error.message : 'Local API server failed.'}`);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-api] ready on http://127.0.0.1:${PORT}`);
});
