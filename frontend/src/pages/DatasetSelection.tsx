import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Database, Layers, TrendingUp, Atom, Shield, Beaker, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getDatasetSlice, getDatasetStats } from "@/lib/moleculeDataset";
import MoleculeSketch from "@/components/MoleculeSketch";
import DatasetAnalytics from "@/components/DatasetAnalytics";
import DiseaseAwarePanel from "@/components/DiseaseAwarePanel";
import { useGlobalExploration } from "@/context/GlobalExplorationContext";

const statIcons = [Database, Layers, TrendingUp, Shield, Beaker, Atom];

const DatasetSelection = () => {
  // Global state - sync selected dataset to context
  const { datasetMode, setDatasetMode, currentDataset, isLoadingDataset } = useGlobalExploration();

  // Local UI state
  const [molecules, setMolecules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getDatasetSlice(datasetMode)
      .then((rows) => {
        if (!active) return;
        setMolecules(rows);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load dataset");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [datasetMode]);

  const stats = useMemo(() => getDatasetStats(molecules), [molecules]);

  const statCards = [
    { label: "Molecules", value: stats.count.toLocaleString(), icon: Database },
    { label: "Features", value: stats.features.toString(), icon: Layers },
    { label: "Avg Score", value: stats.avgScore.toFixed(2), icon: TrendingUp },
    { label: "Lipinski Compliant", value: `${stats.lipinskiCompliant}`, icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-1">Dataset Selection</h2>
        <p className="text-muted-foreground text-sm">Choose a real candidate subset for exploration. Data is loaded from the cleaned production dataset.</p>
      </div>

      {/* Live sync notification */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/10 rounded-lg p-3">
        <Zap className="h-4 w-4 text-primary" />
        <span>Dataset selection controls the pipeline. Changes propagate to Simulation, Visualization, and Results.</span>
      </div>

      <Select value={datasetMode} onValueChange={(v) => setDatasetMode(v as any)}>
        <SelectTrigger className="w-full max-w-sm border-border shadow-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-border shadow-lg">
          <SelectItem value="small">Small Dataset (50 molecules)</SelectItem>
          <SelectItem value="benchmark">Benchmark Dataset (500 molecules)</SelectItem>
          <SelectItem value="full">Full Dataset (all molecules)</SelectItem>
        </SelectContent>
      </Select>

      {(loading || isLoadingDataset) && <p className="text-sm text-muted-foreground">Loading dataset...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Disease-Aware Mode Panel */}
      <DiseaseAwarePanel />

      {/* Dataset Analytics */}
      <DatasetAnalytics />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card-hover p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <p className="font-display text-3xl font-bold text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Disease breakdown */}
      <div className="glass-card p-5">
        <h3 className="font-display font-semibold text-foreground mb-3">Source Distribution</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.sourceBreakdown).map(([source, count]) => (
            <Badge key={source} variant="outline" className="border-primary/30 text-primary px-3 py-1.5 text-sm">
              {source}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">ID</TableHead>
                <TableHead className="text-muted-foreground">Structure</TableHead>
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">MW</TableHead>
                <TableHead className="text-muted-foreground">LogP</TableHead>
                <TableHead className="text-muted-foreground">Source</TableHead>
                <TableHead className="text-muted-foreground">Lipinski</TableHead>
                <TableHead className="text-muted-foreground">Drug Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(molecules || []).slice(0, 50).map((mol) => (
                <TableRow key={mol.molecule_id} className="border-border hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-sm text-primary">{mol.molecule_id}</TableCell>
                  <TableCell>
                    {/* lazy-render 2D sketch from PubChem (falls back to SmilesDrawer) */}
                    <div className="w-20 h-12">
                      <MoleculeSketch smiles={mol.smiles} name={mol.name} cid={(mol as any).cid} size={64} />
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground font-medium">{mol.name}</TableCell>
                  <TableCell className="text-muted-foreground">{mol.molecular_weight}</TableCell>
                  <TableCell className="text-muted-foreground">{mol.logP}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/20 text-xs">{mol.disease_target}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={mol.lipinski_compliant ? "text-success" : "text-destructive"}>
                      {mol.lipinski_compliant ? "✓" : "✗"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="score-bar w-16">
                        <div className="score-bar-fill" style={{ width: `${mol.drug_likeness_score * 100}%` }} />
                      </div>
                      <span className="text-sm text-foreground">{mol.drug_likeness_score.toFixed(2)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
};

export default DatasetSelection;
