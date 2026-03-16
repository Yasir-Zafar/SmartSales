import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import { SalesRecords } from './pages/SalesRecords';

const API_URL = 'http://localhost:5000/api';

// --- AUTH CONTEXT ---
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setUser(res.data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- PROTECTED ROUTE ---
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  
  return children;
};

// --- COMPONENTS ---

const Navbar = () => {
  const { user, logout } = useAuth();
  return (
    <nav className="navbar">
      <h3>SmartSales</h3>
      <div className="nav-links">
        <Link to="/">Dashboard</Link>
        {user?.role === 'ADMIN' && <Link to="/admin">Admin Panel</Link>}
        {user?.role === 'ANALYST' && <Link to="/sales-records">View Sales Records</Link>}
        <button onClick={logout} style={{ marginLeft: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Logout</button>
      </div>
    </nav>
  );
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="login-page">
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Login</h2>
        {error && <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn">Sign In</button>
        </form>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  return (
    <div className="app-container">
      <Navbar />
      <div style={{ padding: '2rem' }}>
        <h2>Welcome, {user?.email}</h2>
        <p style={{ color: 'var(--text-muted)' }}>Role: {user?.role}</p>
        <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="card">
            <h4>Total Sales</h4>
            <p style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>$24,500</p>
          </div>
          <div className="card">
            <h4>Active Customers</h4>
            <p style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>1,240</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminPanel = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Staff');
  const [message, setMessage] = useState('');

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API_URL}/admin/create-user`, 
        { email, password, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('User created successfully!');
      setEmail('');
      setPassword('');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Error creating user');
    }
  };

  return (
    <div className="admin-layout">
      <div className="sidebar">
        <h2>SmartSales Admin</h2>
        <nav className="sidebar-nav">
          <Link to="/">← Dashboard</Link>
          <div className="active">Create Account</div>
        </nav>
      </div>
      <div className="admin-content">
        <header className="admin-header">
          <h3>Create New User Account</h3>
          <div className="user-info">Admin Access Only</div>
        </header>
        <div className="admin-form-container">
          <div className="card">
            <h3>Account Details</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Assign roles (Owner, Analyst, Staff) to control user access.
            </p>
            {message && <p style={{ margin: '1rem 0', color: message.includes('successfully') ? 'var(--primary)' : 'var(--error)' }}>{message}</p>}
            <form onSubmit={handleCreateUser}>
              <div className="input-group">
                <label>Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="user@smartsales.com" />
              </div>
              <div className="input-group">
                <label>Temporary Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
              </div>
              <div className="input-group">
                <label>User Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="Owner">Owner (Full Business Access)</option>
                  <option value="Analyst">Analyst (Data Visualization)</option>
                  <option value="Staff">Staff (Daily Operations)</option>
                </select>
              </div>
              <button type="submit" className="btn">Provision Account</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/sales-records" element={
            <ProtectedRoute roles={['ANALYST', 'ADMIN']}>
              <SalesRecords />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminPanel />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
