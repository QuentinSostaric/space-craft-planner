import mongoose from 'mongoose';

export async function connectToDatabase() {
  const connectionString = process.env.MONGODB_URI;

  if (!connectionString) {
    return {
      connected: false,
      reason: 'Missing MONGODB_URI. Add your MongoDB Atlas connection string in server/.env.',
    };
  }

  try {
    await mongoose.connect(connectionString);

    return {
      connected: true,
      reason: 'MongoDB Atlas connected.',
    };
  } catch (error) {
    return {
      connected: false,
      reason:
        error instanceof Error ? error.message : 'MongoDB connection failed for an unknown reason.',
    };
  }
}
