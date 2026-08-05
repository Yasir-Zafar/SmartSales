import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Sparkles, Search, RefreshCw, ShoppingBag, PieChart, UserSearch } from 'lucide-react';

import { api, errorMessage, isMlUnavailable } from '../lib/api';
import { money, num, titleCase } from '../lib/format';
import { staggerParent } from '../lib/motion';
import { useAuth } from '../context/AuthContext';
import { useTabParam } from '../hooks/useTabParam';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, Inset } from '../components/ui/Surface';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, SearchInput } from '../components/ui/Field';
import { Tabs } from '../components/ui/Tabs';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { EmptyState, MlOfflineState, NoResultsState } from '../components/ui/EmptyState';
import { AIBadge, AIThinking } from '../components/ui/AIState';
import { Donut } from '../components/charts/Donut';
import { ORDINAL } from '../components/charts/ChartFrame';
import { Glossary } from '../components/ui/Hint';

/**
 * Customers — segments and what to do about them.
 *
 * Brings together the owner's segment membership table, the analyst's
 * distribution and per-segment product lists, and the staff upsell lookup that
 * used to be buried on an Operations page.
 *
 * Segment tiers run Champions → Lost, which is an *ordered* scale, so the donut
 * uses a single-hue ordinal ramp rather than five unrelated colours — the
 * ranking is visible in the shading itself.
 */

const TIER_ORDER = ['Champions', 'Loyal Customers', 'Potential Loyalists', 'At Risk', 'Lost'];

/** Keeps tier colours stable no matter which tiers happen to be present. */
function tierColor(label) {
  const index = TIER_ORDER.indexOf(label);
  return ORDINAL[index === -1 ? ORDINAL.length - 1 : index];
}

