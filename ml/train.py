# ============================================================
# SmartSales — Kaggle training cell
#
# What this does:
#   1. Joins all 6 Instacart CSVs
#   2. Maps to your SmartSales DB schema:
#        sale_date, product_id, product_name, category,
#        customer_id, quantity, unit_price, total_price
#   3. Takes first 10,000 rows (ordered by synthetic date)
#   4. Also exports training_data.csv so you can upload it
#      to Supabase and use it as real seed data
#   5. Trains LSTM + SeasonalLinear per product
#   6. Trains KMeans segmentation
#
# After running: download /kaggle/working/artifacts/
#                and optionally /kaggle/working/training_data.csv
# ============================================================

import subprocess
subprocess.run(["pip", "install", "torch", "scikit-learn", "pandas", "numpy", "-q"], check=True)

import math, json, pickle
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

# ── Config ────────────────────────────────────────────────────────────────────
BASE    = Path("/kaggle/input/datasets/psparks/instacart-market-basket-analysis")  # adjust if needed
OUT     = Path("/kaggle/working/artifacts")
ROWS    = 10_000          # rows to keep for training
SEQ_LEN          = 30    # shorter window since we have less data
FORECAST_HORIZON = 30
MIN_HISTORY      = SEQ_LEN + FORECAST_HORIZON + 5
EPOCHS           = 40
BATCH            = 32
LR               = 1e-3
NUM_SEGMENTS     = 5
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {DEVICE}")

(OUT/"models").mkdir(parents=True, exist_ok=True)
(OUT/"segmentation").mkdir(parents=True, exist_ok=True)


# ════════════════════════════════════════════════════════════════════════════
# STEP 1 — JOIN INSTACART CSVs → SmartSales flat schema
#
# SmartSales schema:
#   sale_date     ← synthetic date reconstructed from days_since_prior_order
#   product_id    ← products.product_id
#   product_name  ← products.product_name
#   category      ← departments.department  (closest match to "category")
#   customer_id   ← orders.user_id
#   quantity      ← 1 per line item (Instacart doesn't store qty)
#   unit_price    ← generated per product using category price ranges
#   total_price   ← same as unit_price (quantity=1); backend recomputes as qty*unit_price
# ════════════════════════════════════════════════════════════════════════════

print("Loading Instacart CSVs...")
orders   = pd.read_csv(BASE/"orders.csv")
op_prior = pd.read_csv(BASE/"order_products__prior.csv")
op_train = pd.read_csv(BASE/"order_products__train.csv")
products = pd.read_csv(BASE/"products.csv")
aisles   = pd.read_csv(BASE/"aisles.csv")
depts    = pd.read_csv(BASE/"departments.csv")

op_all = pd.concat([op_prior, op_train], ignore_index=True)

joined = (
    op_all
    .merge(orders,   on="order_id")
    .merge(products, on="product_id")
    .merge(aisles,   on="aisle_id")
    .merge(depts,    on="department_id")
)
joined = joined[joined["eval_set"].isin(["prior", "train"])].copy()
print(f"Full join: {len(joined):,} rows")

# ── Reconstruct synthetic dates ───────────────────────────────────────────────
# Instacart has no real dates; we rebuild a timeline from days_since_prior_order
orders_meta = (
    joined[["user_id","order_id","order_number","days_since_prior_order"]]
    .drop_duplicates("order_id")
    .sort_values(["user_id","order_number"])
    .copy()
)
orders_meta["days_since_prior_order"] = (
    pd.to_numeric(orders_meta["days_since_prior_order"], errors="coerce").fillna(7.0)
)
orders_meta["cum_days"] = orders_meta.groupby("user_id")["days_since_prior_order"].cumsum()
epoch = pd.Timestamp("2023-01-01")
orders_meta["synthetic_date"] = epoch + pd.to_timedelta(orders_meta["cum_days"], unit="D")
joined = joined.merge(orders_meta[["order_id","synthetic_date"]], on="order_id", how="left")

