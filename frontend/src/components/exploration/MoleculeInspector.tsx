import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Beaker, Activity, Atom, ExternalLink, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useExploration, ExplorationMolecule } from '@/context/ExplorationContext';
import { getMoleculeImageUrl, fetchSimilarMolecules, getBioactivityByCid } from '@/services/pubchemApi';
import { explainMolecule } from '@/lib/aiExplainer';
import Molecule3DViewer from '@/components/Molecule3DViewer';
import Molecule2DImage from '@/components/Molecule2DImage';

interface BioactivityData {
  target?: string;
  activity?: string;
  value?: number;
}

export default function MoleculeInspector({ embedded = false }: { embedded?: boolean }) {
  const {
    selectedMolecule,
    inspectorOpen,
    closeInspector,
    addToCompare,
    comparedMolecules,
    addMolecule,
    molecules,
  } = useExploration();

  const [bioactivity, setBioactivity] = useState<BioactivityData[]>([]);
  const [similarMols, setSimilarMols] = useState<ExplorationMolecule[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [viewerMode, setViewerMode] = useState<'3d' | '2d' | 'both'>('3d');

  const isCompared = selectedMolecule
    ? comparedMolecules.some(m => m.id === selectedMolecule.id)
    : false;

  useEffect(() => {
    if (!selectedMolecule?.cid) {
      setBioactivity([]);
      setSimilarMols([]);
      setAiExplanation('');
      return;
    }

    // Fetch bioactivity
    getBioactivityByCid(selectedMolecule.cid).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setBioactivity(data.slice(0, 5).map((d: any) => ({
          target: d.target?.name || 'Unknown',
          activity: d.activity_type || 'Binding',
          value: d.value || 0,
        })));
      } else {
        setBioactivity([]);
      }
    }).catch(() => setBioactivity([]));

    // Fetch similar molecules (limit to 5)
    fetchSimilarMolecules(String(selectedMolecule.cid), 5).then(mols => {
      setSimilarMols(mols);
    }).catch(() => setSimilarMols([]));

    // Generate AI explanation
    setLoadingAI(true);
    try {
      const explanationResult = explainMolecule({
        name: selectedMolecule.name,
        molecular_weight: selectedMolecule.molecular_weight,
        logP: selectedMolecule.logP,
        h_bond_donors: selectedMolecule.h_bond_donors,
        h_bond_acceptors: selectedMolecule.h_bond_acceptors,
        probability: selectedMolecule.probability,
        toxicity_risk: selectedMolecule.toxicity,
        weighted_score: selectedMolecule.drug_likeness,
        lipinski_compliant: selectedMolecule.drug_likeness > 0.5,
        score_breakdown: {
          binding: selectedMolecule.efficacy,
          toxicity: 1 - selectedMolecule.toxicity,
          solubility: selectedMolecule.confidence,
          mw: selectedMolecule.molecular_weight < 500 ? 0.8 : 0.4,
          logP: selectedMolecule.logP < 5 ? 0.8 : 0.4,
        },
      } as any);
      setAiExplanation(explanationResult.summary);
    } catch {
      setAiExplanation('Unable to generate explanation.');
    } finally {
      setLoadingAI(false);
    }
  }, [selectedMolecule]);

  const handleAddSimilar = (mol: ExplorationMolecule) => {
    if (molecules.length < 50 && !molecules.some(m => m.cid === mol.cid)) {
      addMolecule(mol);
    }
  };

  // Build inner content once so we can render in embedded layout or modal
  const InspectorInner = (
    <div className="h-full bg-card border-l border-border shadow-sm overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border p-4 z-10">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg truncate pr-2">{selectedMolecule?.name}</h2>
          <div className="flex items-center gap-2">
            {!embedded && (
              <Button variant="ghost" size="icon" onClick={closeInspector}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge variant="secondary">CID: {selectedMolecule?.cid}</Badge>
          <Badge variant="outline" className="text-primary">
            {selectedMolecule ? (selectedMolecule.probability * 100).toFixed(1) : '0.0'}% prob
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Interactive 2D / 3D Structure (toggle for visibility) */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-sm font-semibold">Structure</div>
            <div className="ml-2 inline-flex rounded-md bg-muted/10 p-0.5">
              <button onClick={() => setViewerMode('3d')} className={`px-2 py-0.5 text-xs rounded-md ${viewerMode === '3d' ? 'bg-violet-600 text-white' : 'text-violet-700 hover:bg-violet-50'}`}>3D</button>
              <button onClick={() => setViewerMode('2d')} className={`px-2 py-0.5 text-xs rounded-md ${viewerMode === '2d' ? 'bg-violet-600 text-white' : 'text-violet-700 hover:bg-violet-50'}`}>2D</button>
              <button onClick={() => setViewerMode('both')} className={`px-2 py-0.5 text-xs rounded-md ${viewerMode === 'both' ? 'bg-violet-600 text-white' : 'text-violet-700 hover:bg-violet-50'}`}>Both</button>
            </div>
          </div>

          {viewerMode === 'both' ? (
            <div className="grid grid-cols-2 gap-3 items-start">
              <div>
                <Molecule3DViewer name={selectedMolecule?.name || ''} smiles={selectedMolecule?.smiles} cid={selectedMolecule?.cid} height={220} />
              </div>
              <div className="flex flex-col items-center">
                <Molecule2DImage cid={selectedMolecule?.cid} name={selectedMolecule?.name} smiles={selectedMolecule?.smiles} size={180} />
                <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${selectedMolecule?.cid}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-2">View on PubChem <ExternalLink className="h-3 w-3" /></a>
              </div>
            </div>
          ) : viewerMode === '3d' ? (
            <Molecule3DViewer name={selectedMolecule?.name || ''} smiles={selectedMolecule?.smiles} cid={selectedMolecule?.cid} height={300} />
          ) : (
            <div className="flex flex-col items-center">
              <Molecule2DImage cid={selectedMolecule?.cid} name={selectedMolecule?.name} smiles={selectedMolecule?.smiles} size={260} />
              <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${selectedMolecule?.cid}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-2">View on PubChem <ExternalLink className="h-3 w-3" /></a>
            </div>
          )}
        </section>

        {/* Properties */}
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Atom className="h-4 w-4" /> Properties
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">MW</span>
              <p className="font-medium">{selectedMolecule?.molecular_weight?.toFixed(2) || '—'}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">LogP</span>
              <p className="font-medium">{selectedMolecule?.logP?.toFixed(2) || '—'}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">H-Donors</span>
              <p className="font-medium">{selectedMolecule?.h_bond_donors || '—'}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">H-Acceptors</span>
              <p className="font-medium">{selectedMolecule?.h_bond_acceptors || '—'}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Drug-likeness</span>
              <p className="font-medium">{selectedMolecule ? (selectedMolecule.drug_likeness * 100).toFixed(0) + '%' : '—'}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Toxicity</span>
              <p className="font-medium">{selectedMolecule ? (selectedMolecule.toxicity * 100).toFixed(0) + '%' : '—'}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Efficacy</span>
              <p className="font-medium">{selectedMolecule ? (selectedMolecule.efficacy * 100).toFixed(0) + '%' : '—'}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">Confidence</span>
              <p className="font-medium">{selectedMolecule ? (selectedMolecule.confidence * 100).toFixed(0) + '%' : '—'}</p>
            </div>
          </div>
        </section>

        {/* AI Explanation */}
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Brain className="h-4 w-4" /> AI Explanation
          </h3>
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-3 text-xs leading-relaxed">
            {loadingAI ? (
              <span className="text-muted-foreground animate-pulse">Generating explanation...</span>
            ) : (
              aiExplanation || 'No explanation available.'
            )}
          </div>
        </section>

        {/* Bioactivity */}
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Bioactivity Summary
          </h3>
          {bioactivity.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {bioactivity.map((b, i) => (
                <li key={i} className="flex justify-between bg-muted/30 rounded px-2 py-1">
                  <span className="truncate">{b.target}</span>
                  <span className="text-muted-foreground">{b.activity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No bioactivity data available.</p>
          )}
        </section>

        {/* Similar Molecules */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Similar Molecules</h3>
          {similarMols.length > 0 ? (
            <ul className="space-y-2">
              {similarMols.map(mol => (
                <li
                  key={mol.cid}
                  className="flex items-center justify-between bg-muted/30 rounded px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={getMoleculeImageUrl(mol.cid)}
                      alt={mol.name}
                      className="h-8 w-8 bg-white rounded"
                    />
                    <span className="text-xs truncate max-w-[140px]">{mol.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleAddSimilar(mol)}
                    disabled={molecules.length >= 50 || molecules.some(m => m.cid === mol.cid)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No similar molecules found.</p>
          )}
        </section>

        {/* Compare Action */}
        <div className="pt-4 border-t border-border">
          <Button
            onClick={() => addToCompare(selectedMolecule as any)}
            disabled={isCompared || comparedMolecules.length >= 4}
            className="w-full"
          >
            {isCompared ? 'Added to Compare' : 'Add to Compare'}
          </Button>
        </div>
      </div>
    </div>
  );

  // Render embedded panel for large screens (non-fixed), and original modal for small screens
  return (
    <>
      {/* Embedded (desktop) */}
      <div className="hidden lg:block h-full">
        {inspectorOpen && selectedMolecule ? InspectorInner : (
          <div className="h-full bg-card border-l border-border shadow-sm p-4 text-xs text-muted-foreground">Inspector closed</div>
        )}
      </div>

      {/* Modal/drawer for small screens */}
      <AnimatePresence>
        {inspectorOpen && selectedMolecule && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="lg:hidden fixed inset-0 bg-card border-l border-border shadow-2xl z-50 overflow-y-auto"
          >
            {InspectorInner}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
