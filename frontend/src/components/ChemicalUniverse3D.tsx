import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Text, Line } from "@react-three/drei";
import * as THREE from "three";
import type { ScoredMolecule } from "@/lib/quantumEngine";
import MoleculeSketch from "@/components/MoleculeSketch";
import {
  getProbabilityColor,
  getDrugLikenessSize,
  getGlowIntensity,
  getClusterColor,
  isLipinskiCompliant,
  getToxicityLevel,
  buildClusterEdges,
  PerformanceMonitor,
} from "@/lib/visualization3dUtils";
import ClusterPanel from "./exploration/ClusterPanel";
import ClusterDetailsModal from "./exploration/ClusterDetailsModal";
import LegendOverlay from "./exploration/LegendPanel";

interface ChemicalUniverse3DProps {
  molecules: ScoredMolecule[];
  onSelectMolecule: (mol: ScoredMolecule) => void;
  selectedMoleculeId: string | null;
  attractorIds?: string[];
  outbreak?: boolean;
  educationMode?: boolean;
  /** When set, camera auto-focuses to this target on mount */
  autoFocusTarget?: { x: number; y: number; z: number } | null;
  /** Label to display over the auto-focus region */
  autoFocusLabel?: string;
  /** Molecule IDs to render with outlier pulsing effect */
  outlierIds?: string[];
  /** Optional callback when a cluster is selected (clusterId, summary) */
  onClusterSelect?: (clusterId: number, summary: any) => void;
}

interface LayerVisibilityState {
  probabilityColoring: boolean;
  clusterHighlight: boolean;
  lipinskiOverlay: boolean;
  toxicityOverlay: boolean;
  diffusionAnimation: boolean;
}

/**
 * Assign cluster IDs based on spatial proximity (simple k-means-like clustering)
 */
function assignClusterIds(points: [number, number, number][], numClusters: number = 5): number[] {
  // K-Means clustering on 3D PCA coordinates (simple, lightweight)
  const n = points.length;
  const clusterIds = new Array(n).fill(0);
  if (n === 0) return clusterIds;

  const k = Math.max(1, Math.min(numClusters, n));

  // Initialize centroids by sampling k points evenly across the dataset
  const centroids: [number, number, number][] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i * n) / k);
    centroids.push([...points[idx]] as [number, number, number]);
  }

  const maxIter = 12;
  const tmpCounts = new Array(k).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    // assignment step
    let moved = false;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const cd = centroids[c];
        const dx = p[0] - cd[0];
        const dy = p[1] - cd[1];
        const dz = p[2] - cd[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestDist) {
          bestDist = d2;
          best = c;
        }
      }
      if (clusterIds[i] !== best) {
        moved = true;
        clusterIds[i] = best;
      }
    }

    // update step
    const sums: [number, number, number][] = new Array(k).fill(0).map(() => [0, 0, 0]);
    tmpCounts.fill(0);
    for (let i = 0; i < n; i++) {
      const c = clusterIds[i];
      sums[c][0] += points[i][0];
      sums[c][1] += points[i][1];
      sums[c][2] += points[i][2];
      tmpCounts[c]++;
    }
    for (let c = 0; c < k; c++) {
      if (tmpCounts[c] > 0) {
        centroids[c][0] = sums[c][0] / tmpCounts[c];
        centroids[c][1] = sums[c][1] / tmpCounts[c];
        centroids[c][2] = sums[c][2] / tmpCounts[c];
      } else {
        // Re-seed empty centroid to a random point to avoid empties
        const rnd = Math.floor(Math.random() * n);
        centroids[c] = [...points[rnd]] as [number, number, number];
      }
    }

    if (!moved) break;
  }

  return clusterIds;
}


/**
 * Tooltip component that follows the mouse
 */
