import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, AlertTriangle, ShieldCheck, Target, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface ActionPanelProps {
  onFocusTopCluster: () => void;
  onShowHighRiskHighReward: () => void;
  onShowLipinskiViolations: () => void;
  onShowSafeZone: () => void;
  onReset: () => void;
  activeAction: string | null;
}

export default function ActionPanel({
  onFocusTopCluster,
  onShowHighRiskHighReward,
  onShowLipinskiViolations,
  onShowSafeZone,
  onReset,
  activeAction,
}: ActionPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const actions = [
    {
      id: "top-cluster",
      label: "Focus Top Cluster",
      icon: <Target className="h-3.5 w-3.5" />,
      onClick: onFocusTopCluster,
      color: "text-blue-600 hover:bg-blue-50 border-blue-200",
      activeColor: "bg-blue-100 border-blue-400 text-blue-800",
    },
    {
      id: "high-risk",
      label: "High-Risk High-Reward",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      onClick: onShowHighRiskHighReward,
      color: "text-violet-600 hover:bg-violet-50 border-violet-200",
      activeColor: "bg-violet-100 border-violet-400 text-violet-800",
    },
    {
      id: "lipinski",
      label: "Lipinski Violations",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      onClick: onShowLipinskiViolations,
      color: "text-amber-600 hover:bg-amber-50 border-amber-200",
      activeColor: "bg-amber-100 border-amber-400 text-amber-800",
    },
    {
      id: "safe-zone",
      label: "Safe Zone",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      onClick: onShowSafeZone,
      color: "text-emerald-600 hover:bg-emerald-50 border-emerald-200",
      activeColor: "bg-emerald-100 border-emerald-400 text-emerald-800",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute bottom-4 right-4 z-40 w-56"
    >
      <div className="bg-white/95 border border-indigo-200 rounded-lg shadow-lg backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50/50 transition"
        >
          <span className="flex items-center gap-1.5">
            <Crosshair className="h-3.5 w-3.5" />
            Explore
          </span>
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>

        {/* Actions */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-indigo-100"
            >
              <div className="p-2 space-y-1.5">
                {actions.map((action) => {
                  const isActive = activeAction === action.id;
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        if (isActive) {
                          onReset();
                        } else {
                          action.onClick();
                        }
                      }}
                      className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                        isActive ? action.activeColor : action.color
                      }`}
                    >
                      {action.icon}
                      <span>{action.label}</span>
                      {isActive && (
                        <span className="ml-auto text-[9px] opacity-60">✕</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
