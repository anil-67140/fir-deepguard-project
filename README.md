# 🛡️ DeepGuard — AI-Driven Financial Forensics Platform

### Iqra University FYP 2026 | Supervised

---

## 👥 Team

---

## 📁 Project Structure

```
deepguard/
├── colab/                          # Google Colab Model Training
│   └── DeepGuard_Model_Training.ipynb
├── fastapi/                        # Python AI Engine
│   ├── main.py
│   ├── requirements.txt
│   └── models/                     # ← Place trained models here
│       ├── isolation_forest.pkl
│       ├── autoencoder.h5
│       ├── scaler.pkl
│       ├── model_metadata.json
│       └── feature_names.json
├── backend/                        # Node.js Express Backend
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── config/db.js
│   ├── models/Transaction.js
│   └── routes/
│       ├── auth.js
│       ├── upload.js
│       ├── analysis.js
│       ├── graph.js
│       ├── reports.js
│       ├── admin.js
│       └── dashboard.js
├── frontend/                       # React.js Frontend
│   ├── package.json
│   └── src/
│       ├── App.js
│       ├── index.js
│       ├── index.css
│       ├── store/index.js
│       ├── services/api.js
│       ├── pages/
│       │   ├── LoginPage.js
│       │   ├── DashboardPage.js
│       │   ├── UploadPage.js
│       │   ├── AnalysisPage.js
│       │   ├── GraphPage.js
│       │   ├── ReportsPage.js
│       │   └── AdminPage.js
│       └── components/
│           └── dashboard/Layout.js
└── docs/
    └── supabase_schema.sql
```

---

## 🚀 COMPLETE SETUP GUIDE

### STEP 1 — Prerequisites

Install these first:

