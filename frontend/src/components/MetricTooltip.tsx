import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface MetricTooltipProps {
  metric: "diversity" | "uniformity" | "clusters" | "qwShift" | "coverage";
}

const tooltipContent: Record<string, { title: string; body: string }> = {
  diversity: {
    title: "Diversity Index",
    body: "Measures how structurally diverse the molecular candidates are (0–1). Higher values indicate a broader range of chemical scaffolds, improving the chance of discovering novel leads.",
  },
  uniformity: {
    title: "Probability Uniformity",
    body: "Entropy-based measure of how evenly probability is distributed across molecules after quantum walk. High uniformity means no single candidate dominates — useful for broad exploration.",
  },
  clusters: {
    title: "Estimated Clusters",
    body: "Approximate number of structurally distinct groups in PCA-embedded chemical space. More clusters suggest a more diverse candidate pool spanning multiple scaffold families.",
  },
  qwShift: {
    title: "QW Shift (Quantum Walk Diffusion)",
    body: "Total probability mass redistributed during quantum walk diffusion. Higher shift indicates the quantum walk significantly altered the ranking — potentially surfacing hidden neighbors.",
  },
  coverage: {
    title: "Chemical Space Coverage",
    body: "Fraction of the available 3D PCA chemical space actually occupied by candidates. Low coverage means molecules cluster tightly; high coverage suggests broad spatial distribution.",
  },
};

export default function MetricTooltip({ metric }: MetricTooltipProps) {
  const [open, setOpen] = useState(false);
  const content = tooltipContent[metric];
  if (!content) return null;

  return (
    <span className="relative inline-flex">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-slate-400 hover:text-indigo-500 transition p-0.5 rounded-full hover:bg-indigo-50"
        aria-label={`Learn about ${content.title}`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h5 className="text-xs font-semibold text-slate-800">{content.title}</h5>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">{content.body}</p>
            {/* Caret */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
