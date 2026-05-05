import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import {
  Settings,
  FileText,
  Package,
  Upload,
  Clock,
  X,
  ChevronRight,
  Loader2,
  TrendingUp,
} from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const StatCard = ({ icon: Icon, label, value, valueColor }) => (
  <div className="bg-surface-800 p-5 rounded-xl border border-surface-700">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-text-muted" />
      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</h4>
    </div>
    <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
  </div>
);

const NavCard = ({ to, icon: Icon, title, subtitle, badge, children, accent }) => {
  const accentMap = {
    teal: 'border-success-border hover:border-success/50 hover:bg-success-glow',
    rose: 'border-danger-border hover:border-danger/50 hover:bg-danger-glow',
    violet: 'border-accent-border hover:border-accent/50 hover:bg-accent-glow',
    amber: 'border-warning-border hover:border-warning/50 hover:bg-warning-glow',
  };
  const iconMap = {
    teal: 'text-success',
    rose: 'text-danger',
    violet: 'text-accent',
    amber: 'text-warning',
  };

  return (
    <Link
      to={to}
      className={`group flex flex-col bg-surface-800 border rounded-xl p-5 transition-all duration-200 ${accentMap[accent] || accentMap.teal}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center ${iconMap[accent] || iconMap.teal}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            <p className="text-text-secondary text-sm">{subtitle}</p>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${iconMap[accent] || iconMap.teal}`} />
      </div>
      {badge && (
        <span className="mt-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-danger-glow text-danger border border-danger-border w-fit">
          {badge}
        </span>
      )}
      {children && <div className="mt-3">{children}</div>}
    </Link>
  );
};

