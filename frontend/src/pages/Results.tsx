import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ChevronDown, Download, Atom, FlaskConical, FileText, Biohazard, AlertTriangle, Bug, Dna } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDataset } from "@/lib/moleculeDataset";
import { scoreMolecules, getTopCandidates, defaultWeights, type ScoredMolecule } from "@/lib/quantumEngine";
import { explainMolecule, generateOutbreakReport } from "@/lib/aiExplainer";
import MoleculeSketch from "@/components/MoleculeSketch";

const getProbBadgeClass = (p: number, total: number) => {
  const normalized = p * total;
  if (normalized >= 0.01) return "bg-success/20 text-success border-success/30";
  if (normalized >= 0.005) return "bg-primary/20 text-primary border-primary/30";
  return "bg-warning/20 text-warning border-warning/30";
};

const Results = () => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [modalCandidate, setModalCandidate] = useState<ScoredMolecule | null>(null);
  const [diseaseFilter, setDiseaseFilter] = useState("All");
  const [showReport, setShowReport] = useState(false);
  const [topN, setTopN] = useState(20);
  const [dataset, setDataset] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getDataset()
      .then((rows) => {
        if (!active) return;
        setDataset(rows);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load dataset");
      });

    return () => {
      active = false;
    };
  }, []);

  const scored = useMemo(() => {
    return scoreMolecules(dataset, defaultWeights, diseaseFilter);
  }, [dataset, diseaseFilter]);

  const topCandidates = useMemo(() => getTopCandidates(scored, topN), [scored, topN]);

  const explanation = useMemo(() => {
    if (!modalCandidate) return null;
    return explainMolecule(modalCandidate);
  }, [modalCandidate]);

  const report = useMemo(() => {
    if (!showReport || diseaseFilter === "All") return null;
    return generateOutbreakReport(diseaseFilter, topCandidates);
  }, [showReport, diseaseFilter, topCandidates]);

  const handleDownload = () => {
    const csv = [
      "rank,id,name,score,probability,disease,lipinski,mw,logP,toxicity,solubility",
      ...topCandidates.map((c) =>
        `${c.rank},${c.molecule_id},${c.name},${c.weighted_score},${c.probability},${c.disease_target},${c.lipinski_compliant},${c.molecular_weight},${c.logP},${c.toxicity_risk},${c.solubility}`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quantiva-results-${diseaseFilter.toLowerCase()}-real-data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-1">Ranking Results</h2>
          <p className="text-muted-foreground text-sm">Top drug candidates ranked by quantum-inspired scoring across {scored.length.toLocaleString()} molecules.</p>
        </div>
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        <div className="flex gap-3">
          <Select value={diseaseFilter} onValueChange={setDiseaseFilter}>
            <SelectTrigger className="w-36 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="All">All Sources</SelectItem>
              <SelectItem value="PubChem">PubChem</SelectItem>
              <SelectItem value="Delaney">Delaney</SelectItem>
            </SelectContent>
          </Select>
          {diseaseFilter !== "All" && (
            <Button variant="outline" className="border-border hover:bg-muted/50" onClick={() => setShowReport(!showReport)}>
              <FileText className="mr-2 h-4 w-4" />
              {showReport ? "Hide Report" : "AI Report"}
            </Button>
          )}
          <Button variant="outline" className="border-border hover:bg-muted/50" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>
      </div>

      {/* Outbreak Report */}
      {showReport && report && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-primary/20">
          <div className="prose prose-invert prose-sm max-w-none">
            {report.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h2 key={i} className="font-display text-xl font-bold text-foreground mt-0">{line.replace("## ", "")}</h2>;
              if (line.startsWith("### ")) return <h3 key={i} className="font-display text-lg font-semibold text-foreground">{line.replace("### ", "")}</h3>;
              if (line.match(/^\d\./)) return <p key={i} className="text-sm text-muted-foreground ml-4">{line}</p>;
              if (line.startsWith("- ")) return <p key={i} className="text-sm text-muted-foreground ml-4">{line}</p>;
              if (line.trim()) return <p key={i} className="text-sm text-muted-foreground">{line}</p>;
              return null;
            })}
          </div>
        </motion.div>
      )}

      {/* Results list */}
      <div className="space-y-3">
        {topCandidates.map((c, i) => (
          <motion.div
            key={c.molecule_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass-card-hover overflow-hidden"
          >
            <div
              className="p-5 flex items-center gap-4 cursor-pointer"
              onClick={() => setExpanded(expanded === c.rank ? null : c.rank)}
            >
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                <span className="font-display font-bold text-primary-foreground text-sm">#{c.rank}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-14 h-10">
                    <MoleculeSketch smiles={c.smiles} size={48} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-foreground">{c.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{c.molecule_id}</span>
                      <Badge variant="outline" className="border-primary/20 text-xs">{c.disease_target}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{c.formula} • MW: {c.molecular_weight}</p>
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <Badge variant="outline" className={getProbBadgeClass(c.probability, scored.length)}>
                  P: {(c.probability * 1000).toFixed(2)}‰
                </Badge>
                {c.lipinski_compliant ? (
                  <Badge variant="outline" className="border-success/30 text-success text-xs">Lipinski ✓</Badge>
                ) : (
                  <Badge variant="outline" className="border-destructive/30 text-destructive text-xs">Lipinski ✗</Badge>
                )}
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="font-display font-bold text-lg text-gradient">{c.weighted_score.toFixed(3)}</p>
                </div>
              </div>
              <div className="w-32 hidden md:block">
                <div className="score-bar">
                  <motion.div
                    className="score-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${c.weighted_score * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.05 }}
                  />
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expanded === c.rank ? "rotate-180" : ""}`} />
            </div>

            <AnimatePresence>
              {expanded === c.rank && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                      {[
                        { label: "Binding", value: c.score_breakdown.binding },
                        { label: "Safety", value: c.score_breakdown.toxicity },
                        { label: "Solubility", value: c.score_breakdown.solubility },
                        { label: "Lipinski", value: c.score_breakdown.lipinski },
                        { label: "MW Score", value: c.score_breakdown.mw },
                        { label: "LogP Score", value: c.score_breakdown.logP },
                      ].map((m) => (
                        <div key={m.label}>
                          <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                          <div className="score-bar">
                            <div className="score-bar-fill" style={{ width: `${m.value * 100}%` }} />
                          </div>
                          <p className="text-xs text-foreground mt-1">{m.value.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/10"
                      onClick={(e) => { e.stopPropagation(); setModalCandidate(c); }}
                    >
                      <FlaskConical className="mr-2 h-4 w-4" />
                      View Full Details & AI Explanation
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Molecule Detail Modal with AI Explainer */}
      <Dialog open={!!modalCandidate} onOpenChange={() => setModalCandidate(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Atom className="h-5 w-5 text-primary" />
              {modalCandidate?.name}
              {modalCandidate && (
                <Badge variant="outline" className="border-primary/20 text-xs ml-2">{modalCandidate.disease_target}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {modalCandidate && explanation && (
            <div className="space-y-5">
              {/* Structure preview */}
              <div className="h-32 rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden relative">
                <svg width="200" height="100" viewBox="0 0 200 100">
                  {[[30,50,70,25],[70,25,110,50],[110,50,70,75],[70,75,30,50],[110,50,150,25],[150,25,150,65],[150,65,110,50]].map(([x1,y1,x2,y2],i) => (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(186,100%,50%)" strokeWidth={2} strokeOpacity={0.6} />
                  ))}
                  {[[30,50],[70,25],[110,50],[70,75],[150,25],[150,65]].map(([cx,cy],i) => (
                    <circle key={i} cx={cx} cy={cy} r={7} fill="hsl(222,40%,10%)" stroke="hsl(186,100%,50%)" strokeWidth={1.5} />
                  ))}
                </svg>
                <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">{modalCandidate.formula}</span>
              </div>

              {/* AI Explanation */}
              <div className="glass-card p-4 border-primary/10">
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Atom className="h-4 w-4 text-primary" />
                  AI Drug-Likeness Assessment
                </h4>
                <p className="text-sm text-muted-foreground mb-3">{explanation.summary}</p>
              </div>

              {/* Descriptors */}
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Property</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { key: "Molecular Weight", value: `${modalCandidate.molecular_weight} Da` },
                    { key: "LogP", value: modalCandidate.logP.toString() },
                    { key: "H-Bond Donors", value: modalCandidate.h_bond_donors.toString() },
                    { key: "H-Bond Acceptors", value: modalCandidate.h_bond_acceptors.toString() },
                    { key: "Rotatable Bonds", value: modalCandidate.rotatable_bonds.toString() },
                    { key: "PSA", value: `${modalCandidate.polar_surface_area} Å²` },
                    { key: "Solubility", value: modalCandidate.solubility.toFixed(3) },
                    { key: "Toxicity Risk", value: modalCandidate.toxicity_risk.toFixed(3) },
                  ].map((d) => (
                    <TableRow key={d.key} className="border-border hover:bg-muted/20">
                      <TableCell className="text-sm text-foreground">{d.key}</TableCell>
                      <TableCell className="text-sm text-primary text-right font-mono">{d.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Lipinski */}
              <div>
                <h4 className="text-xs text-muted-foreground mb-2">Lipinski Rule of Five</h4>
                <div className="flex flex-wrap gap-2">
                  {explanation.lipinskiDetails.map((d, i) => (
                    <Badge key={i} variant="outline" className={`text-xs ${d.includes("✓") ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}`}>
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Score Breakdown</h4>
                {[
                  { label: "Overall", value: modalCandidate.weighted_score },
                  { label: "Binding", value: modalCandidate.score_breakdown.binding },
                  { label: "Safety", value: modalCandidate.score_breakdown.toxicity },
                  { label: "Solubility", value: modalCandidate.score_breakdown.solubility },
                  { label: "LogP", value: modalCandidate.score_breakdown.logP },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20">{s.label}</span>
                    <div className="score-bar flex-1"><div className="score-bar-fill" style={{ width: `${s.value * 100}%` }} /></div>
                    <span className="text-xs font-mono text-foreground w-10 text-right">{s.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Strengths & Risks */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-success mb-2">Strengths</h4>
                  <ul className="space-y-1">
                    {explanation.strengths.slice(0, 4).map((s, i) => (
                      <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-destructive mb-2">Risks</h4>
                  <ul className="space-y-1">
                    {explanation.risks.slice(0, 4).map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground">• {r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="glass-card p-3">
                <p className="text-xs text-muted-foreground mb-1">Verdict</p>
                <p className="text-sm text-foreground font-medium">{explanation.verdict}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Results;
