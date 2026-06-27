import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prediction, clinicalData } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });

    const prompt = `
      As a Clinical AI Assistant, provide a patient-friendly explanation for the following diabetes risk assessment:

      Assessment Result:
      - Risk Status: ${prediction.risk_status}
      - Probability: ${(prediction.final_probability * 100).toFixed(1)}%
      - Uncertainty: ${(prediction.uncertainty * 100).toFixed(1)}%
      - Clinical Flags: ${prediction.flags?.join(', ') || 'None'}

      Patient Data:
      - Glucose: ${clinicalData.glucose_fasting_mg_dl} mg/dL
      - HbA1c: ${clinicalData.hba1c}%
      - BMI: ${(clinicalData.weight / (clinicalData.height / 100) ** 2).toFixed(1)}
      - Blood Pressure: ${clinicalData.bloodpressure} mmHg
      - Age: ${new Date().getFullYear() - new Date(clinicalData.dateOfBirth).getFullYear()}
      - Smoking: ${clinicalData.smoking ? 'Yes' : 'No'}
      - Family History: ${clinicalData.familyHistory ? 'Yes' : 'No'}

      Please explain:
      1. What this risk level means in simple terms.
      2. How the specific clinical indicators (like glucose/HbA1c) influenced this result.
      3. 3-4 actionable next steps for the patient.
      
      Keep the tone professional yet encouraging. Use Markdown for formatting.
      IMPORTANT: Include a disclaimer that this is an AI-generated insight and not a medical diagnosis.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('[API Chat] Error:', error);
    return NextResponse.json({ error: 'Failed to generate AI insights' }, { status: 500 });
  }
}