function MoleculeTooltip({
  molecule,
  screenPosition,
}: {
  molecule: ScoredMolecule | null;
  screenPosition: { x: number; y: number };
}) {
  if (!molecule) return null;
  
  const lipinskiCompliant = isLipinskiCompliant(molecule);
  const toxicityLevel = getToxicityLevel(molecule.toxicity_risk);
  
  // Render tooltip into document.body to avoid clipping by transformed/overflow parents.
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [positionStyle, setPositionStyle] = useState<{ left: number; top: number; transform: string }>({
    left: screenPosition.x,
    top: screenPosition.y,
    transform: "translate(-50%, -100%)",
  });

  useEffect(() => {
    // compute placement after DOM render
    const el = tooltipRef.current;
    if (!el) {
      setPositionStyle((s) => ({ ...s, left: screenPosition.x, top: screenPosition.y }));
      return;
    }

    const rect = el.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // Clamp horizontal center so it doesn't overflow
    let left = screenPosition.x;
    const halfW = rect.width / 2;
    if (left < halfW + 8) left = halfW + 8;
    if (left > winW - halfW - 8) left = winW - halfW - 8;

    // Prefer above the cursor; if not enough space, put below
    let top = screenPosition.y - 12;
    let transform = "translate(-50%, -100%)";
    if (screenPosition.y - rect.height - 16 <= 0) {
      // not enough space above — show below
      top = screenPosition.y + 12;
      transform = "translate(-50%, 0)";
    }

    setPositionStyle({ left, top, transform });
  }, [screenPosition.x, screenPosition.y, molecule]);

  const node = (
    <div
      ref={tooltipRef}
      className="fixed pointer-events-none z-50 bg-white/95 border border-blue-300 p-4 min-w-[280px] text-xs shadow-xl rounded-lg backdrop-blur-sm"
      style={{
        left: `${positionStyle.left}px`,
        top: `${positionStyle.top}px`,
        transform: positionStyle.transform,
        animation: "fadeIn 0.12s ease-out",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-20 h-16 flex-shrink-0">
          <MoleculeSketch
            smiles={molecule.smiles}
            name={molecule.name}
            cid={(molecule as any).cid}
            size={64}
          />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 truncate">{molecule.name}</p>
          <p className="text-slate-600 text-xs">{molecule.molecule_id}</p>
          
          <div className="mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Score:</span>
              <span className="text-blue-700 font-semibold">
                {(molecule as any).weighted_score?.toFixed(3) ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Probability:</span>
              <span className="text-blue-600 font-semibold">
                {(molecule.probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">MW:</span>
              <span className="text-slate-700">{molecule.molecular_weight?.toFixed(0) ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">LogP:</span>
              <span className="text-slate-700">{molecule.logP?.toFixed(2) ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Drug-likeness:</span>
              <span className="text-green-700 font-semibold">
                {(molecule.drug_likeness_score ?? 0).toFixed(3)}
              </span>
            </div>
            
            <div className="flex justify-between text-xs pt-1 border-t border-blue-200">
              <span className={getToxicityBadgeClass(toxicityLevel)}>
                Toxicity: {toxicityLevel}
              </span>
              <span
                className={
                  lipinskiCompliant
                    ? "text-green-700 font-semibold"
                    : "text-yellow-700 font-semibold"
                }
              >
                Lipinski: {lipinskiCompliant ? "✓" : "✗"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function getToxicityBadgeClass(level: string): string {
  switch (level) {
    case "safe":
      return "text-green-700 font-semibold";
    case "moderate":
      return "text-yellow-700 font-semibold";
    case "high":
      return "text-red-700 font-semibold";
    default:
      return "text-slate-700";
  }
}

/**
 * Layers control panel
 */
function LayersPanel({
  visibility,
  onToggle,
  moleculeCount,
}: {
  visibility: LayerVisibilityState;
  onToggle: (key: keyof LayerVisibilityState) => void;
  moleculeCount: number;
}) {
  const isLargDataset = moleculeCount > 1000;
  
  return (
    <div className="absolute top-4 right-4 bg-white/95 border border-blue-300 rounded-lg p-3 text-xs space-y-2 z-40 min-w-[200px] shadow-lg">
      <p className="text-blue-700 font-semibold mb-2">Visualization Layers</p>
      
      <label className="flex items-center gap-2 cursor-pointer hover:text-blue-700 transition text-slate-700">
        <input
          type="checkbox"
          checked={visibility.probabilityColoring}
          onChange={() => onToggle("probabilityColoring")}
          className="w-3 h-3"
        />
        <span>🎨 Probability Coloring</span>
      </label>
      
      <label className="flex items-center gap-2 cursor-pointer hover:text-blue-700 transition text-slate-700">
        <input
          type="checkbox"
          checked={visibility.clusterHighlight}
          onChange={() => onToggle("clusterHighlight")}
          className="w-3 h-3"
        />
        <span>🌈 Cluster Highlight</span>
      </label>
      
      <label className="flex items-center gap-2 cursor-pointer hover:text-blue-700 transition text-slate-700">
        <input
          type="checkbox"
          checked={visibility.lipinskiOverlay}
          onChange={() => onToggle("lipinskiOverlay")}
          className="w-3 h-3"
        />
        <span>☑ Lipinski Overlay</span>
      </label>
      
      <label className="flex items-center gap-2 cursor-pointer hover:text-blue-700 transition text-slate-700">
        <input
          type="checkbox"
          checked={visibility.toxicityOverlay}
          onChange={() => onToggle("toxicityOverlay")}
          className="w-3 h-3"
        />
        <span>🔴 Toxicity Outline</span>
      </label>
      
      <label className="flex items-center gap-2 cursor-pointer hover:text-blue-700 transition text-slate-700" style={{opacity: isLargDataset ? '0.5' : '1', cursor: isLargDataset ? 'not-allowed' : 'pointer'}}>
        <input
          type="checkbox"
          checked={visibility.diffusionAnimation}
          onChange={() => onToggle("diffusionAnimation")}
          disabled={isLargDataset}
          className="w-3 h-3"
        />
        <span>✨ Diffusion Edges {isLargDataset && "(disabled)"}</span>
      </label>
      
      <div className="text-xs text-muted-foreground pt-2 border-t border-glass-border">
        {moleculeCount} molecules
      </div>
    </div>
  );
}

/**
 * Legend panel showing color and size encoding
 */
function LegendPanel({
  visibility,
}: {
  visibility: LayerVisibilityState;
}) {
  return (
    <div className="absolute bottom-4 left-4 bg-white/95 border-2 border-blue-400 rounded-lg p-3 text-xs space-y-3 z-40 min-w-[240px] shadow-lg">
      <p className="text-blue-600 font-bold">✨ Visual Encoding</p>
      
      <div className={`${visibility.probabilityColoring ? '' : 'opacity-40 grayscale'} `}>
        <p className="text-blue-700 mb-1">🎨 Color → Probability (Vibrant!)</p>
        <div className="flex gap-1 h-4 rounded overflow-hidden border border-blue-300">
          <div className="flex-1 bg-blue-600"></div>
          <div className="flex-1 bg-cyan-500"></div>
          <div className="flex-1 bg-lime-500"></div>
          <div className="flex-1 bg-yellow-400"></div>
          <div className="flex-1 bg-red-600"></div>
        </div>
        <div className="flex justify-between text-xs text-blue-700 mt-1">
          <span>Low Prob</span>
          <span>High Prob</span>
        </div>
      </div>
      
      <div className={`${visibility.clusterHighlight ? '' : 'opacity-40 grayscale'}`}>
        <p className="text-blue-700 mb-1">🌈 Color → Cluster Assignment</p>
        <div className="grid grid-cols-5 gap-1">
          <div className="w-6 h-6 rounded bg-pink-500 border border-pink-400"></div>
          <div className="w-6 h-6 rounded bg-orange-500 border border-orange-400"></div>
          <div className="w-6 h-6 rounded bg-yellow-400 border border-yellow-300"></div>
          <div className="w-6 h-6 rounded bg-green-500 border border-green-400"></div>
          <div className="w-6 h-6 rounded bg-cyan-500 border border-cyan-400"></div>
        </div>
        <p className="text-xs text-blue-600 mt-1">10 distinct cluster colors</p>
      </div>
      
      <div>
        <p className="text-blue-700 mb-1">📏 Size → Drug-likeness</p>
        <div className="flex gap-2 items-center">
          <div className="w-2 h-2 rounded-full bg-orange-400 border border-orange-300"></div>
          <span className="text-blue-700 text-xs">Low</span>
          <div className="w-5 h-5 rounded-full bg-green-500 border border-green-400"></div>
          <span className="text-blue-700 text-xs">High</span>
        </div>
      </div>
      
      <div className="pt-2 border-t-2 border-blue-300 space-y-1">
        <p className="text-blue-700 flex items-center gap-1 font-semibold">
          <span className="inline-block w-3 h-3 rounded-full bg-lime-400 shadow-lg animate-pulse"></span>
          Top 5 (Glowing)
        </p>
        <p className="text-green-700 flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-green-600"></span>
          Lipinski: ✓
        </p>
        <p className="text-red-600 flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-red-600"></span>
          High Toxicity
        </p>
      </div>
    </div>
  );
}

/**
 * Axis labels component
 */
function AxisLabels() {
  return (
    <>
      {/* X axis label */}
      <Text position={[5, -5, 0]} fontSize={0.4} color="#1e40af" anchorX="center">
        PCA1
      </Text>
      
      {/* Y axis label */}
      <Text position={[0, 5, 0]} fontSize={0.4} color="#166534" anchorX="center">
        PCA2
      </Text>
      
      {/* Z axis label */}
      <Text position={[0, -5, 5]} fontSize={0.4} color="#ffb74d" anchorX="center">
        PCA3
      </Text>
    </>
  );
}

/**
 * Enhanced instanced points with visual encodings
 */
interface EnhancedInstancedPointsProps {
  molecules: ScoredMolecule[];
  points: [number, number, number][];
  selectedMoleculeId: string | null;
  attractorIds?: string[];
  outlierIds?: string[];
  onSelect: (mol: ScoredMolecule) => void;
  onHover: (idx: number | null) => void;
  visibility: LayerVisibilityState;
  educationMode?: boolean;
  clusterEdges: [number, number][];
  clusterIds?: number[];
  onClusterClick?: (cid: number) => void;
}

function EnhancedInstancedPoints(props: EnhancedInstancedPointsProps) {
  const {
    molecules,
    points,
    selectedMoleculeId,
    attractorIds,
    outlierIds,
    onSelect,
    onHover,
    visibility,
    educationMode,
    clusterEdges,
    clusterIds,
    onClusterClick,
  } = props;
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const glowMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const lipinskiMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const toxicityMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const colorAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const colorBufferRef = useRef<Float32Array | null>(null);
  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const tempVec = useMemo(() => new THREE.Vector3(), []);
  const colorsApplied = useRef(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const performanceMonitor = useMemo(() => new PerformanceMonitor(), []);
  const [shouldUseGlow, setShouldUseGlow] = useState(true);

  // Pre-compute color and size arrays
  const { colorArray, sizeArray } = useMemo(() => {
    const colors = new Float32Array(molecules.length * 3);
    const sizes = new Float32Array(molecules.length);

    const clusters = clusterIds ?? assignClusterIds(points, 10);

    for (let i = 0; i < molecules.length; i++) {
      const mol = molecules[i];
      
      // Color encoding: cluster-based takes precedence, then probability
      let color: THREE.Color;
      if (visibility.clusterHighlight) {
        // Use vibrant cluster colors
        color = getClusterColor(clusters[i]);
      } else if (visibility.probabilityColoring) {
        color = getProbabilityColor(mol.probability ?? 0);
      } else {
        // Fallback: vibrant color by rank (top molecules brightest)
        const rankRatio = Math.max(0.1, 1 - (mol.rank / molecules.length));
        // Create vibrant HSL colors
        const hue = (rankRatio * 360 + 200) % 360; // Hue shifts with rank
        const saturation = 90 + rankRatio * 10;     // Very saturated
        const lightness = 50 + rankRatio * 30;      // Varies with rank
        color = new THREE.Color().setHSL(hue / 360, saturation / 100, lightness / 100);
      }

      // Size encoding: drug-likeness score
      const size = getDrugLikenessSize(mol.drug_likeness_score ?? 0.5);

      colors[i * 3 + 0] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = size;
    }

    return {
      colorArray: colors,
      sizeArray: sizes,
    };
  }, [molecules, visibility.probabilityColoring, visibility.clusterHighlight, points]);

  useEffect(() => {
    // Mark that colors must be re-applied and reset the backing buffer
    colorsApplied.current = false;
    colorBufferRef.current = null;
    colorAttrRef.current = null;
  }, [colorArray]);

  // When hoveredIndex or selection changes, update the instance color buffer to brighten the hovered item
  useEffect(() => {
    if (!meshRef.current) return;
    // If color attribute hasn't been created yet, skip until created in frame
    if (!colorAttrRef.current || !colorBufferRef.current) return;

    // Reset buffer to base colors
    const base = colorArray;
    const buf = colorBufferRef.current!;
    buf.set(base);

    // Brighten hovered index for visibility
    const brighten = (idx: number | null, factor = 1.8) => {
      if (idx === null || idx < 0 || idx >= molecules.length) return;
      const i3 = idx * 3;
      // Read base color
      let r = base[i3 + 0];
      let g = base[i3 + 1];
      let b = base[i3 + 2];
      // Increase intensity while clamping
      r = Math.min(1, r * factor);
      g = Math.min(1, g * factor);
      b = Math.min(1, b * factor);
      buf[i3 + 0] = r;
      buf[i3 + 1] = g;
      buf[i3 + 2] = b;
    };

    brighten(hoveredIndex, 1.9);

    // Apply update
    colorAttrRef.current.array = buf as any;
    colorAttrRef.current.needsUpdate = true;
  }, [hoveredIndex, selectedMoleculeId, colorArray, molecules.length]);

  // Main animation loop
  useFrame((state) => {
    if (!meshRef.current) return;

    // Performance monitoring
    const fps = performanceMonitor.update();
    const lowPerformance = fps < 40;
    // Always show glow for selected molecule
    setShouldUseGlow(!lowPerformance);

    // Apply colors
    if (!colorsApplied.current) {
      // Create a mutable copy of the color buffer so we can highlight on hover
      const buf = colorArray.slice(0);
      colorBufferRef.current = buf;
      const attr = new THREE.InstancedBufferAttribute(buf, 3);
      // Ensure usage is dynamic for updates
      try { attr.setUsage(THREE.DynamicDrawUsage); } catch (e) { /* older three versions ignore */ }

      // Attach to geometry explicitly — set both instanceColor and color for broad compatibility
      if (meshRef.current && meshRef.current.geometry) {
        try {
          meshRef.current.geometry.setAttribute('instanceColor', attr);
          // Also set 'color' attribute for shader compatibility
          meshRef.current.geometry.setAttribute('color', attr);
          // Ensure geometry attribute map is updated
          (meshRef.current.geometry as any).attributes.instanceColor = attr;
          (meshRef.current.geometry as any).attributes.color = attr;
        } catch (e) {
          // ignore if geometry doesn't accept attributes
        }
      }

      // Also set mesh.instanceColor for React-Three-Fiber / three compatibility
      try {
        (meshRef.current as any).instanceColor = attr;
        // some three versions expect meshRef.current.geometry.attributes.color to be set
        if (meshRef.current && meshRef.current.geometry) {
          (meshRef.current.geometry as any).attributes.color = attr;
        }
      } catch (e) {
        // ignore
      }

      // Keep refs for later updates
      colorAttrRef.current = attr;
      colorsApplied.current = true;
      // Ensure material reads vertex colors
      try {
        if (meshRef.current && (meshRef.current as any).material) {
          (meshRef.current as any).material.vertexColors = true;
          (meshRef.current as any).material.needsUpdate = true;
        }
      } catch (e) {
        // ignore
      }
    }

    const elapsedTime = state.clock.elapsedTime;

    // Update all instance matrices with slow, gentle motion (no bouncing)
    for (let i = 0; i < molecules.length; i++) {
      const mol = molecules[i];
      const p = points[i];

      tempObj.position.set(p[0], p[1], p[2]);

      const base = sizeArray[i];
      const isAttractor = attractorIds?.includes(mol.molecule_id);
      const isSelected = selectedMoleculeId === mol.molecule_id;
      const isHoveredLocal = hoveredIndex === i;
      const isOutlier = outlierIds?.includes(mol.molecule_id);

      // Scale factor: selected > attractor > normal (moderate increase)
      let scaleFactor = 1.0;
      if (isSelected) scaleFactor = 1.6; // larger but subtle
      else if (isAttractor) scaleFactor = 1.5;
      // Hovered gets a modest boost for clarity
      if (isHoveredLocal && !isSelected) scaleFactor = Math.max(scaleFactor, 1.35);

      // Add attractor pull offset (unchanged)
      if (isAttractor) {
        const pullStrength = 0.08;
        tempVec.set(-p[0] * pullStrength, -p[1] * pullStrength, -p[2] * pullStrength);
        tempObj.position.add(tempVec);
      }

      // Gentle floating instead of bouncing: low-frequency, low-amplitude offsets
      const floatAmp = isSelected ? 0.06 : isAttractor ? 0.04 : isOutlier ? 0.03 : 0.015;
      const floatX = Math.cos(elapsedTime * 0.18 + i * 0.07) * floatAmp;
      const floatY = Math.sin(elapsedTime * 0.14 + i * 0.11) * floatAmp;
      tempObj.position.x += floatX;
      tempObj.position.y += floatY;

      // Very subtle pulsing (scale) to avoid bounce-y feeling
      const pulseAmp = isSelected ? 0.06 : isAttractor ? 0.03 : isOutlier ? 0.04 : 0.0;
      const pulseSpeed = isOutlier ? 1.2 : 0.4;
      const pulse = 1 + Math.sin(elapsedTime * pulseSpeed + i * 0.2) * pulseAmp;

      const finalSize = base * scaleFactor * pulse;
      tempObj.scale.setScalar(finalSize);
      tempObj.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObj.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Update glow layer
    if (glowMeshRef.current && shouldUseGlow) {
      for (let i = 0; i < molecules.length; i++) {
        const mol = molecules[i];
        const isSelected = selectedMoleculeId === mol.molecule_id;
        const glowIntensity = isSelected ? 1.0 : getGlowIntensity(mol.rank);

        if (glowIntensity > 0) {
          const p = points[i];
          const base = sizeArray[i];
          
          tempObj.position.set(p[0], p[1], p[2]);
          
          // Enhanced pulsing glow for selected molecule
          if (isSelected) {
            // Subtle, slow glow pulse for selected molecule
            const glowPulse = 1.2 + Math.sin(elapsedTime * 1.5) * 0.2;
            tempObj.scale.setScalar(base * glowPulse);
          } else {
            tempObj.scale.setScalar((base * (1 + glowIntensity * 0.5)));
          }
          tempObj.updateMatrix();
          glowMeshRef.current.setMatrixAt(i, tempObj.matrix);
        } else {
          // Invisible for non-glowing molecules
          tempObj.scale.setScalar(0.001);
          tempObj.updateMatrix();
          glowMeshRef.current.setMatrixAt(i, tempObj.matrix);
        }
      }
      glowMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Lipinski overlay: green halos for compliant molecules
    if (lipinskiMeshRef.current) {
      for (let i = 0; i < molecules.length; i++) {
        const mol = molecules[i];
        const compliant = isLipinskiCompliant(mol);
        if (visibility.lipinskiOverlay && compliant) {
          const p = points[i];
          const base = sizeArray[i];
          tempObj.position.set(p[0], p[1], p[2]);
          // Slightly larger halo
          tempObj.scale.setScalar(base * 1.25);
          tempObj.updateMatrix();
          lipinskiMeshRef.current.setMatrixAt(i, tempObj.matrix);
        } else {
          tempObj.scale.setScalar(0.001);
          tempObj.updateMatrix();
          lipinskiMeshRef.current.setMatrixAt(i, tempObj.matrix);
        }
      }
      lipinskiMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Toxicity overlay: red outline for high toxicity molecules
    if (toxicityMeshRef.current) {
      for (let i = 0; i < molecules.length; i++) {
        const mol = molecules[i];
        const tox = getToxicityLevel(mol.toxicity_risk) === 'high';
        if (visibility.toxicityOverlay && tox) {
          const p = points[i];
          const base = sizeArray[i];
          tempObj.position.set(p[0], p[1], p[2]);
          // Slightly larger outline
          tempObj.scale.setScalar(base * 1.3);
          tempObj.updateMatrix();
          toxicityMeshRef.current.setMatrixAt(i, tempObj.matrix);
        } else {
          tempObj.scale.setScalar(0.001);
          tempObj.updateMatrix();
          toxicityMeshRef.current.setMatrixAt(i, tempObj.matrix);
        }
      }
      toxicityMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Main instanced mesh */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, molecules.length]}
        frustumCulled={true}
        onPointerMove={(e) => {
          const id = (e as any).instanceId as number | undefined;
          setHoveredIndex(typeof id === "number" ? id : null);
          onHover(typeof id === "number" ? id : null);
        }}
        onPointerOut={() => {
          setHoveredIndex(null);
          onHover(null);
        }}
        onClick={(e) => {
          const id = (e as any).instanceId as number | undefined;
          if (typeof id === "number") {
            onSelect(molecules[id]);
            try {
              const cid = clusterIds ? clusterIds[id] : undefined;
              if (typeof cid === 'number' && typeof onClusterClick === 'function') {
                onClusterClick(cid);
              }
            } catch (err) {
              // ignore
            }
          }
        }}
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshPhysicalMaterial 
          color={0xffffff}
          vertexColors={true}
          metalness={0.06}
          roughness={0.28}
          emissiveIntensity={0.35}
          emissive={new THREE.Color(0x111111)}
          clearcoat={0.06}
          toneMapped={true}
        />
      </instancedMesh>

      {/* Glow layer for top candidates */}
      {shouldUseGlow && (
        <instancedMesh
          ref={glowMeshRef}
          args={[undefined, undefined, molecules.length]}
          frustumCulled={true}
        >
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            color={new THREE.Color(0x0055ff)}
            emissive={new THREE.Color(0x0088ff)}
            emissiveIntensity={0.9}
            metalness={0}
            roughness={0.6}
            transparent
            opacity={0.85}
            toneMapped={true}
            depthWrite={false}
          />
        </instancedMesh>
      )}

        {/* Lipinski overlay (green halos) */}
        <instancedMesh
          ref={lipinskiMeshRef}
          args={[undefined, undefined, molecules.length]}
          frustumCulled={true}
        >
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial
            color={new THREE.Color(0x33cc66)}
            emissive={new THREE.Color(0x22aa55)}
            emissiveIntensity={0.25}
            metalness={0}
            roughness={0.9}
            transparent
            opacity={0.45}
            toneMapped={true}
            depthWrite={false}
          />
        </instancedMesh>

        {/* Toxicity overlay (red outlines) */}
        <instancedMesh
          ref={toxicityMeshRef}
          args={[undefined, undefined, molecules.length]}
          frustumCulled={true}
        >
          <sphereGeometry args={[1.02, 12, 12]} />
          <meshStandardMaterial
            color={new THREE.Color(0xff4d4f)}
            emissive={new THREE.Color(0xcc3333)}
            emissiveIntensity={0.25}
            metalness={0}
            roughness={0.9}
            transparent
            opacity={0.45}
            toneMapped={true}
            depthWrite={false}
          />
        </instancedMesh>

      {/* Cluster edges visualization */}
      {visibility.diffusionAnimation && visibility.clusterHighlight && clusterEdges.length > 0 && (
        <EdgeLines edges={clusterEdges} points={points} moleculeCount={molecules.length} />
      )}
    </>
  );
}

/**
 * Edge lines component for cluster visualization
 */
function EdgeLines({
  edges,
  points,
  moleculeCount,
}: {
  edges: [number, number][];
  points: [number, number, number][];
  moleculeCount: number;
}) {
  return (
    <>
      {edges.map((edge, idx) => {
        const [i, j] = edge;
        const p1 = new THREE.Vector3(...points[i]);
        const p2 = new THREE.Vector3(...points[j]);
        
        return (
          <Line
            key={`edge-${idx}`}
            points={[p1, p2]}
            color={new THREE.Color(0x6b7d8c)}
            transparent
            opacity={0.32}
            lineWidth={1}
          />
        );
      })}
    </>
  );
}

/**
 * Education mode overlay
 */
function EducationModeOverlay({ enabled }: { enabled?: boolean }) {
  const [step, setStep] = useState(0);
  
  if (!enabled) return null;

  const steps = [
    "🧬 Probability diffuses across structurally similar molecules",
    "📊 Each sphere size represents drug-likeness potential",
    "🎨 Color gradient shows probability from blue (low) to red (high)",
    "✨ Top 5 candidates glow brightly for quick identification",
    "🔗 Lines connect similar molecules in the chemical space",
  ];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background/95 border border-glass-border rounded-lg p-6 max-w-sm text-center z-50">
      <p className="text-sm text-foreground mb-3">{steps[step]}</p>
      <div className="flex gap-2 justify-center">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${
              i === step ? "w-6 bg-primary" : "w-2 bg-muted-foreground"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Enhanced camera controls
 */
function EnhancedCameraControls({
  selectedMolecule,
  points,
  molecules,
  autoFocusTarget,
}: {
  selectedMolecule: ScoredMolecule | null;
  points: [number, number, number][];
  molecules: ScoredMolecule[];
  autoFocusTarget?: { x: number; y: number; z: number } | null;
}) {
  const { camera } = useThree();
  const orbitControlsRef = useRef<any>(null);
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0));
  const hasAutoFocused = useRef(false);

  // One-time auto-focus to densest cluster on mount
  useEffect(() => {
    if (autoFocusTarget && !hasAutoFocused.current && orbitControlsRef.current) {
      hasAutoFocused.current = true;
      targetPosition.current.set(autoFocusTarget.x, autoFocusTarget.y, autoFocusTarget.z);
      orbitControlsRef.current.target.copy(targetPosition.current);
      orbitControlsRef.current.update();
    }
  }, [autoFocusTarget]);

  useFrame(() => {
    if (!orbitControlsRef.current) return;

    // Smoothly pan the orbit controls' target toward the selected molecule,
    // but do NOT move or zoom the camera automatically. The user controls zoom.
    if (selectedMolecule) {
      const molIndex = molecules.findIndex((m) => m.molecule_id === selectedMolecule.molecule_id);
      if (molIndex >= 0 && points[molIndex]) {
        const p = points[molIndex];
        targetPosition.current.set(p[0], p[1], p[2]);

        // Only lerp the orbit target (keeps camera distance stable)
        orbitControlsRef.current.target.lerp(targetPosition.current, 0.06);
        orbitControlsRef.current.update();
      }
    }
  });

  return (
    <OrbitControls
      ref={orbitControlsRef}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={1.2}
      target={targetPosition.current}
      onDoubleClick={() => {
        // Double-click to reset camera
        if (orbitControlsRef.current) {
          orbitControlsRef.current.reset();
        }
      }}
    />
  );
}

/**
 * Reset camera button
 */
function ResetCameraButton({ orbitControlsRef }: { orbitControlsRef: React.RefObject<any> }) {
  return (
    <button
      onClick={() => {
        if (orbitControlsRef.current) {
          orbitControlsRef.current.reset();
        }
      }}
      className="absolute top-4 left-4 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs transition z-40 shadow-md"
    >
      Reset Camera
    </button>
  );
}

/**
 * Main component
 */
export default function ChemicalUniverse3D({
  molecules,
  onSelectMolecule,
  selectedMoleculeId,
  attractorIds,
  outbreak = false,
  educationMode = false,
  autoFocusTarget = null,
  autoFocusLabel,
  outlierIds,
  onClusterSelect,
}: ChemicalUniverse3DProps) {
  // State management
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityState>({
    probabilityColoring: true,
    clusterHighlight: true,
    lipinskiOverlay: false,
    toxicityOverlay: false,
    diffusionAnimation: true,
  });
  const orbitControlsRef = useRef<any>(null);

  // Limit molecules for performance
  const displayed = useMemo(() => molecules.slice(0, 2000), [molecules]);

  // Normalize positions and compute visual properties
  const { points, sizeArray } = useMemo(() => {
    const xs = displayed.map((m) => Number(m.pca_x ?? 0));
    const ys = displayed.map((m) => Number(m.pca_y ?? 0));
    const zs = displayed.map((m) => Number(m.pca_z ?? 0));

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);
    const spanZ = Math.max(1e-6, maxZ - minZ);

    const centerX = (maxX + minX) / 2;
    const centerY = (maxY + minY) / 2;
    const centerZ = (maxZ + minZ) / 2;

    const maxSpan = Math.max(spanX, spanY, spanZ);
    const scale = 8.0;

    const pts: [number, number, number][] = displayed.map((m) => [
      ((m.pca_x ?? 0) - centerX) / maxSpan * scale,
      ((m.pca_y ?? 0) - centerY) / maxSpan * scale,
      ((m.pca_z ?? 0) - centerZ) / maxSpan * scale,
    ]);

    return {
      points: pts,
      sizeArray: displayed.map((m) => getDrugLikenessSize(m.drug_likeness_score ?? 0.5)),
    };
  }, [displayed]);

  // Build cluster edges (only if dataset not too large)
  const clusterEdges = useMemo(() => {
    if (displayed.length > 1000 || !layerVisibility.diffusionAnimation) {
      return [];
    }
    return buildClusterEdges(displayed, 0.6, 4, 300);
  }, [displayed, layerVisibility.diffusionAnimation]);

  // Compute cluster assignments (memoized)
  const clusterIds = useMemo(() => {
    if (!points || points.length === 0) return [] as number[];
    const k = Math.max(2, Math.min(10, Math.floor(Math.sqrt(displayed.length))));
    return assignClusterIds(points, k);
  }, [points, displayed.length]);

  // Compute cluster summaries (memoized)
  const clusterSummaries = useMemo(() => {
    const map = new Map<number, any>();
    for (let i = 0; i < displayed.length; i++) {
      const cid = clusterIds[i] ?? 0;
      const mol = displayed[i];
      const entry = map.get(cid) ?? { items: [], sumScore: 0, sumMW: 0, sumLogP: 0, lipinskiPass: 0, sumTox: 0, sumEfficacy: 0 };
      entry.items.push(mol);
      entry.sumScore += (mol.weighted_score ?? mol.probability ?? 0);
      entry.sumMW += (mol.molecular_weight ?? 0);
      entry.sumLogP += (mol.logP ?? 0);
      entry.lipinskiPass += (mol.lipinski_compliant ? 1 : 0) as any;
      entry.sumTox += ((mol as any).toxicity_risk ?? (mol as any).toxicity ?? 0);
      entry.sumEfficacy += ((mol as any).efficacy ?? (mol as any).efficacy_index ?? 0);
      map.set(cid, entry);
    }

    const out: Record<number, any> = {};
    map.forEach((v, k) => {
      const count = v.items.length;
      const avgScore = count ? v.sumScore / count : 0;
      const avgMW = count ? v.sumMW / count : 0;
      const avgLogP = count ? v.sumLogP / count : 0;
      const lipinskiRate = count ? (v.lipinskiPass / count) : 0;
      const avgTox = count ? v.sumTox / count : 0;
      const avgEfficacy = count ? v.sumEfficacy / count : 0;
      const diffusionImpact = avgScore * 0.12; // approximated
      const centroid = v.items.length ? [
        v.items.reduce((s: number, m: any) => s + (m.pca_x ?? 0), 0) / v.items.length,
        v.items.reduce((s: number, m: any) => s + (m.pca_y ?? 0), 0) / v.items.length,
        v.items.reduce((s: number, m: any) => s + (m.pca_z ?? 0), 0) / v.items.length,
      ] : null;

      out[k] = {
        count,
        avgScore,
        avgMW,
        avgLogP,
        lipinskiRate,
        avgToxicity: avgTox,
        avgEfficacy,
        diffusionImpact,
        centroid,
        top5: (v.items || []).slice().sort((a: any, b: any) => (b.probability ?? 0) - (a.probability ?? 0)).slice(0,5),
        featuresAvg: {
          drug_likeness_score: (v.items.reduce((s: number, m: any) => s + (m.drug_likeness_score ?? 0), 0) / (v.items.length||1)),
          toxicity_risk: (v.items.reduce((s: number, m: any) => s + (m.toxicity_risk ?? 0), 0) / (v.items.length||1)),
          efficacy: (v.items.reduce((s: number, m: any) => s + (m.efficacy ?? 0), 0) / (v.items.length||1)),
        },
      };
    });

    return out;
  }, [clusterIds, displayed]);

  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Get hovered molecule
  const hoveredMolecule = hoveredIndex !== null ? displayed[hoveredIndex] : null;
  const selectedMolecule = displayed.find((m) => m.molecule_id === selectedMoleculeId);

  // Tooltip position tracking
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    if (!hoveredMolecule) return;

    const handleMouseMove = (e: MouseEvent) => {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [hoveredMolecule]);

  // Toggle layer visibility
  const toggleLayer = (key: keyof LayerVisibilityState) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden border border-blue-300 bg-gradient-to-br from-blue-50 via-white to-blue-100 relative">
      <ErrorBoundary>
        <Canvas
          camera={{ position: [8, 6, 8], fov: 50, near: 0.1, far: 1000 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, toneMappingExposure: 1.2 }}
          style={{ background: "#f0f9ff" }}
        >
          {/* Enhanced lighting for light theme */}
          <fog attach="fog" args={["#f0f9ff", 50, 150]} />
          <ambientLight intensity={1.2} />
          <hemisphereLight args={[0xffffff, 0xccddff, 1.0]} />
          <directionalLight position={[12, 12, 8]} intensity={1.2} />
          <directionalLight position={[-10, 8, -6]} intensity={0.6} />
          <pointLight position={[8, 8, 8]} intensity={0.8} color="#ff6b99" />
          <pointLight position={[-8, -8, -8]} intensity={0.4} color="#00cc88" />

          {/* Visual elements */}
          <AxisLabels />

          <EnhancedInstancedPoints
            molecules={displayed}
            points={points}
            selectedMoleculeId={selectedMoleculeId}
            attractorIds={attractorIds}
            outlierIds={outlierIds}
            onSelect={onSelectMolecule}
            onHover={setHoveredIndex}
            visibility={layerVisibility}
            educationMode={educationMode}
            clusterEdges={clusterEdges}
            clusterIds={clusterIds}
            onClusterClick={(cid) => {
              setSelectedClusterId(cid);
              setDetailsOpen(true);
              if (onClusterSelect) onClusterSelect(cid, (clusterSummaries as any)[cid] ?? null);
            }}
          />

          {/* Grid */}
          <gridHelper args={[16, 16, "#d1e7f6", "#e8f4f8"]} position={[0, -5, 0]} />

          {/* Auto-focus label ("Primary Candidate Region") */}
          {autoFocusTarget && autoFocusLabel && (
            <Html position={[autoFocusTarget.x, autoFocusTarget.y + 1.2, autoFocusTarget.z]} center distanceFactor={12}>
              <div className="px-2 py-1 bg-indigo-600/90 text-white text-[10px] font-semibold rounded shadow-lg whitespace-nowrap pointer-events-none">
                {autoFocusLabel}
              </div>
            </Html>
          )}

          {/* Camera controls */}
          <EnhancedCameraControls
            selectedMolecule={selectedMolecule ?? null}
            points={points}
            molecules={displayed}
            autoFocusTarget={autoFocusTarget}
          />
        </Canvas>

        {/* UI Overlays */}
        <ResetCameraButton orbitControlsRef={orbitControlsRef} />
        <MoleculeTooltip molecule={hoveredMolecule ?? null} screenPosition={tooltipPos} />
        <EducationModeOverlay enabled={educationMode} />

        {/* Cluster explanation UI */}
        {selectedClusterId !== null && (
          <ClusterPanel
            clusterId={selectedClusterId}
            summary={(clusterSummaries as any)[selectedClusterId] ?? null}
            onClose={() => setSelectedClusterId(null)}
            onMore={() => setDetailsOpen(true)}
          />
        )}

        <ClusterDetailsModal
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          clusterId={selectedClusterId}
          summary={(clusterSummaries as any)[selectedClusterId] ?? null}
        />

        {/* Legend overlay (portal to body for top-most visibility) */}
        {createPortal(
          <LegendOverlay
            clusterCount={Object.keys(clusterSummaries).length}
            visibility={layerVisibility}
            toggleLayer={(k: string) => toggleLayer(k as any)}
          />,
          document.body
        )}

        {outbreak && (
          <div className="absolute left-4 bottom-4 bg-yellow-900/80 text-white px-3 py-1 rounded shadow text-xs">
            ⚠ Exploring candidates under outbreak constraints
          </div>
        )}
      </ErrorBoundary>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, calc(-100% + 8px)); }
          to { opacity: 1; transform: translate(-50%, calc(-100% - 8px)); }
        }
      `}</style>
    </div>
  );
}