# ── Map to SmartSales flat schema ─────────────────────────────────────────────

# Unit price: generated per product using category-based realistic ranges.
# Same product always gets the same price (seeded by product_id for consistency).
CATEGORY_PRICE_RANGES = {
    "produce":         (0.49,  3.99),
    "dairy eggs":      (0.99,  6.99),
    "meat seafood":    (3.99, 18.99),
    "beverages":       (0.99,  5.99),
    "snacks":          (1.49,  5.49),
    "frozen":          (2.49,  8.99),
    "pantry":          (1.29,  7.99),
    "bakery":          (1.99,  6.99),
    "deli":            (2.99, 12.99),
    "breakfast":       (2.49,  7.99),
    "canned goods":    (0.79,  3.99),
    "dry goods pasta": (0.99,  4.99),
    "household":       (1.99, 12.99),
    "personal care":   (2.99, 14.99),
    "babies":          (3.99, 19.99),
    "pets":            (4.99, 24.99),
    "alcohol":         (5.99, 29.99),
    "international":   (1.99,  8.99),
    "missing":         (1.00,  9.99),
    "other":           (1.00,  9.99),
}

def generate_unit_price(product_id: int, category: str) -> float:
    """Deterministic price per product_id within category range."""
    lo, hi = CATEGORY_PRICE_RANGES.get(category.lower(), (1.00, 9.99))
    rng = np.random.default_rng(seed=int(product_id))   # same seed → same price always
    raw = rng.uniform(lo, hi)
    # Round to nearest .49 or .99 (retail pricing convention)
    cents = round(raw % 1, 2)
    base  = int(raw)
    if cents <= 0.49:
        return round(base + 0.49, 2)
    else:
        return round(base + 0.99, 2)

joined["dept_lower"] = joined["department"].str.strip().str.lower()
joined["unit_price"] = joined.apply(
    lambda r: generate_unit_price(r["product_id"], r["dept_lower"]), axis=1
)

flat = pd.DataFrame({
    "transaction_id": joined["order_id"],           # order_id naturally overlaps —
                                                     # multiple products share one order
    "sale_date":      joined["synthetic_date"].dt.date,
    "product_id":     joined["product_id"],
    "product_name":   joined["product_name"].str.strip().str.lower(),
    "category":       joined["dept_lower"],
    "customer_id":    joined["user_id"],
    "quantity":       1,
    "unit_price":     joined["unit_price"],
    "total_price":    joined["unit_price"],          # quantity=1 so total=unit for now;
                                                     # backend can recompute as qty*unit_price
})
flat = flat.sort_values("sale_date").reset_index(drop=True)

# ── Take first ROWS rows ──────────────────────────────────────────────────────
flat = flat.head(ROWS).copy()
print(f"Trimmed to {len(flat):,} rows | "
      f"{flat['product_name'].nunique()} products | "
      f"{flat['customer_id'].nunique()} customers")

# ── Export for Supabase upload ────────────────────────────────────────────────
# You can upload this CSV to Supabase as seed data.
# The sale_date and product columns match your DB schema directly.
flat.to_csv("/kaggle/working/training_data.csv", index=False)
print("Exported training_data.csv  ← upload this to Supabase if needed")


# ════════════════════════════════════════════════════════════════════════════
# STEP 2 — BUILD DAILY SERIES
# ════════════════════════════════════════════════════════════════════════════

flat["date"] = pd.to_datetime(flat["sale_date"]).dt.normalize()

daily = (
    flat.groupby(["date","product_name"])["quantity"]
    .sum().reset_index()
    .pivot(index="date", columns="product_name", values="quantity")
    .fillna(0).astype(int)
)
full_idx = pd.date_range(daily.index.min(), daily.index.max(), freq="D")
daily    = daily.reindex(full_idx, fill_value=0)
print(f"Daily series: {len(daily)} days × {len(daily.columns)} products")


# ════════════════════════════════════════════════════════════════════════════
# STEP 3 — MODELS
# ════════════════════════════════════════════════════════════════════════════

