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
   *  Must be a stable (module-scope) function — it is used inside effects
   *  without being listed in their dependency arrays, so inline arrow functions
   *  will cause stale behaviour.
   *  Defaults to the 5-column BlueprintGrid mapping if omitted. */
  getColumns?: (containerWidth: number) => number;
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

  const [visibleCount, setVisibleCount] = useState<number>(() =>
    calcCount(window.innerWidth, window.innerHeight, getColumns),
  );
  const [initialCount, setInitialCount] = useState<number>(() =>
    calcCount(window.innerWidth, window.innerHeight, getColumns),
  );

  // NOTE: Must be declared before the IntersectionObserver effect.
  // React runs effects in declaration order; the reset runs before the observer
  // re-registers so that visibleCount is correct when the new observer starts watching.
  // Resets visibleCount whenever the filtered list changes (filter / search / sort).
  // Also refreshes initialCount using real container dimensions once the DOM is mounted.
  useEffect(() => {
    const el = scrollContainerRef.current;
    const w = el?.clientWidth ?? window.innerWidth;
    const h = el?.clientHeight ?? window.innerHeight;
    const count = calcCount(w, h, getColumns);
    setVisibleCount(count);
    setInitialCount(count);
  // getColumns is intentionally omitted — it must be a stable module-scope function.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems]);

  // Loads the next batch when the sentinel enters the scroll container's viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!el || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const batch = calcCount(root.clientWidth, root.clientHeight, getColumns);
          setVisibleCount((c) => Math.min(c + batch, filteredLengthRef.current));
        }
      },
      { root }, // observe relative to the scroll container, not the browser viewport
    );

    observer.observe(el);
    return () => observer.disconnect();
  // getColumns is intentionally omitted — it must be a stable module-scope function.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems]);

  return { scrollContainerRef, sentinelRef, visibleCount, initialCount };
}
