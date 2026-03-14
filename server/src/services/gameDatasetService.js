import { getGameDatasetModel } from '../models/GameDataset.js';
import { buildDatasetChangelog } from './gameDatasetDiff.js';

function getDatasetSort() {
  return { importedAt: -1, updatedAt: -1 };
}

function buildDatasetSummary(dataset) {
  if (!dataset) {
    return null;
  }

  return {
    channel: dataset.channel,
    datasetId: dataset.datasetId,
    label: dataset.label,
    version: dataset.version,
    branch: dataset.branch,
    buildNumber: dataset.buildNumber,
    published: dataset.published,
    blueprintCount: dataset.blueprints?.length ?? 0,
    resourceCount: dataset.resources?.length ?? 0,
    importedAt: dataset.importedAt,
    updatedAt: dataset.updatedAt,
    hasChangelog: Boolean(dataset.changelog),
  };
}

export async function getLatestGameDataset(channel, options = {}) {
  const GameDataset = getGameDatasetModel(channel);
  const query = options.publishedOnly ? { published: true } : {};
  return GameDataset.findOne(query).sort(getDatasetSort()).lean();
}

export async function getLatestPublishedDatasetSummaries() {
  const [live, ptu] = await Promise.all([
    getLatestGameDataset('live', { publishedOnly: true }),
    getLatestGameDataset('ptu', { publishedOnly: true }),
  ]);

  return [live, ptu].filter(Boolean).map(buildDatasetSummary);
}

async function refreshLatestPtuChangelogAgainstLive(liveDataset) {
  const PtuDataset = getGameDatasetModel('ptu');
  const latestPtu = await PtuDataset.findOne().sort(getDatasetSort()).lean();

  if (!latestPtu) {
    return null;
  }

  const changelog = buildDatasetChangelog(latestPtu, liveDataset);

  await PtuDataset.findByIdAndUpdate(latestPtu._id, { changelog }, { new: false });

  return changelog;
}

export async function upsertGameDataset({
  channel,
  datasetId,
  label,
  version,
  branch,
  buildNumber,
  buildId,
  buildDateStamp,
  buildTimeStamp,
  requestedP4ChangeNum,
  shelvedChange,
  installPath,
  outputLabel,
  published,
  resources,
  blueprints,
  metrics,
  sourceFiles,
  importedAt,
}) {
  const GameDataset = getGameDatasetModel(channel);

  let changelog = null;

  if (channel === 'ptu') {
    const latestLive = await getLatestGameDataset('live');

    if (latestLive) {
      changelog = buildDatasetChangelog(
        {
          datasetId,
          channel,
          label,
          version,
          resources,
          blueprints,
        },
        latestLive,
      );
    }
  }

  const dataset = await GameDataset.findOneAndUpdate(
    { datasetId },
    {
      datasetId,
      channel,
      label,
      version,
      branch,
      buildNumber,
      buildId,
      buildDateStamp,
      buildTimeStamp,
      requestedP4ChangeNum,
      shelvedChange,
      installPath,
      outputLabel,
      published: Boolean(published),
      resources,
      blueprints,
      metrics,
      sourceFiles,
      changelog,
      importedAt: importedAt ?? new Date(),
    },
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    },
  ).lean();

  if (channel === 'live') {
    await refreshLatestPtuChangelogAgainstLive(dataset);
  }

  return dataset;
}

export { buildDatasetSummary };
