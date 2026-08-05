import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps the active tab in the URL.
 *
 * Means a tab is linkable and survives a refresh — the command palette and the
 * overview tiles both deep-link straight to a specific tab (`/data?tab=upload`)
 * rather than dropping the user on the first one.
 */
export function useTabParam(defaultTab, validTabs) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const active = validTabs.includes(requested) ? requested : defaultTab;

  const setActive = useCallback(
    (tab) => {
      const next = new URLSearchParams(searchParams);
      if (tab === defaultTab) next.delete('tab');
      else next.set('tab', tab);
      // replace: tab switching should not build up browser history entries.
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, defaultTab]
  );

  return [active, setActive];
}

export default useTabParam;
