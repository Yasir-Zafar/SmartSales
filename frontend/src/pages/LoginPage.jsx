import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  BarChart3,
  Users,
  Shield,
  Zap,
  ArrowRight,
  LogIn,
  AlertCircle,
} from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'OWNER') navigate('/owner');
      else if (user.role === 'ANALYST') navigate('/analyst');
      else if (user.role === 'STAFF') navigate('/staff');
      else navigate('/');
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  const features = [
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: 'Demand Forecasting',
      desc: '5-day sales predictions with ensemble ML models',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Anomaly Detection',
      desc: 'Real-time alerts on abnormal sales drops',
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: 'Customer Segmentation',
      desc: 'RFM analysis with KMeans clustering',
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Role-Based Access',
      desc: 'Owner, Analyst, Staff, and Admin portals',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: 'Smart Recommendations',
      desc: 'AI-driven upsell suggestions at point of sale',
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding & features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-950 p-12 flex-col justify-between">
        {/* Gradient 1/3: Hero background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-surface-950 to-teal-600/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">SmartSales</h1>
          </div>
          <p className="text-text-secondary text-lg mt-2">AI-Powered Sales Intelligence Platform</p>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-text-muted text-sm uppercase tracking-wider font-semibold">Capabilities</h2>
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-4 group">
              <div className="w-10 h-10 rounded-lg bg-surface-800 border border-surface-700 flex items-center justify-center text-accent group-hover:border-accent-border group-hover:bg-accent-glow transition-all">
                {f.icon}
              </div>
              <div>
                <h3 className="text-text-primary font-medium">{f.title}</h3>
                <p className="text-text-muted text-sm mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 text-text-faint text-sm">
          SmartSales &copy; 2026 &mdash; Built for data-driven retail decisions
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-surface-900">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">SmartSales</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-text-primary">Welcome back</h2>
            <p className="text-text-secondary mt-2">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-danger-glow border border-danger-border text-danger px-4 py-3 rounded-xl mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Gradient 2/3: CTA button */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-text-primary placeholder-text-faint focus:outline-none focus:border-accent-border focus:ring-1 focus:ring-accent/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-text-primary placeholder-text-faint focus:outline-none focus:border-accent-border focus:ring-1 focus:ring-accent/30 transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-text-primary font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
            >
              <LogIn className="w-4 h-4" />
              Sign In
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-surface-700">
            <p className="text-text-faint text-sm text-center">
              Need access? Contact your administrator
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
