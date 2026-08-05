import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  TrendingUp,
  Siren,
  Users,
  Boxes,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Backdrop } from '../components/Backdrop';
import { Button, IconButton } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { EASE, DURATION, staggerParent, staggerChild } from '../lib/motion';
import { errorMessage } from '../lib/api';
import { Moon, Sun } from 'lucide-react';

/**
 * Sign in.
 *
 * The left panel is the product pitch — this is the screen a portfolio visitor
 * sees first, so it says what the app does before asking for anything. The
 * right panel is the form, and it now surfaces the specific reason a sign-in
 * failed (deactivated account, rate limited) instead of a flat
 * "Invalid credentials" for every case.
 */

const CAPABILITIES = [
  { icon: TrendingUp, title: '5-day demand forecasts', body: 'An LSTM and a seasonal model, blended per product.' },
  { icon: Siren, title: 'Anomaly detection', body: 'Flags products predicted to fall below their baseline.' },
  { icon: Users, title: 'Customer segmentation', body: 'RFM clustering with upsell suggestions per segment.' },
  { icon: Boxes, title: 'Inventory risk', body: 'Restock guidance from predicted demand and volatility.' },
];

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, isAuthenticated, loading, sessionNotice, clearSessionNotice } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Send the user back where they were headed before the redirect to login.
  const destination = location.state?.from || '/overview';

  useEffect(() => {
    if (!loading && isAuthenticated) navigate(destination, { replace: true });
  }, [loading, isAuthenticated, navigate, destination]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    clearSessionNotice();
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <Backdrop />

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* Pitch */}
        <motion.div
          variants={staggerParent}
          initial="initial"
          animate="animate"
          className="hidden w-1/2 flex-col justify-between p-12 xl:p-16 lg:flex"
        >
          <motion.div variants={staggerChild} className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-honey text-[rgb(var(--honey-ink))] shadow-glow">
              <Sparkles size={21} aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-xl font-bold leading-none tracking-tight text-ink">SmartSales</p>
              <p className="mt-1 text-[12.5px] text-ink-muted">Sales intelligence for retail teams</p>
            </div>
          </motion.div>

          <div className="max-w-lg">
            <motion.h2
              variants={staggerChild}
              className="font-display text-[42px] font-bold leading-[1.08] tracking-tight text-ink"
            >
              Know what sells next,
              <br />
              <span className="text-honey">before it happens.</span>
            </motion.h2>
            <motion.p variants={staggerChild} className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Upload your daily sales and SmartSales forecasts demand, catches abnormal drops, groups your
              customers and tells your floor staff what to restock.
            </motion.p>

            <motion.ul variants={staggerParent} className="mt-9 grid gap-3 sm:grid-cols-2">
              {CAPABILITIES.map((capability) => (
                <motion.li
                  key={capability.title}
                  variants={staggerChild}
                  className="surface-quiet group p-4 transition-[transform,border-color] duration-300 ease-smooth hover:-translate-y-0.5 hover:border-honey/25"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-honey/12 text-honey">
                    <capability.icon size={15} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-[13.5px] font-semibold text-ink">{capability.title}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{capability.body}</p>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          <motion.div variants={staggerChild} className="flex items-center gap-2 text-[12px] text-ink-faint">
            <ShieldCheck size={13} aria-hidden="true" />
            Sessions are held in httpOnly cookies with rotating refresh tokens.
          </motion.div>
        </motion.div>

        {/* Form */}
        <div className="flex w-full items-center justify-center p-6 sm:p-10 lg:w-1/2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE }}
            className="w-full max-w-[26rem]"
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-2.5 lg:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-honey text-[rgb(var(--honey-ink))]">
                  <Sparkles size={17} aria-hidden="true" />
                </span>
                <span className="font-display text-lg font-bold tracking-tight text-ink">SmartSales</span>
              </div>
              <IconButton
                icon={isDark ? Sun : Moon}
                label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={toggle}
                className="ml-auto"
              />
            </div>

            <div className="surface p-7">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
              <p className="mt-1.5 text-[13.5px] text-ink-muted">Sign in to reach your workspace.</p>

              {sessionNotice && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-5 flex gap-2.5 rounded-xl border border-warn/28 bg-warn/8 p-3 text-[12.5px] leading-relaxed text-ink-soft"
                  role="status"
                >
                  <AlertCircle size={15} className="mt-px shrink-0 text-warn" aria-hidden="true" />
                  {sessionNotice}
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 flex gap-2.5 rounded-xl border border-critical/30 bg-critical/8 p-3 text-[12.5px] leading-relaxed text-critical"
                  role="alert"
                >
                  <AlertCircle size={15} className="mt-px shrink-0" aria-hidden="true" />
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <Input
                  label="Email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                />

                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-[34px] text-ink-faint transition-colors hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  iconRight={submitting ? undefined : ArrowRight}
                  className="w-full"
                >
                  {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <div className="mt-6 flex items-start gap-2 border-t border-hairline/8 pt-5 text-[12px] leading-relaxed text-ink-faint">
                <Lock size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Accounts are created by an administrator. If you cannot get in, ask them to check your
                  account is still active.
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
