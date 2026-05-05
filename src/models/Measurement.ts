import mongoose, { Schema, model, models } from 'mongoose';

const MeasurementSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['heart_rate', 'respiration_rate', 'blood_oxygen', 'stress_level'],
  },
  value: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    required: true,
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
  },
}, { timestamps: true });

const Measurement = models.Measurement || model('Measurement', MeasurementSchema);

export default Measurement;
