// import express from "express";
// import cors from "cors";
// import bodyParser from "body-parser";
// import fetch from "node-fetch";

// // --- New Gemini/Dotenv Imports ---
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import dotenv from "dotenv";

// // --- Load .env variables ---
// dotenv.config();

// const app = express();
// app.use(cors());
// // Your body-parser limit is fine
// app.use(bodyParser.json({ limit: "10mb" }));

// // --- Initialize Gemini ---
// // This requires GEMINI_API_KEY in your .env file
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // --- THIS IS THE FIX ---
// // The model "gemini-pro" is outdated.
// // We are changing it to the new "gemini-2.5-flash-preview-09-2025" model.
// const model = genAI.getGenerativeModel({
//   model: "gemini-2.5-flash-preview-09-2025",
// });
// // --- END OF FIX ---

// // --- Your Existing /detect Route (Unchanged) ---
// app.post("/detect", async (req, res) => {
//   try {
//     const { image } = req.body;
//     const response = await fetch("http://localhost:8000/detect", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ image }),
//     });
//     const result = await response.json();
//     res.json(result);
//   } catch (err) {
//     console.error("Error:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// // --- New /api/chat Route ---
// app.post("/api/chat", async (req, res) => {
//   try {
//     const { history, message } = req.body;

//     const systemInstruction = `
//       You are a friendly and helpful assistant for an audiometry test application.
//       Your role is to guide the user, explain what the test involves,
//       and answer questions about the audiometry process.
//       Do not provide medical diagnoses.
//     `;

//     const chat = model.startChat({
//       history: [
//         { role: "user", parts: [{ text: systemInstruction }] },
//         {
//           role: "model",
//           parts: [
//             {
//               text: "Hello! I'm here to help you with your audiometry test. How can I assist you today?",
//             },
//           ],
//         },
//         ...history,
//       ],
//       generationConfig: {
//         maxOutputTokens: 1000,
//       },
//     });

//     const result = await chat.sendMessage(message);
//     const response = await result.response;
//     const text = response.text();

//     res.json({ response: text });
//   } catch (error) {
//     // This will print the specific error from Google (e.g., "API Key Invalid")
//     console.error("Error in /api/chat route:", error);

//     res.status(500).json({ error: "Failed to communicate with Gemini API" });
//   }
// });

// app.listen(5000, () =>
//   console.log("Backend running on port 5000 (with Gesture and Gemini routes)")
// );
