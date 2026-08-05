import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  History,
  Brain,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCcw,
  FileUp,
  Info,
  Clock,
} from 'lucide-react';

import { api, errorMessage } from '../lib/api';
import { num, date, relativeTime, downloadBlob } from '../lib/format';
import { staggerParent } from '../lib/motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTabParam } from '../hooks/useTabParam';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, Inset } from '../components/ui/Surface';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Tabs } from '../components/ui/Tabs';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { AIThinking, IndeterminateBar, AIBadge } from '../components/ui/AIState';

/**
 * Data studio — everything that puts data in or takes data out.
 *
 * Uploading used to be a modal on the staff dashboard, upload history a second
 * modal, and retraining a third modal on the analyst dashboard. They are one
 * workflow — get data in, check it landed, feed it to the model — so they are
 * now one page.
 */

const REQUIRED_COLUMNS = [
  'sale_date',
  'transaction_id',
  'product_id',
  'product_name',
  'category',
  'quantity',
  'unit_price',
  'total_price',
];

const STATUS_META = {
  processed: { tone: 'good', icon: CheckCircle2, label: 'Processed' },
  failed: { tone: 'critical', icon: XCircle, label: 'Failed' },
  pending: { tone: 'warning', icon: Clock, label: 'Pending' },
};

// ── Upload ───────────────────────────────────────────────────────────────────

