import mongoose from 'mongoose';

export async function connectToDatabase() {
  const connectionString = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB_NAME ?? 'craft';

  if (!connectionString) {
    return {
      connected: false,
      reason: 'Missing MONGODB_URI. Add your MongoDB Atlas connection string in server/.env.',
    };
  }

  try {
    await mongoose.connect(connectionString, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 10000,
    });

    return {
      connected: true,
      reason: `MongoDB Atlas connected to database "${databaseName}".`,
    };
  } catch (error) {
    return {
      connected: false,
      reason:
        error instanceof Error ? error.message : 'MongoDB connection failed for an unknown reason.',
    };
  }
}
