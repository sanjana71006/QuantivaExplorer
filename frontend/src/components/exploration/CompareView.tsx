import React, { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { useExploration } from '@/context/ExplorationContext';

const COLORS = ['#8b5cf6', '#06b6d4', '#22c55e', '#f97316', '#ef4444'];

const propertyLabels = {
  molecular_weight: 'MW',
  logP: 'LogP',
  h_bond_donors: 'H-Donors',
  h_bond_acceptors: 'H-Acceptors',
  drug_likeness_score: 'Drug-likeness',
  probability: 'Probability',
};

export default function CompareView() {
  const { comparedMolecules, molecules, selectMolecule } = useExploration();

  // If no molecules in compare list, show all molecules (up to 5)
  const displayMolecules = useMemo(() => {
    if (comparedMolecules.length > 0) return comparedMolecules;
    return molecules.slice(0, 5);
  }, [comparedMolecules, molecules]);

  // Normalize values for radar chart (0-100 scale)
  const radarData = useMemo(() => {
    const normalize = (val: number, min: number, max: number) => 
      Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));

    const properties = [
      { key: 'molecular_weight', label: 'MW', min: 0, max: 800 },
      { key: 'logP', label: 'LogP', min: -3, max: 8 },
      { key: 'h_bond_donors', label: 'H-Donors', min: 0, max: 10 },
      { key: 'h_bond_acceptors', label: 'H-Acceptors', min: 0, max: 15 },
      { key: 'drug_likeness_score', label: 'Drug-likeness', min: 0, max: 1, scale: 100 },
      { key: 'probability', label: 'Probability', min: 0, max: 1, scale: 100 },
    ];

    return properties.map(prop => {
      const point: any = { property: prop.label };
      displayMolecules.forEach((mol, i) => {
        const raw = (mol as any)[prop.key] ?? 0;
        const scaled = prop.scale ? raw * prop.scale : raw;
        point[mol.name] = normalize(scaled, prop.min * (prop.scale || 1), prop.max * (prop.scale || 1));
      });
      return point;
    });
  }, [displayMolecules]);

  // Bar chart data for direct comparison
  const barData = useMemo(() => {
    return displayMolecules.map(mol => ({
      name: mol.name.length > 12 ? mol.name.slice(0, 12) + '...' : mol.name,
      fullName: mol.name,
      MW: mol.molecular_weight,
      LogP: mol.logP,
      'Drug-likeness': mol.drug_likeness_score * 100,
      Probability: mol.probability * 100,
      molecule: mol,
    }));
  }, [displayMolecules]);

  if (displayMolecules.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] rounded-xl border border-border bg-card flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">No molecules to compare</p>
          <p className="text-xs text-muted-foreground">Click "Compare" button on molecules to add them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl border border-border bg-card p-4 overflow-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Property Radar</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke="hsl(222, 20%, 25%)" />
              <PolarAngleAxis
                dataKey="property"
                tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: 'hsl(215, 20%, 45%)', fontSize: 10 }}
              />
              {displayMolecules.map((mol, i) => (
                <Radar
                  key={mol.id}
                  name={mol.name}
                  dataKey={mol.name}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 20%, 12%)',
                  border: '1px solid hsl(222, 20%, 25%)',
                  borderRadius: '8px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart - Drug-likeness & Probability */}
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Score Comparison</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={barData} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 20%)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 10 }}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 20%, 12%)',
                  border: '1px solid hsl(222, 20%, 25%)',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
              <Legend />
              <Bar dataKey="Drug-likeness" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Probability" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Property Table */}
        <div className="lg:col-span-2 bg-card/50 rounded-lg p-4 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Property Comparison Table</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground">Property</th>
                  {displayMolecules.map((mol, i) => (
                    <th
                      key={mol.id}
                      className="text-left py-2 px-3 cursor-pointer hover:text-primary"
                      onClick={() => selectMolecule(mol)}
                      style={{ color: COLORS[i % COLORS.length] }}
                    >
                      {mol.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 text-muted-foreground">Molecular Weight</td>
                  {displayMolecules.map(mol => (
                    <td key={mol.id} className="py-2 px-3">{mol.molecular_weight.toFixed(2)}</td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 text-muted-foreground">LogP</td>
                  {displayMolecules.map(mol => (
                    <td key={mol.id} className="py-2 px-3">{mol.logP.toFixed(2)}</td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 text-muted-foreground">H-Bond Donors</td>
                  {displayMolecules.map(mol => (
                    <td key={mol.id} className="py-2 px-3">{mol.h_bond_donors}</td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 text-muted-foreground">H-Bond Acceptors</td>
                  {displayMolecules.map(mol => (
                    <td key={mol.id} className="py-2 px-3">{mol.h_bond_acceptors}</td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 text-muted-foreground">Drug-likeness</td>
                  {displayMolecules.map(mol => (
                    <td key={mol.id} className="py-2 px-3">{(mol.drug_likeness_score * 100).toFixed(1)}%</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 px-3 text-muted-foreground">Probability</td>
                  {displayMolecules.map(mol => (
                    <td key={mol.id} className="py-2 px-3 text-primary">{(mol.probability * 100).toFixed(1)}%</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
