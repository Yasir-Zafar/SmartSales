import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { SkeletonTable } from './Skeleton';
import { EmptyState } from './EmptyState';

/**
 * The app's one table.
 *
 * Ten screens used to hand-roll a <table> each, so sorting, empty states and
 * sticky headers behaved differently everywhere. Columns are declared as data;
 * sorting, alignment, numeric formatting and virtualised page-size come free.
 */

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
}) {
  const [sort, setSort] = useState(initialSort || null);

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

  return (
    <div
      className={`overflow-auto rounded-xl border border-hairline/8 ${className}`}
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
          {sortedRows.map((row, index) => (
            <motion.tr
              key={rowKey(row, index)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              // Cap the cascade so a 500-row table is not still fading in after a second.
              transition={{ duration: 0.24, delay: Math.min(index * 0.012, 0.28) }}
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
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
