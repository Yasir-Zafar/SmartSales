import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { AnalystDashboard } from './pages/AnalystDashboard';
import { StaffDashboard } from './pages/StaffDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminCreateUser } from './pages/AdminCreateUser';
import { AdminEditUser } from './pages/AdminEditUser';
import { AdminViewUsers } from './pages/AdminViewUsers';
import { SalesRecords } from './pages/SalesRecords';
import { CompareTimePeriods } from './pages/CompareTimePeriods';
import { OwnerSalesSummary } from './pages/OwnerSalesSummary';
import { OwnerAlerts } from './pages/OwnerAlerts';
import { OwnerFiveDayForecast } from './pages/OwnerFiveDayForecast';
import { AnalystAbnormalDrops } from './pages/AnalystAbnormalDrops';
import { StaffOperations } from './pages/StaffOperations';

// --- MAIN APP ---
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/owner" element={
            <ProtectedRoute roles={['OWNER']}>
              <OwnerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/analyst" element={
            <ProtectedRoute roles={['ANALYST']}>
              <AnalystDashboard />
            </ProtectedRoute>
          } />
          <Route path="/staff" element={
            <ProtectedRoute roles={['STAFF']}>
              <StaffDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/view-users" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminViewUsers />
            </ProtectedRoute>
          } />
          <Route path="/admin/create-user" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminCreateUser />
            </ProtectedRoute>
          } />
          <Route path="/admin/edit-user" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminEditUser />
            </ProtectedRoute>
          } />
          <Route path="/sales-records" element={
            <ProtectedRoute roles={['ANALYST']}>
              <SalesRecords />
            </ProtectedRoute>
          } />
          <Route path="/owner/sales-summary" element={
            <ProtectedRoute roles={['OWNER']}>
              <OwnerSalesSummary />
            </ProtectedRoute>
          } />
          <Route path="/owner/alerts" element={
            <ProtectedRoute roles={['OWNER']}>
              <OwnerAlerts />
            </ProtectedRoute>
          } />
          <Route path="/owner/forecasts" element={
            <ProtectedRoute roles={['OWNER']}>
              <OwnerFiveDayForecast />
            </ProtectedRoute>
          } />
          <Route path="/compare-periods" element={
            <ProtectedRoute roles={['ANALYST']}>
              <CompareTimePeriods />
            </ProtectedRoute>
          } />
          <Route path="/analyst/abnormal-drops" element={
            <ProtectedRoute roles={['ANALYST']}>
              <AnalystAbnormalDrops />
            </ProtectedRoute>
          } />
          <Route path="/staff/operations" element={
            <ProtectedRoute roles={['STAFF']}>
              <StaffOperations />
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
