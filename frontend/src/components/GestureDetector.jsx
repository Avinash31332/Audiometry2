// src/components/GestureDetector.js

import React, { useEffect, useRef, useState } from "react";
import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";

const GestureDetector = ({ onThumbsUp }) => {
  const videoRef = useRef(null);
  const [gestureRecognizer, setGestureRecognizer] = useState(null);
  const [isWebcamRunning, setIsWebcamRunning] = useState(false);

  // Initialize the Gesture Recognizer
  useEffect(() => {
    const createGestureRecognizer = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/gesture_recognizer.task", // Path from public folder
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      setGestureRecognizer(recognizer);
    };

    createGestureRecognizer();
  }, []);

  // Start or stop the webcam
  const enableWebcam = () => {
    if (!gestureRecognizer) {
      alert("Please wait for gesture recognizer to load");
      return;
    }

    if (isWebcamRunning) {
      setIsWebcamRunning(false);
      const stream = videoRef.current?.srcObject;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    } else {
      setIsWebcamRunning(true);
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
      });
    }
  };

  // Prediction loop
  const predictWebcam = async () => {
    if (!videoRef.current || !gestureRecognizer) return;

    const video = videoRef.current;
    const results = gestureRecognizer.recognizeForVideo(video, Date.now());

    if (results.gestures.length > 0) {
      const gesture = results.gestures[0][0];

      if (gesture.categoryName === "Thumbs_Up" && gesture.score > 0.85) {
        console.log("👍 Thumbs Up Detected");
        onThumbsUp();
      }
    }

    if (isWebcamRunning) {
      requestAnimationFrame(predictWebcam);
    }
  };

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: "640px",
          height: "480px",
          borderRadius: "12px",
          border: "2px solid gray",
        }}
      ></video>
      <button onClick={enableWebcam} style={{ marginTop: "10px" }}>
        {isWebcamRunning ? "Stop Camera" : "Start Camera"}
      </button>
    </div>
  );
};

export default GestureDetector;