function UploadPanel({ onUploaded }) {
  const toast = useToast();
  const fileInput = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const pickFile = (candidate) => {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith('.csv')) {
      setResult({ ok: false, message: 'That is not a .csv file. Export your sales as CSV and try again.' });
      setFile(null);
      return;
    }
    setFile(candidate);
    setResult(null);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await api.post('/csv', form);
      setResult({ ok: true, message: res.data.message, meta: res.data });
      setFile(null);
      toast.success('Upload complete', res.data.message);
      onUploaded?.();
    } catch (err) {
      const data = err.response?.data;
      setResult({
        ok: false,
        message: data?.message || errorMessage(err, 'Upload failed'),
        errors: data?.errors || [],
      });
      toast.error('Upload failed', data?.message || errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card animate={false} className="h-full">
          <CardHeader
            title="Upload daily sales"
            description="Every row is validated before anything is written, so a bad file cannot half-import."
            icon={Upload}
          />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pickFile(event.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click();
            }}
            role="button"
            tabIndex={0}
            aria-label="Choose a CSV file to upload"
            className={`mt-5 cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-[border-color,background-color] duration-200 ${
              dragging ? 'border-honey bg-honey/8' : 'border-hairline/15 hover:border-honey/45 hover:bg-honey/4'
            }`}
          >
            <motion.div animate={dragging ? { scale: 1.06 } : { scale: 1 }} className="flex flex-col items-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-honey/12 text-honey">
                <FileUp size={24} aria-hidden="true" />
              </span>
              {file ? (
                <>
                  <p className="mt-4 text-[14px] font-semibold text-ink">{file.name}</p>
                  <p className="mt-1 text-[12px] text-ink-muted">{(file.size / 1024).toFixed(1)} KB — ready to upload</p>
                </>
              ) : (
                <>
                  <p className="mt-4 text-[14px] font-semibold text-ink">Drop a CSV here, or click to choose</p>
                  <p className="mt-1 text-[12px] text-ink-muted">Only .csv files are accepted</p>
                </>
              )}
            </motion.div>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
          </div>

          {uploading && (
            <div className="mt-4">
              <IndeterminateBar />
              <p className="mt-2 text-center text-[12.5px] text-ink-muted">
                Validating rows and writing them in batches…
              </p>
            </div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 rounded-xl border p-3.5 ${
                result.ok ? 'border-good/28 bg-good/6' : 'border-critical/28 bg-critical/6'
              }`}
            >
              <p className={`flex items-center gap-2 text-[13px] font-semibold ${result.ok ? 'text-good' : 'text-critical'}`}>
                {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {result.message}
              </p>

              {result.meta?.duration && (
                <p className="mt-1 text-[12px] text-ink-muted">
                  Took {result.meta.duration} across {result.meta.batches} batch
                  {result.meta.batches === 1 ? '' : 'es'}.
                </p>
              )}

              {result.errors?.length > 0 && (
                <>
                  <p className="mt-3 text-[12px] font-medium text-ink-soft">
                    First {result.errors.length} problem{result.errors.length === 1 ? '' : 's'}:
                  </p>
                  <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                    {result.errors.map((message, index) => (
                      <li key={index} className="flex gap-2 text-[12px] text-critical">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {message}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </motion.div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" icon={Upload} onClick={upload} disabled={!file} loading={uploading}>
              {uploading ? 'Uploading…' : 'Upload file'}
            </Button>
            {file && !uploading && (
              <Button variant="ghost" onClick={() => setFile(null)}>
                Choose a different file
              </Button>
            )}
          </div>
        </Card>
      </div>

      <Card animate={false}>
        <CardHeader title="What the file must contain" icon={Info} />
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
          These columns are required, in any order. Header names are matched case-insensitively.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-1.5">
          {REQUIRED_COLUMNS.map((column) => (
            <li key={column} className="rounded-md bg-hairline/6 px-2 py-1 font-mono text-[11px] text-ink-soft">
              {column}
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2.5 border-t border-hairline/8 pt-4 text-[12px] leading-relaxed text-ink-muted">
          <p>
            <span className="font-semibold text-ink-soft">customer_id</span> is optional. Without it, a stable id
            is derived from the transaction id so segmentation still works.
          </p>
          <p>
            <span className="font-semibold text-ink-soft">id</span>,{' '}
            <span className="font-semibold text-ink-soft">created_at</span> and{' '}
            <span className="font-semibold text-ink-soft">uploaded_by</span> must not be present — the server sets
            those.
          </p>
          <p>Quantity and both price columns must be positive numbers, and sale_date must be a real date.</p>
        </div>
      </Card>
    </div>
  );
}

// ── History ──────────────────────────────────────────────────────────────────

function HistoryPanel({ uploads, loading, error, onReload }) {
  const stats = useMemo(
    () => ({
      total: uploads.length,
      processed: uploads.filter((upload) => upload.status === 'processed').length,
      failed: uploads.filter((upload) => upload.status === 'failed').length,
      rows: uploads.reduce((sum, upload) => sum + (upload.row_count || 0), 0),
    }),
    [uploads]
  );

  return (
    <div className="space-y-4">
      <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Uploads" numericValue={stats.total} format={(v) => num(Math.round(v))} icon={Upload} accent loading={loading} />
        <StatCard label="Processed" numericValue={stats.processed} format={(v) => num(Math.round(v))} icon={CheckCircle2} loading={loading} />
        <StatCard label="Failed" numericValue={stats.failed} format={(v) => num(Math.round(v))} icon={XCircle} loading={loading} />
        <StatCard label="Rows ingested" numericValue={stats.rows} format={(v) => num(Math.round(v))} icon={FileSpreadsheet} loading={loading} />
      </motion.div>

      <Card animate={false}>
        <CardHeader
          title="Upload history"
          description="Every ingestion attempt, who ran it and why it failed when it did."
          icon={History}
          actions={
            <Button size="sm" icon={RefreshCcw} onClick={onReload} loading={loading}>
              Reload
            </Button>
          }
        />
        <div className="mt-4">
          {error ? (
            <EmptyState title="Could not load history" description={error} action={onReload} actionLabel="Try again" />
          ) : (
            <DataTable
              loading={loading}
              columns={[
                {
                  key: 'file_name',
                  header: 'File',
                  render: (row) => <span className="font-medium text-ink">{row.file_name || '—'}</span>,
                },
                {
                  key: 'upload_date',
                  header: 'Date',
                  value: (row) => row.created_at || row.upload_date,
                  render: (row) => (
                    <span title={date(row.created_at || row.upload_date, { withTime: true })}>
                      {relativeTime(row.created_at || row.upload_date)}
                    </span>
                  ),
                },
                {
                  key: 'row_count',
                  header: 'Rows',
                  align: 'right',
                  value: (row) => Number(row.row_count || 0),
                  render: (row) => <span className="tabular">{num(row.row_count)}</span>,
                },
                {
                  key: 'duration_seconds',
                  header: 'Duration',
                  align: 'right',
                  value: (row) => Number(row.duration_seconds || 0),
                  render: (row) =>
                    row.duration_seconds != null ? (
                      <span className="tabular text-ink-muted">{Number(row.duration_seconds).toFixed(1)}s</span>
                    ) : (
                      '—'
                    ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  align: 'center',
                  render: (row) => {
                    const meta = STATUS_META[row.status] || { tone: 'neutral', icon: Info, label: row.status || 'unknown' };
                    return (
                      <Badge tone={meta.tone} icon={meta.icon}>
                        {meta.label}
                      </Badge>
                    );
                  },
                },
                {
                  key: 'uploader',
                  header: 'Uploaded by',
                  sortable: false,
                  render: (row) => row.profiles?.name || '—',
                },
                {
                  key: 'error_message',
                  header: 'Detail',
                  sortable: false,
                  className: 'max-w-xs text-ink-faint',
                  render: (row) =>
                    row.error_message ? (
                      <span className="line-clamp-2 text-[11.5px]" title={row.error_message}>
                        {row.error_message}
                      </span>
                    ) : (
                      '—'
                    ),
                },
              ]}
              rows={uploads}
              rowKey={(row) => row.id}
              maxHeight="34rem"
              dense
              empty={
                <EmptyState
                  icon={Upload}
                  title="No uploads yet"
                  description="Once someone uploads a sales CSV it will be listed here."
                />
              }
              caption="History of CSV ingestion runs"
            />
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Training ─────────────────────────────────────────────────────────────────

function TrainingPanel() {
  const toast = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const validRange = startDate && endDate && startDate <= endDate;

  const downloadTrainingCsv = async () => {
    if (!validRange) return;
    setDownloading(true);
    try {
      // A blob response, so this bypasses the JSON interceptor path.
      const res = await api.get('/analyst/training-export', {
        params: { startDate, endDate },
        responseType: 'blob',
      });
      downloadBlob(res.data, `smartsales_training_${startDate}_${endDate}.csv`);
      toast.success('Training CSV downloaded', `Rows from ${date(startDate)} to ${date(endDate)}.`);
    } catch (err) {
      toast.error('Export failed', errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const retrain = async () => {
    if (!validRange) return;
    setRetraining(true);
    setOutcome(null);
    try {
      const res = await api.post('/analyst/retrain', { startDate, endDate });
      setOutcome({ ok: true, data: res.data });
      toast.success('Model reloaded', res.data?.message || 'The model service picked up the new data.');
    } catch (err) {
      const message = errorMessage(err, 'The model service did not accept the reload');
      setOutcome({ ok: false, message });
      toast.error('Reload failed', message);
    } finally {
      setRetraining(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card animate={false}>
        <CardHeader
          title="Choose a training window"
          description="Sales in this range become the model's new view of the world."
          icon={Brain}
        />
        <div className="mt-4 space-y-3">
          <Input label="From" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input
            label="To"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            error={startDate && endDate && startDate > endDate ? 'The end date is before the start date.' : undefined}
          />
        </div>

        <div className="mt-5 space-y-2">
          <Button
            variant="primary"
            icon={RefreshCcw}
            onClick={retrain}
            loading={retraining}
            disabled={!validRange || downloading}
            className="w-full"
          >
            Reload the model
          </Button>
          <Button
            icon={Download}
            onClick={downloadTrainingCsv}
            loading={downloading}
            disabled={!validRange || retraining}
            className="w-full"
          >
            Download the CSV instead
          </Button>
        </div>

        <Inset className="mt-5">
          <p className="text-[12px] leading-relaxed text-ink-muted">
            Reloading sends the exported rows straight to the Python service, which rebuilds its in-memory data,
            recomputes forecasts and rewrites the customer segments. Downloading gives you the same file to
            inspect or train with offline.
          </p>
        </Inset>
      </Card>

      <div className="lg:col-span-2">
        <Card animate={false} className="h-full">
          <CardHeader title="Result" icon={Brain} actions={outcome?.ok && <AIBadge />} />

          <div className="mt-4">
            {retraining ? (
              <AIThinking
                title="Reloading the model"
                steps={[
                  'Exporting sales for the selected window',
                  'Sending them to the model service',
                  'Rebuilding forecasts for every product',
                  'Recomputing customer segments',
                ]}
              />
            ) : outcome?.ok ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="rounded-xl border border-good/28 bg-good/6 p-4">
                  <p className="flex items-center gap-2 text-[13.5px] font-semibold text-good">
                    <CheckCircle2 size={15} />
                    {outcome.data?.message || 'The model service reloaded successfully.'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Rows sent', value: outcome.data?.row_count },
                    { label: 'Customers', value: outcome.data?.ml?.customers },
                    { label: 'Products', value: outcome.data?.ml?.products },
                    { label: 'Forecasts saved', value: outcome.data?.ml?.forecast_snapshots_saved },
                  ].map((entry) => (
                    <Inset key={entry.label} className="text-center">
                      <p className="text-[11px] text-ink-faint">{entry.label}</p>
                      <p className="mt-1 font-display text-lg font-bold text-ink tabular">
                        {entry.value != null ? num(entry.value) : '—'}
                      </p>
                    </Inset>
                  ))}
                </div>

                {outcome.data?.ml?.forecast_run_batch_id && (
                  <p className="text-[11.5px] text-ink-faint">
                    Forecast batch{' '}
                    <span className="font-mono">{outcome.data.ml.forecast_run_batch_id}</span>
                  </p>
                )}
              </motion.div>
            ) : outcome ? (
              <div className="rounded-xl border border-critical/28 bg-critical/6 p-4">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-critical">
                  <XCircle size={15} />
                  {outcome.message}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                  Check the Python service is running on port 8000 and that the date range contains sales.
                </p>
              </div>
            ) : (
              <EmptyState
                icon={Brain}
                title="Nothing reloaded yet"
                description="Pick a date range on the left, then reload the model or download the training file."
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function DataStudio() {
  const { user } = useAuth();
  const role = user?.role;

  const canUpload = ['STAFF', 'ADMIN'].includes(role);
  const canTrain = ['ANALYST', 'ADMIN'].includes(role);

  const availableTabs = [
    ...(canUpload ? [{ id: 'upload', label: 'Upload', icon: Upload }] : []),
    { id: 'history', label: 'History', icon: History },
    ...(canTrain ? [{ id: 'training', label: 'Model training', icon: Brain }] : []),
  ];

  const [tab, setTab] = useTabParam(availableTabs[0].id, availableTabs.map((t) => t.id));

  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/csv');
      setUploads(res.data?.uploads || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load upload history'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div>
      <PageHeader
        title="Data studio"
        description="Get sales data in, confirm it landed, and feed it to the model. Everything that changes what SmartSales knows happens here."
      />

      <div className="mb-4">
        <Tabs tabs={availableTabs} value={tab} onChange={setTab} layoutId="data-tabs" />
      </div>

      {tab === 'upload' && canUpload && <UploadPanel onUploaded={loadHistory} />}
      {tab === 'history' && (
        <HistoryPanel uploads={uploads} loading={loading} error={error} onReload={loadHistory} />
      )}
      {tab === 'training' && canTrain && <TrainingPanel />}
    </div>
  );
}

export default DataStudio;
