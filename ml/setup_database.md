# Setup Database Connection for ML Service

## Quick Setup

### 1. Get Your Database Connection String

**From Supabase Dashboard:**
1. Go to https://supabase.com/dashboard/project/ovdxwgschsrqlnljqiml
2. Click "Project Settings" (gear icon in sidebar)
3. Click "Database"
4. Scroll to "Connection string" section
5. Copy the "URI" connection string

It will look like:
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 2. Update ml/.env File

Edit `/home/boi/Projects/Sem6/FSPM/SmartSales/ml/.env`:

```bash
# Replace [YOUR-PASSWORD] with your actual Supabase database password
DATABASE_URL=postgresql://postgres.ovdxwgschsrqlnljqiml:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 3. Restart ML Service

```bash
cd /home/boi/Projects/Sem6/FSPM/SmartSales/ml
uvicorn app:app --reload
```

### 4. Test Database Connection

```bash
# Trigger forecast persistence
curl -X POST http://localhost:8000/persist-forecasts

# Expected output:
# {
#   "forecast_snapshots_saved": 308,
#   "forecast_run_batch_id": "uuid-here"
# }
```

If `forecast_run_batch_id` is NOT null, it worked! ✅

---

## Alternative: Direct Connection (No Pooler)

If pooler connection fails, try direct connection:

```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.ovdxwgschsrqlnljqiml.supabase.co:5432/postgres
```

---

## Verify Tables Exist

Run this SQL in Supabase SQL Editor:

```sql
-- Check if ml_forecast_snapshots table exists
SELECT COUNT(*) FROM ml_forecast_snapshots;

-- Check if column is correctly named
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ml_forecast_snapshots';
```

Expected columns:
- `ensemble_total_5d` (NOT `ensemble_total_30d`)
- `ensemble_daily` (JSONB)
- `lstm_daily` (JSONB)
- `seasonal_daily` (JSONB)

---

## If Migration Needed

Run this SQL if tables don't exist or column is wrong:

```sql
-- Run the migration script
-- Copy/paste content from: backend/migrations/001_update_5d_forecasts.sql
```

Or run from command line:

```bash
psql $DATABASE_URL -f backend/migrations/001_update_5d_forecasts.sql
```

---

## Troubleshooting

### Error: "database does not exist"
- Check your DATABASE_URL is correct
- Make sure you're using the postgres database, not a custom one

### Error: "password authentication failed"
- Update [YOUR-PASSWORD] with correct password
- Reset password in Supabase if needed

### Error: "could not connect to server"
- Check firewall/network settings
- Try pooler connection instead of direct

### Error: "relation 'ml_forecast_snapshots' does not exist"
- Run migration: `backend/migrations/001_update_5d_forecasts.sql`
- Or run `backend/schema.sql` in Supabase SQL Editor

### Success Signs
When ML service starts, you should see:
```
[SmartSales] Loading data from ./flat_data.csv
[SmartSales] Ready — 697 models | 80 customers
```

When persisting forecasts:
```
[SmartSales] Connecting to database...
[SmartSales] Persisting 308 forecast snapshots...
[SmartSales] Saved 50/308 snapshots...
[SmartSales] Saved 100/308 snapshots...
...
[SmartSales] ✅ Successfully persisted 308 forecasts (batch: uuid-here)
```

---

## Quick Test Commands

```bash
# 1. Check ML service health
curl http://localhost:8000/health

# 2. Test forecast generation
curl http://localhost:8000/forecast/banana

# 3. Persist to database
curl -X POST http://localhost:8000/persist-forecasts

# 4. Check database (in psql)
psql $DATABASE_URL -c "SELECT COUNT(*), MAX(created_at) FROM ml_forecast_snapshots;"
```

---

## Environment Variable Priority

The ML service checks for database URL in this order:
1. `DATABASE_URL` (recommended)
2. `SUPABASE_DB_URL` (alternative)

Use whichever you prefer, both work the same.
