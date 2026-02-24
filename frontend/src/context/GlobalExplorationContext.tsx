import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Molecule, getDataset } from '@/lib/moleculeDataset';
import { scoreMolecules, ScoringWeights, ScoredMolecule, defaultWeights, quantumWalk } from '@/lib/quantumEngine';
import { fetchMoleculeByName } from '@/services/pubchemApi';
import pubchemApi from '@/services/pubchemApi';

// ============ TYPE DEFINITIONS ============

export type DatasetMode = 'local' | 'pubchem' | 'hybrid';
export type ScoringAlgorithm = 'quantum' | 'classical' | 'hybrid';

export interface ExplorationWeights {
  binding: number;
  toxicity: number;
  solubility: number;
  lipinski: number;
  mw: number;
  logp: number;
}

export interface ExplorationFilters {
  lipinskiOnly: boolean;
  toxicityThreshold: number;
  sourceFilter: string;
}

export interface SimulationMetadata {
  id: string;
  datasetName: string;
  timestamp: string;
  topScore: number;
  moleculeCount: number;
  algorithm: ScoringAlgorithm;
  diffusionEnabled: boolean;
  weights: ExplorationWeights;
  filters: ExplorationFilters;
  topMolecule: string | null;
}

export interface DiseaseProfile {
  enabled: boolean;
  keyword: string;
  category: 'cancer' | 'infectious' | 'cns' | 'metabolic' | 'cardiovascular' | 'general';
  weightAdjustments: Partial<ExplorationWeights>;
}

export interface DiversityMetrics {
  diversityScore: number;
  diversityLevel: 'High' | 'Medium' | 'Low';
  pcaVariance: { x: number; y: number; z: number };
  clusterEstimate: number;
  chemicalSpaceCoverage: number;
}

export interface GlobalExplorationState {
  // Dataset
  datasetMode: DatasetMode;
  rawDataset: Molecule[];
  currentDataset: Molecule[];
  isLoadingDataset: boolean;
  datasetError: string | null;

  // Scoring
  scoringAlgorithm: ScoringAlgorithm;
  weights: ExplorationWeights;
  filters: ExplorationFilters;
  diffusionEnabled: boolean;
  scoredResults: ScoredMolecule[];
  probabilityHistory: number[][];

  // Selection
  selectedMolecule: ScoredMolecule | null;
  compareMolecules: ScoredMolecule[];

  // Disease-aware mode
  diseaseProfile: DiseaseProfile;

  // Simulation metadata
  simulationMetadata: SimulationMetadata | null;
  simulationHistory: SimulationMetadata[];

  // Diversity metrics
  diversityMetrics: DiversityMetrics | null;

  // Actions
  setDatasetMode: (mode: DatasetMode) => void;
  setScoringAlgorithm: (algo: ScoringAlgorithm) => void;
  setWeights: (weights: Partial<ExplorationWeights>) => void;
  setFilters: (filters: Partial<ExplorationFilters>) => void;
  setDiffusionEnabled: (enabled: boolean) => void;
  selectMolecule: (mol: ScoredMolecule | null) => void;
  addToCompare: (mol: ScoredMolecule) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  setDiseaseProfile: (profile: Partial<DiseaseProfile>) => void;
  runSimulation: () => void;
  restoreSimulation: (id: string) => void;
  refreshDataset: () => Promise<void>;
  fetchDiseaseCompounds: (keyword: string) => Promise<void>;
}

// ============ DEFAULT VALUES ============

const defaultExplorationWeights: ExplorationWeights = {
  binding: 0.25,
  toxicity: 0.20,
  solubility: 0.15,
  lipinski: 0.15,
  mw: 0.10,
  logp: 0.15,
};

const defaultFilters: ExplorationFilters = {
  lipinskiOnly: false,
  toxicityThreshold: 1.0,
  sourceFilter: 'All',
};

const defaultDiseaseProfile: DiseaseProfile = {
  enabled: false,
  keyword: '',
  category: 'general',
  weightAdjustments: {},
};

// ============ DISEASE WEIGHT PROFILES ============

