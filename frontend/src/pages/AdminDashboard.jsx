import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

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
    if (status === 'processed') return 'bg-teal-500/10 text-teal-400 border border-teal-500/30';
    if (status === 'failed') return 'bg-red-500/10 text-red-400 border border-red-500/30';
    return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30';
  };

  const totalUploads = uploads.length;
  const processedCount = uploads.filter((u) => u.status === 'processed').length;
  const failedCount = uploads.filter((u) => u.status === 'failed').length;
  const totalRows = uploads.reduce((s, u) => s + (u.row_count || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Admin Dashboard</h2>
          <p className="text-gray-400 mt-1">Welcome, <span className="text-teal-400">{user?.email}</span></p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Uploads', value: totalUploads, icon: '📤', accent: 'border-blue-500/30' },
            { label: 'Processed', value: processedCount, icon: '✅', accent: 'border-teal-500/30' },
            { label: 'Failed', value: failedCount, icon: '❌', accent: failedCount > 0 ? 'border-red-500/30' : 'border-gray-700' },
            { label: 'Total Rows', value: totalRows.toLocaleString(), icon: '📊', accent: 'border-violet-500/30' },
          ].map((card) => (
            <div key={card.label} className={`bg-gray-800 border rounded-xl p-5 ${card.accent}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{card.icon}</span>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-100">{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-gray-50">Upload History</h3>
            <p className="text-xs text-gray-500 mt-1">Track all CSV uploads with date, status, and uploader.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mr-3"></div>
              Loading upload history...
            </div>
          ) : error ? (
            <div className="p-6 text-red-400 bg-red-900/10">{error}</div>
          ) : uploads.length === 0 ? (
            <div className="p-6 text-gray-500 text-center">No upload history found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-900/60 text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-6 py-3">File</th>
                    <th className="px-6 py-3">Upload Date</th>
                    <th className="px-6 py-3">Rows</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Uploader</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {uploads.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-800/50">
                      <td className="px-6 py-3 text-gray-200 font-medium">{row.file_name || '—'}</td>
                      <td className="px-6 py-3 text-gray-400">
                        {row.upload_date ? new Date(row.upload_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-3 text-gray-300">{row.row_count?.toLocaleString() ?? '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold capitalize ${statusBadge(row.status)}`}>
                          {row.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-400">{row.profiles?.name || '—'}</td>
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
