import { Router } from 'express';
import {
  buildDatasetSummary,
  getLatestGameDataset,
  getLatestPublishedDatasetSummaries,
  upsertGameDataset,
} from '../services/gameDatasetService.js';

function isValidChannel(channel) {
  return channel === 'live' || channel === 'ptu';
}

export function gameDataRoutes({ databaseConnected, databaseMessage }) {
  const router = Router();

  router.get('/game-data/public', async (_request, response) => {
    if (!databaseConnected) {
      response.status(503).json({
        message: databaseMessage,
        datasets: [],
        defaultChannel: null,
      });
      return;
    }

    const datasets = await getLatestPublishedDatasetSummaries();
    const defaultChannel = datasets.some((dataset) => dataset.channel === 'live')
      ? 'live'
      : datasets[0]?.channel ?? null;

    response.json({
      message: databaseMessage,
      datasets,
      defaultChannel,
    });
  });

  router.get('/game-data/public/:channel', async (request, response) => {
    const { channel } = request.params;

    if (!isValidChannel(channel)) {
      response.status(400).json({
        message: 'Channel must be either "live" or "ptu".',
      });
      return;
    }

    if (!databaseConnected) {
      response.status(503).json({
        message: databaseMessage,
        dataset: null,
      });
      return;
    }

    const dataset = await getLatestGameDataset(channel, { publishedOnly: true });

    if (!dataset) {
      response.status(404).json({
        message: `No published ${channel.toUpperCase()} dataset found.`,
        dataset: null,
      });
      return;
    }

    response.json({
      message: databaseMessage,
      dataset,
    });
  });

  router.get('/game-data/:channel', async (request, response) => {
    const { channel } = request.params;

    if (!isValidChannel(channel)) {
      response.status(400).json({
        message: 'Channel must be either "live" or "ptu".',
      });
      return;
    }

    if (!databaseConnected) {
      response.status(503).json({
        message: databaseMessage,
        dataset: null,
      });
      return;
    }

    const publishedOnly = request.query.publishedOnly === 'true';
    const dataset = await getLatestGameDataset(channel, { publishedOnly });

    if (!dataset) {
      response.status(404).json({
        message: `No ${publishedOnly ? 'published ' : ''}${channel.toUpperCase()} dataset found.`,
        dataset: null,
      });
      return;
    }

    response.json({
      message: databaseMessage,
      summary: buildDatasetSummary(dataset),
      dataset,
    });
  });

  router.post('/game-data/:channel/import', async (request, response) => {
    const { channel } = request.params;

    if (!isValidChannel(channel)) {
      response.status(400).json({
        message: 'Channel must be either "live" or "ptu".',
      });
      return;
    }

    if (!databaseConnected) {
      response.status(503).json({
        message: databaseMessage,
      });
      return;
    }

    const {
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
    } = request.body ?? {};

    if (!datasetId || !label || !version || !Array.isArray(resources) || !Array.isArray(blueprints)) {
      response.status(400).json({
        message:
          'datasetId, label, version, resources[] and blueprints[] are required to import a dataset.',
      });
      return;
    }

    const dataset = await upsertGameDataset({
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
      importedAt: importedAt ? new Date(importedAt) : undefined,
    });

    response.status(201).json({
      message: `Imported ${channel.toUpperCase()} dataset ${datasetId}.`,
      summary: buildDatasetSummary(dataset),
      dataset,
    });
  });

  return router;
}