const diseaseWeightProfiles: Record<string, Partial<ExplorationWeights>> = {
  cancer: { binding: 0.35, toxicity: 0.15, solubility: 0.15, lipinski: 0.10, mw: 0.10, logp: 0.15 },
  infectious: { binding: 0.20, toxicity: 0.30, solubility: 0.20, lipinski: 0.10, mw: 0.10, logp: 0.10 },
  cns: { binding: 0.20, toxicity: 0.20, solubility: 0.10, lipinski: 0.15, mw: 0.10, logp: 0.25 },
  metabolic: { binding: 0.25, toxicity: 0.20, solubility: 0.20, lipinski: 0.15, mw: 0.10, logp: 0.10 },
  cardiovascular: { binding: 0.25, toxicity: 0.25, solubility: 0.15, lipinski: 0.15, mw: 0.10, logp: 0.10 },
  general: defaultExplorationWeights,
};

// ============ HELPER FUNCTIONS ============

function inferDiseaseCategory(keyword: string): DiseaseProfile['category'] {
  const lower = keyword.toLowerCase();
  if (/cancer|tumor|oncolog|leukemia|carcinoma/.test(lower)) return 'cancer';
  if (/malaria|bacteria|virus|infection|antibiotic|antiviral/.test(lower)) return 'infectious';
  if (/brain|neuro|cns|alzheimer|parkinson|depression|anxiety/.test(lower)) return 'cns';
  if (/diabetes|metabol|obesity|lipid/.test(lower)) return 'metabolic';
  if (/heart|cardio|hypertension|cholesterol/.test(lower)) return 'cardiovascular';
  return 'general';
}

function computeDiversityMetrics(molecules: Molecule[]): DiversityMetrics {
  if (!molecules.length) {
    return {
      diversityScore: 0,
      diversityLevel: 'Low',
      pcaVariance: { x: 0, y: 0, z: 0 },
      clusterEstimate: 0,
      chemicalSpaceCoverage: 0,
    };
  }

  // Compute PCA variance
  const xs = molecules.map(m => m.pca_x);
  const ys = molecules.map(m => m.pca_y);
  const zs = molecules.map(m => m.pca_z);

  const variance = (arr: number[]) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  };

  const varX = variance(xs);
  const varY = variance(ys);
  const varZ = variance(zs);

  // Total variance as diversity indicator
  const totalVariance = varX + varY + varZ;
  const maxExpectedVariance = 30; // Normalized scale
  const diversityScore = Math.min(1, totalVariance / maxExpectedVariance);

  // Estimate clusters using simple k-means-like heuristic
  const clusterEstimate = Math.max(1, Math.round(Math.sqrt(molecules.length / 5)));

  // Chemical space coverage (0-1)
  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);
  const zRange = Math.max(...zs) - Math.min(...zs);
  const volume = xRange * yRange * zRange;
  const chemicalSpaceCoverage = Math.min(1, volume / 1000);

  const diversityLevel = diversityScore >= 0.6 ? 'High' : diversityScore >= 0.3 ? 'Medium' : 'Low';

  return {
    diversityScore,
    diversityLevel,
    pcaVariance: { x: varX, y: varY, z: varZ },
    clusterEstimate,
    chemicalSpaceCoverage,
  };
}

