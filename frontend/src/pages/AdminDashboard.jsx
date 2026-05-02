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

  const statusColor = (status) => {
    if (status === 'processed') return 'text-teal-400';
    if (status === 'failed') return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <h2 className="text-2xl font-semibold text-gray-50">Admin Dashboard</h2>
        <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>

        <div className="mt-6 bg-gray-800 rounded-xl shadow-xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-50">Sales Dataset Upload History</h3>
              <p className="text-xs text-gray-500 mt-1">Track all CSV uploads with date, status, and uploader.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm mt-4">Loading upload history...</p>
          ) : error ? (
            <p className="text-red-400 text-sm mt-4">{error}</p>
          ) : uploads.length === 0 ? (
            <p className="text-gray-500 text-sm mt-4">No upload history found.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-2 pr-4">File</th>
                    <th className="py-2 pr-4">Upload Date</th>
                    <th className="py-2 pr-4">Rows</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Uploader</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((row) => (
                    <tr key={row.id} className="border-b border-gray-800">
                      <td className="py-2 pr-4 text-gray-300">{row.file_name || '—'}</td>
                      <td className="py-2 pr-4 text-gray-300">
                        {row.upload_date ? new Date(row.upload_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 pr-4 text-gray-300">{row.row_count ?? '—'}</td>
                      <td className={`py-2 pr-4 capitalize ${statusColor(row.status)}`}>{row.status || 'unknown'}</td>
                      <td className="py-2 pr-4 text-gray-300">{row.profiles?.name || '—'}</td>
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

