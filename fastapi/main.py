"""
DeepGuard — Python FastAPI AI Engine
Isolation Forest + Deep Autoencoder + SHAP
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import numpy as np
import joblib
import json
import os
import io
import shap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import base64
import warnings
warnings.filterwarnings('ignore')

# TensorFlow
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import tensorflow as tf
from tensorflow import keras

app = FastAPI(
    title="DeepGuard AI Engine",
    description="Isolation Forest + Deep Autoencoder + SHAP for Financial Fraud Detection",
    version="1.0.0"
)

# CORS — allow Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# LOAD MODELS ON STARTUP
# ============================================================
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

iso_forest = None
autoencoder = None
scaler = None
model_metadata = None
feature_names = None
shap_explainer = None

@app.on_event("startup")
async def load_models():
    global iso_forest, autoencoder, scaler, model_metadata, feature_names, shap_explainer

    try:
        iso_forest = joblib.load(os.path.join(MODELS_DIR, "isolation_forest.pkl"))
        print("✅ Isolation Forest loaded")
    except Exception as e:
        print(f"❌ Isolation Forest failed: {e}")

    try:
        autoencoder = keras.models.load_model(os.path.join(MODELS_DIR, "autoencoder.h5"))
        print("✅ Autoencoder loaded")
    except Exception as e:
        print(f"❌ Autoencoder failed: {e}")

    try:
        scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))
        print("✅ Scaler loaded")
    except Exception as e:
        print(f"❌ Scaler failed: {e}")

    try:
        with open(os.path.join(MODELS_DIR, "model_metadata.json")) as f:
            model_metadata = json.load(f)
        print(f"✅ Metadata loaded — threshold: {model_metadata.get('ae_threshold', 'N/A')}")
    except Exception as e:
        print(f"❌ Metadata failed: {e}")
        model_metadata = {"ae_threshold": 0.1, "contamination_rate": 0.001}

    try:
        with open(os.path.join(MODELS_DIR, "feature_names.json")) as f:
            feature_names = json.load(f)
        print(f"✅ Feature names loaded — {len(feature_names)} features")
    except Exception as e:
        print(f"❌ Feature names failed: {e}")

    try:
        if iso_forest is not None:
            shap_explainer = shap.TreeExplainer(iso_forest)
            print("✅ SHAP explainer initialized")
    except Exception as e:
        print(f"⚠️ SHAP explainer failed: {e}")


# ============================================================
# PREPROCESSING FUNCTION
# ============================================================
def preprocess_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Apply same preprocessing as Colab training notebook"""
    df_proc = df.copy()

    # Standardize column names
    col_renames = {}
    cols = list(df_proc.columns)
    account_cols = [c for c in cols if 'account' in c.lower()]
    if len(account_cols) >= 2:
        col_renames[account_cols[0]] = 'From Account'
        col_renames[account_cols[1]] = 'To Account'
    if col_renames:
        df_proc = df_proc.rename(columns=col_renames)

    # Drop missing values
    df_proc = df_proc.dropna()

    # Timestamp features
    if 'Timestamp' in df_proc.columns:
        try:
            df_proc['Timestamp'] = pd.to_datetime(df_proc['Timestamp'])
            df_proc['Hour'] = df_proc['Timestamp'].dt.hour
            df_proc['DayOfWeek'] = df_proc['Timestamp'].dt.dayofweek
            df_proc['DayOfMonth'] = df_proc['Timestamp'].dt.day
            df_proc['Month'] = df_proc['Timestamp'].dt.month
            df_proc['IsWeekend'] = (df_proc['DayOfWeek'] >= 5).astype(int)
            df_proc['IsOffHours'] = ((df_proc['Hour'] < 8) | (df_proc['Hour'] > 20)).astype(int)
        except:
            pass

    # Amount features
    if 'Amount Paid' in df_proc.columns and 'Amount Received' in df_proc.columns:
        df_proc['Amount Difference'] = abs(df_proc['Amount Paid'] - df_proc['Amount Received'])
        df_proc['Amount Ratio'] = df_proc['Amount Received'] / (df_proc['Amount Paid'] + 1e-8)

    # One-Hot Encoding
    for col in ['Payment Format', 'Payment Currency', 'Receiving Currency']:
        if col in df_proc.columns:
            dummies = pd.get_dummies(df_proc[col], prefix=col)
            df_proc = pd.concat([df_proc, dummies], axis=1)
            df_proc.drop(columns=[col], inplace=True)

    # Drop non-feature columns
    drop_cols = ['Timestamp', 'From Account', 'To Account', 'From Bank', 'To Bank', 'Is Laundering']
    drop_cols = [c for c in drop_cols if c in df_proc.columns]
    df_proc = df_proc.drop(columns=drop_cols, errors='ignore')

    # Keep only numeric
    df_proc = df_proc.select_dtypes(include=[np.number])

    # Align with training features
    if feature_names:
        for feat in feature_names:
            if feat not in df_proc.columns:
                df_proc[feat] = 0
        df_proc = df_proc[feature_names]

    return df_proc