export function Customers() {
  const { user } = useAuth();
  const role = user?.role;

  const canSeeSegmentTable = ['OWNER', 'ADMIN'].includes(role);
  const canSeeSegmentProfiles = ['ANALYST', 'ADMIN'].includes(role);
  const canLookUpUpsell = ['STAFF', 'ADMIN'].includes(role);

  const availableTabs = [
    ...(canSeeSegmentTable || canSeeSegmentProfiles ? [{ id: 'segments', label: 'Segments', icon: PieChart }] : []),
    ...(canSeeSegmentTable ? [{ id: 'members', label: 'Customer list', icon: Users }] : []),
    ...(canLookUpUpsell ? [{ id: 'upsell', label: 'Customer lookup', icon: UserSearch }] : []),
  ];

  const [tab, setTab] = useTabParam(availableTabs[0]?.id || 'segments', availableTabs.map((t) => t.id));

  const [profiles, setProfiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(canSeeSegmentProfiles);
  const [loadingMembers, setLoadingMembers] = useState(canSeeSegmentTable);
  const [mlDown, setMlDown] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [upsell, setUpsell] = useState(null);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [upsellError, setUpsellError] = useState('');

  const loadProfiles = useCallback(async () => {
    if (!canSeeSegmentProfiles) return;
    setLoadingProfiles(true);
    setMlDown(false);
    try {
      const res = await api.get('/insights/analyst/segments');
      setProfiles(res.data?.segments || []);
    } catch (err) {
      setMlDown(isMlUnavailable(err));
      setProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  }, [canSeeSegmentProfiles]);

  const loadMembers = useCallback(async () => {
    if (!canSeeSegmentTable) return;
    setLoadingMembers(true);
    setError('');
    try {
      const res = await api.get('/insights/owner/customer-segments');
      setMembers(res.data?.segments || []);
    } catch (err) {
      setMlDown(isMlUnavailable(err));
      setError(errorMessage(err, 'Could not load customer segments'));
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [canSeeSegmentTable]);

  useEffect(() => {
    loadProfiles();
    loadMembers();
  }, [loadProfiles, loadMembers]);

  const lookUpCustomer = async (event) => {
    event?.preventDefault();
    const id = Number(customerId);
    if (!Number.isFinite(id) || id <= 0) {
      setUpsellError('Enter a customer ID — a positive whole number.');
      return;
    }

    setUpsellLoading(true);
    setUpsellError('');
    setUpsell(null);
    try {
      const res = await api.get(`/insights/staff/customers/${id}/upsell`);
      setUpsell(res.data);
    } catch (err) {
      setUpsellError(errorMessage(err, 'No recommendation available for that customer'));
    } finally {
      setUpsellLoading(false);
    }
  };

  // Segment mix comes from whichever source the role can reach.
  const distribution = useMemo(() => {
    if (profiles.length) {
      return profiles.map((profile) => ({
        label: profile.label || `Segment ${profile.segment_id}`,
        value: Number(profile.size || 0),
      }));
    }

    const counts = {};
    for (const member of members) {
      const label = member.segment_label || 'Unclassified';
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => TIER_ORDER.indexOf(a.label) - TIER_ORDER.indexOf(b.label));
  }, [profiles, members]);

  const orderedDistribution = useMemo(
    () =>
      [...distribution].sort((a, b) => {
        const ai = TIER_ORDER.indexOf(a.label);
        const bi = TIER_ORDER.indexOf(b.label);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }),
    [distribution]
  );

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (member) =>
        String(member.customer_id).includes(q) ||
        String(member.segment_label || '').toLowerCase().includes(q)
    );
  }, [members, query]);

  /** Per-tier headcount plus the action the API already recommends for it. */
  const tierActions = useMemo(() => {
    const byTier = {};
    for (const member of members) {
      const label = member.segment_label || 'Unclassified';
      if (!byTier[label]) byTier[label] = { label, count: 0, recommendation: member.recommendation };
      byTier[label].count += 1;
    }
    return Object.values(byTier).sort((a, b) => {
      const ai = TIER_ORDER.indexOf(a.label);
      const bi = TIER_ORDER.indexOf(b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [members]);

  const totalCustomers = members.length || distribution.reduce((sum, entry) => sum + entry.value, 0);
  const topTierCount = distribution.find((entry) => entry.label === 'Champions')?.value || 0;
  const atRiskCount =
    (distribution.find((entry) => entry.label === 'At Risk')?.value || 0) +
    (distribution.find((entry) => entry.label === 'Lost')?.value || 0);

  const loading = loadingProfiles || loadingMembers;

  if (!availableTabs.length) {
    return (
      <div>
        <PageHeader title="Customers" />
        <Card animate={false}>
          <EmptyState title="No customer views for your role" description="Ask an administrator if you need access." />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Shoppers grouped by how recently, how often and how much they buy — and what to offer each group."
        actions={
          <Button
            size="sm"
            icon={RefreshCw}
            onClick={() => {
              loadProfiles();
              loadMembers();
            }}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Customers classified"
          numericValue={totalCustomers}
          format={(v) => num(Math.round(v))}
          icon={Users}
          accent
          loading={loading}
        />
        <StatCard
          label="Champions"
          numericValue={topTierCount}
          format={(v) => num(Math.round(v))}
          icon={Sparkles}
          loading={loading}
          hint="Your most frequent shoppers"
        />
        <StatCard
          label="At risk or lost"
          numericValue={atRiskCount}
          format={(v) => num(Math.round(v))}
          icon={ShoppingBag}
          loading={loading}
          hint="Worth a win-back campaign"
        />
      </motion.div>

      {availableTabs.length > 1 && (
        <div className="mt-6">
          <Tabs tabs={availableTabs} value={tab} onChange={setTab} layoutId="customer-tabs" />
        </div>
      )}

      <div className="mt-4">
        {/* ── Segments ─────────────────────────────────────────────────── */}
        {tab === 'segments' && (
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card animate={false} className="h-full">
                <CardHeader
                  title="How your customers split"
                  description="Tiers run from Champions down to Lost, so the shading shows the ranking."
                  icon={PieChart}
                  actions={<AIBadge />}
                />
                <div className="mt-6">
                  {loading ? (
                    <AIThinking
                      title="Grouping your customers"
                      steps={[
                        'Contacting the model service',
                        'Building recency, frequency and spend features',
                        'Clustering customers into segments',
                      ]}
                    />
                  ) : mlDown ? (
                    <MlOfflineState what="Segmentation" onRetry={loadProfiles} />
                  ) : orderedDistribution.length ? (
                    <Donut
                      data={orderedDistribution}
                      colors={orderedDistribution.map((entry) => tierColor(entry.label))}
                      centerLabel="customers"
                      formatValue={(v) => num(v)}
                      size={200}
                    />
                  ) : (
                    <EmptyState
                      title="No segments yet"
                      description="Reload the model from Data studio once sales data has been uploaded."
                    />
                  )}
                </div>

                <Inset className="mt-6">
                  <p className="text-[12px] leading-relaxed text-ink-muted">
                    Segments come from <Glossary k="rfm">RFM</Glossary> analysis: how recently a customer bought,
                    how often, and how much they spend. Champions score high on all three; Lost customers have
                    not been back in a long time.
                  </p>
                </Inset>
              </Card>
            </div>

            <Card animate={false}>
              <CardHeader
                title="What each group buys"
                description="Top products per segment, for targeting offers."
                icon={ShoppingBag}
              />
              <div className="mt-4">
                {loadingProfiles ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="skeleton h-16 w-full" />
                    ))}
                  </div>
                ) : profiles.length ? (
                  <ul className="max-h-[26rem] space-y-2.5 overflow-y-auto scroll-fade">
                    {profiles.map((profile) => (
                      <li key={profile.segment_id ?? profile.label} className="rounded-xl border border-hairline/8 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                              style={{ background: tierColor(profile.label) }}
                              aria-hidden="true"
                            />
                            <span className="text-[13px] font-semibold text-ink">{profile.label}</span>
                          </span>
                          <Badge tone="neutral" size="xs">
                            {num(profile.size)}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                          {(profile.top_products || [])
                            .slice(0, 4)
                            .map((product) => titleCase(typeof product === 'string' ? product : product?.product))
                            .filter(Boolean)
                            .join(' · ') || 'No product data for this segment'}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : tierActions.length ? (
                  // Owners cannot call the analyst profile endpoint, so fall back to
                  // the recommendation the segment endpoint already returns per tier
                  // — a useful panel beats a "not available for your role" notice.
                  <ul className="max-h-[26rem] space-y-2.5 overflow-y-auto scroll-fade">
                    {tierActions.map((tier) => (
                      <li key={tier.label} className="rounded-xl border border-hairline/8 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                              style={{ background: tierColor(tier.label) }}
                              aria-hidden="true"
                            />
                            <span className="text-[13px] font-semibold text-ink">{tier.label}</span>
                          </span>
                          <Badge tone="neutral" size="xs">
                            {num(tier.count)}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">{tier.recommendation}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="No segment detail yet"
                    description="These appear once the model has been reloaded with sales data."
                  />
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── Customer list ────────────────────────────────────────────── */}
        {tab === 'members' && (
          <Card animate={false}>
            <CardHeader
              title="Every customer and their segment"
              description="Includes the recommended next action for each group."
              icon={Users}
              actions={<AIBadge />}
            />

            <div className="mt-4 max-w-sm">
              <SearchInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by customer ID or segment…"
              />
            </div>

            <div className="mt-4">
              {loadingMembers ? (
                <AIThinking
                  title="Classifying customers"
                  steps={['Reading purchase history', 'Scoring each customer', 'Assigning segments']}
                />
              ) : error ? (
                <EmptyState title="Could not load customers" description={error} action={loadMembers} actionLabel="Try again" />
              ) : !filteredMembers.length ? (
                query ? (
                  <NoResultsState query={query} onClear={() => setQuery('')} />
                ) : (
                  <EmptyState title="No customers classified" description="Upload sales with customer IDs to build segments." />
                )
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'customer_id',
                      header: 'Customer',
                      value: (row) => Number(row.customer_id),
                      render: (row) => <span className="font-medium text-ink tabular">#{row.customer_id}</span>,
                    },
                    {
                      key: 'segment_label',
                      header: 'Segment',
                      value: (row) => TIER_ORDER.indexOf(row.segment_label),
                      render: (row) => (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                            style={{ background: tierColor(row.segment_label) }}
                            aria-hidden="true"
                          />
                          <span className="text-ink">{row.segment_label}</span>
                        </span>
                      ),
                    },
                    {
                      key: 'total_purchases',
                      header: 'Purchases',
                      align: 'right',
                      value: (row) => Number(row.total_purchases || 0),
                      render: (row) => <span className="tabular">{num(row.total_purchases)}</span>,
                    },
                    {
                      key: 'total_spend',
                      header: 'Total spend',
                      align: 'right',
                      value: (row) => Number(row.total_spend || 0),
                      render: (row) => <span className="font-semibold text-ink tabular">{money(row.total_spend)}</span>,
                    },
                    {
                      key: 'recommendation',
                      header: 'Suggested action',
                      sortable: false,
                      className: 'text-ink-muted max-w-xs',
                      render: (row) => row.recommendation || '—',
                    },
                  ]}
                  rows={filteredMembers}
                  rowKey={(row) => row.customer_id}
                  maxHeight="34rem"
                  caption="Customers with their assigned segment and recommended action"
                />
              )}
            </div>
          </Card>
        )}

        {/* ── Upsell lookup ────────────────────────────────────────────── */}
        {tab === 'upsell' && (
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Card animate={false}>
              <CardHeader
                title="Look up a customer"
                description="Enter the customer ID from their receipt or loyalty card."
                icon={UserSearch}
              />
              <form onSubmit={lookUpCustomer} className="mt-4 space-y-3">
                <Input
                  label="Customer ID"
                  type="number"
                  min="1"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  placeholder="e.g. 1042"
                  error={upsellError || undefined}
                />
                <Button type="submit" variant="primary" size="sm" icon={Search} loading={upsellLoading} className="w-full">
                  Find recommendation
                </Button>
              </form>

              <Inset className="mt-5">
                <p className="text-[12px] leading-relaxed text-ink-muted">
                  This tells you which group the customer belongs to and what tends to sell well to that group —
                  useful at the till or on the shop floor.
                </p>
              </Inset>
            </Card>

            <div className="lg:col-span-2">
              <Card animate={false} className="h-full">
                <CardHeader title="Recommendation" icon={Sparkles} actions={upsell && <AIBadge />} />

                <div className="mt-4">
                  {upsellLoading ? (
                    <AIThinking
                      title="Looking up this customer"
                      steps={['Finding their purchase history', 'Matching them to a segment', 'Picking products that segment buys']}
                    />
                  ) : upsell ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <Inset>
                        <p className="text-[11.5px] text-ink-faint">Customer #{upsell.customer_id}</p>
                        <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-ink">
                          <span
                            className="h-3 w-3 shrink-0 rounded-[3px]"
                            style={{ background: tierColor(upsell.segment_label) }}
                            aria-hidden="true"
                          />
                          {upsell.segment_label}
                        </p>
                        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                          {upsell.upsell_message || upsell.recommendation || 'No specific suggestion for this customer.'}
                        </p>
                      </Inset>

                      <Inset>
                        <p className="text-[11.5px] text-ink-faint">Popular with this segment</p>
                        {upsell.top_products_for_segment?.length ? (
                          <ul className="mt-2.5 space-y-1.5">
                            {upsell.top_products_for_segment.slice(0, 6).map((product, index) => (
                              <li key={index} className="flex items-center gap-2 text-[13px] text-ink-soft">
                                <ShoppingBag size={12} className="shrink-0 text-ink-faint" aria-hidden="true" />
                                {titleCase(typeof product === 'string' ? product : product?.product)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-[12.5px] text-ink-muted">No product list for this segment yet.</p>
                        )}
                      </Inset>
                    </motion.div>
                  ) : (
                    <EmptyState
                      icon={UserSearch}
                      title="No customer selected"
                      description="Enter a customer ID on the left to see their segment and what to recommend."
                    />
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Customers;
