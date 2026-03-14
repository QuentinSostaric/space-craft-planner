import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { connectToDatabase } from './config/db.js';
import { plannerRoutes } from './routes/plannerRoutes.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 5000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const dbState = await connectToDatabase();

app.use(
  cors({
    origin: clientOrigin,
  }),
);
app.use(express.json());

app.use(
  '/api',
  plannerRoutes({
    databaseConnected: dbState.connected,
    databaseMessage: dbState.reason,
  }),
);

app.listen(port, () => {
  const dbLabel = dbState.connected ? 'connected to Atlas' : `offline: ${dbState.reason}`;
  console.log(`Space Craft Planner API listening on http://localhost:${port} (${dbLabel})`);
});
