"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ClientMotionWrapperProps {
  children: ReactNode;
}

export function ClientMotionWrapper({ children }: ClientMotionWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      {children}
    </motion.div>
  );
}
