"""
SmartSales Preprocessing
=========================
Works with the SmartSales DB schema:

    sales    : id, product_id, customer_id, quantity, total_price, sale_date
    products : id, name, category, price, stock_quantity

The backend produces this flat CSV from a Supabase query and feeds it here:

    sale_date, product_id, product_name, category, customer_id, quantity, total_price

This module never talks to Supabase directly — that is the backend's job.
The ML service just accepts the CSV path (or a DataFrame).
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# Schema
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_COLS = {
    "transaction_id", "sale_date", "product_id", "product_name",
    "category", "customer_id", "quantity", "unit_price", "total_price",
}


def load_flat(path_or_df) -> pd.DataFrame:
    """
    Accepts a CSV path or DataFrame.
    Validates columns, normalises types.
    This is what the backend's CSV export must match.

    Expected columns:
        transaction_id  — shared across multiple rows (one transaction, many products)
        sale_date       — YYYY-MM-DD
        product_id      — int FK to products
        product_name    — str
        category        — str
        customer_id     — int FK to sales.customer_id
        quantity        — int units sold
        unit_price      — NUMERIC price per unit
        total_price     — NUMERIC (quantity * unit_price, backend can recompute)
    """
    if isinstance(path_or_df, str):
        df = pd.read_csv(path_or_df)
    elif isinstance(path_or_df, pd.DataFrame):
        df = path_or_df.copy()
    else:
        # io.StringIO / file-like from POST /reload
        df = pd.read_csv(path_or_df)
    df.columns = [c.strip().lower() for c in df.columns]

    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns in flat CSV: {missing}")

    df["sale_date"]      = pd.to_datetime(df["sale_date"], errors="coerce")
    df["product_name"]   = df["product_name"].str.strip().str.lower()
    df["category"]       = df["category"].str.strip().str.lower()
    df["transaction_id"] = df["transaction_id"].astype(int)
    df["customer_id"]    = df["customer_id"].astype(int)
    df["product_id"]     = df["product_id"].astype(int)
    df["quantity"]       = pd.to_numeric(df["quantity"],    errors="coerce").fillna(1).astype(int)
    df["unit_price"]     = pd.to_numeric(df["unit_price"],  errors="coerce").fillna(0.0)
    df["total_price"]    = pd.to_numeric(df["total_price"], errors="coerce").fillna(0.0)

    df = df.dropna(subset=["sale_date"]).sort_values("sale_date").reset_index(drop=True)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# Time-series
# ─────────────────────────────────────────────────────────────────────────────

def build_daily_product_series(df: pd.DataFrame) -> pd.DataFrame:
    """
    Pivot: rows = calendar days, columns = product_name
    Values = total quantity sold that day.
    Missing calendar days filled with 0.
    """
    df = df.copy()
    df["date"] = df["sale_date"].dt.normalize()

    daily = (
        df.groupby(["date", "product_name"])["quantity"]
        .sum()
        .reset_index()
        .pivot(index="date", columns="product_name", values="quantity")
        .fillna(0).astype(int)
    )
    full_idx = pd.date_range(daily.index.min(), daily.index.max(), freq="D")
    return daily.reindex(full_idx, fill_value=0)


def make_seq(series: np.ndarray, seq_len: int, H: int):
    """Sliding window → X (n, seq_len, 1), y (n, H)."""
    X, y = [], []
    for i in range(len(series) - seq_len - H + 1):
        X.append(series[i:i + seq_len])
        y.append(series[i + seq_len:i + seq_len + H])
    return np.array(X)[..., np.newaxis], np.array(y)


def make_sea_seq(series: np.ndarray, seq_len: int, H: int):
    """Sliding window for SeasonalLinear → X_feat (n, 13*H), y (n, H)."""
    from models import SeasonalLinear
    Xf, y = [], []
    for i in range(len(series) - seq_len - H + 1):
        feat = SeasonalLinear.future_features(i + seq_len - 1, H).squeeze(0).numpy()
        Xf.append(feat)
        y.append(series[i + seq_len:i + seq_len + H])
    return np.array(Xf), np.array(y)


# ─────────────────────────────────────────────────────────────────────────────
# Segmentation features
# ─────────────────────────────────────────────────────────────────────────────

def build_rfm(df: pd.DataFrame) -> pd.DataFrame:
    """
    Recency   = days since last purchase (lower = more recent)
    Frequency = total transactions
    Monetary  = total spend (sum of total_price)

    Extra behavioural features available from SmartSales schema:
        avg_quantity_per_order, unique_products, unique_categories
    """
    ref = df["sale_date"].max()
    return df.groupby("customer_id").agg(
        recency           =("sale_date",   lambda x: (ref - x.max()).days),
        frequency         =("product_id",  "count"),
        monetary          =("total_price", "sum"),
        avg_unit_price    =("unit_price",  "mean"),
        avg_quantity      =("quantity",    "mean"),
        unique_products   =("product_id",  "nunique"),
        unique_categories =("category",    "nunique"),
    ).round(4)


def build_category_affinity(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalised category spend share per customer.
    (total_price per category / total spend)
    """
    cat = (
        df.groupby(["customer_id", "category"])["total_price"]
        .sum()
        .unstack(fill_value=0)
    )
    return cat.div(cat.sum(axis=1), axis=0)


# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def get_all_products(df: pd.DataFrame) -> List[str]:
    return sorted(df["product_name"].unique().tolist())


def get_dataset_stats(df: pd.DataFrame) -> Dict:
    return {
        "total_rows":         len(df),
        "unique_customers":   df["customer_id"].nunique(),
        "unique_products":    df["product_name"].nunique(),
        "unique_categories":  df["category"].nunique(),
        "date_range_start":   df["sale_date"].min().strftime("%Y-%m-%d"),
        "date_range_end":     df["sale_date"].max().strftime("%Y-%m-%d"),
        "total_revenue":      round(float(df["total_price"].sum()), 2),
    }