def compute_shap_for_transaction(X_row: pd.DataFrame) -> dict:
    """Compute SHAP values for a single transaction"""
    if shap_explainer is None:
        return {}
    try:
        shap_vals = shap_explainer.shap_values(X_row)
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[0]
        feature_shap = dict(zip(X_row.columns.tolist(), np.abs(shap_vals[0]).tolist()))
        sorted_shap = dict(sorted(feature_shap.items(), key=lambda x: x[1], reverse=True)[:10])
        return sorted_shap
    except Exception as e:
        return {"error": str(e)}


def generate_shap_chart(shap_data: dict, transaction_id: str, risk_score: float) -> str:
    """Generate SHAP bar chart and return as base64 PNG"""
    try:
        if not shap_data or "error" in shap_data:
            return ""

        fig, ax = plt.subplots(figsize=(10, 6))
        features = list(shap_data.keys())[:10]
        values = [shap_data[f] for f in features]

        # Truncate long feature names
        features_display = [f[:20] + '...' if len(f) > 20 else f for f in features]

        colors = ['#e74c3c' if v > np.mean(values) else '#f39c12' for v in values]
        bars = ax.barh(range(len(features_display)), values[::-1], color=colors[::-1])
        ax.set_yticks(range(len(features_display)))
        ax.set_yticklabels(features_display[::-1], fontsize=9)
        ax.set_xlabel('SHAP Value (Feature Contribution)', fontsize=10)
        ax.set_title(f'DeepGuard SHAP Explanation\nTransaction: {transaction_id} | Risk Score: {risk_score:.1f}%',
                    fontsize=11, fontweight='bold')

        # Add value labels
        for bar, val in zip(bars, values[::-1]):
            ax.text(bar.get_width() + 0.001, bar.get_y() + bar.get_height()/2,
                   f'{val:.4f}', va='center', fontsize=8)

        ax.grid(axis='x', alpha=0.3)
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=120, bbox_inches='tight')
        buf.seek(0)
        img_b64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        return img_b64
    except Exception as e:
        print(f"SHAP chart error: {e}")
        return ""


# ============================================================
# API ENDPOINTS
# ============================================================

@app.get("/")
async def root():
    return {
        "service": "DeepGuard AI Engine",
        "version": "1.0.0",
        "status": "running",
        "models_loaded": {
            "isolation_forest": iso_forest is not None,
            "autoencoder": autoencoder is not None,
            "scaler": scaler is not None,
            "shap": shap_explainer is not None
        }
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "models": {
            "isolation_forest": iso_forest is not None,
            "autoencoder": autoencoder is not None,
            "scaler": scaler is not None
        }
    }


