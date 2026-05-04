import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

export const StaffDashboard = () => {
  const { user } = useAuth();
  const [salesSummary, setSalesSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

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

  useEffect(() => {
    const loadSummary = async () => {
      setSummaryLoading(true);
      setSummaryError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/insights/staff/sales-summary', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load sales summary');
        setSalesSummary(data);
      } catch (err) {
        setSummaryError(err.message || 'Could not load sales summary');
      } finally {
        setSummaryLoading(false);
      }
    };
    loadSummary();
  }, []);

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

<div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-teal-500/20">
    <h3 className="text-lg font-semibold text-gray-50 mb-2">Operations</h3>
    <p className="text-xs text-gray-500 mb-4">Live sales summary and restock guidance.</p>
    <div className="flex flex-wrap gap-3">
      <Link
        to="/staff/operations"
        className="inline-flex items-center justify-center bg-teal-500 hover:bg-teal-400 text-gray-900 font-semibold rounded-md px-4 py-2"
      >
        Open Operations Page
      </Link>
      <Link
        to="/staff/sales-summary"
        className="inline-flex items-center justify-center bg-violet-500 hover:bg-violet-400 text-gray-900 font-semibold rounded-md px-4 py-2"
      >
        Detailed Sales Summary
      </Link>
    </div>
  </div>
  <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-rose-500/20">
    <h3 className="text-lg font-semibold text-gray-50 mb-2">Inventory</h3>
    <p className="text-xs text-gray-500 mb-4">All products, prices, and quantities. Below 10 units uses tiered warnings (0 = strongest).</p>
    <Link
      to="/staff/inventory"
      className="inline-flex items-center justify-center bg-rose-500 hover:bg-rose-400 text-gray-900 font-semibold rounded-md px-4 py-2"
    >
      Open Inventory
    </Link>
  </div>
</div>

<div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
  <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
    <h3 className="text-lg font-semibold text-gray-50 mb-2">Latest Day Sales</h3>
    {summaryLoading ? (
      <p className="text-gray-400 text-sm">Loading summary...</p>
    ) : summaryError ? (
      <p className="text-red-400 text-sm">{summaryError}</p>
    ) : (
      <>
        <p className="text-3xl font-bold text-teal-400">${salesSummary?.today?.revenue || '0.00'}</p>
        <p className="text-xs text-gray-400 mt-1">{salesSummary?.today?.transactions || 0} transactions</p>
        {salesSummary?.today?.date && (
          <p className="text-xs text-gray-500 mt-1">Date: {salesSummary.today.date}</p>
        )}
        {!!salesSummary?.today?.top_items?.length && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Top items</p>
            <ul className="space-y-1">
              {salesSummary.today.top_items.slice(0, 3).map((item) => (
                <li key={item.product_name} className="text-xs text-gray-300 flex justify-between gap-2">
                  <span className="truncate">{item.product_name}</span>
                  <span className="text-teal-300">{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    )}
  </div>
  <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
    <h3 className="text-lg font-semibold text-gray-50 mb-2">Latest 7-Day Sales</h3>
    {summaryLoading ? (
      <p className="text-gray-400 text-sm">Loading summary...</p>
    ) : summaryError ? (
      <p className="text-red-400 text-sm">{summaryError}</p>
    ) : (
      <>
        <p className="text-3xl font-bold text-violet-400">${salesSummary?.week?.revenue || '0.00'}</p>
        <p className="text-xs text-gray-400 mt-1">{salesSummary?.week?.transactions || 0} transactions</p>
        {salesSummary?.week?.start_date && salesSummary?.week?.end_date && (
          <p className="text-xs text-gray-500 mt-1">
            Window: {salesSummary.week.start_date} to {salesSummary.week.end_date}
          </p>
        )}
        {!!salesSummary?.week?.top_items?.length && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Top items this window</p>
            <ul className="space-y-1">
              {salesSummary.week.top_items.slice(0, 3).map((item) => (
                <li key={item.product_name} className="text-xs text-gray-300 flex justify-between gap-2">
                  <span className="truncate">{item.product_name}</span>
                  <span className="text-violet-300">{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    )}
  </div>
</div>

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
