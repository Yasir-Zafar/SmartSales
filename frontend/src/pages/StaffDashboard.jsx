import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

// Mini chart
function WeekBarChart({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const W = 340, H = 72, barW = Math.floor(W / data.length) - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto mt-3">
      {data.map((d, i) => {
        const barH = Math.max(4, (d.revenue / max) * (H - 20));
        const x = i * (W / data.length) + 2;
        const y = H - 14 - barH;
        const label = new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-US', {
          weekday: 'short', timeZone: 'UTC',
        });
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill="#2dd4bf" opacity="0.85" />
            <text x={x + barW / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#6b7280">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Sales Summary component
function SalesSummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/insights/staff/sales-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setSummary(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p className="text-gray-400 mt-8">Loading sales summary...</p>;
  if (error) return <p className="text-red-400 mt-8">{error}</p>;

  const { today, week } = summary;

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Today */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
        <h4 className="text-sm text-gray-400">Today's Sales (Live)</h4>
        <p className="text-2xl text-teal-400 mt-2">${today.revenue}</p>
        <p className="text-gray-500 text-sm">{today.transactions} transactions</p>
      </div>

      {/* Week */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
        <h4 className="text-sm text-gray-400">This Week (Live)</h4>
        <p className="text-2xl text-purple-400 mt-2">${week.revenue}</p>
        <p className="text-gray-500 text-sm">{week.transactions} transactions</p>

        <WeekBarChart data={week.dailyBreakdown} />
      </div>

    </div>
  );
}

export const StaffDashboard = () => {
  const { user } = useAuth();

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const [invRisks, setInvRisks] = useState([]);
  const [invLoading, setInvLoading] = useState(true);
  const [invErr, setInvErr] = useState('');

  useEffect(() => {
    const loadInv = async () => {
      setInvLoading(true);
      setInvErr('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/insights/staff/inventory/risk', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load recommendations');
        setInvRisks(data.risks || []);
      } catch (e) {
        setInvErr(e.message || 'Could not load inventory guidance');
      } finally {
        setInvLoading(false);
      }
    };
    loadInv();
  }, []);

  // --- Upload Modal ---
  const openUploadModal = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    if (uploading) return;
    setUploadModalOpen(false);
    setSelectedFile(null);
    setUploadResult(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setUploadResult(null);
    } else {
      setUploadResult({ success: false, message: 'Please select a valid .csv file.' });
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadResult(null);

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('http://localhost:5000/api/csv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadResult({ success: true, message: data.message });
        setSelectedFile(null);
      } else {
        setUploadResult({ success: false, message: data.message || 'Upload failed.', errors: data.errors || [] });
      }
    } catch (err) {
      setUploadResult({ success: false, message: 'Network error. Could not reach the server.' });
    } finally {
      setUploading(false);
    }
  };

  // --- History Modal ---
  const openHistoryModal = async () => {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:5000/api/csv', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data.uploads || []);
      } else {
        setHistoryError(data.message || 'Failed to load history.');
      }
    } catch (err) {
      setHistoryError('Network error. Could not reach the server.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setHistoryModalOpen(false);
    setHistory([]);
    setHistoryError(null);
  };

  const statusColor = (status) => {
    if (status === 'processed') return 'text-teal-400';
    if (status === 'failed') return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-50">Staff Dashboard</h2>
            <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={openHistoryModal}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Upload History
            </button>
            <button
              onClick={openUploadModal}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" />
              </svg>
              Upload Daily Sales CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 bg-gray-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-lg font-semibold text-gray-50 mb-2">Restock guidance</h3>
          <p className="text-xs text-gray-500 mb-4">Plain-language actions based on forecasted demand (ML service).</p>
          {invLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : invErr ? (
            <p className="text-amber-400 text-sm">{invErr}</p>
          ) : invRisks.length === 0 ? (
            <p className="text-gray-500 text-sm">No high-priority restock items right now.</p>
          ) : (
            <ul className="space-y-3">
              {invRisks.slice(0, 8).map((r) => (
                <li key={r.product} className="border border-gray-700 rounded-lg p-3">
                  <p className="text-teal-400 font-medium text-sm capitalize">{r.product}</p>
                  <p className="text-gray-300 text-sm mt-1">{r.staff_action?.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Live Sales Summary (NEW - does NOT remove your hardcoded stats) */}
        <SalesSummary />

        {/* Cards */}
        <div className="mt-8 grid grid-cols-1 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Recent Transactions</h3>
            <p className="text-gray-400">Latest sales and customer orders</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Quick Actions</h3>
            <p className="text-gray-400">Process orders, update inventory</p>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-50">Upload Daily Sales CSV</h3>
              <button onClick={closeUploadModal} className="text-gray-400 hover:text-gray-200 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-600 hover:border-teal-500 rounded-xl p-8 text-center cursor-pointer transition-colors group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mx-auto text-gray-500 group-hover:text-teal-400 transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {selectedFile ? (
                <p className="text-teal-400 font-medium">{selectedFile.name}</p>
              ) : (
                <>
                  <p className="text-gray-300 font-medium">Click to select a CSV file</p>
                  <p className="text-gray-500 text-sm mt-1">Only .csv files are accepted</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </div>

            {uploadResult && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${uploadResult.success ? 'bg-teal-900/50 text-teal-300' : 'bg-red-900/50 text-red-300'}`}>
                <p className="font-medium">{uploadResult.message}</p>
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-red-400">
                    {uploadResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={closeUploadModal} disabled={uploading} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Uploading...
                  </>
                ) : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-50">CSV Upload History</h3>
              <button onClick={closeHistoryModal} className="text-gray-400 hover:text-gray-200 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-10 text-gray-400">Loading...</div>
            ) : historyError ? (
              <div className="text-center py-10 text-red-400">{historyError}</div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 text-gray-500">No uploads yet.</div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 bg-gray-800">
                    <tr className="text-xs uppercase tracking-wider text-gray-400 border-b border-gray-700">
                      <th className="pb-3 pr-4">File</th>
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Rows</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Uploaded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                        <td className="py-3 pr-4 text-gray-200 truncate max-w-[160px]" title={row.file_name}>{row.file_name}</td>
                        <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{new Date(row.upload_date).toLocaleDateString()}</td>
                        <td className="py-3 pr-4 text-gray-400">{row.row_count}</td>
                        <td className={`py-3 pr-4 font-medium capitalize ${statusColor(row.status)}`}>{row.status}</td>
                        <td className="py-3 text-gray-400">{row.profiles?.name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button onClick={closeHistoryModal} className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
