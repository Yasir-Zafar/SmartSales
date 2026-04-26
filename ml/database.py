"""
Optional Postgres access for the ML service (same schema as Express / Supabase).

Set DATABASE_URL to a Postgres connection string (e.g. Supabase pooler URI).
Used to persist forecast snapshots after each reload/inference run.
"""
from __future__ import annotations

import json
import os
import uuid
from typing import Any, Dict, List, Optional

try:
    import psycopg2
    from psycopg2.extras import Json as PgJson
except ImportError:  # pragma: no cover
    psycopg2 = None
    PgJson = None


def get_database_url() -> Optional[str]:
    """Build PostgreSQL connection URL from Supabase environment variables."""
    # First check if DATABASE_URL is directly provided
    direct_url = os.environ.get("DATABASE_URL")
    if direct_url:
        return direct_url

    supabase_url = os.environ.get("SUPABASE_URL")
    if not supabase_url:
        return None

    # Extract project reference from Supabase URL
    # Format: https://PROJECT_REF.supabase.co
    project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")

    # Try to get database password from environment
    db_password = os.environ.get("SUPABASE_DB_PASSWORD")
    if not db_password:
        print("[SmartSales] ⚠️  SUPABASE_DB_PASSWORD not set. Skipping database persistence.")
        print("[SmartSales] Set SUPABASE_DB_PASSWORD to your Supabase project database password.")
        return None

    # Use direct connection (port 5432) instead of pooler
    # Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
    return f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"


def persist_forecast_snapshots(rows: List[Dict[str, Any]]) -> Optional[str]:
    """
    Insert one batch of forecast rows into ml_forecast_snapshots.
    Each row dict must include: product_name, category, forecast_start, forecast_end,
    ensemble_daily, lstm_daily, seasonal_daily, metrics (dict), ensemble_total_5d.
    Returns run_batch_id or None if skipped/failed.
    """
    url = get_database_url()

    # Check if database connection is configured
    if not url:
        print("[SmartSales] ⚠️  SUPABASE_URL not configured. Skipping forecast persistence.")
        print("[SmartSales] Set SUPABASE_URL environment variable to enable database persistence.")
        return None

    if not rows:
        print("[SmartSales] No forecast rows to persist.")
        return None

    if psycopg2 is None:
        print("[SmartSales] ⚠️  psycopg2 not installed. Install with: pip install psycopg2-binary")
        return None

    run_batch_id = str(uuid.uuid4())
    sql = """
    INSERT INTO ml_forecast_snapshots (
      run_batch_id, product_name, category, forecast_start, forecast_end,
      ensemble_daily, lstm_daily, seasonal_daily, metrics, ensemble_total_5d
    ) VALUES (
      %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
    )
    """

    conn = None
    try:
        print(f"[SmartSales] Connecting to database...")
        conn = psycopg2.connect(url, connect_timeout=10)
        cur = conn.cursor()

        print(f"[SmartSales] Persisting {len(rows)} forecast snapshots...")
        for i, r in enumerate(rows):
            cur.execute(
                sql,
                (
                    run_batch_id,
                    r["product_name"],
                    r.get("category") or "",
                    r["forecast_start"],
                    r["forecast_end"],
                    PgJson(r["ensemble_daily"]),
                    PgJson(r["lstm_daily"]),
                    PgJson(r["seasonal_daily"]),
                    PgJson(r.get("metrics") or {}),
                    r.get("ensemble_total_5d"),
                ),
            )
            if (i + 1) % 50 == 0:
                print(f"[SmartSales] Saved {i + 1}/{len(rows)} snapshots...")

        conn.commit()
        cur.close()
        conn.close()
        print(f"[SmartSales] ✅ Successfully persisted {len(rows)} forecasts (batch: {run_batch_id})")
        return run_batch_id
    except Exception as e:
        print(f"[SmartSales] ❌ Database error: {type(e).__name__}: {e}")
        print(f"[SmartSales] Check your SUPABASE_URL is correct and database is accessible.")
        if conn:
            try:
                conn.close()
            except:
                pass
        return None


def build_forecast_rows_from_state(S, SEQ_LEN: int, FORECAST_HORIZON: int) -> List[Dict[str, Any]]:
    """Build rows for ml_forecast_snapshots from in-memory ML State (app.State)."""
    import pandas as pd

    prod_cat = (
        S.df.drop_duplicates("product_name")
        .set_index("product_name")["category"]
        .to_dict()
    )
    rows: List[Dict[str, Any]] = []
    last_date = S.daily.index[-1]
    forecast_start = (last_date + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    forecast_end = (last_date + pd.Timedelta(days=FORECAST_HORIZON)).strftime("%Y-%m-%d")

    for product, ens in S.ensembles.items():
        if product not in S.daily.columns or len(S.daily[product]) < SEQ_LEN:
            continue
        series = S.daily[product].values.astype(float)
        preds = ens.predict(series[-SEQ_LEN:], len(series) - 1)
        mm = S.meta.get(product, {}).get("metrics", {})

        def as_list(arr):
            return [round(float(x), 4) for x in arr]

        rows.append(
            {
                "product_name": product,
                "category": prod_cat.get(product, ""),
                "forecast_start": forecast_start,
                "forecast_end": forecast_end,
                "ensemble_daily": as_list(preds["ensemble"][:FORECAST_HORIZON]),
                "lstm_daily": as_list(preds["lstm"][:FORECAST_HORIZON]),
                "seasonal_daily": as_list(preds["seasonal"][:FORECAST_HORIZON]),
                "metrics": mm,
                "ensemble_total_5d": round(float(preds["ensemble"][:FORECAST_HORIZON].sum()), 4),
            }
        )
    return rows
