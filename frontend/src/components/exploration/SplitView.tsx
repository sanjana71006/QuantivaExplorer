import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useExploration, ExplorationMolecule } from '@/context/ExplorationContext';

// Classical scoring - simple Lipinski-based
function classicalScore(mol: ExplorationMolecule): number {
  let score = 1.0;
  if (mol.molecular_weight > 500) score -= 0.25;
  if (mol.logP > 5) score -= 0.25;
  if (mol.h_bond_donors > 5) score -= 0.25;
  if (mol.h_bond_acceptors > 10) score -= 0.25;
  return Math.max(0, Math.min(1, score));
}

// Quantum scoring - uses probability + confidence
function quantumScore(mol: ExplorationMolecule): number {
  return mol.probability * mol.confidence;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-card/95 border border-border rounded-lg p-3 text-xs shadow-lg">
        <p className="font-semibold">{d.name}</p>
        <p className="text-muted-foreground">MW: {d.molecular_weight.toFixed(1)}</p>
        <p className="text-muted-foreground">LogP: {d.logP.toFixed(2)}</p>
        <p className="text-primary">Score: {d.score?.toFixed(3)}</p>
      </div>
    );
  }
  return null;
};

export default function SplitView() {
  const { molecules, selectedMolecule, selectMolecule } = useExploration();

  // Classical data - sorted by classical score
  const classicalData = useMemo(() => {
    return molecules
      .map(m => ({
        ...m,
        score: classicalScore(m),
        x: m.molecular_weight,
        y: m.logP,
      }))
      .sort((a, b) => b.score - a.score);
  }, [molecules]);

  // Quantum data - sorted by quantum score
  const quantumData = useMemo(() => {
    return molecules
      .map(m => ({
        ...m,
        score: quantumScore(m),
        x: m.pca_x,
        y: m.pca_y,
      }))
      .sort((a, b) => b.score - a.score);
  }, [molecules]);

  // Find divergence - molecules ranked very differently
  const divergence = useMemo(() => {
    const classicalRanks = new Map(classicalData.map((m, i) => [m.id, i]));
    const quantumRanks = new Map(quantumData.map((m, i) => [m.id, i]));
    
    return molecules.map(m => {
      const cRank = classicalRanks.get(m.id) ?? 0;
      const qRank = quantumRanks.get(m.id) ?? 0;
      return {
        molecule: m,
        classicalRank: cRank + 1,
        quantumRank: qRank + 1,
        divergence: Math.abs(cRank - qRank),
      };
    }).sort((a, b) => b.divergence - a.divergence);
  }, [molecules, classicalData, quantumData]);

  const handleClick = (data: any) => {
    if (data?.payload) {
      selectMolecule(data.payload as ExplorationMolecule);
    }
  };

  if (molecules.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] rounded-xl border border-border bg-card flex items-center justify-center">
        <p className="text-muted-foreground">Add molecules to compare Classical vs Quantum approaches</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
        {/* Classical Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-br from-blue-950/50 to-slate-900 rounded-lg p-4 border border-blue-900/50"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-blue-400">Classical Filtering</h3>
            <span className="text-xs text-blue-400/70">Lipinski-based scoring</span>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 40, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 40%, 20%)" />
              <XAxis
                dataKey="x"
                name="MW"
                tick={{ fill: 'hsl(215, 60%, 60%)', fontSize: 10 }}
                label={{ value: 'Molecular Weight', position: 'bottom', offset: 20, fill: 'hsl(215, 60%, 60%)', fontSize: 11 }}
              />
              <YAxis
                dataKey="y"
                name="LogP"
                tick={{ fill: 'hsl(215, 60%, 60%)', fontSize: 10 }}
                label={{ value: 'LogP', angle: -90, position: 'insideLeft', offset: -20, fill: 'hsl(215, 60%, 60%)', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={classicalData} cursor="pointer" onClick={handleClick}>
                {classicalData.map((entry, i) => (
                  <Cell
                    key={entry.id}
                    fill={`hsl(210, 80%, ${30 + entry.score * 40}%)`}
                    fillOpacity={selectedMolecule?.id === entry.id ? 1 : 0.7}
                    stroke={selectedMolecule?.id === entry.id ? '#fff' : 'transparent'}
                    strokeWidth={2}
                    r={4 + entry.score * 6}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          <div className="mt-3 text-xs text-blue-400/70">
            Top 3 Classical: {classicalData.slice(0, 3).map(m => m.name).join(', ')}
          </div>
        </motion.div>

        {/* Quantum Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-br from-purple-950/50 to-slate-900 rounded-lg p-4 border border-purple-900/50"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-400">Quantum Diffusion</h3>
            <span className="text-xs text-purple-400/70">Probability × Confidence</span>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 40, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(270, 40%, 20%)" />
              <XAxis
                dataKey="x"
                name="PCA-X"
                tick={{ fill: 'hsl(270, 60%, 60%)', fontSize: 10 }}
                label={{ value: 'Embedding X', position: 'bottom', offset: 20, fill: 'hsl(270, 60%, 60%)', fontSize: 11 }}
              />
              <YAxis
                dataKey="y"
                name="PCA-Y"
                tick={{ fill: 'hsl(270, 60%, 60%)', fontSize: 10 }}
                label={{ value: 'Embedding Y', angle: -90, position: 'insideLeft', offset: -20, fill: 'hsl(270, 60%, 60%)', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={quantumData} cursor="pointer" onClick={handleClick}>
                {quantumData.map((entry, i) => (
                  <Cell
                    key={entry.id}
                    fill={`hsl(280, 80%, ${30 + entry.score * 40}%)`}
                    fillOpacity={selectedMolecule?.id === entry.id ? 1 : 0.7}
                    stroke={selectedMolecule?.id === entry.id ? '#fff' : 'transparent'}
                    strokeWidth={2}
                    r={4 + entry.score * 6}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          <div className="mt-3 text-xs text-purple-400/70">
            Top 3 Quantum: {quantumData.slice(0, 3).map(m => m.name).join(', ')}
          </div>
        </motion.div>
      </div>

      {/* Divergence indicator */}
      {divergence.length > 0 && divergence[0].divergence > 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 bg-amber-950/30 border border-amber-900/50 rounded-lg p-3"
        >
          <p className="text-amber-400 text-sm font-medium">
            🔀 Ranking Divergence Detected
          </p>
          <p className="text-amber-400/70 text-xs mt-1">
            <strong>{divergence[0].molecule.name}</strong> ranks #{divergence[0].classicalRank} classically but #{divergence[0].quantumRank} in quantum scoring.
            This suggests unique properties worth investigating.
          </p>
        </motion.div>
      )}
    </div>
  );
}
