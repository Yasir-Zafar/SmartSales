import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { EASE } from './lib/motion';

import { LoginPage } from './pages/LoginPage';
import { Overview } from './pages/Overview';
import { Forecasts } from './pages/Forecasts';
import { ForecastDetail } from './pages/ForecastDetail';
import { Anomalies } from './pages/Anomalies';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { Compare } from './pages/Compare';
import { Customers } from './pages/Customers';
import { DataStudio } from './pages/DataStudio';
import { Team } from './pages/Team';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

/**
 * Routing.
 *
 * The old router had twenty flat, role-prefixed paths (/owner/forecasts,
 * /analyst/abnormal-drops, /staff/sales-summary) that pointed at near-duplicate
 * pages. This version has one canonical URL per concept, guarded by role, with
 * every legacy path redirected so old links and bookmarks still land correctly.
 */

const LEGACY_REDIRECTS = [
  ['/owner', '/overview'],
  ['/analyst', '/overview'],
  ['/staff', '/overview'],
  ['/admin', '/overview'],
  ['/owner/forecasts', '/forecasts'],
  ['/owner/alerts', '/anomalies'],
  ['/analyst/abnormal-drops', '/anomalies'],
  ['/dropped-status', '/anomalies?tab=status'],
  ['/owner/inventory', '/inventory'],
  ['/staff/inventory', '/inventory'],
  ['/owner/sales-summary', '/sales'],
  ['/staff/sales-summary', '/sales'],
  ['/sales-records', '/sales'],
  ['/compare-periods', '/sales/compare'],
  ['/owner/customer-segments', '/customers'],
  ['/staff/operations', '/inventory?tab=restock'],
  ['/admin/view-users', '/team'],
  ['/admin/create-user', '/team?tab=invite'],
  ['/admin/edit-user', '/team?tab=manage'],
];

function guarded(element, roles) {
  return <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;
}

export default function App() {
  return (
    <ThemeProvider>
      {/* One easing curve for the whole app unless a component asks otherwise. */}
      <MotionConfig transition={{ ease: EASE }} reducedMotion="user">
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/overview" element={<Overview />} />

                  <Route path="/forecasts" element={guarded(<Forecasts />, ['OWNER', 'ANALYST', 'ADMIN'])} />
                  <Route
                    path="/forecasts/:product"
                    element={guarded(<ForecastDetail />, ['OWNER', 'ANALYST', 'ADMIN'])}
                  />
                  <Route path="/anomalies" element={guarded(<Anomalies />, ['OWNER', 'ANALYST', 'ADMIN'])} />

                  <Route path="/inventory" element={guarded(<Inventory />, ['OWNER', 'STAFF', 'ADMIN'])} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/sales/compare" element={guarded(<Compare />, ['OWNER', 'ANALYST', 'ADMIN'])} />
                  <Route path="/customers" element={<Customers />} />

                  <Route path="/data" element={guarded(<DataStudio />, ['STAFF', 'ANALYST', 'ADMIN'])} />
                  <Route path="/team" element={guarded(<Team />, ['ADMIN'])} />
                  <Route path="/settings" element={<Settings />} />

                  {LEGACY_REDIRECTS.map(([from, to]) => (
                    <Route key={from} path={from} element={<Navigate to={to} replace />} />
                  ))}

                  <Route path="/" element={<Navigate to="/overview" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
