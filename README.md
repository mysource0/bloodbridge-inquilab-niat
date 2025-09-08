🩸 BloodBridge AI

**BloodBridge AI** is an AI-powered, gamified platform that connects blood donors with patients in real-time through a conversational WhatsApp interface.  
Our mission is to eliminate the desperate, time-consuming search for blood — especially for patients with chronic conditions like **Thalassemia**, who require regular transfusions.  

⚡ **Project Status**: Feature-complete MVP (all core chatbot, services, and dashboard logic fully implemented & functional).  

---

## ✨ Core Features

- 🤖 **AI-Powered Chatbot**  
  WhatsApp bot powered by **Google Gemini**, handling registration, emergency requests & FAQs with natural conversation flow.  

- 🌉 **Blood Bridges**  
  Rotating donor groups tailored for patients with recurring transfusion needs.  

- 🧠 **Predictive Donor Matching**  
  Python ML microservice scores donors based on **availability & reliability** to ensure the best matches.  

- 🏆 **Gamification & Engagement**  
  Points & badges to build a **motivated donor community**.  

- 💻 **Admin Dashboard**  
  React-based dashboard for admins to **monitor activity, manage users, and trigger real-time actions**.  

---

## 🏗️ System Architecture

BloodBridge AI is built on a microservices architecture to ensure scalability, modularity, and maintainability. The system integrates multiple components to handle real-time blood donor matching, user engagement, and administrative oversight. Below is a breakdown of the architecture, including data flows and interactions between services.
Architecture Diagram
text[ Users (WhatsApp) ] <--> [ WhatsApp API (Meta) ] <--> [ Node.js Backend (Express) ] <--> [ Supabase DB (PostgreSQL) ]
                                                            |
                                                            +--> [ Google Gemini API ] (AI Orchestration)
                                                            |
                                                            +--> [ Python ML Service (FastAPI) ] (Donor Scoring)
                                                            |
[ Admin Users ] <--> [ React Admin Dashboard (Vite) ] <--+ (REST API)
                                                            |
                                                            +--> [ Supabase Realtime ] (Live Updat
🛠️ Tech Stack
Backend: Node.js, Express.js

Frontend: React (Vite), Material-UI (MUI)

ML Service: Python, FastAPI, Sentence Transformers, PyTorch

Database: PostgreSQL (Supabase managed)

AI Orchestration: Google Gemini API

Realtime: Supabase Realtime

🚀 Getting Started
✅ Prerequisites
Node.js v18+

Python v3.9+

Git installed

Supabase Account

Meta for Developers Account (for WhatsApp Business API)

1️⃣ Clone the Repository
bash
Copy code
git clone <your-repository-url>
cd <your-repository-folder>
2️⃣ Set Up the Database (Supabase)
Create a new Supabase project.

Go to Database → Connection Pooling and copy the connection string (postgresql://...).

In SQL Editor, click New query and run the contents of db.txt to create tables & functions.

3️⃣ Configure Environment Variables
📌 Backend (backend/.env)
ini
Copy code
PORT=3001
JWT_SECRET="generate-a-strong-random-secret-key"
DATABASE_URL="YOUR_SUPABASE_CONNECTION_POOLER_URI"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
ML_SERVICE_URL="http://localhost:8000"
WHATSAPP_TOKEN="YOUR_WHATSAPP_TEMPORARY_ACCESS_TOKEN"
WHATSAPP_PHONE_NUMBER_ID="YOUR_WHATSAPP_PHONE_NUMBER_ID"
WHATSAPP_APP_SECRET="YOUR_WHATSAPP_APP_SECRET"
WHATSAPP_VERIFY_TOKEN="create-a-custom-verify-token"
ADMIN_DEMO_PHONE="+91..."
📌 ML Service (ml_services/.env)
ini
Copy code
DATABASE_URL="YOUR_SUPABASE_CONNECTION_POOLER_URI"
📌 Admin Dashboard (admin-dashboard/.env)
ini
Copy code
VITE_SUPABASE_URL="YOUR_PUBLIC_SUPABASE_PROJECT_URL"
VITE_SUPABASE_ANON_KEY="YOUR_PUBLIC_SUPABASE_ANON_KEY"
4️⃣ Install Dependencies
Backend
bash
Copy code
cd backend
npm install
ML Service
bash
Copy code
cd ml_services
python -m venv venv
# Activate venv:
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
Frontend
bash
Copy code
cd admin-dashboard
npm install
5️⃣ Run the Application
Start Backend
bash
Copy code
cd backend
npm start
# ✅ BloodBridge AI backend is running on port 3001
Start ML Service
bash
Copy code
cd ml_services
uvicorn main:app --reload
# INFO: Uvicorn running on http://127.0.0.1:8000
Start Frontend
bash
Copy code
cd admin-dashboard
npm run dev
# Local server: http://localhost:5173
6️⃣ Access the Application
Open browser → http://localhost:5173

Log in with:

Phone: ADMIN_DEMO_PHONE from backend .env

Password: admin123

🎉 Next Steps
📱 Test WhatsApp Bot: Send messages to your WhatsApp Business number.

📊 Explore Admin Dashboard: Monitor live activity & manage users.

🤝 Contribute: Check out our contributing guidelines.

📚 Resources
Supabase Docs

Meta WhatsApp API

Google Gemini API

💬 Contact
📧 support@bloodbridge.ai
❤️ Let’s save lives together!

pgsql
Copy code
