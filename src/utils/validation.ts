import { z } from 'zod';

// Clinical form schema - strict validation
export const ClinicalFormSchema = z.object({
  age: z
    .number()
    .int()
    .min(1, 'Age must be at least 1')
    .max(150, 'Age must be 150 or less'),
  bloodPressure: z.object({
    systolic: z
      .number()
      .min(50, 'Systolic BP too low')
      .max(300, 'Systolic BP too high'),
    diastolic: z
      .number()
      .min(30, 'Diastolic BP too low')
      .max(200, 'Diastolic BP too high'),
  }),
  glucose: z
    .number()
    .positive('Glucose must be positive')
    .max(600, 'Glucose value too high'),
  bmi: z
    .number()
    .positive('BMI must be positive')
    .max(100, 'BMI too high'),
  familyHistory: z.boolean(),
  smoking: z.boolean(),
  physicalActivity: z.boolean(),
  dietQuality: z.enum(['poor', 'fair', 'good', 'excellent']),
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
  systolic?: number;
  bmi?: number;
}) {
  const flags = {
    highGlucose: (data.glucose ?? 0) > 126,
    hypertension: (data.systolic ?? 0) > 140,
    highBMI: (data.bmi ?? 0) > 30,
  };
  return flags;
}
