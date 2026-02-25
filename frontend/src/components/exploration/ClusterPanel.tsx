import React from 'react';
import { Button } from '@/components/ui/button';

export default function ClusterPanel({
  clusterId,
  summary,
  onClose,
  onMore,
}: {
  clusterId: number | null;
  summary: any | null;
  onClose: () => void;
  onMore: () => void;
}) {
  if (clusterId === null || !summary) return null;

  return (
    <div className="absolute right-4 top-16 w-80 bg-white/95 border border-blue-200 rounded-lg shadow-lg p-4 z-50">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-blue-700 font-semibold">Cluster ID: {clusterId}</p>
          <p className="text-xs text-muted-foreground">Molecules: {summary.count}</p>
        </div>
        <button onClick={onClose} className="text-sm text-muted-foreground">✕</button>
      </div>

      <div className="mt-3 text-xs space-y-2">
        <div className="flex justify-between"><span>Avg Score</span><span className="font-semibold">{summary.avgScore.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Avg MW</span><span className="font-semibold">{summary.avgMW.toFixed(0)}</span></div>
        <div className="flex justify-between"><span>Avg LogP</span><span className="font-semibold">{summary.avgLogP.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Lipinski Pass Rate</span><span className="font-semibold">{Math.round(summary.lipinskiRate*100)}%</span></div>
        <div className="flex justify-between"><span>Avg Toxicity</span><span className="font-semibold">{summary.avgToxicity.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Diffusion Impact</span><span className="font-semibold">+{Math.round(summary.diffusionImpact*100)}%</span></div>
        <div className="pt-2"><span className="text-xs text-muted-foreground">Dominant Feature:</span>
          <div className="text-sm font-medium">{summary.dominantFeature}</div>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button onClick={onMore} size="sm">More</Button>
      </div>
    </div>
  );
}
