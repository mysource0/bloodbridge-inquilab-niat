# 🩸 BloodBridge AI

BloodBridge is an AI-powered, gamified platform designed to connect blood donors with patients in real-time via a conversational WhatsApp interface. Our mission is to eliminate the desperate, time-consuming search for blood, particularly for patients with chronic conditions like Thalassemia who require regular transfusions.

## ✨ Core Features

*   **🤖 AI-Powered Chatbot:** A WhatsApp bot, driven by Google Gemini, that handles user registration, emergency requests, and FAQs using natural language.
*   **🌉 Blood Bridges:** A flagship feature that creates dedicated, rotating groups of donors for patients with long-term, recurring transfusion needs.
*   **🧠 Predictive Donor Matching:** A Python ML microservice that scores donors based on availability and reliability to find the best possible match for any request.
*   **🏆 Gamification & Engagement:** A system that awards points and badges to encourage and retain a motivated community of donors.
*   **💻 Admin Dashboard:** A comprehensive web app built with React for admins to monitor all platform activity, manage users, and trigger actions in real-time.

## 🏗️ System Architecture

The project is built on a modern microservices architecture:
[ React Admin Dashboard ] <--> [ Node.js Backend API ] <--> [ Supabase (Postgres) DB ]
(Vite) (Express) |
| +---> [ Python ML Service ]
+----------------------------> (FastAPI)
|
+----------------------------> [ WhatsApp Webhook ]
(Meta API)
code
Code
## 🛠️ Technology Stack

*   **Backend:** Node.js, Express.js
*   **Frontend:** React (Vite), Material-UI (MUI)
*   **ML Service:** Python, FastAPI, Sentence Transformers, PyTorch
*   **Database:** PostgreSQL (managed by Supabase)
*   **AI Orchestration:** Google Gemini for function-calling
*   **Real-time:** Supabase Realtime

---

## 🚀 Getting Started

To run this project locally, you will need three separate terminals. Follow the setup instructions for each component.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or later recommended)
*   [Python](https://www.python.org/) (v3.9 or later recommended)
*   `git` installed on your machine.

### 1. Backend Setup (Node.js)

The backend is the core of the application.

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Create an environment file
# Create a new file named .env in the `backend` directory
# and paste the contents of `.env.example` into it.
backend/.env file:
Fill this file with your actual secret keys. Use the Connection Pooler URI from Supabase.
code
Ini
# backend/.env

PORT=3001
JWT_SECRET="YOUR_RANDOM_JWT_SECRET"
DATABASE_URL="YOUR_SUPABASE_CONNECTION_POOLER_URI"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
ML_SERVICE_URL="http://localhost:8000"
WHATSAPP_TOKEN="YOUR_WHATSAPP_TOKEN"
WHATSAPP_PHONE_NUMBER_ID="YOUR_WHATSAPP_PHONE_ID"
WHATSAPP_APP_SECRET="YOUR_WHATSAPP_APP_SECRET"
WHATSAPP_VERIFY_TOKEN="YOUR_CUSTOM_VERIFY_TOKEN"
ADMIN_DEMO_PHONE="+91..."
2. ML Service Setup (Python)
This service handles donor scoring and smart FAQs.
code
Bash
# 1. Navigate to the ml_services directory
cd ml_services

# 2. Create a Python virtual environment
python -m venv venv

# 3. Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Create an environment file
# Create a new file named .env in the `ml_services` directory.
ml_services/.env file:
This file only needs your database URL for the RAG feature.
code
Ini
# ml_services/.env

DATABASE_URL="YOUR_SUPABASE_CONNECTION_POOLER_URI"
3. Admin Dashboard Setup (React)
This is the frontend UI.
code
Bash
# 1. Navigate to the admin-dashboard directory
cd admin-dashboard

# 2. Install dependencies
npm install

# 3. Create an environment file
# Create a new file named .env in the `admin-dashboard` directory.
admin-dashboard/.env file:
This needs the public keys for Supabase Realtime functionality. Get these from your Supabase project's API Settings.
code
Ini
# admin-dashboard/.env

VITE_SUPABASE_URL="YOUR_PUBLIC_SUPABASE_PROJECT_URL"
VITE_SUPABASE_ANON_KEY="YOUR_PUBLIC_SUPABASE_ANON_KEY"
▶️ Running the Application
You must have three separate terminals open and running simultaneously.
Terminal 1: Start the Backend
code
Bash
cd backend
npm start
Expected output: ✅ BloodBridge AI backend is running on port 3001
Terminal 2: Start the ML Service
code
Bash
cd ml_services
# Make sure your virtual environment is active
uvicorn main:app --reload
Expected output: INFO: Uvicorn running on http://127.0.0.1:8000
Terminal 3: Start the Admin Dashboard
code
Bash
cd admin-dashboard
npm run dev
Expected output: A local server address, usually http://localhost:5173
Accessing the Application
Open your browser and navigate to the address from Terminal 3 (e.g., http://localhost:5173).
Log in with the admin credentials:
Phone: The value of ADMIN_DEMO_PHONE from your backend .env file (e.g., +918000000000).
Password: admin123 (this is hardcoded in adminController.js for demo purposes).
