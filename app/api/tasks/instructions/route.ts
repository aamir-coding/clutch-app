import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    const { taskId, title, description } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Missing task title" }, { status: 400 });
    }

    const systemInstruction = `You are an elite, high-stakes productivity coach and crisis intervention assistant. 
Your job is to provide direct, extremely focused, and tactical advice to someone who is facing a critical deadline that is less than 4 hours away.
Keep your response concise (3-4 sentences max), highly actionable, and motivating. 
Focus on:
1. Stripping out all secondary scope and finishing only the absolute core MVP.
2. A single high-impact concrete step to take immediately.
3. Silencing distractions (e.g., phone in another room, turning off Slack/tabs).
Do not use generic fluff or warm pleasantries. Speak with professional, firm, and supportive urgency.`;

    const prompt = `Task: "${title}"
Details/Scope: "${description || 'None provided'}"
Deadline: Less than 4 hours away.

Provide a tailored crisis strategy for this task.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const instruction = response.text || "Focus on the core components. Eliminate distractions and execute.";

    return NextResponse.json({ instruction });
  } catch (error: any) {
    console.error("Gemini Crisis API Error:", error);
    return NextResponse.json(
      { instruction: "Focus on finishing the absolute core requirements. Strip out all secondary features. Write down your next 3 concrete steps, put your phone in another room, and execute." },
      { status: 200 } // Return fallback instruction with 200 to keep UI functional
    );
  }
}