class SalesLSTM(nn.Module):
    def __init__(self, H=30, hidden=64, layers=2, drop=0.2):
        super().__init__()
        self.lstm = nn.LSTM(1, hidden, layers, batch_first=True,
                            dropout=drop if layers > 1 else 0.0)
        self.head = nn.Sequential(
            nn.Linear(hidden, hidden//2), nn.ReLU(), nn.Dropout(drop),
            nn.Linear(hidden//2, H),
        )
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out[:, -1, :])

def fourier(t, periods=[7.0, 30.44], n=3):
    cols = []
    for p in periods:
        for k in range(1, n+1):
            cols += [np.sin(2*math.pi*k*t/p), np.cos(2*math.pi*k*t/p)]
    return np.stack(cols, axis=1).astype(np.float32)

class SeasonalLinear(nn.Module):
    def __init__(self, H=30):
        super().__init__()
        self.H = H
        self.linear = nn.Linear(13*H, H)
    @staticmethod
    def features(last_t, H):
        t  = np.arange(last_t+1, last_t+1+H, dtype=np.float32)
        f  = fourier(t)
        tr = (t/(last_t+1)).reshape(-1,1)
        return torch.tensor(np.concatenate([f,tr],axis=1).flatten(),
                            dtype=torch.float32).unsqueeze(0)
    def forward(self, x): return self.linear(x)


# ════════════════════════════════════════════════════════════════════════════
# STEP 4 — TRAINING HELPERS
# ════════════════════════════════════════════════════════════════════════════

def slug(s): return s.replace(" ","_").replace("/","-")
crit = nn.MSELoss()

def make_seq(series, seq_len, H):
    X, y = [], []
    for i in range(len(series)-seq_len-H+1):
        X.append(series[i:i+seq_len])
        y.append(series[i+seq_len:i+seq_len+H])
    return np.array(X)[...,np.newaxis], np.array(y)

def make_sea_seq(series, seq_len, H):
    Xf, y = [], []
    for i in range(len(series)-seq_len-H+1):
        Xf.append(SeasonalLinear.features(i+seq_len-1, H).squeeze(0).numpy())
        y.append(series[i+seq_len:i+seq_len+H])
    return np.array(Xf), np.array(y)

def fit_model(model, X, y, epochs):
    loader = DataLoader(
        TensorDataset(torch.tensor(X, dtype=torch.float32),
                      torch.tensor(y, dtype=torch.float32)),
        batch_size=BATCH, shuffle=True)
    opt = torch.optim.Adam(model.parameters(), lr=LR)
    for _ in range(epochs):
        model.train()
        for xb, yb in loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            opt.zero_grad(); loss = crit(model(xb), yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()

def eval_model(model, X_val, y_val, mean, std):
    model.eval()
    with torch.no_grad():
        pn = model(torch.tensor(X_val, dtype=torch.float32).to(DEVICE)).cpu().numpy()
    p = np.clip(pn*(std+1e-8)+mean, 0, None)
    t = np.clip(y_val*(std+1e-8)+mean, 0, None)
    return round(float(np.mean(np.abs(p-t))),4), round(float(np.sqrt(np.mean((p-t)**2))),4)

def train_product(series, product, meta):
    mean, std = float(series.mean()), float(series.std())
    if std < 1e-6:   # product with no variance (always 0 or constant)
        return None
    norm = (series - mean) / (std + 1e-8)

    Xl, yl = make_seq(norm, SEQ_LEN, FORECAST_HORIZON)
    if len(Xl) < 8: return None
    sp = max(1, int(len(Xl)*0.8))

    lstm = SalesLSTM(H=FORECAST_HORIZON).to(DEVICE)
    fit_model(lstm, Xl[:sp], yl[:sp], EPOCHS)
    mae_l, rmse_l = eval_model(lstm, Xl[sp:], yl[sp:], mean, std)

    Xs, ys = make_sea_seq(norm, SEQ_LEN, FORECAST_HORIZON)
    sea = SeasonalLinear(H=FORECAST_HORIZON).to(DEVICE)
    fit_model(sea, Xs[:sp], ys[:sp], EPOCHS)
    mae_s, rmse_s = eval_model(sea, Xs[sp:], ys[sp:], mean, std)

    # Ensemble eval
    lstm.eval(); sea.eval()
    with torch.no_grad():
        pl = lstm(torch.tensor(Xl[sp:], dtype=torch.float32).to(DEVICE)).cpu().numpy()
        ps = sea(torch.tensor(Xs[sp:], dtype=torch.float32).to(DEVICE)).cpu().numpy()
    pe   = (pl+ps)/2
    true = np.clip(yl[sp:]*(std+1e-8)+mean, 0, None)
    pred = np.clip(pe*(std+1e-8)+mean, 0, None)
    mae_e  = round(float(np.mean(np.abs(pred-true))), 4)
    rmse_e = round(float(np.sqrt(np.mean((pred-true)**2))), 4)

    torch.save(lstm.state_dict(), OUT/"models"/f"{slug(product)}.lstm.pt")
    torch.save(sea.state_dict(),  OUT/"models"/f"{slug(product)}.seasonal.pt")

    metrics = {
        "lstm":     {"mae": mae_l, "rmse": rmse_l},
        "seasonal": {"mae": mae_s, "rmse": rmse_s},
        "ensemble": {"mae": mae_e, "rmse": rmse_e},
    }
    meta[product] = {"mean": mean, "std": std, "metrics": metrics}
    return metrics


# ════════════════════════════════════════════════════════════════════════════
# STEP 5 — RUN FORECASTING TRAINING
# ════════════════════════════════════════════════════════════════════════════

meta    = {}
results = []
skipped = []
products_list = sorted(flat["product_name"].unique())

for i, prod in enumerate(products_list):
    if prod not in daily.columns: skipped.append(prod); continue
    series = daily[prod].values.astype(float)
    if len(series) < MIN_HISTORY or series.sum() < 5:
        skipped.append(prod); continue
    print(f"[{i+1}/{len(products_list)}] {prod}")
    r = train_product(series, prod, meta)
    if r: results.append({"product": prod, **r})

with open(OUT/"models"/"_meta.json","w") as f:
    json.dump(meta, f, indent=2)

print(f"\nTrained: {len(results)} | Skipped: {len(skipped)}")


# ════════════════════════════════════════════════════════════════════════════
# STEP 6 — SEGMENTATION
# Uses SmartSales-compatible features: RFM on customer_id + category affinity
# ════════════════════════════════════════════════════════════════════════════

print("\nBuilding segmentation features...")

ref_date = flat["date"].max()

rfm = flat.groupby("customer_id").agg(
    recency          =("date",        lambda x: (ref_date - x.max()).days),
    frequency        =("product_id",  "count"),
    monetary         =("total_price", "sum"),          # will be 0 for Instacart seed data
    unique_products  =("product_id",  "nunique"),
    unique_categories=("category",    "nunique"),
).fillna(0)

# Category affinity: spend share per customer (falls back to count share if no price)
cat_pivot = flat.groupby(["customer_id","category"])["quantity"].sum().unstack(fill_value=0)
cat_norm  = cat_pivot.div(cat_pivot.sum(axis=1), axis=0).fillna(0)

combined = rfm.join(cat_norm, how="inner").fillna(0)
scaler   = StandardScaler()
X_sc     = scaler.fit_transform(combined.values)

km     = KMeans(n_clusters=NUM_SEGMENTS, random_state=42, n_init=10)
labels = km.fit_predict(X_sc)
seg_s  = pd.Series(labels, index=combined.index, name="segment")

def label_seg(rec, freq, spend):
    # Recency is days-since-last-purchase (lower = better)
    if rec < 30  and freq > 5:   return "Champions"
    if rec < 60  and freq > 3:   return "Loyal Customers"
    if rec < 90:                 return "Potential Loyalists"
    if rec < 180:                return "At Risk"
    return "Lost"

profiles = []
for sid in range(NUM_SEGMENTS):
    mask     = seg_s == sid
    seg_rfm  = rfm[mask]
    members  = rfm[mask].index.tolist()
    seg_flat = flat[flat["customer_id"].isin(members)]

    top_prods = (
        seg_flat["product_name"].value_counts().head(5)
        .reset_index().rename(columns={"product_name":"product","count":"order_count"})
        .to_dict(orient="records")
    )
    top_cats = (
        seg_flat["category"].value_counts().head(3)
        .reset_index().rename(columns={"category":"category","count":"order_count"})
        .to_dict(orient="records")
    )

    avg_rec  = float(seg_rfm["recency"].mean())
    avg_freq = float(seg_rfm["frequency"].mean())
    avg_mon  = float(seg_rfm["monetary"].mean())

    profiles.append({
        "segment_id":          sid,
        "size":                int(mask.sum()),
        "avg_recency_days":    round(avg_rec,  1),
        "avg_frequency":       round(avg_freq, 1),
        "avg_spend":           round(avg_mon,  2),
        "avg_unique_products": round(float(seg_rfm["unique_products"].mean()), 1),
        "top_products":        top_prods,
        "top_categories":      top_cats,
        "label":               label_seg(avg_rec, avg_freq, avg_mon),
    })
    print(f"  Segment {sid} ({profiles[-1]['label']}): {profiles[-1]['size']} customers")

for fname, obj in [("kmeans.pkl",km),("scaler.pkl",scaler)]:
    with open(OUT/"segmentation"/fname,"wb") as f: pickle.dump(obj, f)

seg_config = {
    "rfm_columns":  list(rfm.columns),
    "cat_columns":  list(cat_norm.columns),
    "combined_columns": list(combined.columns),
}
with open(OUT/"segmentation"/"config.json","w") as f:
    json.dump(seg_config, f, indent=2)
with open(OUT/"segmentation"/"segment_profiles.json","w") as f:
    json.dump(profiles, f, indent=2)


# ════════════════════════════════════════════════════════════════════════════
# STEP 7 — TRAINING REPORT
# ════════════════════════════════════════════════════════════════════════════

def avg(key, sub):
    vals = [r[key][sub] for r in results if r.get(key)]
    return round(float(np.mean(vals)), 4) if vals else None

report = {
    "generated_at":      pd.Timestamp.now().isoformat(),
    "source_dataset":    "instacart (mapped to SmartSales schema)",
    "training_rows":     ROWS,
    "seq_len":           SEQ_LEN,
    "forecast_horizon":  FORECAST_HORIZON,
    "products_trained":  len(results),
    "products_skipped":  len(skipped),
    "avg_metrics": {
        "lstm":     {"mae": avg("lstm","mae"),     "rmse": avg("lstm","rmse")},
        "seasonal": {"mae": avg("seasonal","mae"), "rmse": avg("seasonal","rmse")},
        "ensemble": {"mae": avg("ensemble","mae"), "rmse": avg("ensemble","rmse")},
    },
    "per_product": sorted(results, key=lambda r: r["ensemble"]["mae"]),
    "segmentation": {"n_segments": NUM_SEGMENTS, "profiles": profiles},
}
with open(OUT/"training_report.json","w") as f:
    json.dump(report, f, indent=2)

am = report["avg_metrics"]
print(f"\n✓ Training complete")
print(f"  LSTM      MAE={am['lstm']['mae']}  RMSE={am['lstm']['rmse']}")
print(f"  Seasonal  MAE={am['seasonal']['mae']}  RMSE={am['seasonal']['rmse']}")
print(f"  Ensemble  MAE={am['ensemble']['mae']}  RMSE={am['ensemble']['rmse']}")
print(f"\nDownload → {OUT.resolve()}/")
print(f"Seed CSV  → /kaggle/working/training_data.csv")