- [Node.js v18+](https://nodejs.org)
- [Python 3.10+](https://python.org)
- [MongoDB Community](https://www.mongodb.com/try/download/community)
- [Ollama](https://ollama.ai) (free local LLM)
- A [Supabase](https://supabase.com) account (free tier)

---

### STEP 2 — Train AI Models (Google Colab)

1. Go to [Google Colab](https://colab.research.google.com)
2. Upload `colab/DeepGuard_Model_Training.ipynb`
3. Enable GPU: Runtime → Change runtime type → T4 GPU
4. Download IBM AML dataset from Kaggle:
   - https://www.kaggle.com/datasets/ealtman2019/ibm-transactions-for-anti-money-laundering-aml
   - Download `HI_Small_Trans.csv`
5. Upload the CSV to Colab Files panel
6. Run all cells (takes ~15 min on GPU)
7. Download `deepguard_models.zip` when prompted
8. Extract and copy all files to `fastapi/models/`

---

### STEP 3 — Setup Supabase

1. Create project at https://supabase.com
2. Go to SQL Editor → paste contents of `docs/supabase_schema.sql` → Run
3. Go to Authentication → Enable Email/Password sign-in
4. Create your first user: Authentication → Users → Add User
5. Run this SQL to make them admin:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
   ```
6. Copy your Project URL and API keys from Settings → API

---

### STEP 4 — Setup FastAPI (AI Engine)

```bash
cd fastapi

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify models are in place
ls models/
# Should show: isolation_forest.pkl, autoencoder.h5, scaler.pkl, model_metadata.json, feature_names.json

# Start FastAPI
python main.py
# Runs on http://localhost:8000
# API docs: http://localhost:8000/docs
```

---

### STEP 5 — Setup Node.js Backend

```bash
cd backend

# Install dependencies
npm install

# Copy and edit environment file
cp .env.example .env

# Edit .env with your values:
# MONGO_URI=mongodb://localhost:27017/deepguard
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_KEY=your-service-role-key
# JWT_SECRET=your-random-secret-key-here
# FASTAPI_URL=http://localhost:8000

# Start backend
npm run dev
# Runs on http://localhost:5000
```

---

### STEP 6 — Setup React Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env

# Start frontend
npm start
# Opens http://localhost:3000
```

---

### STEP 7 — Setup Ollama (Free LLM for Reports)

```bash
# Install from https://ollama.ai

# Pull the free Llama model
ollama pull llama3.2

# Verify it runs
ollama run llama3.2 "Hello"

# Ollama runs automatically on http://localhost:11434
# DeepGuard will use it automatically for PDF report generation
# If not running, reports still work using template text
```

---

### STEP 8 — Start Everything Together

Open 4 terminal windows:

```bash
# Terminal 1 — MongoDB
mongod

# Terminal 2 — FastAPI AI Engine
cd fastapi && source venv/bin/activate && python main.py

# Terminal 3 — Node.js Backend
cd backend && npm run dev

# Terminal 4 — React Frontend
cd frontend && npm start

# Optional Terminal 5 — Ollama
ollama serve
```

Open http://localhost:3000 → Login with your Supabase credentials

---

## 📊 Dataset Setup

**IBM AML Dataset (HI-Small)**

- URL: https://www.kaggle.com/datasets/ealtman2019/ibm-transactions-for-anti-money-laundering-aml
- File to download: `HI_Small_Trans.csv`
- Size: ~500MB | ~5 million transactions
- Laundering rate: 1 in 981 transactions

**Column Reference:**
| Column | Description |
|--------|-------------|
| Timestamp | Transaction date/time |
| From Bank | Sender bank ID |
| Account | Sender account number |
| To Bank | Receiver bank ID |
| Account.1 | Receiver account number |
| Amount Received | Amount the receiver got |
| Receiving Currency | Currency received |
| Amount Paid | Amount the sender paid |
| Payment Currency | Currency used to pay |
| Payment Format | Bank Transfer/Wire/Cash/Cheque/ACH/Credit Card/Reinvestment |
| Is Laundering | 0=Legitimate, 1=Money Laundering (used for evaluation only) |

---

## 🔑 API Endpoints Reference

### FastAPI (port 8000)

| Method | Endpoint           | Description                           |
| ------ | ------------------ | ------------------------------------- |
| GET    | `/`                | Health check + model status           |
| GET    | `/health`          | Quick health check                    |
| POST   | `/analyze`         | Upload file → get fraud scores + SHAP |
| POST   | `/explain/{index}` | Get SHAP for specific transaction     |

### Node.js Backend (port 5000)

| Method | Endpoint                        | Description                              |
| ------ | ------------------------------- | ---------------------------------------- |
| POST   | `/api/auth/login`               | Login → get JWT token                    |
| GET    | `/api/auth/me`                  | Get current user                         |
| POST   | `/api/upload`                   | Upload CSV/Excel → trigger AI analysis   |
| GET    | `/api/upload/history`           | Get all uploads                          |
| GET    | `/api/analysis/:id`             | Get analysis results (paginated)         |
| GET    | `/api/analysis/:id/stats`       | Get summary statistics                   |
| GET    | `/api/graph/:id`                | Get Cytoscape.js graph data              |
| GET    | `/api/graph/:id/trace/:account` | Trace account via $graphLookup           |
| POST   | `/api/reports/generate/:id`     | Generate PDF report (Puppeteer + Ollama) |
| GET    | `/api/dashboard/summary`        | Get dashboard stats                      |
| GET    | `/api/admin/users`              | List all users (admin only)              |
| GET    | `/api/admin/logs`               | View audit logs (admin only)             |

---

## 🎯 Model Architecture

```
IBM AML CSV
    ↓
Preprocessing (pandas + sklearn)
    ↓
MinMax Normalization
    ↓
    ├── Isolation Forest (n_estimators=100)
    │   Score: -1 to +1 → normalized 0-100%
    │
    └── Deep Autoencoder
        Input → Dense 32 → Dense 16 → Bottleneck 8
               → Dense 16 → Dense 32 → Output
        Score: MSE reconstruction error → 0-100%
    ↓
Ensemble Score = 50% IF + 50% AE
    ↓
SHAP (TreeExplainer on Isolation Forest)
    ↓
MongoDB Storage + Cytoscape.js Graph
    ↓
Puppeteer PDF + Ollama AI Summary
```

---

## 📈 Model Performance (IBM HI-Small)

| Metric    | Isolation Forest | Autoencoder | **Ensemble** |
| --------- | ---------------- | ----------- | ------------ |
| ROC-AUC   | ~78%             | ~97%        | **~96%**     |
| F1 Score  | ~65%             | ~93%        | **~94%**     |
| Precision | ~60%             | ~94%        | **~94%**     |
| Recall    | ~70%             | ~92%        | **~92%**     |

---

## ⚠️ Troubleshooting

**FastAPI won't start:**

- Check Python version: `python --version` (need 3.10+)
- Check models exist in `fastapi/models/`
- Check TensorFlow: `pip install tensorflow==2.15.0`

**MongoDB connection failed:**

- Start MongoDB: `mongod` or start MongoDB service
- Check MONGO_URI in `.env`

**Supabase auth error:**

- Verify SUPABASE_URL and SUPABASE_SERVICE_KEY in `.env`
- Check user exists in Supabase dashboard

**PDF generation fails:**

- Install Puppeteer: `npm install puppeteer`
- On Linux: `apt-get install -y chromium-browser`

**Graph not showing:**

- Upload a file and complete analysis first
- Check browser console for Cytoscape.js errors
- Ensure MongoDB has FinancialEntity documents

**Ollama not working:**

- Run: `ollama serve` in separate terminal
- Pull model: `ollama pull llama3.2`
- Reports will still work without it using template text

---

## 🎓 Academic References

1. Liu, Ting & Zhou (2008) — Isolation Forest — IEEE ICDM — https://ieeexplore.ieee.org/document/4781136
2. Lundberg & Lee (2017) — SHAP — NeurIPS — https://arxiv.org/abs/1705.07874
3. IBM AML Dataset (2023) — Altman et al. — arXiv:2306.16424
4. Autoencoder for Fraud (2021) — IEEE — https://ieeexplore.ieee.org/document/9389940
5. GNN + Autoencoder Banking (2024) — IEEE — https://ieeexplore.ieee.org/document/10689393

---

_DeepGuard | Iqra University FYP 2026 | Department of Computer Science_
