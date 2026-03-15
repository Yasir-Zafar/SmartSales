import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

export const AdminDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <h2 className="text-2xl font-semibold text-gray-50">Admin Dashboard</h2>
        <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>
      </div>
    </div>
  );
};

