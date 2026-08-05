import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, ArrowLeft, LayoutDashboard } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { itemsForRole } from '../lib/nav';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Surface';

/**
 * 404.
 *
 * Rather than a dead end, this lists what the signed-in role can actually
 * reach — most mistyped or stale URLs in this app are old role-prefixed paths,
 * and the destination they wanted is one of these.
 */
export function NotFound() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destinations = itemsForRole(user?.role).slice(0, 6);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg text-center"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-honey/12 text-honey">
          <Compass size={26} aria-hidden="true" />
        </span>

        <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">
          There is nothing at this address
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
          <span className="font-mono text-[12.5px] text-ink-faint">{location.pathname}</span> does not match any
          page. It may be an old link from before the navigation was reorganised.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="primary" icon={LayoutDashboard} onClick={() => navigate('/overview')}>
            Go to overview
          </Button>
          <Button icon={ArrowLeft} onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>

        {destinations.length > 0 && (
          <Card className="mt-8 text-left" animate={false}>
            <p className="text-2xs font-semibold uppercase tracking-[0.13em] text-ink-faint">
              Available to you
            </p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {destinations.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-soft transition-colors hover:bg-honey/8 hover:text-ink"
                >
                  <item.icon size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </Card>
        )}
      </motion.div>
    </div>
  );
}

export default NotFound;
