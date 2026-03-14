import mongoose from 'mongoose';

const gameDatasetSchema = new mongoose.Schema(
  {
    datasetId: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['live', 'ptu'],
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: String,
      default: null,
      trim: true,
    },
    buildNumber: {
      type: String,
      default: null,
      trim: true,
    },
    buildId: {
      type: String,
      default: null,
      trim: true,
    },
    buildDateStamp: {
      type: String,
      default: null,
      trim: true,
    },
    buildTimeStamp: {
      type: String,
      default: null,
      trim: true,
    },
    requestedP4ChangeNum: {
      type: String,
      default: null,
      trim: true,
    },
    shelvedChange: {
      type: String,
      default: null,
      trim: true,
    },
    installPath: {
      type: String,
      default: null,
      trim: true,
    },
    outputLabel: {
      type: String,
      default: null,
      trim: true,
    },
    published: {
      type: Boolean,
      default: false,
    },
    resources: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    blueprints: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sourceFiles: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    changelog: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    importedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    minimize: false,
    strict: true,
    timestamps: true,
  },
);

gameDatasetSchema.index({ datasetId: 1 }, { unique: true });
gameDatasetSchema.index({ published: 1, importedAt: -1 });
gameDatasetSchema.index({ updatedAt: -1 });

function getCollectionName(channel) {
  if (channel === 'ptu') {
    return process.env.MONGODB_PTU_COLLECTION ?? 'craft-ptu-data';
  }

  return process.env.MONGODB_LIVE_COLLECTION ?? 'craft-live-data';
}

export function getGameDatasetModel(channel) {
  const normalizedChannel = channel === 'live' ? 'live' : 'ptu';
  const modelName = `GameDataset_${normalizedChannel}`;
  const collectionName = getCollectionName(normalizedChannel);

  return mongoose.models[modelName] ?? mongoose.model(modelName, gameDatasetSchema, collectionName);
}
