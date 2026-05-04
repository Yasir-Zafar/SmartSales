import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-gray-800 px-8 py-4 flex justify-between items-center border-b border-white/10">
      <h3 className="text-xl font-semibold text-gray-50">SmartSales</h3>
      <div className="flex items-center gap-6">
        {user?.role === 'OWNER' && (
          <>
            <Link to="/owner" className="text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
            <Link to="/owner/inventory" className="text-gray-400 hover:text-gray-200 transition-colors">Inventory</Link>
            <Link to="/owner/forecasts" className="text-gray-400 hover:text-gray-200 transition-colors">5-Day Forecast</Link>
            <Link to="/owner/alerts" className="text-gray-400 hover:text-gray-200 transition-colors">Drop Alerts</Link>
            <Link to="/dropped-status" className="text-gray-400 hover:text-gray-200 transition-colors">Dropped Status</Link>
            <Link to="/owner/sales-summary" className="text-gray-400 hover:text-gray-200 transition-colors">Sales Summary</Link>
            <Link to="/owner/customer-segments" className="text-gray-400 hover:text-gray-200 transition-colors">Customer Segments</Link>
          </>
        )}
        {user?.role === 'ANALYST' && (
          <>
            <Link to="/analyst" className="text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
            <Link to="/analyst/abnormal-drops" className="text-gray-400 hover:text-gray-200 transition-colors">Drop Alerts</Link>
            <Link to="/dropped-status" className="text-gray-400 hover:text-gray-200 transition-colors">Dropped Status</Link>
            <Link to="/sales-records" className="text-gray-400 hover:text-gray-200 transition-colors">View Sales Records</Link>
            <Link to="/compare-periods" className="text-gray-400 hover:text-gray-200 transition-colors">Compare Time Periods</Link>
          </>
        )}
        {user?.role === 'STAFF' && (
          <>
            <Link to="/staff" className="text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
            <Link to="/staff/inventory" className="text-gray-400 hover:text-gray-200 transition-colors">Inventory</Link>
            <Link to="/staff/operations" className="text-gray-400 hover:text-gray-200 transition-colors">Operations</Link>
            <Link to="/staff/sales-summary" className="text-gray-400 hover:text-gray-200 transition-colors">Sales Summary</Link>
          </>
        )}
        {user?.role === 'ADMIN' && (
          <>
            <Link to="/admin" className="text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
            <Link to="/admin/view-users" className="text-gray-400 hover:text-gray-200 transition-colors">View Users</Link>
            <Link to="/admin/create-user" className="text-gray-400 hover:text-gray-200 transition-colors">Create User</Link>
            <Link to="/admin/edit-user" className="text-gray-400 hover:text-gray-200 transition-colors">Edit User</Link>
          </>
        )}
        <button
          onClick={handleLogout}
          className="ml-4 bg-transparent border-none text-gray-400 hover:text-gray-200 cursor-pointer transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

