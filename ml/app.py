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

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

import numpy as np
import pandas as pd
import torch
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

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


def _label_segment(rec, freq, spend):
    if rec < 30 and freq > 5:   return "Champions"
    if rec < 60 and freq > 3:   return "Loyal Customers"
    if rec < 90:                return "Potential Loyalists"
    if rec < 180:               return "At Risk"
    return "Lost"


def _rebuild_segmentation(num_segments: int = 5) -> dict:
    """Re-run RFM + category affinity + KMeans on current in-memory data."""
    if S.df is None:
        return {"error": "No data loaded"}

    seg_dir = ARTIFACTS / "segmentation"
    seg_dir.mkdir(parents=True, exist_ok=True)

    rfm = build_rfm(S.df)
    cat_affinity = build_category_affinity(S.df)

    combined = rfm.join(cat_affinity, how="inner").fillna(0)

    scaler = StandardScaler()
    X_sc = scaler.fit_transform(combined.values)

    km = KMeans(n_clusters=num_segments, random_state=42, n_init=10)
    labels = km.fit_predict(X_sc)
    seg_s = pd.Series(labels, index=combined.index, name="segment")

    profiles = []
    for sid in range(num_segments):
        mask = seg_s == sid
        seg_rfm = rfm[mask]
        members = rfm[mask].index.tolist()
        seg_flat = S.df[S.df["customer_id"].isin(members)]

        top_prods = (
            seg_flat["product_name"].value_counts().head(5)
            .reset_index().rename(columns={"product_name": "product", "count": "order_count"})
            .to_dict(orient="records")
        )
        top_cats = (
            seg_flat["category"].value_counts().head(3)
            .reset_index().rename(columns={"category": "category", "count": "order_count"})
            .to_dict(orient="records")
        )

        avg_rec = float(seg_rfm["recency"].mean())
        avg_freq = float(seg_rfm["frequency"].mean())
        avg_mon = float(seg_rfm["monetary"].mean())

        profiles.append({
            "segment_id": sid,
            "size": int(mask.sum()),
            "avg_recency_days": round(avg_rec, 1),
            "avg_frequency": round(avg_freq, 1),
            "avg_spend": round(avg_mon, 2),
            "avg_unique_products": round(float(seg_rfm["unique_products"].mean()), 1),
            "top_products": top_prods,
            "top_categories": top_cats,
            "label": _label_segment(avg_rec, avg_freq, avg_mon),
        })

    for fname, obj in [("kmeans.pkl", km), ("scaler.pkl", scaler)]:
        with open(seg_dir / fname, "wb") as f:
            pickle.dump(obj, f)

    seg_config = {
        "rfm_columns": list(rfm.columns),
        "cat_columns": list(cat_affinity.columns),
        "combined_columns": list(combined.columns),
    }
    with open(seg_dir / "config.json", "w") as f:
        json.dump(seg_config, f, indent=2)
    with open(seg_dir / "segment_profiles.json", "w") as f:
        json.dump(profiles, f, indent=2)

    S.kmeans = km
    S.scaler = scaler
    S.seg_config = seg_config
    S.profiles = profiles

    print(f"✅ Rebuilt segmentation: {num_segments} segments, {len(combined)} customers")
    return {
        "segments": num_segments,
        "customers": len(combined),
        "profiles": [
            {"id": p["segment_id"], "label": p["label"], "size": p["size"]}
            for p in profiles
        ],
    }


async def _auto_load_data_from_backend():
    """Automatically load training data from backend on startup."""
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:5000")
    internal_key = os.environ.get("ML_INTERNAL_API_KEY", "")
    # Fixed date range: 2023-01-01 to today
    from datetime import date
    start_date = "2023-01-01"
    end_date = date.today().isoformat()

    try:
        import httpx
        url = f"{backend_url.rstrip('/')}/api/analyst/training-export/internal?startDate={start_date}&endDate={end_date}"
        print(f"[SmartSales] Fetching training data from {start_date} to {end_date}...")

        headers = {}
        if internal_key:
            headers["x-ml-internal-key"] = internal_key
        else:
            print("[SmartSales] ⚠️  ML_INTERNAL_API_KEY not set; backend internal export may reject startup sync")

        for attempt in range(1, 6):
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)

            if response.status_code == 200:
                csv_content = response.text
                _load_data(io.StringIO(csv_content))

                # Persist forecasts to database if configured
                snap_rows = build_forecast_rows_from_state(S, SEQ_LEN, FORECAST_HORIZON)
                run_batch_id = persist_forecast_snapshots(snap_rows)

                print(f"[SmartSales] ✅ Auto-loaded {len(S.df):,} rows from backend")
                print(f"[SmartSales] Ready — {len(S.ensembles)} models | "
                      f"{S.df['customer_id'].nunique():,} customers")
                if run_batch_id:
                    print(f"[SmartSales] Forecast batch persisted: {run_batch_id}")
                return True

            if response.status_code in (401, 403):
                print(f"[SmartSales] ⚠️  Backend auth rejected startup sync ({response.status_code}). Check ML_INTERNAL_API_KEY.")
                return False

            print(f"[SmartSales] Startup sync attempt {attempt}/5 failed with {response.status_code}; retrying...")
            import asyncio
            await asyncio.sleep(2)

        print("[SmartSales] ⚠️  Backend startup sync failed after retries, using local CSV fallback")
        return False
    except Exception as e:
        print(f"[SmartSales] ⚠️  Could not fetch from backend: {e}")
        print(f"[SmartSales] Falling back to local CSV if available")
        return False


