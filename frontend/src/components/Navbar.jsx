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
          <Link to="/owner" className="text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
        )}
        {user?.role === 'ANALYST' && (
          <Link to="/analyst" className="text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
        )}
        {user?.role === 'STAFF' && (
          <Link to="/staff" className="text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
        )}
        {user?.role === 'ADMIN' && (
          <>
            <Link to="/admin" className="text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
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

