import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, TrendingUp, AlertTriangle, ShieldCheck, Beaker } from "lucide-react";
import type { ScoredMolecule } from "@/lib/quantumEngine";

interface InsightBannerProps {
  scoredResults: ScoredMolecule[];
  diversityMetrics: {
    diversityScore: number;
    clusterEstimate: number;
    chemicalSpaceCoverage: number;
    diversityLevel: string;
  } | null;
}

interface Insight {
  icon: React.ReactNode;
  text: string;
  type: "info" | "warning" | "success" | "discovery";
}

export default function InsightBanner({ scoredResults, diversityMetrics }: InsightBannerProps) {
  const insights = useMemo<Insight[]>(() => {
    if (!scoredResults.length) return [];
    const results: Insight[] = [];

    // 1. Dominant cluster detection
    if (diversityMetrics && diversityMetrics.clusterEstimate > 0) {
      const clusters = diversityMetrics.clusterEstimate;
      const coverage = diversityMetrics.chemicalSpaceCoverage;
      if (clusters <= 3 && coverage < 0.5) {
        results.push({
          icon: <Beaker className="h-4 w-4" />,
          text: `Candidates concentrate in ${clusters} cluster${clusters > 1 ? "s" : ""} — consider diversifying your chemical space.`,
          type: "warning",
        });
      } else if (clusters >= 8) {
        results.push({
          icon: <Beaker className="h-4 w-4" />,
          text: `${clusters} distinct molecular clusters detected — broad chemical diversity present.`,
          type: "success",
        });
      }
    }

    // 2. High-risk, high-reward candidates
    const highRiskHighReward = scoredResults.filter(
      (m) => m.weighted_score >= 0.7 && (m.toxicity_risk ?? 0) > 0.5
    );
    if (highRiskHighReward.length > 0) {
      results.push({
        icon: <TrendingUp className="h-4 w-4" />,
        text: `${highRiskHighReward.length} high-score molecule${highRiskHighReward.length > 1 ? "s" : ""} carry elevated toxicity risk — investigate ${highRiskHighReward[0].name} first.`,
        type: "discovery",
      });
    }

    // 3. Lipinski violation trends in top 10
    const top10 = scoredResults.slice(0, 10);
    const lipinskiViolations = top10.filter((m) => {
      const mw = Number(m.molecular_weight ?? 0);
      const logP = Number(m.logP ?? 0);
      const donors = Number((m as any).h_bond_donors ?? 0);
      const acceptors = Number((m as any).h_bond_acceptors ?? 0);
      return mw > 500 || logP > 5 || donors > 5 || acceptors > 10;
    });
    if (lipinskiViolations.length >= 3) {
      results.push({
        icon: <AlertTriangle className="h-4 w-4" />,
        text: `${lipinskiViolations.length} of your top 10 candidates violate Lipinski rules — oral bioavailability may be limited.`,
        type: "warning",
      });
    }

    // 4. Safe zone summary
    const safeHighScore = scoredResults.filter(
      (m) => m.weighted_score >= 0.6 && (m.toxicity_risk ?? 0) < 0.3
    );
    if (safeHighScore.length >= 5) {
      results.push({
        icon: <ShieldCheck className="h-4 w-4" />,
        text: `${safeHighScore.length} safe, high-scoring candidates identified — ${safeHighScore[0].name} leads with ${(safeHighScore[0].probability * 100).toFixed(1)}% probability.`,
        type: "success",
      });
    }

    // 5. Top candidate highlight
    if (scoredResults.length > 0 && results.length === 0) {
      const top = scoredResults[0];
      results.push({
        icon: <Lightbulb className="h-4 w-4" />,
        text: `Top candidate: ${top.name} (score ${top.weighted_score.toFixed(3)}, prob ${(top.probability * 100).toFixed(1)}%). ${scoredResults.length} molecules in pipeline.`,
        type: "info",
      });
    }

    return results;
  }, [scoredResults, diversityMetrics]);

  if (insights.length === 0) return null;

  const typeStyles = {
    info: "from-blue-500/10 to-blue-600/5 border-blue-400/40 text-blue-700",
    warning: "from-amber-500/10 to-amber-600/5 border-amber-400/40 text-amber-700",
    success: "from-emerald-500/10 to-emerald-600/5 border-emerald-400/40 text-emerald-700",
    discovery: "from-violet-500/10 to-violet-600/5 border-violet-400/40 text-violet-700",
  };

  const iconBg = {
    info: "bg-blue-500/20",
    warning: "bg-amber-500/20",
    success: "bg-emerald-500/20",
    discovery: "bg-violet-500/20",
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={insights.map((i) => i.text).join("|")}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="space-y-2"
      >
        {insights.slice(0, 3).map((insight, index) => (
          <div
            key={index}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-gradient-to-r ${typeStyles[insight.type]}`}
          >
            <div className={`flex-shrink-0 p-1.5 rounded-md ${iconBg[insight.type]}`}>
              {insight.icon}
            </div>
            <p className="text-sm font-medium leading-snug">{insight.text}</p>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
