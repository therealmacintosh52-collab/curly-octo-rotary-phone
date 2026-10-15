'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
/**
 * false in the server-rendered HTML and until React has hydrated the page, then true. Buttons that fire a one-way action (approve, pay,
 * cancel) should be `disabled` until then: the server HTML shows them enabled, and a click that lands before hydration has no handler, is
 * silently lost, and the visitor believes it worked (P9-003).
 */
export const useHydrated = (): boolean => useSyncExternalStore(subscribe, () => true, () => false);
