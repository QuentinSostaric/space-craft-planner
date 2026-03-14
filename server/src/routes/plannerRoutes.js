import { Router } from 'express';
import mongoose from 'mongoose';
import { PlannerTask } from '../models/PlannerTask.js';

export function plannerRoutes({ databaseConnected, databaseMessage }) {
  const router = Router();

  router.get('/health', (_request, response) => {
    response.json({
      ok: true,
      databaseConnected,
      message: databaseMessage,
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/tasks', async (_request, response) => {
    if (!databaseConnected) {
      response.json({
        items: [],
        databaseConnected,
        message: databaseMessage,
      });
      return;
    }

    const items = await PlannerTask.find().sort({ launchDate: 1, createdAt: -1 }).lean();
    response.json({
      items,
      databaseConnected,
      message: databaseMessage,
    });
  });

  router.post('/tasks', async (request, response) => {
    if (!databaseConnected) {
      response.status(503).json({
        message: databaseMessage,
      });
      return;
    }

    const item = await PlannerTask.create({
      title: request.body.title,
      objective: request.body.objective,
      launchDate: request.body.launchDate,
      crew: request.body.crew,
    });

    response.status(201).json({ item });
  });

  router.patch('/tasks/:id', async (request, response) => {
    if (!databaseConnected) {
      response.status(503).json({
        message: databaseMessage,
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      response.status(400).json({
        message: 'Invalid task identifier.',
      });
      return;
    }

    const item = await PlannerTask.findByIdAndUpdate(
      request.params.id,
      {
        status: request.body.status,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!item) {
      response.status(404).json({
        message: 'Task not found.',
      });
      return;
    }

    response.json({ item });
  });

  router.delete('/tasks/:id', async (request, response) => {
    if (!databaseConnected) {
      response.status(503).json({
        message: databaseMessage,
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      response.status(400).json({
        message: 'Invalid task identifier.',
      });
      return;
    }

    const item = await PlannerTask.findByIdAndDelete(request.params.id);

    if (!item) {
      response.status(404).json({
        message: 'Task not found.',
      });
      return;
    }

    response.status(204).send();
  });

  return router;
}
