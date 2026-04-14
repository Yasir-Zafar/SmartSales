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
    return os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")


def persist_forecast_snapshots(rows: List[Dict[str, Any]]) -> Optional[str]:
    """
    Insert one batch of forecast rows into ml_forecast_snapshots.
    Each row dict must include: product_name, category, forecast_start, forecast_end,
    ensemble_daily, lstm_daily, seasonal_daily, metrics (dict), ensemble_total_30d.
    Returns run_batch_id or None if skipped/failed.
    """
    url = get_database_url()
    if not url or not rows or psycopg2 is None:
        return None

    run_batch_id = str(uuid.uuid4())
    sql = """
    INSERT INTO ml_forecast_snapshots (
      run_batch_id, product_name, category, forecast_start, forecast_end,
      ensemble_daily, lstm_daily, seasonal_daily, metrics, ensemble_total_30d
    ) VALUES (
      %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
    )
    """
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        for r in rows:
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
                    r.get("ensemble_total_30d"),
                ),
            )
        conn.commit()
        cur.close()
        conn.close()
        return run_batch_id
    except Exception as e:  # pragma: no cover
        print(f"[SmartSales] persist_forecast_snapshots failed: {e}")
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
                "ensemble_daily": as_list(preds["ensemble"]),
                "lstm_daily": as_list(preds["lstm"]),
                "seasonal_daily": as_list(preds["seasonal"]),
                "metrics": mm,
                "ensemble_total_30d": round(float(preds["ensemble"].sum()), 4),
            }
        )
    return rows
