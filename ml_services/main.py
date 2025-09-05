# ml_services/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from sentence_transformers import SentenceTransformer, util
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
os.environ['SENTENCE_TRANSFORMERS_HOME'] = './.cache'

print("Loading sentence-transformer model...")
MODEL_NAME = 'all-MiniLM-L6-v2'
model = SentenceTransformer(MODEL_NAME)
print("Model loaded successfully.")

DATABASE_URL = os.getenv('DATABASE_URL')
conn = None
try:
    print("Connecting to the database for RAG...")
    conn = psycopg2.connect(DATABASE_URL)
    print("Database connection successful.")
except psycopg2.OperationalError as e:
    print(f"FATAL: Could not connect to the database: {e}")
    conn = None

knowledge_cache = []

# --- Pydantic Models ---
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

# ✅ NEW: Models for the RAG endpoint
class RagRequest(BaseModel):
    query: str

class RagResponse(BaseModel):
    answer: str
    source_found: bool

# --- FastAPI App ---
app = FastAPI(title="BloodBridge AI Engine (Scoring & RAG)")

# --- Helper Functions ---
def calculate_availability_score(last_donation_date: Optional[str]) -> float:
    if not last_donation_date:
        return 100.0
    try:
        last_date = datetime.fromisoformat(last_donation_date.replace('Z', '+00:00'))
        days_since = (datetime.now(last_date.tzinfo) - last_date).days
        if days_since >= 90:
            return 100.0
        if days_since < 56:
            return 0.0
        return round(((days_since - 56) / (90 - 56)) * 100, 2)
    except (ValueError, TypeError):
        return 100.0

def calculate_reliability_score(streak: int, notifications: int, confirmations: int) -> float:
    streak_score = min(streak * 10, 40)
    if notifications == 0:
        response_score = 40.0
    else:
        response_rate = confirmations / notifications
        response_score = response_rate * 60
    return min(streak_score + response_score, 100.0)

# ✅ NEW: Function to load and vectorize the knowledge base
def load_knowledge_base():
    global knowledge_cache
    if not conn:
        print("WARNING: Database connection not available. Knowledge base will be empty.")
        return

    print("Loading and vectorizing knowledge base from database...")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, content FROM knowledge_base;")
            rows = cur.fetchall()
            contents = [row[1] for row in rows]
            embeddings = model.encode(contents, convert_to_tensor=True)
            knowledge_cache = [
                {'id': rows[i][0], 'content': contents[i], 'embedding': embeddings[i]}
                for i in range(len(rows))
            ]
            print(f"Loaded and vectorized {len(knowledge_cache)} documents into memory.")
    except Exception as e:
        print(f"Error loading knowledge base: {e}")
        knowledge_cache = []

# ✅ NEW: FastAPI startup event to load the data
@app.on_event("startup")
async def startup_event():
    load_knowledge_base()

# --- API Endpoints ---
@app.get("/health", summary="Health Check")
async def health_check():
    return {"status": "healthy", "knowledge_base_items": len(knowledge_cache)}

@app.post("/score-donor", response_model=DonorScoreResponse, summary="Scores a single donor")
async def score_donor(request: DonorScoreRequest):
    availability = calculate_availability_score(request.last_donation_date)
    reliability = calculate_reliability_score(
        request.streak_count, request.notifications_received, request.donations_confirmed
    )
    final_score = (availability * 0.6) + (reliability * 0.4)
    if availability == 0:
        final_score = 0

    return DonorScoreResponse(
        donor_id=request.donor_id,
        availability_score=availability,
        reliability_score=reliability,
        final_score=round(final_score, 2)
    )

# ✅ NEW: The fully implemented RAG endpoint
@app.post("/generate-faq-answer", response_model=RagResponse, summary="Answers a question using RAG")
async def generate_faq_answer(request: RagRequest):
    if not knowledge_cache:
        raise HTTPException(status_code=503, detail="Knowledge base is not loaded.")

    query_embedding = model.encode(request.query, convert_to_tensor=True)

    best_match = None
    highest_similarity = -1.0

    for doc in knowledge_cache:
        similarity = util.pytorch_cos_sim(query_embedding, doc['embedding'])[0][0].item()
        if similarity > highest_similarity:
            highest_similarity = similarity
            best_match = doc

    SIMILARITY_THRESHOLD = 0.5
    if best_match and highest_similarity > SIMILARITY_THRESHOLD:
        answer = best_match['content'].split('A: ')[-1]
        return RagResponse(answer=answer, source_found=True)
    else:
        default_answer = (
            "Thank you for your question. I'm not sure about that. "
            "An NGO volunteer will get back to you shortly."
        )
        return RagResponse(answer=default_answer, source_found=False)