function generateSimulationId(): string {
  return `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============ CONTEXT ============

const GlobalExplorationContext = createContext<GlobalExplorationState | null>(null);

export function useGlobalExploration(): GlobalExplorationState {
  const ctx = useContext(GlobalExplorationContext);
  if (!ctx) {
    throw new Error('useGlobalExploration must be used within GlobalExplorationProvider');
  }
  return ctx;
}

// ============ PROVIDER ============

interface ProviderProps {
  children: ReactNode;
}

export function GlobalExplorationProvider({ children }: ProviderProps) {
  // Dataset state
  const [datasetMode, setDatasetMode] = useState<DatasetMode>('local');
  const [rawDataset, setRawDataset] = useState<Molecule[]>([]);
  const [pubchemMolecules, setPubchemMolecules] = useState<Molecule[]>([]);
  const [isLoadingDataset, setIsLoadingDataset] = useState(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  // Scoring state
  const [scoringAlgorithm, setScoringAlgorithm] = useState<ScoringAlgorithm>('quantum');
  const [weights, setWeightsState] = useState<ExplorationWeights>(defaultExplorationWeights);
  const [filters, setFiltersState] = useState<ExplorationFilters>(defaultFilters);
  const [diffusionEnabled, setDiffusionEnabled] = useState(true);

  // Selection state
  const [selectedMolecule, setSelectedMolecule] = useState<ScoredMolecule | null>(null);
  const [compareMolecules, setCompareMolecules] = useState<ScoredMolecule[]>([]);

  // Disease-aware state
  const [diseaseProfile, setDiseaseProfileState] = useState<DiseaseProfile>(defaultDiseaseProfile);

  // Simulation history
  const [simulationHistory, setSimulationHistory] = useState<SimulationMetadata[]>([]);

  // ============ DERIVED STATE ============

  // Current dataset based on mode
  const currentDataset = useMemo(() => {
    switch (datasetMode) {
      case 'local':
        return rawDataset;
      case 'pubchem':
        return pubchemMolecules;
      case 'hybrid':
        // Dedupe by molecule_id
        const combined = new Map<string, Molecule>();
        rawDataset.forEach(m => combined.set(m.molecule_id, m));
        pubchemMolecules.forEach(m => combined.set(m.molecule_id, m));
        return Array.from(combined.values());
      default:
        return rawDataset;
    }
  }, [datasetMode, rawDataset, pubchemMolecules]);

  // Effective weights (with disease adjustments)
  const effectiveWeights = useMemo((): ExplorationWeights => {
    if (!diseaseProfile.enabled) return weights;
    const profile = diseaseWeightProfiles[diseaseProfile.category] || diseaseWeightProfiles.general;
    return { ...weights, ...profile, ...diseaseProfile.weightAdjustments };
  }, [weights, diseaseProfile]);

  // Convert to scoring engine weights
  const scoringEngineWeights = useMemo((): ScoringWeights => ({
    bindingAffinity: effectiveWeights.binding,
    toxicity: effectiveWeights.toxicity,
    solubility: effectiveWeights.solubility,
    lipinski: effectiveWeights.lipinski,
    molecularWeight: effectiveWeights.mw,
    logP: effectiveWeights.logp,
  }), [effectiveWeights]);

  // Scored results (auto-computed when dependencies change)
  const scoredResults = useMemo(() => {
    if (!currentDataset.length) return [];

    let filtered = currentDataset;

    // Apply filters
    if (filters.lipinskiOnly) {
      filtered = filtered.filter(m => m.lipinski_compliant === 1);
    }
    if (filters.toxicityThreshold < 1) {
      filtered = filtered.filter(m => m.toxicity_risk <= filters.toxicityThreshold);
    }
    if (filters.sourceFilter && filters.sourceFilter !== 'All') {
      filtered = filtered.filter(m => m.disease_target === filters.sourceFilter);
    }

    return scoreMolecules(filtered, scoringEngineWeights);
  }, [currentDataset, filters, scoringEngineWeights]);

  // Probability history (quantum walk)
  const probabilityHistory = useMemo(() => {
    if (!diffusionEnabled || scoredResults.length < 2) return [];
    return quantumWalk(scoredResults, 10, 0.3);
  }, [scoredResults, diffusionEnabled]);

  // Diversity metrics
  const diversityMetrics = useMemo(() => {
    return computeDiversityMetrics(currentDataset);
  }, [currentDataset]);

  // Current simulation metadata
  const simulationMetadata = useMemo((): SimulationMetadata | null => {
    if (!scoredResults.length) return null;
    return {
      id: generateSimulationId(),
      datasetName: datasetMode === 'local' ? 'Local Dataset' : datasetMode === 'pubchem' ? 'PubChem' : 'Hybrid',
      timestamp: new Date().toISOString(),
      topScore: scoredResults[0]?.weighted_score || 0,
      moleculeCount: scoredResults.length,
      algorithm: scoringAlgorithm,
      diffusionEnabled,
      weights: { ...effectiveWeights },
      filters: { ...filters },
      topMolecule: scoredResults[0]?.name || null,
    };
  }, [scoredResults, datasetMode, scoringAlgorithm, diffusionEnabled, effectiveWeights, filters]);

  // ============ ACTIONS ============

  const refreshDataset = useCallback(async () => {
    setIsLoadingDataset(true);
    setDatasetError(null);
    try {
      const data = await getDataset();
      setRawDataset(data);
    } catch (err) {
      setDatasetError(err instanceof Error ? err.message : 'Failed to load dataset');
    } finally {
      setIsLoadingDataset(false);
    }
  }, []);

  const fetchDiseaseCompounds = useCallback(async (keyword: string) => {
    if (!keyword.trim()) return;
    
    setIsLoadingDataset(true);
    setDatasetError(null);
    
    try {
      // Use the backend's disease-search API endpoint
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiBase}/api/disease-search?query=${encodeURIComponent(keyword)}`);
      
      if (!response.ok) {
        throw new Error(`Disease search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const items = data.items || [];
      
      if (items.length > 0) {
        console.log(`✅ Fetched ${items.length} compounds for "${keyword}" from ${data.source}`);
        
        // Transform API response to Molecule format
        const molecules: Molecule[] = items.map((r: any, i: number) => ({
          molecule_id: `disease_${r.id || r.cid || i}`,
          name: r.name || `Compound ${i + 1}`,
          smiles: r.smiles || '',
          source_dataset: data.source || 'pubchem',
          formula: r.formula || '',
          molecular_weight: Number(r.molecular_weight) || 0,
          logP: Number(r.logP) || 0,
          h_bond_donors: Number(r.h_donors) || 0,
          h_bond_acceptors: Number(r.h_acceptors) || 0,
          rotatable_bonds: 0,
          polar_surface_area: Number(r.tpsa) || 0,
          solubility: 0.5,
          toxicity_risk: 0.2,
          efficacy_index: Number(r.efficacy_index) || 0.5,
          safety_index: Number(r.safety_index) || 0.5,
          molecular_complexity: Number(r.molecular_complexity) || 0.3,
          drug_score: Number(r.weighted_score) || 0.5,
          lipinski_compliant: 1,
          disease_target: keyword,
          drug_likeness_score: Number(r.weighted_score) || 0.5,
          pca_x: (Math.random() - 0.5) * 10,
          pca_y: (Math.random() - 0.5) * 10,
          pca_z: (Math.random() - 0.5) * 10,
        }));
        
        setPubchemMolecules(molecules);
        setDatasetMode('hybrid');
      } else {
        console.warn(`No compounds found for "${keyword}"`);
      }
    } catch (err) {
      console.warn('Failed to fetch disease compounds:', err);
      setDatasetError(err instanceof Error ? err.message : 'Failed to fetch disease data');
      
      // Fallback: try fetching by molecule name
      try {
        const seedMolecule = await fetchMoleculeByName(keyword);
        if (seedMolecule && seedMolecule.cid) {
          const similar = await pubchemApi.getSimilarCompounds(String(seedMolecule.cid), 50);
          const allResults = [seedMolecule, ...similar];
          
          const molecules: Molecule[] = allResults.slice(0, 50).map((r: any, i: number) => ({
            molecule_id: `pubchem_${r.cid || r.CID || r.id || i}`,
            name: r.name || r.Title || `Compound ${i + 1}`,
            smiles: r.smiles || r.CanonicalSMILES || '',
            source_dataset: 'pubchem',
            formula: r.formula || r.MolecularFormula || '',
            molecular_weight: Number(r.molecularWeight || r.MolecularWeight || r.molecular_weight) || 0,
            logP: Number(r.logP || r.XLogP) || 0,
            h_bond_donors: Number(r.hBondDonors || r.HBondDonorCount) || 0,
            h_bond_acceptors: Number(r.hBondAcceptors || r.HBondAcceptorCount) || 0,
            rotatable_bonds: Number(r.RotatableBondCount) || 0,
            polar_surface_area: Number(r.TPSA) || 0,
            solubility: 0.5,
            toxicity_risk: 0.2,
            efficacy_index: 0.5,
            safety_index: 0.5,
            molecular_complexity: 0.3,
            drug_score: 0.5,
            lipinski_compliant: 1,
            disease_target: keyword,
            drug_likeness_score: 0.5,
            pca_x: (Math.random() - 0.5) * 10,
            pca_y: (Math.random() - 0.5) * 10,
            pca_z: (Math.random() - 0.5) * 10,
          }));
          setPubchemMolecules(molecules);
        }
      } catch (fallbackErr) {
        console.warn('Fallback search also failed:', fallbackErr);
      }
    } finally {
      setIsLoadingDataset(false);
    }
  }, [setDatasetMode]);

  const setWeights = useCallback((newWeights: Partial<ExplorationWeights>) => {
    setWeightsState(prev => ({ ...prev, ...newWeights }));
  }, []);

  const setFilters = useCallback((newFilters: Partial<ExplorationFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const selectMolecule = useCallback((mol: ScoredMolecule | null) => {
    setSelectedMolecule(mol);
  }, []);

  const addToCompare = useCallback((mol: ScoredMolecule) => {
    setCompareMolecules(prev => {
      if (prev.length >= 4) return prev;
      if (prev.some(m => m.molecule_id === mol.molecule_id)) return prev;
      return [...prev, mol];
    });
  }, []);

  const removeFromCompare = useCallback((id: string) => {
    setCompareMolecules(prev => prev.filter(m => m.molecule_id !== id));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareMolecules([]);
  }, []);

  const setDiseaseProfile = useCallback((profile: Partial<DiseaseProfile>) => {
    setDiseaseProfileState(prev => {
      const updated = { ...prev, ...profile };
      if (profile.keyword && profile.enabled) {
        updated.category = inferDiseaseCategory(profile.keyword);
        updated.weightAdjustments = diseaseWeightProfiles[updated.category] || {};
      }
      return updated;
    });
  }, []);

  const runSimulation = useCallback(() => {
    if (!simulationMetadata) return;
    
    // Save to history (keep last 3)
    setSimulationHistory(prev => {
      const newHistory = [simulationMetadata, ...prev].slice(0, 3);
      return newHistory;
    });
  }, [simulationMetadata]);

  const restoreSimulation = useCallback((id: string) => {
    const sim = simulationHistory.find(s => s.id === id);
    if (!sim) return;

    setWeightsState({
      binding: sim.weights.binding,
      toxicity: sim.weights.toxicity,
      solubility: sim.weights.solubility,
      lipinski: sim.weights.lipinski,
      mw: sim.weights.mw,
      logp: sim.weights.logp,
    });
    setFiltersState(sim.filters);
    setDiffusionEnabled(sim.diffusionEnabled);
    setScoringAlgorithm(sim.algorithm);
  }, [simulationHistory]);

  // ============ EFFECTS ============

  // Load initial dataset
  useEffect(() => {
    refreshDataset();
  }, [refreshDataset]);

  // Fetch disease compounds when disease mode enabled
  useEffect(() => {
    if (diseaseProfile.enabled && diseaseProfile.keyword) {
      fetchDiseaseCompounds(diseaseProfile.keyword);
    }
  }, [diseaseProfile.enabled, diseaseProfile.keyword, fetchDiseaseCompounds]);

  // ============ CONTEXT VALUE ============

  const contextValue: GlobalExplorationState = {
    datasetMode,
    rawDataset,
    currentDataset,
    isLoadingDataset,
    datasetError,
    scoringAlgorithm,
    weights: effectiveWeights,
    filters,
    diffusionEnabled,
    scoredResults,
    probabilityHistory,
    selectedMolecule,
    compareMolecules,
    diseaseProfile,
    simulationMetadata,
    simulationHistory,
    diversityMetrics,
    setDatasetMode,
    setScoringAlgorithm,
    setWeights,
    setFilters,
    setDiffusionEnabled,
    selectMolecule,
    addToCompare,
    removeFromCompare,
    clearCompare,
    setDiseaseProfile,
    runSimulation,
    restoreSimulation,
    refreshDataset,
    fetchDiseaseCompounds,
  };

  return (
    <GlobalExplorationContext.Provider value={contextValue}>
      {children}
    </GlobalExplorationContext.Provider>
  );
}
