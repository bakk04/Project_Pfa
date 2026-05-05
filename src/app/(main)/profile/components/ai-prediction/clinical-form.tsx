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
    weight: 75,
    height: 175,
    glucose_fasting_mg_dl: 100,
    hba1c: 5.4,
    smoking: false,
    familyHistory: false,
    gender: 0, // Female
    bloodpressure: 120,
    pregnancies: 0,
    skinthickness: 20,
    insulin: 80,
    diabetespedigreefunction: 0.47,
    dateOfBirth: '1990-01-01',
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
      setFormData((prev: ClinicalData) => ({
        ...prev,
        [field]: value,
      }))

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={styles.inputGroup}>
          <label className={styles.label}>Weight (kg)</label>
          <input
            type="number"
            value={formData.weight}
            onChange={(e) => handleChange('weight', parseFloat(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
          {errors['weight'] && <p className={styles.errorText}>{errors['weight']}</p>}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Height (cm)</label>
          <input
            type="number"
            value={formData.height}
            onChange={(e) => handleChange('height', parseFloat(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
          {errors['height'] && <p className={styles.errorText}>{errors['height']}</p>}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Fasting Glucose (mg/dL)</label>
          <input
            type="number"
            value={formData.glucose_fasting_mg_dl}
            onChange={(e) => handleChange('glucose_fasting_mg_dl', parseFloat(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
          {errors['glucose_fasting_mg_dl'] && <p className={styles.errorText}>{errors['glucose_fasting_mg_dl']}</p>}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>HbA1c (%)</label>
          <input
            type="number"
            step="0.1"
            value={formData.hba1c}
            onChange={(e) => handleChange('hba1c', parseFloat(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
          {errors['hba1c'] && <p className={styles.errorText}>{errors['hba1c']}</p>}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Blood Pressure (Systolic)</label>
          <input
            type="number"
            value={formData.bloodpressure}
            onChange={(e) => handleChange('bloodpressure', parseFloat(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
          {errors['bloodpressure'] && <p className={styles.errorText}>{errors['bloodpressure']}</p>}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Gender</label>
          <select
            value={formData.gender}
            onChange={(e) => handleChange('gender', parseInt(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          >
            <option value={1}>Male</option>
            <option value={0}>Female</option>
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Insulin (μU/mL)</label>
          <input
            type="number"
            value={formData.insulin}
            onChange={(e) => handleChange('insulin', parseFloat(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Skin Thickness (mm)</label>
          <input
            type="number"
            value={formData.skinthickness}
            onChange={(e) => handleChange('skinthickness', parseFloat(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Date of Birth</label>
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleChange('dateOfBirth', e.target.value)}
            className={styles.input}
            disabled={isLoading}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Diabetes Pedigree Function</label>
          <input
            type="number"
            step="0.01"
            value={formData.diabetespedigreefunction}
            onChange={(e) => handleChange('diabetespedigreefunction', parseFloat(e.target.value))}
            className={styles.input}
            disabled={isLoading}
          />
        </div>

        {formData.gender === 0 && (
          <div className={styles.inputGroup}>
            <label className={styles.label}>Pregnancies</label>
            <input
              type="number"
              value={formData.pregnancies}
              onChange={(e) => handleChange('pregnancies', parseInt(e.target.value))}
              className={styles.input}
              disabled={isLoading}
            />
          </div>
        )}
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
