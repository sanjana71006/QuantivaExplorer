import React from 'react';
import { getClusterColor } from '@/lib/visualization3dUtils';

export default function LegendPanel({
  clusterCount = 6,
  visibility,
  toggleLayer,
}: {
  clusterCount?: number;
  visibility: any;
  toggleLayer: (k: string) => void;
}) {
  const clustersToShow = Math.min(clusterCount, 8);
  const clusterIds = Array.from({ length: clustersToShow }, (_, i) => i);

  return (
    <div className="fixed left-4 top-16 bg-white/98 border border-blue-200 rounded-lg shadow-lg p-3 z-90 w-44" style={{backdropFilter: 'saturate(1.1) blur(4px)'}}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-800">Legend</div>
        <div className="text-xs text-muted-foreground">3D</div>
      </div>

      <div className="text-xs text-muted-foreground mb-2">Clusters</div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {clusterIds.map((cid) => {
          const c = getClusterColor(cid);
          const hex = `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;
          return (
            <div key={cid} className="flex flex-col items-center text-[10px]">
              <div style={{ width: 24, height: 16, background: hex, borderRadius: 4, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }} />
              <div className="mt-1 text-[10px] text-slate-700">{cid}</div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground mb-2">Probability</div>
      <div className="h-3 rounded bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-3" />

      <div className="text-xs text-muted-foreground mb-2">Overlays</div>
      <div className="flex flex-col gap-2 text-sm">
        <label className="flex items-center justify-between">
          <span className="text-xs">Lipinski</span>
          <input type="checkbox" checked={visibility?.lipinskiOverlay} onChange={() => toggleLayer('lipinskiOverlay')} />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-xs">Toxicity</span>
          <input type="checkbox" checked={visibility?.toxicityOverlay} onChange={() => toggleLayer('toxicityOverlay')} />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-xs">Diffusion</span>
          <input type="checkbox" checked={visibility?.diffusionAnimation} onChange={() => toggleLayer('diffusionAnimation')} />
        </label>
      </div>

      <div className="text-[10px] text-muted-foreground mt-3">Method: K-Means on PCA (3D)</div>
    </div>
  );
}
