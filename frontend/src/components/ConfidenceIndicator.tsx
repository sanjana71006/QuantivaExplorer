import { useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ScoredMolecule } from "@/lib/quantumEngine";

interface ConfidenceIndicatorProps {
  scoredResults: ScoredMolecule[];
  diversityMetrics: {
    diversityScore: number;
    clusterEstimate: number;
    chemicalSpaceCoverage: number;
  } | null;
  probabilityHistory: number[][];
}

type ConfidenceLevel = "High" | "Medium" | "Low";

export default function ConfidenceIndicator({
  scoredResults,
  diversityMetrics,
  probabilityHistory,
}: ConfidenceIndicatorProps) {
  const { level, score, factors } = useMemo(() => {
    if (!scoredResults.length || !diversityMetrics) {
      return { level: "Low" as ConfidenceLevel, score: 0, factors: [] };
    }

    const f: { label: string; value: number; good: boolean }[] = [];

    // 1. Diversity contribution (0 – 0.35)
    const divScore = Math.min(1, diversityMetrics.diversityScore);
    const divContrib = divScore * 0.35;
    f.push({
      label: "Diversity",
      value: divScore,
      good: divScore >= 0.4,
    });

    // 2. Cluster separation (0 – 0.25)
    // More clusters with higher coverage = better separation
    const clusterRatio = Math.min(1, diversityMetrics.clusterEstimate / 15);
    const coverageRatio = diversityMetrics.chemicalSpaceCoverage;
    const separation = (clusterRatio * 0.6 + coverageRatio * 0.4);
    const sepContrib = separation * 0.25;
    f.push({
      label: "Cluster Separation",
      value: separation,
      good: separation >= 0.4,
    });

    // 3. Diffusion stability (0 – 0.25)
    let stability = 0.5; // default if no history
    if (probabilityHistory.length >= 2) {
      const initial = probabilityHistory[0];
      const final = probabilityHistory[probabilityHistory.length - 1];
      const shift = initial.reduce((s, p, i) => s + Math.abs(p - (final[i] || 0)), 0) / 2;
      // Lower shift = more stable
      stability = Math.max(0, 1 - shift * 2);
    }
    const stabContrib = stability * 0.25;
    f.push({
      label: "Diffusion Stability",
      value: stability,
      good: stability >= 0.5,
    });

    // 4. Dataset size adequacy (0 – 0.15)
    const sizeScore = Math.min(1, scoredResults.length / 200);
    const sizeContrib = sizeScore * 0.15;
    f.push({
      label: "Dataset Size",
      value: sizeScore,
      good: sizeScore >= 0.5,
    });

    const totalScore = divContrib + sepContrib + stabContrib + sizeContrib;
    const lev: ConfidenceLevel = totalScore >= 0.6 ? "High" : totalScore >= 0.35 ? "Medium" : "Low";

    return { level: lev, score: totalScore, factors: f };
  }, [scoredResults, diversityMetrics, probabilityHistory]);

  const levelStyles = {
    High: { color: "text-emerald-700", bg: "bg-emerald-500", ring: "ring-emerald-300", barBg: "bg-emerald-500" },
    Medium: { color: "text-amber-700", bg: "bg-amber-500", ring: "ring-amber-300", barBg: "bg-amber-500" },
    Low: { color: "text-red-600", bg: "bg-red-500", ring: "ring-red-300", barBg: "bg-red-500" },
  };
  const styles = levelStyles[level];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/95 border border-slate-200 rounded-xl p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-indigo-600" />
        <h4 className="text-sm font-semibold text-slate-800">Model Confidence</h4>
      </div>

      {/* Main indicator */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full ${styles.bg} ring-4 ${styles.ring} flex items-center justify-center`}>
          {level === "High" && <TrendingUp className="h-5 w-5 text-white" />}
          {level === "Medium" && <Minus className="h-5 w-5 text-white" />}
          {level === "Low" && <TrendingDown className="h-5 w-5 text-white" />}
        </div>
        <div>
          <p className={`text-lg font-bold ${styles.color}`}>{level}</p>
          <p className="text-xs text-slate-500">{(score * 100).toFixed(0)}% composite score</p>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        {factors.map((f) => (
          <div key={f.label} className="flex items-center gap-2 text-xs">
            <span className="w-28 text-slate-600 truncate">{f.label}</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${f.value * 100}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={`h-full rounded-full ${f.good ? "bg-emerald-400" : "bg-amber-400"}`}
              />
            </div>
            <span className="w-8 text-right text-slate-500 font-mono">{(f.value * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
