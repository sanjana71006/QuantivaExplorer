import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

// Types
export interface ExplorationMolecule {
  id: string;
  cid?: number;
  name: string;
  smiles?: string;
  molecular_weight: number;
  logP: number;
  h_bond_donors: number;
  h_bond_acceptors: number;
  tpsa: number;
  rotatable_bonds: number;
  drug_likeness_score: number;
  drug_likeness: number;  // alias for drug_likeness_score
  probability: number;
  confidence: number;
  efficacy: number;
  toxicity: number;
  source: 'local' | 'pubchem' | 'hybrid';
  pca_x: number;
  pca_y: number;
  pca_z: number;
  bioactivity?: {
    activeCount: number;
    inactiveCount: number;
    targets: string[];
  };
  similarMolecules?: string[];
  sdfData?: string;
}

export type VisualMode = 'galaxy' | 'network' | 'risk-reward' | 'compare' | 'split';
export type DataSource = 'local' | 'pubchem' | 'hybrid';

interface ExplorationState {
  molecules: ExplorationMolecule[];
  selectedMolecule: ExplorationMolecule | null;
  comparedMolecules: ExplorationMolecule[];
  visualMode: VisualMode;
  similarityEnabled: boolean;
  outbreakMode: boolean;
  dataSource: DataSource;
  isLoading: boolean;
  inspectorOpen: boolean;
  compareDrawerOpen: boolean;
}

