import { useEffect, useRef, useState } from 'react';

/** Approximate rendered height of a card in pixels.
 *  Used to estimate how many cards fit in the visible area of the scroll container.
 *  Update if card layouts change significantly across consuming components. */
export const CARD_HEIGHT_ESTIMATE_PX = 310;

/** Default column mapping — matches BlueprintGrid's 5-column CSS grid. */
export function defaultGetColumns(containerWidth: number): number {
  if (containerWidth >= 1536) return 5; // xl
  if (containerWidth >= 1200) return 4; // lg
  if (containerWidth >= 900)  return 3; // md
  if (containerWidth >= 600)  return 2; // sm
  return 1;
}

function calcCount(
  containerWidth: number,
  containerHeight: number,
  getColumns: (w: number) => number,
): number {
  const cols = getColumns(containerWidth);
  const rows = Math.ceil(containerHeight / CARD_HEIGHT_ESTIMATE_PX) + 2;
  return cols * rows;
}

export interface UseInfiniteScrollOptions {
  /** Maps scroll container pixel width to number of visible grid columns.
   *  Defaults to the 5-column BlueprintGrid mapping if omitted.
   *  A stable module-scope function is recommended for clarity, though an inline
   *  function also works correctly (the hook captures it via a ref on every render). */
  getColumns?: (containerWidth: number) => number;
  /** Optional resolver for an external scroll root, such as #main-content.
   *  When omitted, the hook falls back to scrollContainerRef.current. */
  getScrollRoot?: () => HTMLDivElement | null;
}

export interface UseInfiniteScrollResult {
  /** Attach to the scrollable container Box (the element with overflow:'auto'). */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to a 1px invisible div placed after the last rendered item.
   *  Render it only when visibleCount < filteredItems.length. */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** How many items to slice from filteredItems before rendering. */
  visibleCount: number;
  /** Stable initial batch size — use for the `priority` image prop on the first N cards. */
  initialCount: number;
}

export function getMainContentScrollRoot(): HTMLDivElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const element = document.getElementById('main-content');
  return element instanceof HTMLDivElement ? element : null;
}

/**
 * Infinite scroll for a filtered item grid.
 *
 * Usage:
 *   const { scrollContainerRef, sentinelRef, visibleCount, initialCount } =
 *     useInfiniteScroll(filteredItems, { getColumns: myGetColumns });
 *
 * Wire scrollContainerRef to the Box with overflow:'auto'.
 * Render items as filteredItems.slice(0, visibleCount).map(...)
 * Render the sentinel after the grid only when visibleCount < filteredItems.length.
 */
export function useInfiniteScroll<T>(
  filteredItems: T[],
  options?: UseInfiniteScrollOptions,
): UseInfiniteScrollResult {
  const getColumns = options?.getColumns ?? defaultGetColumns;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Synchronously tracks the latest filtered length so the observer callback
  // never reads a stale value after a rapid filter change.
  const filteredLengthRef = useRef(filteredItems.length);
  filteredLengthRef.current = filteredItems.length;

  // Keeps getColumns current without adding it to effect dependency arrays.
  // Callers should still pass a stable module-scope function for clarity.
  const getColumnsRef = useRef(getColumns);
  getColumnsRef.current = getColumns;
  const getScrollRootRef = useRef(options?.getScrollRoot ?? null);
  getScrollRootRef.current = options?.getScrollRoot ?? null;

  const resolveScrollRoot = () => getScrollRootRef.current?.() ?? scrollContainerRef.current;

  const [visibleCount, setVisibleCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 10;
    return calcCount(window.innerWidth, window.innerHeight, getColumns);
  });
  const [initialCount, setInitialCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 10;
    return calcCount(window.innerWidth, window.innerHeight, getColumns);
  });

  // NOTE: Must be declared before the IntersectionObserver effect.
  // React runs effects in declaration order; the reset runs before the observer
  // re-registers so that visibleCount is correct when the new observer starts watching.
  // Resets visibleCount whenever the filtered list changes (filter / search / sort).
  // Also refreshes initialCount using real container dimensions once the DOM is mounted.
  useEffect(() => {
    const el = resolveScrollRoot();
    const w = el?.clientWidth ?? window.innerWidth;
    const h = el?.clientHeight ?? window.innerHeight;
    const count = calcCount(w, h, getColumnsRef.current);
    setVisibleCount(count);
    setInitialCount(count);
  }, [filteredItems]);

  // Loads the next batch when the sentinel enters the scroll container's viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    const root = resolveScrollRoot();
    if (!el || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const batch = calcCount(root.clientWidth, root.clientHeight, getColumnsRef.current);
          setVisibleCount((c) => Math.min(c + batch, filteredLengthRef.current));
        }
      },
      { root }, // observe relative to the scroll container, not the browser viewport
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredItems]);

  return { scrollContainerRef, sentinelRef, visibleCount, initialCount };
}
