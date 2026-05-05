import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DiabetesPrediction, ClinicalData } from '@/types/prediction'

export function generateMedicalReport(prediction: DiabetesPrediction, clinicalData: ClinicalData, patientInfo: { name: string, id: string }) {
  const doc = new jsPDF()
  const timestamp = new Date().toLocaleString()
  const bmi = (clinicalData.weight / (clinicalData.height / 100) ** 2).toFixed(1)
  
  // Calculate Age
  const birthDate = new Date(clinicalData.dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  // Define Colors
  const colors = {
    primary: [44, 62, 80],    // Slate Blue
    secondary: [52, 199, 89], // Sehati Green
    text: [51, 51, 51],
    light: [248, 249, 250],
    border: [230, 230, 230]
  }

  // Sidebar / Header Design (Modern)
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.rect(0, 0, 210, 45, 'F')
  
  // Branding
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('SEHATI', 20, 25)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('ADVANCED CLINICAL AI SYSTEM', 20, 32)
  doc.text('EUROPEAN STANDARDS COMPLIANT', 20, 37)

  // Report Title (Right Aligned)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CLINICAL ANALYSIS REPORT', 190, 25, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`REF: ${Math.random().toString(36).substr(2, 9).toUpperCase()}`, 190, 32, { align: 'right' })
  doc.text(`DATE: ${timestamp}`, 190, 37, { align: 'right' })

  // 1. Patient Identification
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('I. PATIENT IDENTIFICATION', 20, 60)
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
  doc.line(20, 63, 190, 63)

  const patientData = [
    ['Full Name:', patientInfo.name, 'Patient ID:', patientInfo.id],
    ['Age:', age.toString(), 'Gender:', clinicalData.gender === 1 ? 'Male' : 'Female'],
    ['Height:', `${clinicalData.height} cm`, 'Weight:', `${clinicalData.weight} kg`],
    ['BMI:', `${bmi} kg/m²`, 'Status:', parseFloat(bmi) > 30 ? 'OBESE' : parseFloat(bmi) > 25 ? 'OVERWEIGHT' : 'NORMAL']
  ]

  autoTable(doc, {
    startY: 67,
    body: patientData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, textColor: colors.text },
    columnStyles: { 0: { fontStyle: 'bold', width: 30 }, 2: { fontStyle: 'bold', width: 30 } }
  })

  // 2. Risk Assessment Summary
  const startY2 = (doc as any).lastAutoTable.finalY + 12
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('II. RISK ASSESSMENT SUMMARY', 20, startY2)
  doc.line(20, startY2 + 3, 190, startY2 + 3)

  const riskStatus = prediction.risk_status.toUpperCase()
  const riskColor = riskStatus === 'HIGH' ? [231, 76, 60] : riskStatus === 'MODERATE' ? [230, 126, 34] : [46, 204, 113]
  
  // Risk Badge
  doc.setFillColor(riskColor[0], riskColor[1], riskColor[2])
  doc.roundedRect(20, startY2 + 8, 170, 25, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text(`DIABETES RISK STATUS: ${riskStatus}`, 105, startY2 + 20, { align: 'center' })
  doc.setFontSize(9)
  doc.text(`CONFIDENCE SCORE: ${((prediction.final_probability || prediction.probability || 0) * 100).toFixed(1)}%`, 105, startY2 + 28, { align: 'center' })

  // 3. Clinical Indicators
  const startY3 = startY2 + 45
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('III. CLINICAL INDICATORS', 20, startY3)
  doc.line(20, startY3 + 3, 190, startY3 + 3)

  const indicatorData = [
    ['Metric', 'Measured Value', 'Reference Range', 'Clinical Status'],
    ['Fasting Glucose', `${clinicalData.glucose_fasting_mg_dl} mg/dL`, '70 - 100 mg/dL', clinicalData.glucose_fasting_mg_dl > 126 ? 'DIABETIC' : clinicalData.glucose_fasting_mg_dl > 100 ? 'PRE-DIABETIC' : 'NORMAL'],
    ['HbA1c Level', `${clinicalData.hba1c}%`, '< 5.7%', clinicalData.hba1c > 6.5 ? 'HIGH' : clinicalData.hba1c >= 5.7 ? 'ELEVATED' : 'NORMAL'],
    ['Systolic BP', `${clinicalData.bloodpressure} mmHg`, '< 120 mmHg', clinicalData.bloodpressure >= 140 ? 'HYPERTENSION' : clinicalData.bloodpressure >= 120 ? 'ELEVATED' : 'NORMAL'],
    ['Insulin (Fasting)', `${clinicalData.insulin} μU/mL`, '2.6 - 24.9 μU/mL', 'OBSERVE'],
  ]

  autoTable(doc, {
    startY: startY3 + 8,
    head: [indicatorData[0]],
    body: indicatorData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: colors.primary, fontSize: 9, halign: 'center' },
    styles: { fontSize: 8, halign: 'center', cellPadding: 4 },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
  })

  // 4. Clinical Recommendations
  const startY4 = (doc as any).lastAutoTable.finalY + 12
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('IV. CLINICAL RECOMMENDATIONS', 20, startY4)
  doc.line(20, startY4 + 3, 190, startY4 + 3)

  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2])
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  
  const recommendations = [
    ['Dietary:', 'Implement a low-glycemic index nutrition plan. Reduce processed sugars and saturated fats.'],
    ['Activity:', 'Target 150 minutes of moderate aerobic exercise per week as per WHO guidelines.'],
    ['Monitoring:', 'Scheduled HbA1c screening every 90 days for trend analysis.'],
    ['Medical:', 'Discuss these findings with your endocrinologist for comprehensive diagnostic validation.']
  ]

  autoTable(doc, {
    startY: startY4 + 8,
    body: recommendations,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', width: 30 } }
  })

  // Footer / Signatures
  const lastY = (doc as any).lastAutoTable.finalY || 220
  const footerY = Math.min(265, lastY + 25)
  
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
  doc.line(20, footerY, 80, footerY)
  doc.line(130, footerY, 190, footerY)
  
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.setFontSize(8)

  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('DISCLAIMER: This report is an AI-assisted analysis for screening purposes only. It does not constitute a formal medical diagnosis.', 105, 285, { align: 'center' })
  doc.text('© 2026 SEHATI HEALTH AI - CLINICAL DIVISION', 105, 290, { align: 'center' })

  // Save PDF
  doc.save(`SEHATI_Clinical_Report_${patientInfo.name.replace(/\s+/g, '_')}.pdf`)
}