interface ExplorationActions {
  setMolecules: (molecules: ExplorationMolecule[]) => void;
  addMolecule: (molecule: ExplorationMolecule) => void;
  addMolecules: (molecules: ExplorationMolecule[]) => void;
  removeMolecule: (id: string) => void;
  selectMolecule: (molecule: ExplorationMolecule | null) => void;
  addToCompare: (molecule: ExplorationMolecule) => void;
  removeFromCompare: (id: string) => void;
  clearCompared: () => void;
  clearCompare: () => void;  // alias
  setVisualMode: (mode: VisualMode) => void;
  toggleSimilarity: () => void;
  toggleOutbreakMode: () => void;
  setDataSource: (source: DataSource) => void;
  setLoading: (loading: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setCompareDrawerOpen: (open: boolean) => void;
  openInspector: () => void;
  closeInspector: () => void;
  toggleCompareDrawer: () => void;
  clearAll: () => void;
}

type ExplorationContextType = ExplorationState & ExplorationActions;

const ExplorationContext = createContext<ExplorationContextType | null>(null);

const MAX_MOLECULES = 50;

export function ExplorationProvider({ children }: { children: ReactNode }) {
  const [molecules, setMoleculesState] = useState<ExplorationMolecule[]>([]);
  const [selectedMolecule, setSelectedMolecule] = useState<ExplorationMolecule | null>(null);
  const [comparedMolecules, setComparedMolecules] = useState<ExplorationMolecule[]>([]);
  const [visualMode, setVisualModeState] = useState<VisualMode>('galaxy');
  const [similarityEnabled, setSimilarityEnabled] = useState(false);
  const [outbreakMode, setOutbreakMode] = useState(false);
  const [dataSource, setDataSourceState] = useState<DataSource>('local');
  const [isLoading, setIsLoading] = useState(false);
  const [inspectorOpen, setInspectorOpenState] = useState(false);
  const [compareDrawerOpen, setCompareDrawerOpenState] = useState(false);

  const setMolecules = useCallback((mols: ExplorationMolecule[]) => {
    setMoleculesState(mols.slice(0, MAX_MOLECULES));
  }, []);

  const addMolecule = useCallback((mol: ExplorationMolecule) => {
    setMoleculesState(prev => {
      if (prev.length >= MAX_MOLECULES) return prev;
      if (prev.some(m => m.id === mol.id)) return prev;
      return [...prev, mol];
    });
  }, []);

  const addMolecules = useCallback((mols: ExplorationMolecule[]) => {
    setMoleculesState(prev => {
      const existing = new Set(prev.map(m => m.id));
      const newMols = mols.filter(m => !existing.has(m.id));
      const combined = [...prev, ...newMols];
      return combined.slice(0, MAX_MOLECULES);
    });
  }, []);

  const removeMolecule = useCallback((id: string) => {
    setMoleculesState(prev => prev.filter(m => m.id !== id));
    setSelectedMolecule(prev => prev?.id === id ? null : prev);
    setComparedMolecules(prev => prev.filter(m => m.id !== id));
  }, []);

  const selectMolecule = useCallback((mol: ExplorationMolecule | null) => {
    setSelectedMolecule(mol);
    if (mol) setInspectorOpenState(true);
  }, []);

  const addToCompare = useCallback((mol: ExplorationMolecule) => {
    setComparedMolecules(prev => {
      if (prev.some(m => m.id === mol.id)) return prev;
      if (prev.length >= 5) return prev; // max 5 for comparison
      return [...prev, mol];
    });
    setCompareDrawerOpenState(true);
  }, []);

  const removeFromCompare = useCallback((id: string) => {
    setComparedMolecules(prev => prev.filter(m => m.id !== id));
  }, []);

  const clearCompared = useCallback(() => {
    setComparedMolecules([]);
    setCompareDrawerOpenState(false);
  }, []);

  const setVisualMode = useCallback((mode: VisualMode) => {
    setVisualModeState(mode);
  }, []);

  const toggleSimilarity = useCallback(() => {
    setSimilarityEnabled(prev => !prev);
  }, []);

  const toggleOutbreakMode = useCallback(() => {
    setOutbreakMode(prev => !prev);
  }, []);

  const setDataSource = useCallback((source: DataSource) => {
    setDataSourceState(source);
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const setInspectorOpen = useCallback((open: boolean) => {
    setInspectorOpenState(open);
  }, []);

  const setCompareDrawerOpen = useCallback((open: boolean) => {
    setCompareDrawerOpenState(open);
  }, []);

  const openInspector = useCallback(() => {
    setInspectorOpenState(true);
  }, []);

  const closeInspector = useCallback(() => {
    setInspectorOpenState(false);
  }, []);

  const toggleCompareDrawer = useCallback(() => {
    setCompareDrawerOpenState(prev => !prev);
  }, []);

  const clearCompare = useCallback(() => {
    setComparedMolecules([]);
    setCompareDrawerOpenState(false);
  }, []);

  const clearAll = useCallback(() => {
    setMoleculesState([]);
    setSelectedMolecule(null);
    setComparedMolecules([]);
    setInspectorOpenState(false);
    setCompareDrawerOpenState(false);
  }, []);

  const value = useMemo<ExplorationContextType>(() => ({
    molecules,
    selectedMolecule,
    comparedMolecules,
    visualMode,
    similarityEnabled,
    outbreakMode,
    dataSource,
    isLoading,
    inspectorOpen,
    compareDrawerOpen,
    setMolecules,
    addMolecule,
    addMolecules,
    removeMolecule,
    selectMolecule,
    addToCompare,
    removeFromCompare,
    clearCompared,
    clearCompare,
    setVisualMode,
    toggleSimilarity,
    toggleOutbreakMode,
    setDataSource,
    setLoading,
    setInspectorOpen,
    setCompareDrawerOpen,
    openInspector,
    closeInspector,
    toggleCompareDrawer,
    clearAll,
  }), [
    molecules, selectedMolecule, comparedMolecules, visualMode,
    similarityEnabled, outbreakMode, dataSource, isLoading,
    inspectorOpen, compareDrawerOpen, setMolecules, addMolecule,
    addMolecules, removeMolecule, selectMolecule, addToCompare,
    removeFromCompare, clearCompared, clearCompare, setVisualMode, toggleSimilarity,
    toggleOutbreakMode, setDataSource, setLoading, setInspectorOpen,
    setCompareDrawerOpen, openInspector, closeInspector, toggleCompareDrawer, clearAll,
  ]);

  return (
    <ExplorationContext.Provider value={value}>
      {children}
    </ExplorationContext.Provider>
  );
}

export function useExploration() {
  const context = useContext(ExplorationContext);
  if (!context) {
    throw new Error('useExploration must be used within ExplorationProvider');
  }
  return context;
}

export default ExplorationContext;
