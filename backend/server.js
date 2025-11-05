import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";

// --- New Gemini/Dotenv Imports ---
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// --- Load .env variables ---
dotenv.config();

const app = express();
app.use(cors());
// Your body-parser limit is fine
app.use(bodyParser.json({ limit: "10mb" }));

// --- Initialize Gemini ---
// This requires GEMINI_API_KEY in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// The model "gemini-pro" is outdated.
// We are changing it to the new "gemini-2.5-flash-preview-09-2025" model.
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-preview-09-2025",
});

// --- Your Existing /detect Route (Unchanged) ---
app.post("/detect", async (req, res) => {
  try {
    const { image } = req.body;
    const response = await fetch("http://localhost:8000/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- New /api/chat Route ---
app.post("/api/chat", async (req, res) => {
  try {
    const { history, message } = req.body;

    // --- UPDATED SYSTEM INSTRUCTION ---
    const systemInstruction = `
      You are a friendly and helpful assistant for an audiometry test application.

      --- YOUR RULES ---
      1.  **ROLE:** Your role is to guide the user, explain what the test involves, and answer questions about the audiometry process.
      2.  **TONE:** Your responses must be concise and clear. Use shorter sentences. Keep your answers helpful but not overly long.
      3.  **TOPIC:** You MUST stay strictly on topic. The only topics you can discuss are:
          - The audiometry test itself.
          - Ear-related health issues (e.g., tinnitus, hearing loss).
          - Precautions and advice for ear health.
          - Anything related to ears, hearing, or audiometry.
      4.  **OFF-TOPIC (NON-EAR HEALTH):** If the user asks about any other health issue (e.g., a headache, stomach pain), you MUST NOT provide advice. Instead, show sympathy and gently redirect them. 
          Example: "I understand you're concerned about that, but my expertise is limited to ear health and audiometry. For other medical concerns, it's always best to consult a doctor."
      5.  **OFF-TOPIC (GENERAL):** If the user asks about something completely unrelated (e.g., the weather, sports), politely decline and remind them of your purpose.
          Example: "That's an interesting question, but I'm here to help with your ear health and audiometry test."
      6.  **DIAGNOSIS:** You must never provide a medical diagnosis. Always suggest they consult a healthcare professional.
    `;
    // --- END OF UPDATE ---

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemInstruction }] },
        {
          role: "model",
          parts: [
            {
              text: "Hello! I'm here to help you with your audiometry test. How can I assist you today?",
            },
          ],
        },
        ...history,
      ],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.json({ response: text });
  } catch (error) {
    // This will print the specific error from Google (e.g., "API Key Invalid")
    console.error("Error in /api/chat route:", error);

    res.status(500).json({ error: "Failed to communicate with Gemini API" });
  }
});

app.listen(5000, () =>
  console.log("Backend running on port 5000 (with Gesture and Gemini routes)")
);
