import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dna, Search, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';

const diseaseProfiles = {
  cancer: {
    label: 'Cancer',
    color: 'hsl(0, 84%, 60%)',
    description: 'Increased binding affinity weight for target inhibition',
  },
  infectious: {
    label: 'Infectious Disease',
    color: 'hsl(45, 93%, 47%)',
    description: 'Emphasized safety and toxicity evaluation',
  },
  cns: {
    label: 'CNS / Neurological',
    color: 'hsl(260, 60%, 55%)',
    description: 'Optimized LogP for blood-brain barrier penetration',
  },
  metabolic: {
    label: 'Metabolic',
    color: 'hsl(160, 84%, 40%)',
    description: 'Focus on solubility and oral bioavailability',
  },
  cardiovascular: {
    label: 'Cardiovascular',
    color: 'hsl(186, 100%, 50%)',
    description: 'Balanced safety and efficacy profile',
  },
  general: {
    label: 'General',
    color: 'hsl(215, 20%, 55%)',
    description: 'Standard drug-likeness optimization',
  },
};

export default function DiseaseAwarePanel() {
  const { 
    diseaseProfile, 
    setDiseaseProfile, 
    fetchDiseaseCompounds, 
    datasetMode, 
    setDatasetMode,
    isLoadingDataset,
    currentDataset,
  } = useGlobalExploration();
  const [keyword, setKeyword] = useState(diseaseProfile.keyword);
  const [isSearching, setIsSearching] = useState(false);

  // Count disease-specific molecules
  const diseaseCount = currentDataset.filter(m => 
    m.disease_target?.toLowerCase() === diseaseProfile.keyword?.toLowerCase() ||
    m.source_dataset === 'pubchem'
  ).length;

  const handleToggle = useCallback((enabled: boolean) => {
    setDiseaseProfile({ enabled });
    if (!enabled) {
      setDiseaseProfile({ keyword: '', category: 'general' });
    }
  }, [setDiseaseProfile]);

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) return;
    
    setIsSearching(true);
    setDiseaseProfile({ keyword, enabled: true });
    
    // Switch to hybrid mode to include PubChem results
    if (datasetMode === 'local') {
      setDatasetMode('hybrid');
    }
    
    await fetchDiseaseCompounds(keyword);
    setIsSearching(false);
  }, [keyword, setDiseaseProfile, fetchDiseaseCompounds, datasetMode, setDatasetMode]);

  const profileInfo = diseaseProfiles[diseaseProfile.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Dna className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Disease-Aware Mode</h3>
            <p className="text-xs text-muted-foreground">Adaptive scoring for disease targets</p>
          </div>
        </div>
        <Switch
          checked={diseaseProfile.enabled}
          onCheckedChange={handleToggle}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      <AnimatePresence>
        {diseaseProfile.enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-4"
          >
            {/* Search input */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter disease (e.g., Cancer, Malaria, Diabetes)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-card border-border"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || isLoadingDataset || !keyword.trim()}
                className="gradient-primary text-primary-foreground"
              >
                {isSearching || isLoadingDataset ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Active profile banner */}
            {diseaseProfile.keyword && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg p-3"
                style={{ backgroundColor: `${profileInfo.color}15`, borderLeft: `3px solid ${profileInfo.color}` }}
              >
                <div className="flex items-start gap-3">
                  <Check className="h-4 w-4 mt-0.5" style={{ color: profileInfo.color }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        Disease-aware optimization active: <span style={{ color: profileInfo.color }}>{profileInfo.label} profile</span>
                      </p>
                      {diseaseCount > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {diseaseCount} compounds fetched
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {profileInfo.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Weight adjustments preview */}
            {diseaseProfile.keyword && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-2">Auto-adjusted weights:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(diseaseProfile.weightAdjustments || {}).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key}: {((value as number) * 100).toFixed(0)}%
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Flow explanation */}
            {diseaseProfile.keyword && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20"
              >
                <p className="text-xs font-semibold text-primary mb-3">⚡ How Disease-Aware Ranking Works:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">1</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Weight Adjustment:</span> Scoring weights are tuned for {profileInfo.label.toLowerCase()} targets (e.g., higher binding affinity for cancer, better BBB penetration for CNS).
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">2</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Re-scoring:</span> All molecules are re-ranked using the weighted formula: <code className="bg-muted px-1 rounded text-[10px]">Σ(weight × property_score)</code>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">3</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Diffusion (optional):</span> If enabled, quantum walk smooths rankings based on molecular similarity graphs.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">4</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Result:</span> Top candidates optimized for <span className="text-primary font-medium">{diseaseProfile.keyword}</span> appear in Ranking Results and Visualization pages.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Disclaimer */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-warning/10 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <p>
                This is an <strong>exploratory scoring adaptation</strong> for educational purposes. 
                It does not provide medical advice or validated drug discovery predictions.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
