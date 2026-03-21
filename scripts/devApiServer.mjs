import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';

const PORT = 8788;

const SUMMARY_PROJECTION = {
  _id: 0,
  blueprints: 0,
  resources: 0,
  dismantling: 0,
  missionRewards: 0,
  changelog: 0,
  metrics: 0,
  sourceFiles: 0,
};

const CORE_PROJECTION = {
  _id: 0,
  missionRewards: 0,
  metrics: 0,
  sourceFiles: 0,
  installPath: 0,
  outputLabel: 0,
};

let clientPromise = null;
let cachedUri = null;

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

function getDbName() {
  return process.env.ATLAS_DB_NAME ?? 'craft';
}

function getCollectionName(channel) {
  return channel === 'live'
    ? (process.env.ATLAS_LIVE_COLLECTION ?? 'craft-live-data')
    : (process.env.ATLAS_PTU_COLLECTION ?? 'craft-ptu-data');
}

function toSummary(doc, channel) {
  return {
    channel,
    datasetId: doc.datasetId,
    label: doc.label,
    version: doc.version,
    branch: doc.branch ?? null,
    buildNumber: doc.buildNumber ?? null,
    published: Boolean(doc.published),
    blueprintCount: doc.blueprintCount ?? (doc.blueprints?.length ?? 0),
    resourceCount: doc.resourceCount ?? (doc.resources?.length ?? 0),
    hasDismantling: Boolean(doc.dismantlingAvailable ?? doc.dismantling),
    hasMissionRewards:
      (doc.missionRewardContractCount ?? 0) > 0 ||
      (doc.missionRewardFactionGroupCount ?? 0) > 0,
    missionRewardContractCount: doc.missionRewardContractCount ?? 0,
    missionRewardFactionGroupCount: doc.missionRewardFactionGroupCount ?? 0,
    importedAt: doc.importedAt ?? null,
    updatedAt: doc.updatedAt ?? doc.importedAt ?? null,
    hasChangelog: Boolean(doc.changelog),
  };
}

function normalizeCoreDataset(doc, channel) {
  return {
    channel,
    datasetId: doc.datasetId,
    label: doc.label,
    version: doc.version,
    branch: doc.branch ?? null,
    buildNumber: doc.buildNumber ?? null,
    published: Boolean(doc.published),
    blueprintCount: doc.blueprintCount ?? doc.blueprints?.length ?? 0,
    resourceCount: doc.resourceCount ?? doc.resources?.length ?? 0,
    blueprints: doc.blueprints ?? [],
    resources: doc.resources ?? [],
    resourceInsights: doc.resourceInsights ?? null,
    changelog: doc.changelog ?? null,
    dismantling: doc.dismantling ?? null,
    materialSources: doc.materialSources ?? null,
    missionRewards: null,
    importedAt: doc.importedAt ?? null,
    updatedAt: doc.updatedAt ?? doc.importedAt ?? null,
  };
}

