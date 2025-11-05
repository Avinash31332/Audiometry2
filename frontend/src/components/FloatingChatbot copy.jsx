import React, { useState, useEffect, useRef } from "react";

// --- Floating Chatbot Component ---
// This component provides a floating button that opens a chat window.
// It manages its own state and can be dropped into any page.
export default function FloatingChatbot() {
  // === STATE ===
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([
    {
      role: "model",
      parts: [
        {
          text: "Hello! I'm your personal assistant. How can I help you with your audiometry test today?",
        },
      ],
    },
  ]);
  const [newMessage, setNewMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // --- New LLM Feature State ---
  const [suggestedReplies, setSuggestedReplies] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  // === REFS ===
  const chatWindowRef = useRef(null);

  // === EFFECTS ===
  // Effect to auto-scroll the chat window when new messages are added
  useEffect(() => {
    if (isOpen && chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [history, isOpen]);

  // === HELPER FUNCTION ===
  /**
   * A generic function to call the Gemini API via our backend.
   * This DRYs up the code for chat, summary, and suggestions.
   */
  const callGemini = async (message, currentHistory) => {
    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: currentHistory,
          message: message,
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return await response.json();
    } catch (error) {
      console.error("Error calling Gemini:", error);
      // Return a structured error response
      return {
        error: true,
        response:
          "Sorry, I'm having trouble connecting. Please try again later.",
      };
    }
  };

  // === CHAT FUNCTIONS ===

  /**
   * Sends the user's message to the /api/chat endpoint on your server
   */
  const handleSendMessage = async (e) => {
    e.preventDefault(); // Prevent form submission
    const userMessage = newMessage.trim();
    if (!userMessage || isChatLoading) return;

    setIsChatLoading(true);
    setNewMessage("");
    setSuggestedReplies([]); // Clear suggestions

    // Add user's message to the chat history
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
    ];
    setHistory(updatedHistory);

    // Call the API
    const data = await callGemini(userMessage, history);

    // Add AI's response to history
    setHistory((prevHistory) => [
      ...prevHistory,
      { role: "model", parts: [{ text: data.response }] },
    ]);

    setIsChatLoading(false);
  };

  // === NEW LLM FEATURE FUNCTIONS ===

  /**
   * ✨ Asks the LLM to summarize the conversation.
   */
  const handleSummarize = async () => {
    setIsChatLoading(true);
    const summaryPrompt =
      "---SYSTEM: Please provide a concise, one-paragraph summary of our conversation so far.---";

    const data = await callGemini(summaryPrompt, history);

    if (!data.error) {
      setSummaryText(data.response);
      setShowSummary(true);
    } else {
      // Handle error, e.g., show error in summary box
      setSummaryText("Could not generate summary: " + data.response);
      setShowSummary(true);
    }

    setIsChatLoading(false);
  };

  /**
   * ✨ Asks the LLM to suggest 3 relevant follow-up questions.
   */
  const handleSuggestQuestions = async () => {
    setIsChatLoading(true);
    setSuggestedReplies([]); // Clear old suggestions
    const suggestionPrompt =
      "---SYSTEM: Based on our conversation, please suggest 3 common questions a user might ask next. Return them as a bulleted list, starting each with a dash. Example:\n- Question 1\n- Question 2\n- Question 3---";

    const data = await callGemini(suggestionPrompt, history);

    if (!data.error) {
      // Parse the bulleted list response
      const suggestions = data.response
        .split("\n")
        .filter((line) => line.trim().startsWith("-"))
        .map((line) => line.trim().substring(1).trim()); // Remove the '-'
      setSuggestedReplies(suggestions.slice(0, 3)); // Take top 3
    }
    // Don't do anything on error, just don't show suggestions

    setIsChatLoading(false);
  };

  /**
   * Handles clicking a suggested reply button
   */
  const onSuggestionClick = (suggestion) => {
    setNewMessage(suggestion);
    setSuggestedReplies([]); // Clear suggestions
  };

  // === RENDER LOGIC ===

  // If the chat is NOT open, render the floating spherical button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-green-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg hover:bg-green-700 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Open chat assistant"
      >
        {/* Chat Bubble Icon SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>
    );
  }

  // If the chat IS open, render the full chat window
  return (
    <>
      {/* --- Summary Modal --- */}
      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Conversation Summary
            </h3>
            <p className="text-sm text-gray-600 mb-6">{summaryText}</p>
            <button
              onClick={() => setShowSummary(false)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* --- Chat Window --- */}
      <div className="fixed bottom-8 right-8 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col font-sans transition-all z-40">
        {/* --- Chat Header --- */}
        <div className="bg-green-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <h3 className="text-lg font-semibold">Personal Assistant</h3>
          <div className="flex gap-2">
            {/* ✨ Summarize Button */}
            <button
              onClick={handleSummarize}
              disabled={isChatLoading || history.length <= 1}
              className="p-1 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
              aria-label="Summarize conversation"
              title="Summarize conversation"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5.75 3C4.784 3 4 3.784 4 4.75V15.25C4 16.216 4.784 17 5.75 17H14.25C15.216 17 16 16.216 16 15.25V4.75C16 3.784 15.216 3 14.25 3H5.75ZM5.5 4.75C5.5 4.61193 5.61193 4.5 5.75 4.5H14.25C14.3881 4.5 14.5 4.61193 14.5 4.75V15.25C14.5 15.3881 14.3881 15.5 14.25 15.5H5.75C5.61193 15.5 5.5 15.3881 5.5 15.25V4.75ZM7 7H13V8H7V7ZM7 10H13V11H7V10ZM7 13H10V14H7V13Z" />
              </svg>
            </button>
            {/* Minimize Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Close chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* --- Chat Window --- */}
        <div
          ref={chatWindowRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
        >
          {history.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`p-3 rounded-xl max-w-xs shadow-sm ${
                  msg.role === "user"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.parts[0].text}</p>
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="p-3 rounded-xl bg-gray-200 text-gray-800">
                <p className="italic">Typing...</p>
              </div>
            </div>
          )}
        </div>

        {/* --- Suggested Replies --- */}
        {suggestedReplies.length > 0 && (
          <div className="p-2 border-t bg-white flex flex-wrap gap-2">
            {suggestedReplies.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick(suggestion)}
                className="bg-gray-100 text-green-700 text-sm py-1 px-3 rounded-full hover:bg-gray-200 transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* --- Chat Input Form --- */}
        <form
          onSubmit={handleSendMessage}
          className="flex gap-2 p-4 border-t bg-white rounded-b-lg"
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ask a question..."
            disabled={isChatLoading}
            className="flex-1 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* ✨ Suggest Questions Button */}
          <button
            type="button"
            onClick={handleSuggestQuestions}
            disabled={isChatLoading}
            className="text-green-600 font-semibold rounded-lg px-3 py-3 shadow-md hover:bg-gray-100 transition-all disabled:opacity-50"
            aria-label="Suggest questions"
            title="Suggest questions"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM3.893 4.553a1 1 0 00-1.346 1.346l1.201 3.4A1 1 0 004.893 10H7v1.107a1 1 0 001.659.753l3.4-1.201a1 1 0 00.347-1.346L9.2 4.893A1 1 0 007.893 4H6.786l-2.893.553zM16.107 15.447a1 1 0 001.346-1.346l-1.201-3.4A1 1 0 0015.107 10H13V8.893a1 1 0 00-1.659-.753l-3.4 1.201a1 1 0 00-.347 1.346l3.201 4.417a1 1 0 001.307.346h1.107l2.893-.553z" />
            </svg>
          </button>
          {/* Send Button */}
          <button
            type="submit"
            disabled={isChatLoading || !newMessage}
            className="bg-green-600 text-white font-semibold rounded-lg px-5 py-3 shadow-md hover:bg-blue-700 transition-all disabled:opacity-50"
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
