/**
 * Shared motion vocabulary.
 *
 * Every transition in the app pulls from this file, so nothing moves at a
 * different speed or on a different curve than anything else. The curve is a
 * decelerating ease with no overshoot — quick to start, soft to land.
 */

export const EASE = [0.22, 1, 0.36, 1];

export const DURATION = {
  instant: 0.12,
  fast: 0.2,
  base: 0.32,
  slow: 0.5,
};

/** Route-level transition: content rises slightly as it fades in. */
export const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: DURATION.fast, ease: EASE } },
};

/** Parent of a list/grid — children arrive in a quick cascade rather than all at once. */
export const staggerParent = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
};

export const staggerChild = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.base, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE } },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: DURATION.fast, ease: EASE } },
};

export const slideOver = {
  initial: { x: '-100%' },
  animate: { x: 0, transition: { duration: DURATION.base, ease: EASE } },
  exit: { x: '-100%', transition: { duration: DURATION.fast, ease: EASE } },
};

/** Collapsible sections: animating height needs an explicit "auto" target. */
export const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { duration: DURATION.base, ease: EASE } },
  exit: { height: 0, opacity: 0, transition: { duration: DURATION.fast, ease: EASE } },
};

/** Springs feel right for anything the pointer is directly pushing around. */
export const softSpring = { type: 'spring', stiffness: 380, damping: 32, mass: 0.7 };
