import { useEffect } from "react";

interface EdgeSwipeOptions {
  /** Whether the left panel (legend) is currently open/expanded. */
  leftOpen: boolean;
  /** Whether the right drawer (inspector) is currently open. */
  rightOpen: boolean;
  /** Swipe right from the left screen edge (left panel closed). */
  openLeft?: () => void;
  /** Swipe left over the open left panel. */
  closeLeft?: () => void;
  /** Swipe left from the right screen edge (right drawer closed). */
  openRight?: () => void;
  /** Swipe right over the open right drawer. */
  closeRight?: () => void;
  /** Width of the strip (px) at each screen edge that arms an OPEN gesture. */
  edgeSize?: number;
  /** Approx. width (px) of the open left panel — the zone that arms a close. */
  leftPanelWidth?: number;
  /** Approx. width (px) of the open right drawer — the zone that arms a close. */
  rightPanelWidth?: number;
  /** Minimum horizontal travel (px) to count as a swipe. */
  threshold?: number;
  enabled?: boolean;
}

/**
 * Edge-swipe gestures to reveal the side panels on touch devices.
 *
 * - Swipe right from the LEFT edge → open the legend (left panel).
 * - Swipe left from the RIGHT edge → open the inspector (right drawer).
 * - Swipe back over an open panel (toward its edge) → close it.
 *
 * Listens only to touch events, so it never interferes with mouse use. OPEN
 * gestures are armed only from a narrow edge strip; CLOSE gestures only when the
 * touch begins over the already-open panel — both kept clear of the graph's
 * drag-to-pan in the canvas centre. Mostly-vertical drags (content scroll) are
 * ignored.
 */
export function useEdgeSwipe({
  leftOpen,
  rightOpen,
  openLeft,
  closeLeft,
  openRight,
  closeRight,
  edgeSize = 30,
  leftPanelWidth = 360,
  rightPanelWidth = 410,
  threshold = 56,
  enabled = true,
}: EdgeSwipeOptions) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let startX = 0;
    let startY = 0;
    let fromLeft = false;
    let fromRight = false;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      const w = window.innerWidth;
      // Open: only a narrow edge strip. Close: anywhere over the open panel.
      fromLeft = startX <= (leftOpen ? leftPanelWidth : edgeSize);
      fromRight = startX >= w - (rightOpen ? rightPanelWidth : edgeSize);
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      // Require a deliberate, mostly-horizontal swipe.
      if (Math.abs(dx) < threshold || Math.abs(dy) > Math.abs(dx)) return;

      if (dx > 0) {
        // Swiping right.
        if (fromLeft && !leftOpen) openLeft?.();
        else if (fromRight && rightOpen) closeRight?.();
      } else {
        // Swiping left.
        if (fromRight && !rightOpen) openRight?.();
        else if (fromLeft && leftOpen) closeLeft?.();
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [
    leftOpen,
    rightOpen,
    openLeft,
    closeLeft,
    openRight,
    closeRight,
    edgeSize,
    leftPanelWidth,
    rightPanelWidth,
    threshold,
    enabled,
  ]);
}
