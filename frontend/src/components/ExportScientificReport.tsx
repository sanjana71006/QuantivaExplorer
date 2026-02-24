import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, FileJson, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';
import { explainMolecule } from '@/lib/aiExplainer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const ExportScientificReport: React.FC = () => {
  const {
    scoredResults,
    weights,
    filters,
    datasetMode,
    scoringAlgorithm,
    diffusionEnabled,
    diversityMetrics,
    diseaseProfile,
    simulationMetadata,
  } = useGlobalExploration();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const generateReport = () => {
    const top10 = scoredResults.slice(0, 10);
    const timestamp = new Date().toISOString();

    // Generate AI explanations for top 3
    const topExplanations = top10.slice(0, 3).map((mol) => ({
      name: mol.name,
      explanation: explainMolecule(mol),
    }));

    const report = {
      meta: {
        title: 'Quantiva Molecular Exploration Report',
        generatedAt: timestamp,
        version: '1.0',
      },
      configuration: {
        datasetMode,
        scoringAlgorithm,
        diffusionEnabled,
        weights: {
          binding: weights.binding,
          toxicity: weights.toxicity,
          solubility: weights.solubility,
          lipinski: weights.lipinski,
          molecularWeight: weights.mw,
          logP: weights.logp,
        },
        filters: {
          lipinskiOnly: filters.lipinskiOnly,
          toxicityThreshold: filters.toxicityThreshold,
          sourceFilter: filters.sourceFilter,
        },
      },
      diseaseMode: diseaseProfile
        ? {
            enabled: true,
            keyword: diseaseProfile.keyword,
            adjustedWeights: diseaseProfile.weightAdjustments,
          }
        : { enabled: false },
      datasetStatistics: {
        totalMolecules: scoredResults.length,
        diversityIndex: diversityMetrics?.diversityScore || 0,
        clusterEstimate: diversityMetrics?.clusterEstimate || 0,
        chemicalSpaceCoverage: diversityMetrics?.chemicalSpaceCoverage || 0,
        lipinskiCompliant: scoredResults.filter((m) => m.lipinski_compliant).length,
      },
      topCandidates: top10.map((mol, idx) => ({
        rank: idx + 1,
        id: mol.molecule_id,
        name: mol.name,
        smiles: mol.smiles,
        formula: mol.formula,
        molecularWeight: mol.molecular_weight,
        logP: mol.logP,
        hBondDonors: mol.h_bond_donors,
        hBondAcceptors: mol.h_bond_acceptors,
        weightedScore: mol.weighted_score,
        probability: mol.probability,
        lipinskiCompliant: mol.lipinski_compliant === 1,
        scoreBreakdown: mol.score_breakdown,
      })),
      aiAnalysis: topExplanations.map((e) => ({
        molecule: e.name,
        summary: e.explanation.summary,
        verdict: e.explanation.verdict,
        strengths: e.explanation.strengths,
        risks: e.explanation.risks,
        whatWouldImprove: e.explanation.whatWouldImproveScore,
        confidence: e.explanation.confidenceLevel,
      })),
      simulationHistory: simulationMetadata
        ? {
            id: simulationMetadata.id,
            datasetName: simulationMetadata.datasetName,
            timestamp: simulationMetadata.timestamp,
            topScore: simulationMetadata.topScore,
          }
        : null,
    };

    return report;
  };

  const handleExportJSON = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const report = generateReport();
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quantiva-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setIsGenerating(false);
    }, 500);
  };

  const handleExportMarkdown = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const report = generateReport();
      const md = generateMarkdownReport(report);
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quantiva-report-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
      setIsGenerating(false);
    }, 500);
  };

  const generateMarkdownReport = (report: any): string => {
    const lines: string[] = [
      '# Quantiva Molecular Exploration Report',
      '',
      `**Generated:** ${new Date(report.meta.generatedAt).toLocaleString()}`,
      '',
      '---',
      '',
      '## Configuration',
      '',
      `- **Dataset Mode:** ${report.configuration.datasetMode}`,
      `- **Scoring Algorithm:** ${report.configuration.scoringAlgorithm}`,
      `- **Quantum Diffusion:** ${report.configuration.diffusionEnabled ? 'Enabled' : 'Disabled'}`,
      '',
      '### Weight Parameters',
      '',
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| Binding Affinity | ${report.configuration.weights.binding.toFixed(2)} |`,
      `| Toxicity Safety | ${report.configuration.weights.toxicity.toFixed(2)} |`,
      `| Solubility | ${report.configuration.weights.solubility.toFixed(2)} |`,
      `| Lipinski Compliance | ${report.configuration.weights.lipinski.toFixed(2)} |`,
      `| Molecular Weight | ${report.configuration.weights.molecularWeight.toFixed(2)} |`,
      `| LogP | ${report.configuration.weights.logP.toFixed(2)} |`,
      '',
      '---',
      '',
      '## Dataset Statistics',
      '',
      `- **Total Molecules:** ${report.datasetStatistics.totalMolecules}`,
      `- **Diversity Index:** ${(report.datasetStatistics.diversityIndex * 100).toFixed(1)}%`,
      `- **Cluster Estimate:** ~${report.datasetStatistics.clusterEstimate}`,
      `- **Chemical Space Coverage:** ${(report.datasetStatistics.chemicalSpaceCoverage * 100).toFixed(1)}%`,
      `- **Lipinski Compliant:** ${report.datasetStatistics.lipinskiCompliant}`,
      '',
    ];

    if (report.diseaseMode.enabled) {
      lines.push(
        '---',
        '',
        '## Disease-Aware Mode',
        '',
        `**Target Keyword:** ${report.diseaseMode.keyword}`,
        '',
      );
    }

    lines.push(
      '---',
      '',
      '## Top 10 Candidates',
      '',
      '| Rank | Name | Score | MW | LogP | Lipinski |',
      '|------|------|-------|----|----- |----------|',
    );

    report.topCandidates.forEach((mol: any) => {
      lines.push(
        `| ${mol.rank} | ${mol.name} | ${mol.weightedScore.toFixed(3)} | ${mol.molecularWeight.toFixed(0)} | ${mol.logP.toFixed(2)} | ${mol.lipinskiCompliant ? '✓' : '✗'} |`
      );
    });

    lines.push('', '---', '', '## AI Analysis (Top 3)', '');

    report.aiAnalysis.forEach((analysis: any, idx: number) => {
      lines.push(
        `### ${idx + 1}. ${analysis.molecule}`,
        '',
        `**Summary:** ${analysis.summary}`,
        '',
        `**Verdict:** ${analysis.verdict}`,
        '',
        `**Confidence:** ${analysis.confidence}`,
        '',
        '**Strengths:**',
        ...analysis.strengths.slice(0, 3).map((s: string) => `- ${s}`),
        '',
        '**Risks:**',
        ...analysis.risks.slice(0, 3).map((r: string) => `- ${r}`),
        '',
        '**Improvement Suggestions:**',
        ...analysis.whatWouldImprove.slice(0, 3).map((i: string) => `- ${i}`),
        '',
      );
    });

    lines.push(
      '---',
      '',
      '*Report generated by Quantiva Explorer*',
    );

    return lines.join('\n');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          <FileText className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Export Scientific Report
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Generate a comprehensive report including dataset metadata, weight configuration,
            top candidates, diversity metrics, and AI analysis.
          </p>

          <div className="space-y-3">
            <Button
              onClick={handleExportJSON}
              disabled={isGenerating || scoredResults.length === 0}
              className="w-full justify-start"
              variant="outline"
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="mr-2 h-4 w-4" />
              )}
              Export as JSON
            </Button>

            <Button
              onClick={handleExportMarkdown}
              disabled={isGenerating || scoredResults.length === 0}
              className="w-full justify-start"
              variant="outline"
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export as Markdown
            </Button>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
            <p className="font-medium mb-1">Report includes:</p>
            <ul className="space-y-1">
              <li>• Full weight configuration</li>
              <li>• Top 10 candidates with scores</li>
              <li>• Diversity metrics & chemical space coverage</li>
              <li>• AI explanations for top 3 molecules</li>
              <li>• Disease mode status (if enabled)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportScientificReport;
