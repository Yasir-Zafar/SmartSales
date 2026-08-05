import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { sectionsForRole, SETTINGS_ITEM, ROLE_META } from '../../lib/nav';
import { softSpring } from '../../lib/motion';
import { useAuth } from '../../context/AuthContext';

/**
 * Primary navigation.
 *
 * Replaces a single row of look-alike pills in a top bar. Items are grouped
 * into named sections so the app reads as four areas rather than twelve
 * destinations, and the active marker is one element shared across links via
 * layoutId, so it slides between rows instead of blinking.
 */

function NavRow({ item, collapsed, badge, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/sales'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors duration-200',
          collapsed ? 'justify-center px-0' : '',
          item.nested && !collapsed ? 'ml-3' : '',
          isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              transition={softSpring}
              className="absolute inset-0 rounded-xl bg-honey/12 ring-1 ring-inset ring-honey/22"
            />
          )}
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            <Icon size={17} className={isActive ? 'text-honey' : ''} aria-hidden="true" />
          </span>

          {!collapsed && (
            <>
              <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
              {badge > 0 && (
                <span className="relative shrink-0 rounded-full bg-critical/15 px-1.5 py-px text-[10px] font-bold text-critical tabular">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </>
          )}

          {collapsed && badge > 0 && (
            <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-critical" aria-hidden="true" />
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ collapsed, onToggleCollapse, badges = {}, onNavigate }) {
  const { user } = useAuth();
  const role = user?.role;
  const sections = sectionsForRole(role);
  const roleMeta = ROLE_META[role];

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={`flex items-center gap-2.5 px-4 py-5 ${collapsed ? 'justify-center px-0' : ''}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-honey text-[rgb(var(--honey-ink))] shadow-glow">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-display text-[15px] font-bold leading-none tracking-tight text-ink">SmartSales</p>
            <p className="mt-1 truncate text-[11px] text-ink-faint">{roleMeta?.label} workspace</p>
          </div>
        )}
      </div>

      {/* Sections */}
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {sections.map((section) => (
          <div key={section.id}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.13em] text-ink-faint">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavRow
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  badge={item.badgeKey ? badges[item.badgeKey] : 0}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-0.5 border-t border-hairline/8 px-3 py-3">
        <NavRow item={SETTINGS_ITEM} collapsed={collapsed} onNavigate={onNavigate} />

        <button
          type="button"
          onClick={onToggleCollapse}
          className={`hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink lg:flex ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