function compareSummaries(a, b) {
  const dateA = Date.parse(a.updatedAt ?? a.importedAt ?? '') || 0;
  const dateB = Date.parse(b.updatedAt ?? b.importedAt ?? '') || 0;
  if (dateA !== dateB) {
    return dateB - dateA;
  }

  const buildA = Number(a.buildNumber ?? 0);
  const buildB = Number(b.buildNumber ?? 0);
  if (buildA !== buildB) {
    return buildB - buildA;
  }

  return String(b.version ?? '').localeCompare(String(a.version ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI in .dev.vars.');
  }

  if (!clientPromise || cachedUri !== uri) {
    cachedUri = uri;
    const client = new MongoClient(uri, {
      maxPoolSize: 4,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
    });
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(getDbName());
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

async function listDatasets(response) {
  const db = await getDb();
  const [liveDocs, ptuDocs] = await Promise.all([
    db.collection(getCollectionName('live'))
      .find({ published: true })
      .project(SUMMARY_PROJECTION)
      .sort({ importedAt: -1 })
      .toArray(),
    db.collection(getCollectionName('ptu'))
      .find({ published: true })
      .project(SUMMARY_PROJECTION)
      .sort({ importedAt: -1 })
      .toArray(),
  ]);

  const datasets = [
    ...liveDocs.map((doc) => toSummary(doc, 'live')),
    ...ptuDocs.map((doc) => toSummary(doc, 'ptu')),
  ].sort(compareSummaries);

  sendJson(response, 200, {
    datasets,
    defaultChannel: datasets[0]?.channel ?? null,
  });
}

async function getDatasetByChannel(response, channel) {
  if (channel !== 'live' && channel !== 'ptu') {
    sendError(response, 404, `Unknown dataset channel "${channel}".`);
    return;
  }

  const db = await getDb();
  const doc = await db.collection(getCollectionName(channel)).findOne(
    { published: true },
    { projection: CORE_PROJECTION, sort: { importedAt: -1 } },
  );

  if (!doc) {
    sendError(response, 404, `No published dataset for channel "${channel}".`);
    return;
  }

  sendJson(response, 200, { dataset: normalizeCoreDataset(doc, channel) });
}

async function getMissionRewardsByChannel(response, channel) {
  if (channel !== 'live' && channel !== 'ptu') {
    sendError(response, 404, `Unknown dataset channel "${channel}".`);
    return;
  }

  const db = await getDb();
  const doc = await db.collection(getCollectionName(channel)).findOne(
    { published: true },
    { projection: { _id: 0, missionRewards: 1 }, sort: { importedAt: -1 } },
  );

  if (!doc) {
    sendError(response, 404, `No published dataset for channel "${channel}".`);
    return;
  }

  sendJson(response, 200, { missionRewards: doc.missionRewards ?? null });
}

async function findDatasetById(datasetId) {
  const db = await getDb();
  for (const channel of ['live', 'ptu']) {
    const doc = await db.collection(getCollectionName(channel)).findOne(
      { published: true, datasetId },
      { projection: CORE_PROJECTION, sort: { importedAt: -1 } },
    );

    if (doc) {
      return { channel, doc };
    }
  }

  return null;
}

async function findMissionRewardsById(datasetId) {
  const db = await getDb();
  for (const channel of ['live', 'ptu']) {
    const doc = await db.collection(getCollectionName(channel)).findOne(
      { published: true, datasetId },
      { projection: { _id: 0, missionRewards: 1 }, sort: { importedAt: -1 } },
    );

    if (doc) {
      return { channel, doc };
    }
  }

  return null;
}

loadDevVars();

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

    const datasetByIdMissionMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)\/mission-rewards$/);
    if (datasetByIdMissionMatch) {
      const match = await findMissionRewardsById(decodeURIComponent(datasetByIdMissionMatch[1]));
      if (!match) {
        sendError(response, 404, `No published dataset for id "${decodeURIComponent(datasetByIdMissionMatch[1])}".`);
        return;
      }
      sendJson(response, 200, { missionRewards: match.doc.missionRewards ?? null });
      return;
    }

    const datasetByIdMatch = path.match(/^\/api\/game-data\/public\/by-id\/([^/]+)$/);
    if (datasetByIdMatch) {
      const match = await findDatasetById(decodeURIComponent(datasetByIdMatch[1]));
      if (!match) {
        sendError(response, 404, `No published dataset for id "${decodeURIComponent(datasetByIdMatch[1])}".`);
        return;
      }
      sendJson(response, 200, { dataset: normalizeCoreDataset(match.doc, match.channel) });
      return;
    }

    const missionRewardsByChannelMatch = path.match(/^\/api\/game-data\/public\/(live|ptu)\/mission-rewards$/);
    if (missionRewardsByChannelMatch) {
      await getMissionRewardsByChannel(response, missionRewardsByChannelMatch[1]);
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