export const StaffDashboard = () => {
  const { user } = useAuth();
  const [salesSummary, setSalesSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const openUploadModal = () => { setSelectedFile(null); setUploadResult(null); setUploadModalOpen(true); };
  const closeUploadModal = () => { if (uploading) return; setUploadModalOpen(false); setSelectedFile(null); setUploadResult(null); };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.csv')) { setSelectedFile(file); setUploadResult(null); }
    else { setUploadResult({ success: false, message: 'Please select a valid .csv file.' }); setSelectedFile(null); }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadResult(null);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const res = await fetch(`${API_URL}/csv`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (res.ok) { setUploadResult({ success: true, message: data.message }); setSelectedFile(null); }
      else { setUploadResult({ success: false, message: data.message || 'Upload failed.', errors: data.errors || [] }); }
    } catch { setUploadResult({ success: false, message: 'Network error. Could not reach the server.' }); }
    finally { setUploading(false); }
  };

  const openHistoryModal = async () => {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/csv`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setHistory(data.uploads || []);
      else setHistoryError(data.message || 'Failed to load history.');
    } catch { setHistoryError('Network error. Could not reach the server.'); }
    finally { setHistoryLoading(false); }
  };
  const closeHistoryModal = () => { setHistoryModalOpen(false); setHistory([]); setHistoryError(null); };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const loadSummary = async () => {
      setSummaryLoading(true);
      setSummaryError('');
      try {
        const res = await fetch(`${API_URL}/insights/staff/sales-summary`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load sales summary');
        setSalesSummary(data);
      } catch (err) { setSummaryError(err.message); }
      finally { setSummaryLoading(false); }
    };
    loadSummary();
  }, []);

  const statusColor = (status) => {
    if (status === 'processed') return 'text-success';
    if (status === 'failed') return 'text-danger';
    return 'text-warning';
  };

  const todayItems = salesSummary?.today?.top_items || [];

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Navbar />
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Staff Dashboard</h2>
            <p className="text-text-secondary mt-1">Welcome, <span className="text-accent">{user?.email}</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={openHistoryModal} className="flex items-center gap-2 bg-surface-700 hover:bg-surface-600 text-text-secondary text-sm font-medium px-4 py-2 rounded-lg transition-all">
              <Clock className="w-4 h-4" />
              Upload History
            </button>
            <button onClick={openUploadModal} className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-all">
              <Upload className="w-4 h-4" />
              Upload CSV
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-4">Navigation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <NavCard to="/staff/operations" icon={Settings} title="Operations" subtitle="Restock guidance and sales overview" accent="teal" />
            <NavCard to="/staff/sales-summary" icon={FileText} title="Detailed Sales Summary" subtitle="Item-level breakdowns and daily trends" accent="violet">
              {summaryLoading ? (
                <p className="text-text-faint text-xs">Loading...</p>
              ) : summaryError ? (
                <p className="text-danger text-xs">Could not load</p>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Today</span>
                  <span className="text-text-primary font-semibold">${salesSummary?.today?.revenue || '0.00'}</span>
                </div>
              )}
            </NavCard>
            <NavCard to="/staff/inventory" icon={Package} title="Inventory" subtitle="All products and stock levels" accent="rose" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={TrendingUp} label="Today Revenue" value={summaryLoading ? '—' : `$${Number(salesSummary?.today?.revenue || 0).toLocaleString()}`} valueColor="text-success" />
          <StatCard icon={TrendingUp} label="7-Day Revenue" value={summaryLoading ? '—' : `$${Number(salesSummary?.week?.revenue || 0).toLocaleString()}`} valueColor="text-accent" />
          <StatCard icon={TrendingUp} label="Today Transactions" value={summaryLoading ? '—' : Number(salesSummary?.today?.transactions || 0).toLocaleString()} valueColor="text-warning" />
        </div>
        {summaryError && <p className="text-danger text-sm mt-3">{summaryError}</p>}
        {!summaryLoading && !summaryError && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {todayItems.length > 0 && (
              <div className="bg-surface-800 border border-surface-700 p-5 rounded-xl">
                <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Top Items (Today)</p>
                <ul className="space-y-1">
                  {todayItems.slice(0, 5).map((item) => (
                    <li key={item.product_name} className="text-sm text-text-secondary flex justify-between gap-2">
                      <span className="truncate">{item.product_name}</span>
                      <span className="text-accent">{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {salesSummary?.week?.top_items?.length > 0 && (
              <div className="bg-surface-800 border border-surface-700 p-5 rounded-xl">
                <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Top Items (7-Day)</p>
                <ul className="space-y-1">
                  {salesSummary.week.top_items.slice(0, 5).map((item) => (
                    <li key={item.product_name} className="text-sm text-text-secondary flex justify-between gap-2">
                      <span className="truncate">{item.product_name}</span>
                      <span className="text-accent">{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 border border-surface-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-primary">Upload Daily Sales CSV</h3>
              <button onClick={closeUploadModal} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-surface-600 hover:border-accent-border rounded-xl p-8 text-center cursor-pointer transition-all group">
              <Upload className="w-10 h-10 mx-auto text-text-faint group-hover:text-accent transition-colors mb-3" />
              {selectedFile ? (
                <p className="text-accent font-medium">{selectedFile.name}</p>
              ) : (
                <>
                  <p className="text-text-secondary font-medium">Click to select a CSV file</p>
                  <p className="text-text-faint text-sm mt-1">Only .csv files are accepted</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </div>
            {uploadResult && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${uploadResult.success ? 'bg-success-glow text-success' : 'bg-danger-glow text-danger'}`}>
                <p className="font-medium">{uploadResult.message}</p>
                {uploadResult.errors?.length > 0 && (
                  <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-danger">
                    {uploadResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={closeUploadModal} disabled={uploading} className="flex-1 bg-surface-700 hover:bg-surface-600 text-text-secondary text-sm font-medium py-2 rounded-lg transition-all disabled:opacity-50">Cancel</button>
              <button onClick={handleUpload} disabled={!selectedFile || uploading} className="flex-1 bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {uploading ? (<><Loader2 className="animate-spin w-4 h-4" />Uploading...</>) : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 border border-surface-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-primary">CSV Upload History</h3>
              <button onClick={closeHistoryModal} className="text-text-secondary hover:text-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {historyLoading ? (
              <div className="text-center py-10 text-text-secondary">Loading...</div>
            ) : historyError ? (
              <div className="text-center py-10 text-danger">{historyError}</div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 text-text-faint">No uploads yet.</div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 bg-surface-800">
                    <tr className="text-xs uppercase tracking-wider text-text-muted border-b border-surface-700">
                      <th className="pb-3 pr-4">File</th>
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Rows</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Uploaded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b border-surface-700/50 hover:bg-surface-700/30 transition-colors">
                        <td className="py-3 pr-4 text-text-primary truncate max-w-[160px]" title={row.file_name}>{row.file_name}</td>
                        <td className="py-3 pr-4 text-text-muted whitespace-nowrap">{new Date(row.upload_date).toLocaleDateString()}</td>
                        <td className="py-3 pr-4 text-text-muted">{row.row_count}</td>
                        <td className={`py-3 pr-4 font-medium capitalize ${statusColor(row.status)}`}>{row.status}</td>
                        <td className="py-3 text-text-muted">{row.profiles?.name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={closeHistoryModal} className="bg-surface-700 hover:bg-surface-600 text-text-secondary text-sm font-medium px-4 py-2 rounded-lg transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
