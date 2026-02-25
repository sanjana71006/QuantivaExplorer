import React from 'react';
import { Button } from '@/components/ui/button';

export default function ClusterDetailsModal({
  open,
  onClose,
  clusterId,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  clusterId: number | null;
  summary: any | null;
}) {
  if (!open || clusterId === null || !summary) return null;

  const descriptors = [
    'molecular_weight','logP','h_bond_donors','h_bond_acceptors','tpsa','rotatable_bonds',
    'drug_likeness_score','toxicity_risk','efficacy','solubility','polar_surface_area','molecular_complexity',
    'safety_index','lipinski_compliant','drug_score','mw','logp','h_donors','h_acceptors'
  ];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-6">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 overflow-auto max-h-[80vh]">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold">Cluster {clusterId} — Details</h3>
          <button onClick={onClose} className="text-muted-foreground">Close</button>
        </div>

        <section className="mt-4 text-sm space-y-3">
          <p><strong>Clustering Method:</strong> K-Means on PCA-reduced feature space (3D). Features: MW, LogP, H-bond donors/acceptors, PSA, toxicity, efficacy, solubility, and more.</p>
          <p><strong>Cluster Centroid (approx):</strong> {summary.centroid ? `${summary.centroid.join(', ')}` : '—'}</p>
          <p><strong>Top 5 Molecules (by probability):</strong></p>
          <ol className="pl-4 list-decimal">
            {summary.top5.map((m: any, i: number) => (
              <li key={i} className="py-1">{m.name} — {Math.round((m.probability||0)*1000)/10}%</li>
            ))}
          </ol>

          <div>
            <p className="font-medium">Feature distribution (sample):</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {['drug_likeness_score','toxicity_risk','efficacy'].map((k) => (
                <div key={k} className="text-xs bg-slate-50 p-2 rounded">
                  <div className="font-semibold">{k}</div>
                  <div className="mt-2">
                    <div className="h-2 bg-blue-200 rounded" style={{width: `${Math.min(100, Math.round((summary.featuresAvg[k]||0)*100))}%`}} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <p className="font-medium">PCA basis / descriptors used:</p>
            <div className="text-xs mt-2 grid grid-cols-2 gap-2">
              {descriptors.map((d) => (
                <div key={d} className="bg-gray-50 p-2 rounded">{d}</div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
