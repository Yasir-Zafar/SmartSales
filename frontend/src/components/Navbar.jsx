import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Users,
  UserPlus,
  UserPen,
  FileText,
  GitCompare,
  LogOut,
} from 'lucide-react';

const navItem = (to, icon, label, active) => (
  <Link
    to={to}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      active
        ? 'bg-accent-glow text-accent'
        : 'text-text-secondary hover:text-text-primary hover:bg-surface-700/50'
    }`}
  >
    {icon}
    {label}
  </Link>
);

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-surface-800 px-6 py-3 flex justify-between items-center border-b border-surface-700 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-text-primary">SmartSales</span>
      </div>

      <div className="flex items-center gap-1">
        {user?.role === 'OWNER' && (
          <>
            {navItem('/owner', <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}
            {navItem('/owner/inventory', <Package className="w-4 h-4" />, 'Inventory')}
            {navItem('/owner/forecasts', <BarChart3 className="w-4 h-4" />, 'Forecast')}
            {navItem('/owner/alerts', <AlertTriangle className="w-4 h-4" />, 'Alerts')}
            {navItem('/dropped-status', <TrendingUp className="w-4 h-4" />, 'Drops')}
            {navItem('/owner/sales-summary', <FileText className="w-4 h-4" />, 'Sales')}
            {navItem('/owner/customer-segments', <Users className="w-4 h-4" />, 'Segments')}
          </>
        )}
        {user?.role === 'ANALYST' && (
          <>
            {navItem('/analyst', <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}
            {navItem('/analyst/abnormal-drops', <AlertTriangle className="w-4 h-4" />, 'Alerts')}
            {navItem('/dropped-status', <TrendingUp className="w-4 h-4" />, 'Drops')}
            {navItem('/sales-records', <FileText className="w-4 h-4" />, 'Records')}
            {navItem('/compare-periods', <GitCompare className="w-4 h-4" />, 'Compare')}
          </>
        )}
        {user?.role === 'STAFF' && (
          <>
            {navItem('/staff', <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}
            {navItem('/staff/inventory', <Package className="w-4 h-4" />, 'Inventory')}
            {navItem('/staff/operations', <BarChart3 className="w-4 h-4" />, 'Operations')}
            {navItem('/staff/sales-summary', <FileText className="w-4 h-4" />, 'Sales')}
          </>
        )}
        {user?.role === 'ADMIN' && (
          <>
            {navItem('/admin', <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}
            {navItem('/admin/view-users', <Users className="w-4 h-4" />, 'Users')}
            {navItem('/admin/create-user', <UserPlus className="w-4 h-4" />, 'Create')}
            {navItem('/admin/edit-user', <UserPen className="w-4 h-4" />, 'Edit')}
          </>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 ml-2 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-danger hover:bg-danger-glow transition-all"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </nav>
  );
};
