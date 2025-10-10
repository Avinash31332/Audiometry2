from fastapi import FastAPI
from pydantic import BaseModel
import base64
import cv2
import numpy as np
import mediapipe as mp

app = FastAPI()

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=True, max_num_hands=1)
mp_drawing = mp.solutions.drawing_utils

class Frame(BaseModel):
    image: str

@app.post("/detect")
def detect_gesture(data: Frame):
    # Decode base64 image
    img_data = base64.b64decode(data.image.split(",")[1])
    np_arr = np.frombuffer(img_data, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    results = hands.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

    if results.multi_hand_landmarks:
        return {"gesture": "thumbs_up"}  # For now, assume detected
    return {"gesture": "none"}
