import { z } from 'zod';

// Clinical form schema - strict validation based on backend requirements
export const ClinicalFormSchema = z.object({
  weight: z
    .number()
    .positive('Weight must be positive')
    .max(500, 'Weight too high'),
  height: z
    .number()
    .positive('Height must be positive')
    .max(300, 'Height too high'),
  glucose_fasting_mg_dl: z
    .number()
    .positive('Glucose must be positive')
    .max(600, 'Glucose value too high'),
  hba1c: z
    .number()
    .min(3, 'HbA1c too low')
    .max(20, 'HbA1c too high'),
  smoking: z.boolean(),
  familyHistory: z.boolean(),
  gender: z.number().min(0).max(1),
  bloodpressure: z
    .number()
    .min(30, 'Blood pressure too low')
    .max(300, 'Blood pressure too high'),
  pregnancies: z
    .number()
    .int()
    .min(0)
    .max(20),
  skinthickness: z
    .number()
    .min(0)
    .max(100),
  insulin: z
    .number()
    .min(0)
    .max(1000),
  diabetespedigreefunction: z
    .number()
    .min(0)
    .max(5),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

// Vitals schema for manual input
export const VitalsSchema = z.object({
  bloodPressure: z
    .object({
      systolic: z.number().min(50).max(300),
      diastolic: z.number().min(30).max(200),
    })
    .optional(),
  glucose: z.number().positive().max(600).optional(),
  weight: z.number().positive().max(500).optional(),
});

// Chat message schema
export const ChatMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message too long'),
  userID: z.string().min(1, 'User ID required'),
});

// Helpers
export function validateClinicalData(data: unknown) {
  try {
    const validated = ClinicalFormSchema.parse(data);
    return { valid: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, data: null, errors: error.issues };
    }
    return { valid: false, data: null, errors: [{ message: 'Unknown error' }] };
  }
}

export function validateChatMessage(data: unknown) {
  try {
    const validated = ChatMessageSchema.parse(data);
    return { valid: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, data: null, errors: error.issues };
    }
    return { valid: false, data: null, errors: [{ message: 'Unknown error' }] };
  }
}

export function validateVitals(data: unknown) {
  try {
    const validated = VitalsSchema.parse(data);
    return { valid: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, data: null, errors: error.issues };
    }
    return { valid: false, data: null, errors: [{ message: 'Unknown error' }] };
  }
}

// Clinical rules - applied on backend
export function applyClinicalRules(data: {
  glucose?: number;
  bloodpressure?: number;
  bmi?: number;
}) {
  const flags = {
    highGlucose: (data.glucose ?? 0) > 126,
    hypertension: (data.bloodpressure ?? 0) > 140,
    highBMI: (data.bmi ?? 0) > 30,
  };
  return flags;
}
