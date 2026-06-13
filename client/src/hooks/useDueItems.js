// client/src/hooks/useDueItems.js
// Subscribe a component to the shared due-items store (see lib/notifications.js).
// Starts the single app-wide poll loop on first mount. Returns the current list;
// re-renders when the store updates. Multiple bells can call this safely — they
// share one fetch, one interval, and one consistent list.

import { useState, useEffect } from 'react';
import { getDueItems, subscribeDueItems, ensureDuePolling } from '../lib/notifications';

export default function useDueItems() {
  // Lazy initial read covers data already fetched before this mount; the
  // subscription below delivers every later update (so no setState in the effect).
  const [items, setItems] = useState(getDueItems);

  useEffect(() => {
    const unsubscribe = subscribeDueItems(setItems);
    ensureDuePolling();
    return unsubscribe;
  }, []);

  return items;
}
