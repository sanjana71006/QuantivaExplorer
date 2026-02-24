import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Zap, TrendingUp, AlertCircle } from 'lucide-react';
import { ScoredMolecule } from '@/lib/quantumEngine';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';

interface ContributionHighlighterProps {
  molecule: ScoredMolecule;
  compact?: boolean;
}

export default function ContributionHighlighter({ molecule, compact = false }: ContributionHighlighterProps) {
  const { educationMode, weights } = useGlobalExploration();

  if (!educationMode.enabled) {
    return null;
  }

  // Calculate estimated contributions based on weights and molecule properties
  const contributions = [
    {
      name: 'Binding Affinity',
      weight: weights.binding,
      value: molecule.binding_affinity || 0.5,
      icon: '🎯',
      color: 'from-blue-500 to-blue-600',
      description: 'Target affinity strength',
    },
    {
      name: 'Toxicity',
      weight: weights.toxicity,
      value: 1 - (molecule.toxicity_risk || 0.3), // Inverted: lower risk = higher contribution
      icon: '☠️',
      color: 'from-red-500 to-red-600',
      description: 'Safety profile',
    },
    {
      name: 'Solubility',
      weight: weights.solubility,
      value: molecule.solubility || 0.5,
      icon: '💧',
      color: 'from-cyan-500 to-cyan-600',
      description: 'Bioavailability',
    },
    {
      name: 'Lipinski',
      weight: weights.lipinski,
      value: molecule.lipinski_compliant ? 1 : 0.3,
      icon: '✅',
      color: 'from-amber-500 to-amber-600',
      description: 'Drug-likeness rules',
    },
    {
      name: 'Molecular Weight',
      weight: weights.mw,
      value: Math.max(0, 1 - Math.abs(molecule.molecular_weight - 300) / 200),
      icon: '⚖️',
      color: 'from-violet-500 to-violet-600',
      description: 'Weight compliance',
    },
    {
      name: 'LogP (Hydrophobicity)',
      weight: weights.logp,
      value: Math.max(0, 1 - Math.abs(molecule.logP - 2) / 3),
      icon: '🌊',
      color: 'from-emerald-500 to-emerald-600',
      description: 'Lipophilicity balance',
    },
  ];

  // Calculate contribution scores
  const scored = contributions.map(c => ({
    ...c,
    contribution: c.weight * c.value,
  }));

  const totalContribution = scored.reduce((sum, c) => sum + c.contribution, 0);
  const normalized = scored.map(c => ({
    ...c,
    percentage: totalContribution > 0 ? (c.contribution / totalContribution) * 100 : 0,
  }));

  // Sort by contribution
  const sorted = [...normalized].sort((a, b) => b.contribution - a.contribution);

  const topFactor = sorted[0];

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Key Contributors
          </h4>
          <Badge variant="secondary" className="text-xs">
            {topFactor.name}
          </Badge>
        </div>

        <div className="space-y-1.5">
          {sorted.slice(0, 3).map((factor, idx) => (
            <motion.div
              key={factor.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{factor.icon} {factor.name}</span>
                <span className="text-muted-foreground">{factor.percentage.toFixed(0)}%</span>
              </div>
              <Progress value={factor.percentage} className="h-1.5" />
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Why This Molecule Ranks High
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Contribution breakdown for scoring
              </CardDescription>
            </div>
            <motion.div
              className="text-3xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {topFactor.icon}
            </motion.div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Top contributor highlight */}
          <motion.div
            className={`p-3 rounded-lg border-2 border-primary/30 bg-gradient-to-r ${topFactor.color} ${topFactor.color}/10`}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-foreground">Top Factor</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {topFactor.description}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {topFactor.percentage.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Contribution</div>
              </div>
            </div>
          </motion.div>

          {/* All contributors */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-1 h-1 bg-primary rounded-full" />
              All Contributing Factors
            </div>

            <div className="space-y-2.5">
              {sorted.map((factor, idx) => (
                <motion.div
                  key={factor.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-2.5 rounded-lg border transition-all ${
                    idx === 0
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-muted/50 border-border hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{factor.icon}</span>
                      <div>
                        <div className="font-medium text-sm">{factor.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {factor.description}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-primary text-sm">
                        {factor.percentage.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(factor.value * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Contribution bar */}
                  <div className="space-y-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full bg-gradient-to-r ${factor.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${factor.percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.1 + idx * 0.05 }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground px-0.5">
                      <span>Weight: {(factor.weight * 100).toFixed(0)}%</span>
                      <span>Value: {(factor.value * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Overall score */}
          <motion.div
            className="pt-2 border-t space-y-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Score</span>
              <span className="text-lg font-bold text-primary">
                {(molecule.weighted_score * 100).toFixed(1)}
              </span>
            </div>
            <Progress value={molecule.weighted_score * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Combines all factors weighted by importance
            </p>
          </motion.div>

          {/* Insight */}
          {molecule.lipinski_compliant && (
            <motion.div
              className="flex gap-2 p-2.5 bg-green-500/10 rounded-lg border border-green-500/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <AlertCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-green-700">
                ✓ Passes Lipinski's Rule of Five - excellent oral bioavailability potential
              </span>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
