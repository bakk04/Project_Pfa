'use client'

import React, { useState, useCallback } from 'react'
import { ClinicalFormSchema } from '@/utils/validation'
import type { ClinicalData } from '@/types/prediction'
import styles from './ClinicalForm.module.css'

interface ClinicalFormProps {
  onSubmit: (data: ClinicalData) => Promise<void>
  isLoading?: boolean
}

export function ClinicalForm({ onSubmit, isLoading = false }: ClinicalFormProps) {
  const [formData, setFormData] = useState<ClinicalData>({
    age: 30,
    glucose: 100,
    bloodPressure: { systolic: 120, diastolic: 80 },
    bmi: 24,
    familyHistory: false,
    smoking: false,
    physicalActivity: true,
    dietQuality: 'fair',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const validateForm = useCallback(() => {
    const result = ClinicalFormSchema.safeParse(formData)
    if (!result.success) {
      const newErrors: Record<string, string> = {}
      result.error.issues.forEach((error: any) => {
        const path = error.path.join('.')
        newErrors[path] = error.message
      })
      setErrors(newErrors)
      return false
    }
    setErrors({})
    return true
  }, [formData])

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      setFormData((prev: ClinicalData) => {
        if (field.includes('.')) {
          const [parent, child] = field.split('.')
          return {
            ...prev,
            [parent]: {
              ...(prev[parent as keyof ClinicalData] as any),
              [child]: value,
            },
          }
        }
        return {
          ...prev,
          [field]: value,
        }
      })

      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[field]
          return newErrors
        })
      }
    },
    [errors]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!validateForm()) {
      return
    }

    try {
      await onSubmit(formData)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prediction failed'
      setSubmitError(message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.inputGroup}>
        <label className={styles.label}>Age (years)</label>
        <input
          type="number"
          min="18"
          max="120"
          value={formData.age}
          onChange={(e) => handleChange('age', parseInt(e.target.value))}
          className={styles.input}
          disabled={isLoading}
        />
        {errors['age'] && <p className={styles.errorText}>{errors['age']}</p>}
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>Fasting Glucose (mg/dL)</label>
        <input
          type="number"
          min="0"
          max="500"
          value={formData.glucose}
          onChange={(e) => handleChange('glucose', parseInt(e.target.value))}
          className={styles.input}
          disabled={isLoading}
        />
        {errors['glucose'] && <p className={styles.errorText}>{errors['glucose']}</p>}
      </div>

      <div className={styles.grid}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>SBP (mmHg)</label>
          <input
            type="number"
            min="0"
            max="300"
            value={formData.bloodPressure.systolic}
            onChange={(e) => handleChange('bloodPressure.systolic', parseInt(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>DBP (mmHg)</label>
          <input
            type="number"
            min="0"
            max="200"
            value={formData.bloodPressure.diastolic}
            onChange={(e) => handleChange('bloodPressure.diastolic', parseInt(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>BMI (kg/m²)</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={formData.bmi}
          onChange={(e) => handleChange('bmi', parseFloat(e.target.value))}
          className={styles.input}
          disabled={isLoading}
        />
        {errors['bmi'] && <p className={styles.errorText}>{errors['bmi']}</p>}
      </div>

      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={formData.familyHistory}
            onChange={(e) => handleChange('familyHistory', e.target.checked)}
            disabled={isLoading}
          />
          <span className={styles.checkboxText}>Family history of diabetes</span>
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={formData.smoking}
            onChange={(e) => handleChange('smoking', e.target.checked)}
            disabled={isLoading}
          />
          <span className={styles.checkboxText}>Current smoker</span>
        </label>
      </div>

      {submitError && (
        <div className={styles.submitError}>
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className={styles.submitButton}
      >
        {isLoading ? 'Analyzing...' : 'Get Risk Assessment'}
      </button>
    </form>
  )
}
