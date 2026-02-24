import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ScoredMolecule } from '@/lib/quantumEngine';

interface LipinskiViolation {
  rule: string;
  value: number;
  limit: string;
  passed: boolean;
}

interface LipinskiViolationOverlayProps {
  molecule: ScoredMolecule;
  compact?: boolean;
}

const LipinskiViolationOverlay: React.FC<LipinskiViolationOverlayProps> = ({ molecule, compact = false }) => {
  // Lipinski Rule of Five checks
  const violations: LipinskiViolation[] = [
    {
      rule: 'Molecular Weight',
      value: molecule.molecular_weight,
      limit: '≤ 500 Da',
      passed: molecule.molecular_weight <= 500,
    },
    {
      rule: 'LogP',
      value: molecule.logP,
      limit: '≤ 5',
      passed: molecule.logP <= 5,
    },
    {
      rule: 'H-Bond Donors',
      value: molecule.h_bond_donors,
      limit: '≤ 5',
      passed: molecule.h_bond_donors <= 5,
    },
    {
      rule: 'H-Bond Acceptors',
      value: molecule.h_bond_acceptors,
      limit: '≤ 10',
      passed: molecule.h_bond_acceptors <= 10,
    },
  ];

  const failedRules = violations.filter(v => !v.passed);
  const passedCount = violations.filter(v => v.passed).length;
  const isCompliant = failedRules.length === 0;

  if (compact) {
    // Compact mode: show badges only for failed rules
    if (isCompliant) {
      return (
        <Badge variant="outline" className="border-success/30 text-success text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Lipinski ✓
        </Badge>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        {failedRules.map((rule) => (
          <Badge
            key={rule.rule}
            variant="outline"
            className="border-destructive/30 text-destructive text-xs"
          >
            <XCircle className="h-3 w-3 mr-1" />
            {rule.rule.replace('H-Bond ', 'HB').replace('Molecular Weight', 'MW')}
          </Badge>
        ))}
      </div>
    );
  }

  // Full mode: detailed breakdown
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2 mb-2">
        {isCompliant ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-success">Lipinski Compliant ({passedCount}/4)</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {failedRules.length} Lipinski Violation{failedRules.length > 1 ? 's' : ''} ({passedCount}/4)
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {violations.map((v) => (
          <div
            key={v.rule}
            className={`p-2 rounded-lg border ${
              v.passed
                ? 'bg-success/5 border-success/20'
                : 'bg-destructive/5 border-destructive/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{v.rule}</span>
              {v.passed ? (
                <CheckCircle2 className="h-3 w-3 text-success" />
              ) : (
                <XCircle className="h-3 w-3 text-destructive" />
              )}
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-sm font-mono font-medium ${v.passed ? 'text-foreground' : 'text-destructive'}`}>
                {typeof v.value === 'number' ? v.value.toFixed(v.rule === 'LogP' ? 2 : 0) : v.value}
              </span>
              <span className="text-xs text-muted-foreground">({v.limit})</span>
            </div>
          </div>
        ))}
      </div>

      {!isCompliant && (
        <p className="text-xs text-muted-foreground mt-2 bg-muted/20 rounded p-2">
          Molecules violating Lipinski's Rule of Five may have reduced oral bioavailability.
        </p>
      )}
    </motion.div>
  );
};

export default LipinskiViolationOverlay;
