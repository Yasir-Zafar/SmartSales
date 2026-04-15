import React, { useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

// ─── PDF Export Hook ────────────────────────────────────────────────────────
// Drop new cards/sections anywhere inside <div ref={exportRef}> and they'll
// automatically appear in the exported PDF — no changes needed here.
const usePdfExport = (filename = 'dashboard.pdf') => {
  const exportRef = useRef(null);

  const exportToPdf = useCallback(async () => {
    const element = exportRef.current;
    if (!element) return;

    // Dynamically import to keep bundle lean
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#111827', // matches bg-gray-900
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(filename);
  }, [filename]);

  return { exportRef, exportToPdf };
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
// Add new metric cards by just adding an entry to the STATS array below.
const StatCard = ({ label, value, change, valueColor }) => (
  <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
    <h4 className="text-sm font-medium text-gray-400 uppercase">{label}</h4>
    <p className={`text-3xl font-bold mt-2 ${valueColor}`}>{value}</p>
    {change && <p className="text-xs text-gray-500 mt-1">{change}</p>}
  </div>
);

// ─── Config — edit this to add/remove stat cards ─────────────────────────────
const STATS = [
  { label: 'Total Revenue',    value: '$124,500', change: '+12.5% from last month', valueColor: 'text-teal-500'   },
  { label: 'Total Sales',      value: '1,842',    change: '+8.2% from last month',  valueColor: 'text-pink-500'   },
  { label: 'Active Customers', value: '1,240',    change: '+5.1% from last month',  valueColor: 'text-purple-500' },
  { label: 'Profit Margin',    value: '34.2%',    change: '+2.1% from last month',  valueColor: 'text-green-500'  },
];

// ─── Main Component ──────────────────────────────────────────────────────────
export const OwnerDashboard = () => {
  const { user } = useAuth();
  const { exportRef, exportToPdf } = usePdfExport('owner-dashboard.pdf');

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />

      {/* ↓ Everything inside this div is captured in the PDF export */}
      <div ref={exportRef} className="p-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-50">Owner Dashboard</h2>
            <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>
          </div>
          <button
            onClick={exportToPdf}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Export PDF
          </button>
        </div>

        {/* Stat Cards — driven by STATS array above */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        {/* Content Sections — add more <div> blocks here freely */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Sales Forecast</h3>
            <p className="text-gray-400">AI-powered sales predictions and trends</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Customer Segmentation</h3>
            <p className="text-gray-400">Customer groups and behavior analysis</p>
          </div>
        </div>

        {/* Add future sections below — they'll export automatically */}

      </div>
    </div>
  );
};