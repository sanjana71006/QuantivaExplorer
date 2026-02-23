import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis, ReferenceLine } from 'recharts';
import { useExploration, ExplorationMolecule } from '@/context/ExplorationContext';

interface DataPoint extends ExplorationMolecule {
  z: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const d = payload[0].payload as DataPoint;
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 text-sm shadow-lg">
        <p className="font-semibold text-foreground">{d.name}</p>
        <p className="text-muted-foreground">Efficacy: {(d.efficacy * 100).toFixed(1)}%</p>
        <p className="text-muted-foreground">Toxicity: {(d.toxicity * 100).toFixed(1)}%</p>
        <p className="text-primary">Probability: {(d.probability * 100).toFixed(1)}%</p>
        <p className="text-muted-foreground">Drug-likeness: {d.drug_likeness_score.toFixed(2)}</p>
      </div>
    );
  }
  return null;
};

export default function RiskRewardMap() {
  const { molecules, selectedMolecule, selectMolecule } = useExploration();

  const data = useMemo<DataPoint[]>(() => {
    return molecules.map(m => ({
      ...m,
      z: m.probability * 100, // bubble size based on probability
    }));
  }, [molecules]);

  const getColor = (mol: DataPoint) => {
    const isSelected = selectedMolecule?.id === mol.id;
    if (isSelected) return '#fbbf24'; // yellow for selected
    
    // Color based on risk-reward ratio
    const ratio = mol.efficacy / (mol.toxicity + 0.01);
    if (ratio > 2) return '#22c55e'; // green - good
    if (ratio > 1) return '#06b6d4'; // cyan - moderate
    if (ratio > 0.5) return '#f97316'; // orange - risky
    return '#ef4444'; // red - high risk
  };

  const handleClick = (data: any) => {
    if (data && data.payload) {
      selectMolecule(data.payload as ExplorationMolecule);
    }
  };

  if (molecules.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] rounded-xl border border-border bg-card flex items-center justify-center">
        <p className="text-muted-foreground">Add molecules to view risk-reward analysis</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Risk-Reward Map</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">High Reward</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-cyan-500" />
            <span className="text-muted-foreground">Moderate</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-muted-foreground">Risky</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">High Risk</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={450}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 20%)" />
          
          <XAxis
            dataKey="efficacy"
            type="number"
            domain={[0, 1]}
            name="Efficacy"
            tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
            axisLine={{ stroke: 'hsl(222, 20%, 25%)' }}
            label={{
              value: 'Efficacy (higher is better) →',
              position: 'bottom',
              offset: 40,
              fill: 'hsl(215, 20%, 55%)',
              fontSize: 12,
            }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          
          <YAxis
            dataKey="toxicity"
            type="number"
            domain={[0, 1]}
            name="Toxicity"
            tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
            axisLine={{ stroke: 'hsl(222, 20%, 25%)' }}
            label={{
              value: '← Toxicity (lower is better)',
              angle: -90,
              position: 'insideLeft',
              offset: -40,
              fill: 'hsl(215, 20%, 55%)',
              fontSize: 12,
            }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          
          <ZAxis dataKey="z" range={[50, 400]} />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* Optimal zone indicator */}
          <ReferenceLine
            segment={[{ x: 0.5, y: 0 }, { x: 1, y: 0.25 }]}
            stroke="#22c55e"
            strokeDasharray="5 5"
            strokeOpacity={0.5}
          />
          
          <Scatter
            data={data}
            cursor="pointer"
            onClick={handleClick}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColor(entry)}
                fillOpacity={selectedMolecule?.id === entry.id ? 1 : 0.7}
                stroke={selectedMolecule?.id === entry.id ? '#fff' : 'transparent'}
                strokeWidth={2}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div className="mt-2 text-xs text-muted-foreground text-center">
        Bubble size represents quantum probability • Click to select molecule
      </div>
    </div>
  );
}
