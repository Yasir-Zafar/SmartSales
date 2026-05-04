import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Upload, CheckCircle, XCircle, BarChart3 } from 'lucide-react';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUploads = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/csv', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load upload history');
        setUploads(data.uploads || []);
      } catch (e) {
        setError(e.message || 'Could not load upload history');
      } finally {
        setLoading(false);
      }
    };
    loadUploads();
  }, []);

  const statusBadge = (status) => {
    if (status === 'processed') return 'bg-success/10 text-success border border-success/30';
    if (status === 'failed') return 'bg-danger/10 text-danger border border-danger/30';
    return 'bg-warning/10 text-warning border border-warning/30';
  };

  const totalUploads = uploads.length;
  const processedCount = uploads.filter((u) => u.status === 'processed').length;
  const failedCount = uploads.filter((u) => u.status === 'failed').length;
  const totalRows = uploads.reduce((s, u) => s + (u.row_count || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Navbar />
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-text-primary">Admin Dashboard</h2>
          <p className="text-text-muted mt-1">Welcome, <span className="text-accent">{user?.email}</span></p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface-800 border border-accent/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-accent">
                <Upload size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Total Uploads</p>
                <p className="text-2xl font-bold text-text-primary">{totalUploads}</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-800 border border-success/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-success">
                <CheckCircle size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Processed</p>
                <p className="text-2xl font-bold text-text-primary">{processedCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-800 border border-danger/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-danger">
                <XCircle size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Failed</p>
                <p className="text-2xl font-bold text-text-primary">{failedCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-800 border border-accent/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-accent">
                <BarChart3 size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Total Rows</p>
                <p className="text-2xl font-bold text-text-primary">{totalRows.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-700">
            <h3 className="text-lg font-semibold text-text-primary">Upload History</h3>
            <p className="text-xs text-text-faint mt-1">Track all CSV uploads with date, status, and uploader.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-faint">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mr-3"></div>
              Loading upload history...
            </div>
          ) : error ? (
            <div className="p-6 text-danger bg-danger/10">{error}</div>
          ) : uploads.length === 0 ? (
            <div className="p-6 text-text-faint text-center">No upload history found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-900/60 text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-6 py-3">File</th>
                    <th className="px-6 py-3">Upload Date</th>
                    <th className="px-6 py-3">Rows</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Uploader</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {uploads.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-800/50">
                      <td className="px-6 py-3 text-text-primary font-medium">{row.file_name || '—'}</td>
                      <td className="px-6 py-3 text-text-muted">
                        {row.upload_date ? new Date(row.upload_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-3 text-text-secondary">{row.row_count?.toLocaleString() ?? '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold capitalize ${statusBadge(row.status)}`}>
                          {row.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-text-muted">{row.profiles?.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
