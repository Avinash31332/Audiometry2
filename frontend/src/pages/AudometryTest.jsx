// This file has been stylistically refactored to match the original component's theme.
// 1. "Start Camera" button changed from purple to the primary green style.
// 2. Waveform canvas background changed from white to transparent.
// No functional changes were made.

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const frequencies = [250, 500, 1000, 2000, 4000, 8000]; // Hz
const ears = ["left", "right"];
const minGain = 0; // dB HL
const maxGain = 70; // dB HL

const initialTestLogicState = {
  intensity: 30,
  phase: "descending",
};

export default function AudiometryTest() {
  const navigate = useNavigate();

  const [currentEarIndex, setCurrentEarIndex] = useState(0);
  const [currentFreqIndex, setCurrentFreqIndex] = useState(0);
  const [results, setResults] = useState({ left: {}, right: {} });
  const [isPlaying, setIsPlaying] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [testLogicState, setTestLogicState] = useState(initialTestLogicState);

  const [camRunning, setCamRunning] = useState(false);
  const [gesture, setGesture] = useState("");
  const [lastGesture, setLastGesture] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  const videoRef = useRef(null);
  const recognizerRef = useRef(null);
  const animRef = useRef(null);
  const acceptingGesturesRef = useRef(false);
  const lastTriggerRef = useRef(0);
  const isInitialMount = useRef(true);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);

  const audioBuffersRef = useRef({});

  // --- MediaPipe Gesture Control ---
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        recognizerRef.current = await GestureRecognizer.createFromOptions(
          vision,
          {
            baseOptions: { modelAssetPath: "/gesture_recognizer.task" },
            runningMode: "VIDEO",
            numHands: 1,
          }
        );
      } catch (error) {
        console.error("Failed to initialize MediaPipe:", error);
        alert(
          "Error initializing gesture model. Ensure 'gesture_recognizer.task' is in your public folder."
        );
      }
    };
    initMediaPipe();
  }, []);

  // --- Audio File Preloading ---
  useEffect(() => {
    const loadAudioFiles = async () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          alert("Web Audio API is not supported in this browser.");
          setIsLoading(false);
          return;
        }
        audioCtxRef.current = new AudioCtx();
        const context = audioCtxRef.current;

        const loadPromises = [];
        for (const ear of ears) {
          for (const freq of frequencies) {
            const filePath = `/audio_${freq}_${ear}.wav`;
            const promise = fetch(filePath)
              .then((response) => {
                if (!response.ok)
                  throw new Error(`File not found: ${filePath}`);
                return response.arrayBuffer();
              })
              .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
              .then((decodedBuffer) => {
                const key = `${freq}_${ear}`;
                audioBuffersRef.current[key] = decodedBuffer;
              });
            loadPromises.push(promise);
          }
        }
        await Promise.all(loadPromises);
        console.log("All audio files loaded successfully.");
      } catch (error) {
        console.error("Failed to load audio files:", error);
        alert(
          "Could not load necessary audio files. Please check the public folder and your network connection."
        );
      } finally {
        setIsLoading(false);
      }
    };
    loadAudioFiles();
  }, []);

  const startCamera = async () => {
    if (!recognizerRef.current) return alert("Gesture model not loaded yet.");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setCamRunning(true);
    detectLoop();
  };

  const detectLoop = () => {
    if (!recognizerRef.current || !videoRef.current) return;
    const rec = recognizerRef.current;
    const v = videoRef.current;
    const loop = () => {
      if (v.readyState >= 2) {
        const res = rec.recognizeForVideo(v, performance.now());
        if (res?.gestures?.[0]?.[0]) {
          const g = res.gestures[0][0];
          setGesture(`${g.categoryName} (Score: ${g.score.toFixed(2)})`);
          if (
            acceptingGesturesRef.current &&
            g.score > 0.75 &&
            g.categoryName.toLowerCase() !== "none"
          ) {
            const now = Date.now();
            if (now - lastTriggerRef.current > 1500) {
              lastTriggerRef.current = now;
              const name = g.categoryName.toLowerCase();
              if (name.includes("thumb") && name.includes("up")) {
                setLastGesture({ name: "heard", timestamp: now });
              }
              if (name.includes("thumb") && name.includes("down")) {
                setLastGesture({ name: "not_heard", timestamp: now });
              }
            }
          }
        }
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (!lastGesture) return;
    if (lastGesture.name === "heard") {
      recordHeard();
    } else if (lastGesture.name === "not_heard") {
      recordNotHeard();
    }
  }, [lastGesture]);

  const playTone = (freq, dbHL, ear) => {
    try {
      if (!isFinite(dbHL)) {
        console.error(
          `Invalid non-finite dbHL value received: ${dbHL}. Aborting playTone.`
        );
        return;
      }

      const ctx = audioCtxRef.current;
      if (!ctx) {
        console.error("AudioContext not initialized.");
        return;
      }
      if (ctx.state === "suspended") ctx.resume();

      const bufferKey = `${freq}_${ear}`;
      const buffer = audioBuffersRef.current[bufferKey];

      if (!buffer) {
        console.error(
          `Audio buffer for ${bufferKey} is not loaded or available.`
        );
        alert(
          `Could not play sound for ${freq}Hz in ${ear} ear. File may be missing.`
        );
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const amplitude = Math.pow(10, (dbHL - maxGain) / 20);
      gainNode.gain.value = Math.max(0, amplitude);

      source.connect(gainNode).connect(analyser).connect(ctx.destination);

      source.start();
      drawWaveform();

      source.onended = () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    } catch (err) {
      console.error("Audio error:", err);
      alert("An unexpected audio error occurred.");
    }
  };

  // --- STYLING CHANGE: Reverted to original transparent background logic ---
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const ctx2d = canvas ? canvas.getContext("2d") : null;
    if (!canvas || !analyser || !ctx2d) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx2d.fillStyle = "rgba(255,255,255,0)"; // Transparent fill
      ctx2d.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = "#111827";
      ctx2d.beginPath();
      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
        x += sliceWidth;
      }
      ctx2d.lineTo(canvas.width, canvas.height / 2);
      ctx2d.stroke();
    };
    if (!rafRef.current) draw();
  };

  // --- Test Controls & State Logic ---
  const playCurrentTone = () => {
    if (isLoading || isPlaying || testComplete) return;

    setIsPlaying(true);
    acceptingGesturesRef.current = true;
    playTone(
      frequencies[currentFreqIndex],
      testLogicState.intensity,
      ears[currentEarIndex]
    );

    setTimeout(() => {
      setIsPlaying(false);
      acceptingGesturesRef.current = false;
    }, 1500);
  };

  const recordHeard = () => {
    acceptingGesturesRef.current = false;
    if (testLogicState.phase === "descending") {
      const newIntensity = Math.max(minGain, testLogicState.intensity - 10);
      setTestLogicState({ ...testLogicState, intensity: newIntensity });
    } else {
      const ear = ears[currentEarIndex];
      const freq = frequencies[currentFreqIndex];
      const dbHL = testLogicState.intensity;
      setResults((prev) => ({
        ...prev,
        [ear]: { ...prev[ear], [freq]: dbHL },
      }));
      nextStep();
    }
  };

  const recordNotHeard = () => {
    acceptingGesturesRef.current = false;
    if (testLogicState.intensity >= maxGain) {
      const ear = ears[currentEarIndex];
      const freq = frequencies[currentFreqIndex];
      setResults((prev) => ({ ...prev, [ear]: { ...prev[ear], [freq]: 100 } }));
      nextStep();
    } else {
      const newIntensity = Math.min(maxGain, testLogicState.intensity + 5);
      setTestLogicState({ intensity: newIntensity, phase: "ascending" });
    }
  };

  const nextStep = () => {
    setTestLogicState(initialTestLogicState);
    if (currentFreqIndex < frequencies.length - 1) {
      setCurrentFreqIndex((i) => i + 1);
    } else if (currentEarIndex < ears.length - 1) {
      setCurrentEarIndex((i) => i + 1);
      setCurrentFreqIndex(0);
    } else {
      setTestComplete(true);
    }
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (testComplete || isPlaying || isLoading) return;
    const timeoutId = setTimeout(playCurrentTone, 500);
    return () => clearTimeout(timeoutId);
  }, [
    testLogicState,
    currentFreqIndex,
    currentEarIndex,
    testComplete,
    isLoading,
  ]);

  useEffect(() => {
    if (testComplete) {
      const newResult = {
        date: new Date().toISOString(),
        results,
        leftAvg: earAvgHL("left"),
        rightAvg: earAvgHL("right"),
        leftCondition: earConditionText(earAvgHL("left")),
        rightCondition: earConditionText(earAvgHL("right")),
      };
      const existing = JSON.parse(localStorage.getItem("hearingResults")) || [];
      localStorage.setItem(
        "hearingResults",
        JSON.stringify([...existing, newResult])
      );
    }
  }, [testComplete]);

  // --- Helper Functions (No changes) ---
  const normalizeToHL = (val) => {
    if (val === undefined || val === null) return null;
    return Math.min(100, Math.abs(val));
  };

  const earAvgHL = (ear) => {
    const vals = frequencies
      .map((f) => results[ear][f])
      .filter((v) => v !== undefined && v !== null);
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  };

  const mapAvgDbToScore = (avg) => {
    if (avg <= 20) return 10;
    if (avg <= 40) return 8;
    if (avg <= 55) return 6;
    if (avg <= 70) return 4;
    if (avg <= 90) return 2;
    return 1;
  };

  const earConditionText = (avg) => {
    if (avg <= 20) return "Normal hearing";
    if (avg <= 40) return "Mild hearing loss";
    if (avg <= 55) return "Moderate hearing loss";
    if (avg <= 70) return "Moderately-severe hearing loss";
    if (avg <= 90) return "Severe hearing loss";
    return "Profound hearing loss";
  };

  const earAdviceText = (avg) => {
    if (avg <= 20) return "✅ No action needed — just monitor over time.";
    if (avg <= 40)
      return "ℹ️ Monitor hearing; consider checkup if issues persist.";
    if (avg <= 55)
      return "🔍 Full evaluation recommended; hearing aids may help.";
    if (avg <= 70)
      return "🎧 Strongly consider hearing aids and audiologist visit.";
    if (avg <= 90) return "⚠️ Hearing aids likely beneficial; consult soon.";
    return "🚨 Urgent: specialist evaluation required.";
  };

  const asymmetryFlag = () =>
    Math.abs(earAvgHL("left") - earAvgHL("right")) >= 15;

  const makeChartData = (ear, color) => ({
    labels: frequencies.map((f) => `${f} Hz`),
    datasets: [
      {
        label: `${ear} ear`,
        data: frequencies.map((f) => normalizeToHL(results[ear][f])),
        borderColor: color,
        backgroundColor: color,
        tension: 0.2,
        pointRadius: 6,
        spanGaps: true,
      },
    ],
  });

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      scales: {
        y: {
          reverse: true,
          title: { display: true, text: "dB HL" },
          min: 0,
          max: 100,
        },
        x: { title: { display: true, text: "Frequency (Hz)" } },
      },
    }),
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-green-500 mb-6 text-center">
          Audiometry Hearing Test
        </h1>

        <div className="flex flex-col items-center mb-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="border rounded-md bg-black"
            style={{ width: 320, height: 240 }}
          />
          {!camRunning && (
            // --- STYLING CHANGE: Button changed from purple to green ---
            <button
              onClick={startCamera}
              className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg shadow mt-3"
              disabled={isLoading}
            >
              {isLoading
                ? "🔊 Loading Audio..."
                : "🎥 Start Camera for Gestures"}
            </button>
          )}
          <p className="mt-2 text-gray-700 h-6">Gesture: {gesture || "None"}</p>
        </div>

        {isLoading ? (
          <div className="text-center p-6 bg-white rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold text-gray-700">
              Preparing Test...
            </h2>
            <p className="text-gray-500 mt-2">
              Please wait while the audio files are being loaded.
            </p>
          </div>
        ) : !testComplete ? (
          <div className="bg-white shadow-lg rounded-xl p-6 text-center space-y-4">
            <p className="text-gray-700">
              Ear:{" "}
              <span className="font-semibold text-green-500">
                {ears[currentEarIndex]}
              </span>{" "}
              | Frequency:{" "}
              <span className="font-semibold">
                {frequencies[currentFreqIndex]} Hz
              </span>{" "}
              | Intensity:{" "}
              <span className="font-semibold">
                {testLogicState.intensity} dB HL
              </span>
            </p>

            <div className="flex justify-center gap-4 mt-4">
              <button
                className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg shadow"
                onClick={playCurrentTone}
                disabled={isPlaying}
              >
                ▶ Play Tone
              </button>
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-lg shadow"
                onClick={recordHeard}
              >
                👍 Heard
              </button>
              <button
                className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2 rounded-lg shadow"
                onClick={recordNotHeard}
              >
                👎 Not Heard
              </button>
            </div>

            <div className="mt-4 flex justify-center">
              {/* --- STYLING CHANGE: Removed bg-white class --- */}
              <canvas
                ref={canvasRef}
                width={600}
                height={80}
                className="border rounded"
                style={{ width: "100%", maxWidth: 600 }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="bg-green-50 border border-green-300 text-green-700 font-medium rounded-lg p-4 text-center mb-6">
              ✅ Test Completed Successfully
            </div>
            <div className="text-center mt-6">
              <button
                onClick={() => navigate("/results")}
                className="bg-green-600 text-white px-6 py-3 rounded-xl shadow hover:bg-green-700 transition cursor-pointer"
              >
                View Past Results
              </button>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white shadow-lg rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">
              Left Ear Audiogram
            </h2>
            <Line
              data={makeChartData("left", "#3b82f6")}
              options={chartOptions}
            />
          </div>
          <div className="bg-white shadow-lg rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-600">
              Right Ear Audiogram
            </h2>
            <Line
              data={makeChartData("right", "#ef4444")}
              options={chartOptions}
            />
          </div>
        </div>

        {testComplete && (
          <div className="bg-white shadow-lg rounded-xl p-6 mt-8">
            <h2 className="text-xl font-semibold text-center mb-6">
              Post-Test Summary & Recommendations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-bold text-blue-600 mb-2">
                  Left Ear
                </h3>
                <p>
                  Avg (dB HL): <b>{earAvgHL("left")}</b>
                </p>
                <p>
                  Score (1–10): <b>{mapAvgDbToScore(earAvgHL("left"))}</b>
                </p>
                <p className="mb-2">
                  Condition:{" "}
                  <span className="font-semibold">
                    {earConditionText(earAvgHL("left"))}
                  </span>
                </p>
                <p className="text-sm text-gray-700">
                  {earAdviceText(earAvgHL("left"))}
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-bold text-red-600 mb-2">
                  Right Ear
                </h3>
                <p>
                  Avg (dB HL): <b>{earAvgHL("right")}</b>
                </p>
                <p>
                  Score (1–10): <b>{mapAvgDbToScore(earAvgHL("right"))}</b>
                </p>
                <p className="mb-2">
                  Condition:{" "}
                  <span className="font-semibold">
                    {earConditionText(earAvgHL("right"))}
                  </span>
                </p>
                <p className="text-sm text-gray-700">
                  {earAdviceText(earAvgHL("right"))}
                </p>
              </div>
            </div>
            {asymmetryFlag() && (
              <p className="text-red-600 font-medium mt-6 text-center">
                ⚠️ Significant asymmetry between ears (≥15 dB). Professional
                evaluation strongly recommended.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