@app.post("/analyze")
async def analyze_transactions(file: UploadFile = File(...)):
    """
    Main endpoint: Accept CSV/Excel, run both AI models, return scores + SHAP
    """
    if iso_forest is None or autoencoder is None or scaler is None:
        raise HTTPException(status_code=503, detail="AI models not loaded. Check models/ directory.")

    # Read uploaded file
    try:
        content = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Only CSV and Excel files supported")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File read error: {str(e)}")

    original_count = len(df)

    # Preprocess
    try:
        X = preprocess_dataframe(df)
        if len(X) == 0:
            raise HTTPException(status_code=400, detail="No valid rows after preprocessing")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preprocessing error: {str(e)}")

    # Scale
    try:
        X_scaled = scaler.transform(X)
        X_scaled_df = pd.DataFrame(X_scaled, columns=X.columns)
    except Exception as e:
        # If scaler fails (new categories), just use raw
        X_scaled = X.values
        X_scaled_df = X

    # ---- ISOLATION FOREST ----
    try:
        if_scores_raw = iso_forest.score_samples(X_scaled)
        if_scores_norm = 1 - (if_scores_raw - if_scores_raw.min()) / (
            if_scores_raw.max() - if_scores_raw.min() + 1e-8
        )
        if_scores_pct = (if_scores_norm * 100).round(2)
    except Exception as e:
        if_scores_pct = np.zeros(len(X))
        print(f"IF error: {e}")

    # ---- AUTOENCODER ----
    try:
        X_reconstructed = autoencoder.predict(X_scaled, verbose=0)
        mse = np.mean(np.power(X_scaled - X_reconstructed, 2), axis=1)
        ae_threshold = model_metadata.get("ae_threshold", np.percentile(mse, 95))
        ae_scores_norm = np.clip(mse / ae_threshold, 0, 1)
        ae_scores_pct = (ae_scores_norm * 100).round(2)
    except Exception as e:
        ae_scores_pct = np.zeros(len(X))
        mse = np.zeros(len(X))
        print(f"AE error: {e}")

    # ---- ENSEMBLE SCORE ----
    ensemble_scores = (0.5 * (if_scores_pct / 100)) + (0.5 * (ae_scores_pct / 100))
    ensemble_scores_pct = (ensemble_scores * 100).round(2)

    # ---- BUILD RESULTS ----
    results = []
    flagged_count = 0

    for i in range(len(df)):
        risk_score = float(ensemble_scores_pct[i])
        is_flagged = risk_score > 50.0

        if is_flagged:
            flagged_count += 1

        # Risk level
        if risk_score >= 75:
            risk_level = "CRITICAL"
        elif risk_score >= 50:
            risk_level = "HIGH"
        elif risk_score >= 25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # Fraud category (based on pattern)
        fraud_category = "Normal"
        if is_flagged:
            if float(if_scores_pct[i]) > float(ae_scores_pct[i]):
                fraud_category = "Statistical Outlier"
            else:
                fraud_category = "Hidden Pattern"

        # SHAP for flagged transactions (top 20 only to save time)
        shap_data = {}
        shap_chart_b64 = ""
        if is_flagged and i < 20 and shap_explainer is not None:
            try:
                row_df = pd.DataFrame([X_scaled_df.iloc[i]], columns=X_scaled_df.columns)
                shap_data = compute_shap_for_transaction(row_df)
                shap_chart_b64 = generate_shap_chart(shap_data, str(i), risk_score)
            except:
                pass

        # Get original row data
        orig_row = df.iloc[i].to_dict()
        # Convert non-serializable types
        orig_row = {k: str(v) if not isinstance(v, (int, float, bool, type(None))) else v
                   for k, v in orig_row.items()}

        results.append({
            "index": i,
            "transaction_data": orig_row,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "is_flagged": is_flagged,
            "fraud_category": fraud_category,
            "isolation_forest_score": float(if_scores_pct[i]),
            "autoencoder_score": float(ae_scores_pct[i]),
            "reconstruction_error": float(mse[i]) if len(mse) > i else 0,
            "shap_values": shap_data,
            "shap_chart": shap_chart_b64
        })

    # Summary
    summary = {
        "total_transactions": original_count,
        "processed": len(results),
        "flagged": flagged_count,
        "legitimate": len(results) - flagged_count,
        "flag_rate": round(flagged_count / max(len(results), 1) * 100, 2),
        "critical_count": sum(1 for r in results if r["risk_level"] == "CRITICAL"),
        "high_count": sum(1 for r in results if r["risk_level"] == "HIGH"),
        "medium_count": sum(1 for r in results if r["risk_level"] == "MEDIUM"),
        "low_count": sum(1 for r in results if r["risk_level"] == "LOW"),
        "avg_risk_score": round(float(np.mean(ensemble_scores_pct)), 2),
        "max_risk_score": round(float(np.max(ensemble_scores_pct)), 2),
    }

    return JSONResponse({
        "status": "success",
        "summary": summary,
        "results": results
    })


@app.post("/explain/{transaction_index}")
async def explain_transaction(transaction_index: int, file: UploadFile = File(...)):
    """Get detailed SHAP explanation for specific transaction"""
    content = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(content))
    else:
        df = pd.read_excel(io.BytesIO(content))

    if transaction_index >= len(df):
        raise HTTPException(status_code=400, detail="Transaction index out of range")

    X = preprocess_dataframe(df)
    X_scaled = scaler.transform(X)
    X_scaled_df = pd.DataFrame(X_scaled, columns=X.columns)

    row_df = pd.DataFrame([X_scaled_df.iloc[transaction_index]], columns=X_scaled_df.columns)
    shap_data = compute_shap_for_transaction(row_df)

    # Compute risk score for this transaction
    if_score = float(1 - (iso_forest.score_samples(X_scaled[transaction_index:transaction_index+1]) -
                         iso_forest.score_samples(X_scaled).min()) /
                    (iso_forest.score_samples(X_scaled).max() -
                     iso_forest.score_samples(X_scaled).min() + 1e-8)) * 100

    recon = autoencoder.predict(X_scaled[transaction_index:transaction_index+1], verbose=0)
    ae_mse = float(np.mean(np.power(X_scaled[transaction_index] - recon[0], 2)))
    ae_threshold = model_metadata.get("ae_threshold", 0.1)
    ae_score = min(ae_mse / ae_threshold * 100, 100)
    risk_score = (if_score * 0.5) + (ae_score * 0.5)

    chart_b64 = generate_shap_chart(shap_data, str(transaction_index), risk_score)

    return {
        "transaction_index": transaction_index,
        "risk_score": round(risk_score, 2),
        "isolation_forest_score": round(if_score, 2),
        "autoencoder_score": round(ae_score, 2),
        "shap_values": shap_data,
        "shap_chart_base64": chart_b64,
        "top_features": list(shap_data.keys())[:5] if shap_data else []
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
