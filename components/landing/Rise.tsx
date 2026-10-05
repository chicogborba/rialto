"use client";

import { motion, useReducedMotion } from "motion/react";

/** Slides its children up into place when they scroll into view. Transform only, so content is never hidden. */
export function Rise({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { y: 36, skewY: 2 }}
      whileInView={{ y: 0, skewY: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 220, damping: 24, delay }}
    >
      {children}
    </motion.div>
  );
}