@app.on_event("startup")
async def startup():
    _load_artifacts()

    # Try to auto-load from backend first
    loaded = await _auto_load_data_from_backend()

    # Fall back to local CSV if backend fetch failed
    if not loaded:
        csv = Path(CSV_PATH)
        if csv.exists():
            print(f"[SmartSales] Loading data from {csv}")
            _load_data(str(csv))

            # Persist forecasts to database if configured
            snap_rows = build_forecast_rows_from_state(S, SEQ_LEN, FORECAST_HORIZON)
            persist_forecast_snapshots(snap_rows)

            print(f"[SmartSales] Ready — {len(S.ensembles)} models | "
                  f"{S.df['customer_id'].nunique():,} customers")
        else:
            print(f"[SmartSales] ⚠️  No local CSV found. Waiting for data via POST /reload")


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

    seg_result = _rebuild_segmentation()

    return {
        "status": "reloaded",
        "rows":   len(S.df),
        "customers": int(S.df["customer_id"].nunique()),
        "products":  int(S.df["product_name"].nunique()),
        "forecast_snapshots_saved": len(snap_rows),
        "forecast_run_batch_id": run_batch_id,
        "segments_rebuilt": seg_result,
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


# NOTE: this MUST stay above /forecast/{product}. FastAPI matches routes in
# registration order, so declaring it later let the {product} wildcard
# capture "total-revenue" and 404 with "No trained model for
# 'total-revenue'" — which silently broke the owner's revenue guard.
@app.get("/forecast/total-revenue")
def forecast_total_revenue():
    """Compute total forecasted revenue across all products for the next 5 days."""
    _require_data()
    prod_prices = {}
    grouped = S.df.groupby("product_name")["unit_price"].mean()
    for name, price in grouped.items():
        prod_prices[name] = float(price)

    total_units = 0.0
    total_revenue = 0.0
    by_product = []
    for product, ens in S.ensembles.items():
        if product not in S.daily.columns or len(S.daily[product]) < SEQ_LEN:
            continue
        series = S.daily[product].values.astype(float)
        pred = ens.predict(series[-SEQ_LEN:], len(series) - 1)["ensemble"]
        units = float(pred.sum())
        price = prod_prices.get(product, 0)
        revenue = units * price
        total_units += units
        total_revenue += revenue
        by_product.append({
            "product": product,
            "forecast_units_5d": round(units, 2),
            "avg_price": round(price, 2),
            "forecast_revenue": round(revenue, 2),
        })

    by_product.sort(key=lambda x: x["forecast_revenue"], reverse=True)
    return {
        "total_forecast_units": round(total_units, 2),
        "total_forecast_revenue": round(total_revenue, 2),
        "forecast_horizon_days": FORECAST_HORIZON,
        "by_product": by_product,
    }


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
            "ensemble_total_5d":    round(total, 2),
            "demand_volatility_cv": round(cv, 3),
            "reasons":              reasons,
            "ensemble_mae":         mm.get("ensemble",{}).get("mae"),
            "action": f"Stock up on {product}. Expected {total:.0f} units over {FORECAST_HORIZON} days"
        })

    risks.sort(key=lambda r: (r["risk_level"]=="high", r["ensemble_total_5d"]), reverse=True)
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
            "best_model":    min(["lstm", "seasonal", "ensemble"],
                                key=lambda m: mm.get(m, {}).get("mae", 9999)),
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


# ── Abnormal Drop Detection ───────────────────────────────────────────────────
@app.get("/alerts/abnormal-drops")
def get_abnormal_drops(
    severity: Optional[str] = Query(default=None, enum=["high", "medium", "low"]),
    min_drop_pct: float = Query(default=30.0, ge=0, le=100),
):
    """
    Detect products with abnormal sales drops by comparing current forecast
    to historical baseline (average of past sales).
    """
    _require_data()

    prod_cat = (
        S.df.drop_duplicates("product_name")
        .set_index("product_name")["category"].to_dict()
    )

    alerts = []

    for product, ens in S.ensembles.items():
        if product not in S.daily.columns or len(S.daily[product]) < SEQ_LEN * 2:
            continue

        series = S.daily[product].values.astype(float)

        # Current forecast (next 5 days)
        preds = ens.predict(series[-SEQ_LEN:], len(series) - 1)
        ensemble_total_5d = float(preds["ensemble"][:FORECAST_HORIZON].sum())

        # Baseline: average of last 10 days of actual sales (or available history)
        lookback = min(10, len(series) - FORECAST_HORIZON)
        if lookback < 5:
            continue

        baseline_daily_avg = float(series[-lookback:].mean())
        baseline_total_5d = baseline_daily_avg * FORECAST_HORIZON

        # Calculate drop percentage
        if baseline_total_5d < 0.01:  # Avoid division by zero for very low sales
            continue

        drop_pct = ((baseline_total_5d - ensemble_total_5d) / baseline_total_5d) * 100

        # Only flag if there's a significant drop
        if drop_pct < min_drop_pct:
            continue

        # Determine severity
        if drop_pct >= 60:
            sev = "high"
        elif drop_pct >= 40:
            sev = "medium"
        else:
            sev = "low"

        alerts.append({
            "type": "ABNORMAL_DROP",
            "title": "Abnormal Drop",
            "product": product,
            "category": prod_cat.get(product, ""),
            "ensemble_total_5d": round(ensemble_total_5d, 2),
            "baseline_total_5d": round(baseline_total_5d, 2),
            "drop_pct": round(drop_pct, 1),
            "severity": sev,
        })

    # Filter by severity if requested
    if severity:
        alerts = [a for a in alerts if a["severity"] == severity]

    # Sort by severity (high first) then by drop percentage
    severity_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: (severity_order[a["severity"]], -a["drop_pct"]))

    return {
        "count": len(alerts),
        "alerts": alerts,
    }
