import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Your existing component imports
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import HearingHealth from "./pages/HearingHealth";
import HearingTest from "./pages/AudometryTest";
import Results from "./pages/Results";

import FloatingChatbot from "./components/FloatingChatbot"; // Adjust path if needed

export default function App() {
  return (
    // 2. Add the <Router> component to wrap your app
    <div className="flex flex-col min-h-screen">
      {/* The <></> fragment was removed as it's not needed here */}
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/health" element={<HearingHealth />} />
          <Route path="/test" element={<HearingTest />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </main>
      <Footer />

      {/* 3. Add the FloatingChatbot here */}
      {/* It will render on top of all other content */}
      <FloatingChatbot />
    </div>
  );
}
