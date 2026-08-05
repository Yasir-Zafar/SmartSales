import {
  LayoutDashboard,
  TrendingUp,
  Siren,
  Boxes,
  Receipt,
  Users,
  Database,
  Shield,
  Settings,
  GitCompareArrows,
} from 'lucide-react';

/**
 * The single source of truth for navigation and access.
 *
 * The old app scattered role checks across the navbar, the router and each
 * page, so the three could disagree. Now the sidebar, the command palette and
 * the route guards all read this list, and adding a page means adding one entry.
 *
 * Route access here mirrors the roles the backend enforces on the matching
 * endpoints — the UI hides what it cannot fetch, and the API still refuses it.
 */

export const ROLES = ['OWNER', 'ANALYST', 'STAFF', 'ADMIN'];

export const ROLE_META = {
  OWNER: {
    label: 'Owner',
    blurb: 'Whole-business performance, forecasts and alerts',
  },
  ANALYST: {
    label: 'Analyst',
    blurb: 'Model accuracy, segmentation and data exports',
  },
  STAFF: {
    label: 'Staff',
    blurb: 'Daily sales, restocking and customer recommendations',
  },
  ADMIN: {
    label: 'Admin',
    blurb: 'User accounts, roles and platform oversight',
  },
};

export const NAV_SECTIONS = [
  {
    id: 'insights',
    label: 'Insights',
    items: [
      {
        to: '/overview',
        label: 'Overview',
        icon: LayoutDashboard,
        roles: ['OWNER', 'ANALYST', 'STAFF', 'ADMIN'],
        description: 'Your role’s headline numbers and what needs attention',
        keywords: ['home', 'dashboard', 'kpi', 'summary', 'start'],
      },
      {
        to: '/forecasts',
        label: 'Forecasts',
        icon: TrendingUp,
        roles: ['OWNER', 'ANALYST', 'ADMIN'],
        description: '5-day demand predictions from the ensemble model',
        keywords: ['predict', 'demand', 'lstm', 'seasonal', 'ensemble', 'ai'],
      },
      {
        to: '/anomalies',
        label: 'Anomalies',
        icon: Siren,
        roles: ['OWNER', 'ANALYST', 'ADMIN'],
        description: 'Abnormal sales drops, thresholds, history and revenue guard',
        keywords: ['alerts', 'drops', 'threshold', 'warning', 'revenue guard'],
        badgeKey: 'anomalies',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      {
        to: '/inventory',
        label: 'Inventory',
        icon: Boxes,
        roles: ['OWNER', 'STAFF', 'ADMIN'],
        description: 'Stock levels, low-stock bands and AI restock guidance',
        keywords: ['stock', 'products', 'restock', 'shelf', 'risk'],
      },
      {
        to: '/sales',
        label: 'Sales',
        icon: Receipt,
        roles: ['OWNER', 'ANALYST', 'STAFF', 'ADMIN'],
        description: 'Explore sales records, revenue and top-selling items',
        keywords: ['revenue', 'records', 'transactions', 'summary', 'export'],
      },
      {
        to: '/sales/compare',
        label: 'Compare periods',
        icon: GitCompareArrows,
        roles: ['OWNER', 'ANALYST', 'ADMIN'],
        description: 'Put two date ranges side by side',
        keywords: ['compare', 'periods', 'versus', 'a/b', 'range'],
        nested: true,
      },
      {
        to: '/customers',
        label: 'Customers',
        icon: Users,
        roles: ['OWNER', 'ANALYST', 'STAFF', 'ADMIN'],
        description: 'RFM segments, segment mix and upsell recommendations',
        keywords: ['segments', 'rfm', 'upsell', 'clusters', 'champions'],
      },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    items: [
      {
        to: '/data',
        label: 'Data studio',
        icon: Database,
        roles: ['STAFF', 'ANALYST', 'ADMIN'],
        description: 'Upload daily sales, review history, export and retrain the model',
        keywords: ['upload', 'csv', 'import', 'history', 'retrain', 'training'],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      {
        to: '/team',
        label: 'Team',
        icon: Shield,
        roles: ['ADMIN'],
        description: 'Create accounts, change roles and control access',
        keywords: ['users', 'accounts', 'roles', 'permissions', 'admin', 'invite'],
      },
    ],
  },
];

export const SETTINGS_ITEM = {
  to: '/settings',
  label: 'Settings',
  icon: Settings,
  roles: ['OWNER', 'ANALYST', 'STAFF', 'ADMIN'],
  description: 'Appearance, password and active sessions',
  keywords: ['theme', 'dark mode', 'password', 'security', 'sessions', 'logout'],
};

export const ALL_NAV_ITEMS = [
  ...NAV_SECTIONS.flatMap((section) => section.items),
  SETTINGS_ITEM,
];

export function sectionsForRole(role) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}

export function itemsForRole(role) {
  return ALL_NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccess(role, path) {
  const item = ALL_NAV_ITEMS.find((entry) => entry.to === path);
  return item ? item.roles.includes(role) : false;
}

/** Where a role lands after signing in. */
export function landingPath() {
  return '/overview';
}
