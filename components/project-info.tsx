/**
 * File: components/project-info.tsx
 * Purpose: Introduce an empty conversation with one concise call to action.
 * Problem solved: Gives users enough context to start without adding decorative information density.
 */
import { Bot } from "lucide-react";
import { motion } from "motion/react";

export function ProjectInfo() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-sm flex-col items-center px-4 py-14 text-center"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Bot className="size-4" />
      </span>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-zinc-900">
        What should the agent do?
      </h2>
      <p className="mt-1.5 text-sm leading-5 text-zinc-500">
        Describe a task and watch each action on the live desktop.
      </p>
    </motion.section>
  );
}
