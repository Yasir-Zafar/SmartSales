import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonTable } from './Skeleton';
import { EmptyState } from './EmptyState';
import { num } from '../../lib/format';

/**
 * The app's one table.
 *
 * Ten screens used to hand-roll a <table> each, so sorting, empty states and
 * sticky headers behaved differently everywhere. Columns are declared as data;
 * sorting, alignment and numeric formatting come free.
 *
 * Rows are PAGED, and that is not cosmetic. The sales explorer legitimately
 * returns tens of thousands of line items, and rendering them all — each as an
 * animated element — locked up the browser hard enough for the tab to need
 * killing. Aggregates upstream are still computed over the complete set; only
 * the DOM is bounded.
 */

const DEFAULT_PAGE_SIZE = 50;

/** Above this many rows, per-row entry animation is dropped — the stagger costs
 *  more than it adds once a page is full of data. */
const ANIMATE_MAX = 60;

export function DataTable({
  columns,
  rows,
  loading = false,
  rowKey = (row, index) => row.id ?? index,
  empty,
  initialSort,
  maxHeight,
  dense = false,
  onRowClick,
  className = '',
  caption,
  pageSize = DEFAULT_PAGE_SIZE,
  paginate = true,
}) {
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;

    const accessor = column.sortValue || column.value || ((row) => row[column.key]);
    const direction = sort.direction === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * direction;
    });
  }, [rows, sort, columns]);

  const totalRows = sortedRows.length;
  const pageCount = paginate ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);

  const visibleRows = useMemo(
    () => (paginate ? sortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize) : sortedRows),
    [sortedRows, paginate, safePage, pageSize]
  );

  // Re-filtering or re-sorting should drop you back to the first page rather
  // than stranding you on a page that no longer exists.
  useEffect(() => {
    setPage(0);
  }, [totalRows, sort]);

  const toggleSort = (column) => {
    if (column.sortable === false) return;
    setSort((current) => {
      if (current?.key !== column.key) return { key: column.key, direction: column.defaultDirection || 'desc' };
      if (current.direction === 'desc') return { key: column.key, direction: 'asc' };
      return null; // third click clears the sort and restores source order
    });
  };

  if (loading) {
    return <SkeletonTable rows={dense ? 8 : 6} columns={columns.length} className={className} />;
  }

  if (!rows.length) {
    return empty || <EmptyState title="Nothing here yet" description="No rows matched this view." />;
  }

  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-3';
  const animateRows = visibleRows.length <= ANIMATE_MAX;

  return (
    <div className={className}>
    <div
      className="overflow-auto rounded-xl border border-hairline/8"
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-left text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
          <tr className="border-b border-hairline/10">
            {columns.map((column) => {
              const isSorted = sort?.key === column.key;
              const SortIcon = !isSorted ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
              const alignment = column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left';

              return (
                <th
                  key={column.key}
                  scope="col"
                  className={`${cellPad} ${alignment} text-2xs font-semibold uppercase tracking-[0.1em] text-ink-faint`}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sortable === false ? (
                    column.header
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={`inline-flex items-center gap-1.5 transition-colors hover:text-ink ${
                        column.align === 'right' ? 'flex-row-reverse' : ''
                      } ${isSorted ? 'text-ink' : ''}`}
                    >
                      {column.header}
                      <SortIcon size={11} className={isSorted ? 'text-honey' : 'opacity-45'} aria-hidden="true" />
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {visibleRows.map((row, index) => {
            const Row = animateRows ? motion.tr : 'tr';
            const animationProps = animateRows
              ? {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { duration: 0.24, delay: Math.min(index * 0.012, 0.28) },
                }
              : {};

            return (
            <Row
              key={rowKey(row, index)}
              {...animationProps}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={[
                'border-b border-hairline/6 last:border-0 transition-colors',
                onRowClick ? 'cursor-pointer hover:bg-honey/6' : 'hover:bg-hairline/4',
              ].join(' ')}
            >
              {columns.map((column) => {
                const alignment =
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left';
                return (
                  <td
                    key={column.key}
                    className={`${cellPad} ${alignment} ${column.className || 'text-ink-soft'}`}
                  >
                    {column.render ? column.render(row) : (column.value ? column.value(row) : row[column.key]) ?? '—'}
                  </td>
                );
              })}
            </Row>
            );
          })}
        </tbody>
      </table>
    </div>

    {paginate && pageCount > 1 && (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-ink-faint tabular">
          Showing {num(safePage * pageSize + 1)}–{num(Math.min((safePage + 1) * pageSize, totalRows))} of{' '}
          {num(totalRows)}
        </p>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-hairline/12 px-2.5 text-[12px] text-ink-soft transition-colors hover:bg-hairline/8 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={13} aria-hidden="true" /> Prev
          </button>

          <span className="px-1 text-[12px] text-ink-muted tabular">
            {safePage + 1} / {num(pageCount)}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-hairline/12 px-2.5 text-[12px] text-ink-soft transition-colors hover:bg-hairline/8 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    )}
    </div>
  );
}

export default DataTable;
