# ml_services/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sentence_transformers import SentenceTransformer, util
import os
import psycopg2
from dotenv import load_dotenv # <-- ADD THIS LINE

load_dotenv() # <-- AND ADD THIS LINE

# --- Configuration ---
# Caches the ML model locally to avoid re-downloading
os.environ['SENTENCE_TRANSFORMERS_HOME'] = './.cache'

print("Loading sentence-transformer model...")
MODEL_NAME = 'all-MiniLM-L6-v2'
model = SentenceTransformer(MODEL_NAME)
print("Model loaded successfully.")

# --- Pydantic Models for type validation ---
class DonorScoreRequest(BaseModel):
    donor_id: str
    last_donation_date: Optional[str] = None
    streak_count: int = 0
    notifications_received: int = 0
    donations_confirmed: int = 0

class DonorScoreResponse(BaseModel):
    donor_id: str
    availability_score: float
    reliability_score: float
    final_score: float

# --- FastAPI App ---
app = FastAPI(title="BloodBridge AI Engine")

# --- Helper Functions ---
def calculate_availability_score(last_donation_date: Optional[str]) -> float:
    if not last_donation_date:
        return 100.0
    try:
        last_date = datetime.fromisoformat(last_donation_date.replace('Z', '+00:00'))
        days_since = (datetime.now(last_date.tzinfo) - last_date).days
        if days_since >= 90: return 100.0
        if days_since < 56: return 0.0
        # Linearly scale the score between 56 and 90 days
        return round(((days_since - 56) / (90 - 56)) * 100, 2)
    except (ValueError, TypeError):
        return 100.0 # Default to available if date is invalid

def calculate_reliability_score(streak: int, notifications: int, confirmations: int) -> float:
    # Score based on donation streak (max 40 points)
    streak_score = min(streak * 10, 40)
    
    # Score based on response rate (max 60 points)
    if notifications == 0:
        response_score = 40.0 # Default score for new donors
    else:
        response_rate = confirmations / notifications
        response_score = response_rate * 60
        
    return min(streak_score + response_score, 100.0)

# --- API Endpoints ---
@app.get("/health", summary="Health Check")
async def health_check():
    return {"status": "healthy"}

@app.post("/score-donor", response_model=DonorScoreResponse, summary="Scores a single donor")
async def score_donor(request: DonorScoreRequest):
    availability = calculate_availability_score(request.last_donation_date)
    
    reliability = calculate_reliability_score(
        request.streak_count, 
        request.notifications_received, 
        request.donations_confirmed
    )
    
    # Final score is a weighted average
    final_score = (availability * 0.6) + (reliability * 0.4)
    if availability == 0:
        final_score = 0
        
    return DonorScoreResponse(
        donor_id=request.donor_id,
        availability_score=availability,
        reliability_score=reliability,
        final_score=round(final_score, 2)
    )