import mongoose from 'mongoose';

const plannerTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    objective: {
      type: String,
      required: true,
      trim: true,
    },
    launchDate: {
      type: Date,
      required: true,
    },
    crew: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['planned', 'active', 'complete'],
      default: 'planned',
    },
  },
  {
    timestamps: true,
  },
);

export const PlannerTask = mongoose.model('PlannerTask', plannerTaskSchema);
