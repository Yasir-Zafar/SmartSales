import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

export const StaffDashboard = () => {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const openModal = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (uploading) return;
    setModalOpen(false);
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
        setUploadResult({
          success: false,
          message: data.message || 'Upload failed.',
          errors: data.errors || [],
        });
      }
    } catch (err) {
      setUploadResult({ success: false, message: 'Network error. Could not reach the server.' });
    } finally {
      setUploading(false);
    }
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
          <button
            onClick={openModal}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" />
            </svg>
            Upload Daily Sales CSV
          </button>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Today's Sales</h4>
            <p className="text-3xl font-bold text-teal-500 mt-2">$4,250</p>
            <p className="text-xs text-gray-500 mt-1">24 transactions</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Pending Orders</h4>
            <p className="text-3xl font-bold text-pink-500 mt-2">12</p>
            <p className="text-xs text-gray-500 mt-1">Need attention</p>
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
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-50">Upload Daily Sales CSV</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* File Picker */}
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Result Message */}
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

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={uploading}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
              >
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
    </div>
  );
};
