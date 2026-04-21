"""
SmartSales FastAPI Microservice
================================
Accepts a flat CSV produced by the JS backend from a Supabase query.

The backend runs this SQL and writes the result to a temp CSV,
then either:
  (a) POSTs it to /reload  to refresh the service's in-memory data, or
  (b) the service reads it from a path on startup via CSV_PATH env var

SQL the backend should run:
    SELECT
        s.id              AS transaction_id,
        s.sale_date,
        s.product_id,
        p.name            AS product_name,
        p.category,
        s.customer_id,
        s.quantity,
        p.price           AS unit_price,
        s.total_price
    FROM sales s
    JOIN products p ON s.product_id = p.id
    ORDER BY s.sale_date;

Environment variables:
    ARTIFACTS_DIR   path to downloaded Kaggle artifacts folder
    CSV_PATH        path to the flat CSV the backend exported
                    (default: ./flat_data.csv)

Start:
    uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""

import io
import json
import os
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from models import ForecastEnsemble, SeasonalLinear
from preprocessing import (
    build_category_affinity,
    build_daily_product_series,
    build_rfm,
    get_dataset_stats,
    load_flat,
)
from database import build_forecast_rows_from_state, persist_forecast_snapshots

# ── Config ────────────────────────────────────────────────────────────────────
ARTIFACTS = Path(os.environ.get("ARTIFACTS_DIR", "./artifacts"))
CSV_PATH  = os.environ.get("CSV_PATH", "./flat_data.csv")

SEQ_LEN          = int(os.environ.get("SEQ_LEN", 5))   # match training config
FORECAST_HORIZON = 5

app = FastAPI(
    title="SmartSales ML Service",
    description="Forecasting + segmentation for SmartSales",
    version="3.0.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── State ─────────────────────────────────────────────────────────────────────
class State:
    df:        pd.DataFrame = None
    daily:     pd.DataFrame = None
    meta:      dict         = {}
    ensembles: dict         = {}
    kmeans                  = None
    scaler                  = None
    seg_config: dict        = {}
    profiles:  list         = []
    report:    dict         = {}

S = State()

RECOMMENDATIONS = {
    "Champions":           "Send loyalty rewards and early access to new products.",
    "Loyal Customers":     "Upsell premium alternatives and bundle deals.",
    "Potential Loyalists": "Offer a loyalty program invitation.",
    "At Risk":             "Send a win-back offer or personalised discount.",
    "Lost":                "Send a re-engagement campaign with a strong incentive.",
}


# ── Load data + artifacts ─────────────────────────────────────────────────────
def _load_data(path_or_df):
    raw      = load_flat(path_or_df)
    S.df     = raw
    S.daily  = build_daily_product_series(raw)


def _load_artifacts():
    model_dir = ARTIFACTS / "models"
    seg_dir = ARTIFACTS / "segmentation"

    with open(model_dir / "_meta.json") as f:
        S.meta = json.load(f)

    # Only keep products that were actually trained (have models)
    trained_products = set(S.meta.keys())
    print(f"Loaded {len(trained_products)} trained models")

    S.ensembles = {}
    for product, info in S.meta.items():
        ens = ForecastEnsemble(
            mean=info["mean"], 
            std=info["std"],
            seq_len=SEQ_LEN, 
            forecast_horizon=FORECAST_HORIZON
        )
        s = product.replace(" ", "_").replace("/", "-")
        lp = model_dir / f"{s}.lstm.pt"
        sp = model_dir / f"{s}.seasonal.pt"

        if lp.exists() and sp.exists():
            ens.lstm.load_state_dict(torch.load(lp, map_location="cpu"))
            ens.seasonal.load_state_dict(torch.load(sp, map_location="cpu"))
            S.ensembles[product] = ens
        else:
            print(f"Warning: Missing model files for {product}")

    # Load segmentation
    for fname, attr in [("kmeans.pkl", "kmeans"), ("scaler.pkl", "scaler")]:
        with open(seg_dir / fname, "rb") as f:
            setattr(S, attr, pickle.load(f))

    with open(seg_dir / "config.json") as f:
        S.seg_config = json.load(f)
    with open(seg_dir / "segment_profiles.json") as f:
        S.profiles = json.load(f)

    rp = ARTIFACTS / "training_report.json"
    if rp.exists():
        with open(rp) as f:
            S.report = json.load(f)

    print(f"✅ Loaded {len(S.ensembles)} usable forecasting models")


@app.on_event("startup")
def startup():
    _load_artifacts()
    csv = Path(CSV_PATH)
    if csv.exists():
        print(f"[SmartSales] Loading data from {csv}")
        _load_data(str(csv))
        print(f"[SmartSales] Ready — {len(S.ensembles)} models | "
              f"{S.df['customer_id'].nunique():,} customers")
    else:
        print(f"[SmartSales] Artifacts loaded. Waiting for data via POST /reload")


# ── Helpers ───────────────────────────────────────────────────────────────────
def rl(arr, n=2): return [round(float(v), n) for v in arr]
def _require_data():
    if S.df is None:
        raise HTTPException(503, "No data loaded yet. POST a CSV to /reload first.")


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {
        "status":         "ok",
        "data_loaded":    S.df is not None,
        "models_loaded":  len(S.ensembles),
        "customers":      int(S.df["customer_id"].nunique()) if S.df is not None else 0,
        "products":       int(S.df["product_name"].nunique()) if S.df is not None else 0,
    }


# ── POST /reload  (backend calls this after exporting a fresh CSV) ─────────────
@app.post("/reload")
async def reload_data(file: UploadFile = File(...)):
    """
    Backend exports fresh data from Supabase as CSV and POSTs it here.
    This refreshes all in-memory DataFrames without restarting the service.

    The CSV must have columns:
        transaction_id, sale_date, product_id, product_name, category,
        customer_id, quantity, unit_price, total_price
    """
    content = await file.read()
    try:
        _load_data(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        raise HTTPException(400, f"Failed to load CSV: {e}")

    snap_rows = build_forecast_rows_from_state(S, SEQ_LEN, FORECAST_HORIZON)
    run_batch_id = persist_forecast_snapshots(snap_rows)

    return {
        "status": "reloaded",
        "rows":   len(S.df),
        "customers": int(S.df["customer_id"].nunique()),
        "products":  int(S.df["product_name"].nunique()),
        "forecast_snapshots_saved": len(snap_rows),
        "forecast_run_batch_id": run_batch_id,
    }


@app.post("/persist-forecasts")
def persist_forecasts_manual():
    """Recompute forecasts from current in-memory data and write snapshots to Postgres."""
    _require_data()
    snap_rows = build_forecast_rows_from_state(S, SEQ_LEN, FORECAST_HORIZON)
    run_batch_id = persist_forecast_snapshots(snap_rows)
    return {
        "forecast_snapshots_saved": len(snap_rows),
        "forecast_run_batch_id": run_batch_id,
    }


@app.get("/products")
def list_products():
    _require_data()
    return {"products": sorted(S.ensembles.keys())}


# ── Forecast: single product ──────────────────────────────────────────────────
@app.get("/forecast/{product}")
def get_forecast(product: str):
    _require_data()
    
    product = product.lower().strip()
    
    if product not in S.ensembles:
        raise HTTPException(404, f"No trained model for '{product}'. Check /products")

    if product not in S.daily.columns or len(S.daily[product]) < SEQ_LEN:
        raise HTTPException(422, f"Not enough history for '{product}'")

    series = S.daily[product].values.astype(float)
    
    preds = S.ensembles[product].predict(series[-SEQ_LEN:], len(series) - 1)

    last_date = S.daily.index[-1]
    forecast_start = (last_date + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    forecast_end = (last_date + pd.Timedelta(days=FORECAST_HORIZON)).strftime("%Y-%m-%d")

    def block(arr):
        # Take only first 5 days if model still outputs 30
        short_arr = arr[:FORECAST_HORIZON]
        return {
            "daily": rl(short_arr),
            "total": round(float(short_arr.sum()), 2),
            "avg_daily": round(float(short_arr.mean()), 2)
        }

    mm = S.meta.get(product, {}).get("metrics", {})
    best = min(["lstm", "seasonal", "ensemble"], 
               key=lambda m: mm.get(m, {}).get("mae", 9999))

    category = S.df[S.df["product_name"] == product]["category"].iloc[0] \
        if not S.df[S.df["product_name"] == product].empty else ""

    return {
        "product": product,
        "category": category,
        "forecast_start": forecast_start,
        "forecast_end": forecast_end,
        "horizon_days": FORECAST_HORIZON,
        "models": {k: block(v) for k, v in preds.items()},
        "metrics": mm,
        "best_model": best,
    }


# ── Forecast: all products ────────────────────────────────────────────────────
# Replace the whole get_all_forecasts function with this:
@app.get("/forecasts")
def get_all_forecasts(
    limit: int = Query(default=50, le=200),
    sort_by: str = Query(default="ensemble_total", enum=["ensemble_total","mae","product"]),
    category: Optional[str] = Query(default=None),
):
    _require_data()
    prod_cat = (
        S.df.drop_duplicates("product_name")
        .set_index("product_name")["category"].to_dict()
    )
    rows = []
    for product, ens in S.ensembles.items():
        if category and prod_cat.get(product,"").lower() != category.lower(): 
            continue
        if product not in S.daily.columns or len(S.daily[product]) < SEQ_LEN: 
            continue
            
        series = S.daily[product].values.astype(float)
        preds = ens.predict(series[-SEQ_LEN:], len(series)-1)
        mm = S.meta.get(product, {}).get("metrics", {})
        
        ensemble_5d = float(preds["ensemble"][:FORECAST_HORIZON].sum())
        
        rows.append({
            "product": product,
            "category": prod_cat.get(product,""),
            "ensemble_total_5d": round(ensemble_5d, 2),     # ← Fixed
            "lstm_mae": mm.get("lstm", {}).get("mae"),
            "seasonal_mae": mm.get("seasonal", {}).get("mae"),
            "ensemble_mae": mm.get("ensemble", {}).get("mae"),
        })

    # Updated sorting
    if sort_by == "ensemble_total":
        rows.sort(key=lambda r: r["ensemble_total_5d"], reverse=True)
    elif sort_by == "mae":
        rows.sort(key=lambda r: r["ensemble_mae"] or 9999)
    else:
        rows.sort(key=lambda r: r["product"])

    return {"count": len(rows), "forecasts": rows[:limit]}


# ── Segments: all ─────────────────────────────────────────────────────────────
@app.get("/segments")
def get_segments():
    return {
        "segments": [
            {**p, "recommendation": RECOMMENDATIONS.get(p["label"], "Engage this group.")}
            for p in S.profiles
        ]
    }


# ── Segments: single customer ─────────────────────────────────────────────────
@app.get("/segments/{customer_id}")
def get_customer_segment(customer_id: int):
    """
    Classify a single customer in real-time.
    Returns segment, stats, and a plain-English recommendation for staff.
    """
    _require_data()
    cust_df = S.df[S.df["customer_id"] == customer_id]
    if cust_df.empty:
        raise HTTPException(404, f"Customer {customer_id} not found.")

    rfm_all = build_rfm(S.df)
    cat_all = build_category_affinity(S.df)

    if customer_id not in rfm_all.index:
        raise HTTPException(404, "Not enough data for this customer.")

    cfg = S.seg_config
    rfm_cols = cfg["rfm_columns"]
    cat_cols  = cfg["cat_columns"]

    rfm_row = rfm_all.reindex(columns=rfm_cols, fill_value=0).loc[[customer_id]]
    cat_row = cat_all.reindex(columns=cat_cols, fill_value=0).loc[[customer_id]]

    # Rebuild the same combined feature vector used during training
    combined_row = pd.concat([rfm_row.reset_index(drop=True),
                               cat_row.reset_index(drop=True)], axis=1)
    combined_row.columns = cfg["combined_columns"]

    X_sc   = S.scaler.transform(combined_row.fillna(0).values)
    seg_id = int(S.kmeans.predict(X_sc)[0])

    profile = next((p for p in S.profiles if p["segment_id"] == seg_id), {})
    r       = rfm_all.loc[customer_id]

    return {
        "customer_id":              customer_id,
        "segment_id":               seg_id,
        "segment_label":            profile.get("label", "Unknown"),
        "recency_days":             int(r["recency"]),
        "total_purchases":          int(r["frequency"]),
        "total_spend":              round(float(r["monetary"]), 2),
        "unique_products_bought":   int(r["unique_products"]),
        "unique_categories_bought": int(r["unique_categories"]),
        "top_products_for_segment": profile.get("top_products", []),
        "top_categories_for_segment": profile.get("top_categories", []),
        "recommendation": RECOMMENDATIONS.get(profile.get("label",""), "Engage this customer."),
    }


# ── Inventory risk ────────────────────────────────────────────────────────────
@app.get("/inventory/risk")
def inventory_risk(
    level:    Optional[str] = Query(default=None, enum=["high","medium"]),
    category: Optional[str] = Query(default=None),
):
    _require_data()
    prod_cat = (
        S.df.drop_duplicates("product_name")
        .set_index("product_name")["category"].to_dict()
    )

    totals, rows = [], []
    for product, ens in S.ensembles.items():
        if product not in S.daily.columns or len(S.daily[product]) < SEQ_LEN: continue
        if category and prod_cat.get(product,"") != category.lower(): continue
        series = S.daily[product].values.astype(float)
        pred   = ens.predict(series[-SEQ_LEN:], len(series)-1)["ensemble"]
        totals.append(pred.sum())
        rows.append((product, pred))

    if not rows: return {"risks": []}
    q75 = float(np.percentile(totals, 75))

    risks = []
    for product, pred in rows:
        cv    = float(pred.std() / (pred.mean() + 1e-8))
        total = float(pred.sum())
        rl_   = "low"; reasons = []
        if total >= q75:
            rl_ = "high" if cv > 0.5 else "medium"
            reasons.append("high forecasted volume")
        if cv > 0.7:
            rl_ = "high"; reasons.append("volatile daily demand")
        if rl_ == "low": continue

        mm = S.meta.get(product,{}).get("metrics",{})
        risks.append({
            "product":              product,
            "category":             prod_cat.get(product,""),
            "risk_level":           rl_,
            "ensemble_total_30d":   round(total, 2),
            "demand_volatility_cv": round(cv, 3),
            "reasons":              reasons,
            "ensemble_mae":         mm.get("ensemble",{}).get("mae"),
            "action": f"Stock up on {product}. Expected {total:.0f} units over {FORECAST_HORIZON} days"
        })

    risks.sort(key=lambda r: (r["risk_level"]=="high", r["ensemble_total_30d"]), reverse=True)
    if level: risks = [r for r in risks if r["risk_level"] == level]
    return {"count": len(risks), "risks": risks}


# ── Metrics ───────────────────────────────────────────────────────────────────
@app.get("/metrics")
def get_metrics(
    sort_by: str = Query(default="ensemble_mae",
                         enum=["lstm_mae","seasonal_mae","ensemble_mae","product"])
):
    """MAE + RMSE per product across all models. For Analysts."""
    _require_data()
    prod_cat = (
        S.df.drop_duplicates("product_name")
        .set_index("product_name")["category"].to_dict()
    )
    rows = []
    for product, info in S.meta.items():
        mm = info.get("metrics",{})
        rows.append({
            "product":       product,
            "category":      prod_cat.get(product,""),
            "lstm_mae":      mm.get("lstm",    {}).get("mae"),
            "lstm_rmse":     mm.get("lstm",    {}).get("rmse"),
            "seasonal_mae":  mm.get("seasonal",{}).get("mae"),
            "seasonal_rmse": mm.get("seasonal",{}).get("rmse"),
            "ensemble_mae":  mm.get("ensemble",{}).get("mae"),
            "ensemble_rmse": mm.get("ensemble",{}).get("rmse"),
        })

    if sort_by != "product": rows.sort(key=lambda r: r[sort_by] or 9999)
    else:                    rows.sort(key=lambda r: r["product"])

    return {"avg_metrics": S.report.get("avg_metrics",{}), "per_product": rows}


# ── Summary ───────────────────────────────────────────────────────────────────
@app.get("/summary")
def summary():
    _require_data()
    stats = get_dataset_stats(S.df)
    totals = []
    for product, ens in S.ensembles.items():
        if product not in S.daily.columns or len(S.daily[product]) < SEQ_LEN: continue
        pred = ens.predict(S.daily[product].values.astype(float)[-SEQ_LEN:],
                           len(S.daily[product])-1)["ensemble"]
        totals.append((product, float(pred.sum())))
    totals.sort(key=lambda x: x[1], reverse=True)

    return {
        "generated_at":   pd.Timestamp.now().isoformat(),
        **stats,
        "models_loaded":  len(S.ensembles),
        "avg_metrics":    S.report.get("avg_metrics",{}),
        "top_5_products": [{"product":p,"ensemble_total_5d":round(t,2)} for p,t in totals[:5]],
        "segments":       [{"label":p["label"],"size":p["size"]} for p in S.profiles],
    }
