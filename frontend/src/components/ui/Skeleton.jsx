import React from 'react';

/**
 * Loading placeholders.
 *
 * Skeletons mirror the shape of the content that is coming, so the layout does
 * not jump when data lands. The old build printed "Loading..." in a paragraph,
 * which reflowed the whole page on arrival.
 */

export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-3"
          // A ragged right edge reads as text rather than as bars.
          style={{ width: index === lines - 1 ? '62%' : `${88 - index * 6}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="surface p-5" aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-3 h-2.5 w-40" />
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonStat key={index} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 5, className = '' }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      <div className="flex gap-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-9 flex-1"
              style={{ opacity: 1 - rowIndex * 0.09 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Bars of pseudo-random height so a loading chart still reads as a chart. */
export function SkeletonChart({ height = 220, bars = 12, className = '' }) {
  return (
    <div className={`flex items-end gap-2 ${className}`} style={{ height }} aria-hidden="true">
      {Array.from({ length: bars }).map((_, index) => (
        <Skeleton
          key={index}
          className="flex-1 rounded-t-[4px]"
          style={{ height: `${28 + Math.abs(Math.sin(index * 1.7)) * 62}%` }}
        />
      ))}
    </div>
  );
}

export default Skeleton;
