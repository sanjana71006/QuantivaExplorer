import { useRef, useState, useMemo, useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ScoredMolecule } from "@/lib/quantumEngine";
import MoleculeSketch from "@/components/MoleculeSketch";

interface ChemicalUniverse3DProps {
  molecules: ScoredMolecule[];
  onSelectMolecule: (mol: ScoredMolecule) => void;
  selectedMoleculeId: string | null;
  attractorIds?: string[];
  outbreak?: boolean;
}

export default function ChemicalUniverse3D({ molecules, onSelectMolecule, selectedMoleculeId, attractorIds, outbreak = false }: ChemicalUniverse3DProps) {
  // limit and memoize
  const displayed = useMemo(() => molecules.slice(0, 2000), [molecules]);

  // normalize positions, colors and sizes
  const { points, colors, sizes } = useMemo(() => {
    const xs = displayed.map((m) => Number(m.pca_x ?? 0));
    const ys = displayed.map((m) => Number(m.pca_y ?? 0));
    const zs = displayed.map((m) => Number(m.pca_z ?? 0));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);
    const spanZ = Math.max(1e-6, maxZ - minZ);
    // center and uniform scale so the cloud fits in view
    const centerX = (maxX + minX) / 2;
    const centerY = (maxY + minY) / 2;
    const centerZ = (maxZ + minZ) / 2;
    const maxSpan = Math.max(spanX, spanY, spanZ);
    const scale = 8.0; // visual scale

    const pts = displayed.map((m) => {
      const x = (Number(m.pca_x ?? 0) - centerX) / maxSpan * scale;
      const y = (Number(m.pca_y ?? 0) - centerY) / maxSpan * scale;
      const z = (Number(m.pca_z ?? 0) - centerZ) / maxSpan * scale;
      return [x, y, z] as [number, number, number];
    });

    // Lightweight k-means clustering on molecular feature vectors (similarity by descriptors)
    const kForN = Math.max(2, Math.min(10, Math.round(Math.sqrt(Math.max(1, displayed.length)))));
    function kMeans(pointsArr: number[][], k: number, maxIter = 20) {
      if (pointsArr.length <= k) return pointsArr.map((_, i) => i % k);
      // init centroids by sampling k distinct points
      const centroids: number[][] = [];
      const used: Set<number> = new Set();
      for (let i = 0; i < k; i++) {
        let idx = Math.floor((i / k) * pointsArr.length);
        // ensure uniqueness
        if (used.has(idx)) {
          idx = [...Array(pointsArr.length).keys()].find((j) => !used.has(j)) || idx;
        }
        used.add(idx);
        centroids.push(pointsArr[idx].slice());
      }

      let assignments = new Array(pointsArr.length).fill(0);
      for (let iter = 0; iter < maxIter; iter++) {
        let moved = false;
        // assign
        for (let i = 0; i < pointsArr.length; i++) {
          const p = pointsArr[i];
          let best = 0;
          let bestDist = Infinity;
          for (let c = 0; c < k; c++) {
            const d0 = p[0] - centroids[c][0];
            const d1 = p[1] - centroids[c][1];
            const d2 = p[2] - centroids[c][2];
            const d = d0 * d0 + d1 * d1 + d2 * d2;
            if (d < bestDist) {
              bestDist = d;
              best = c;
            }
          }
          if (assignments[i] !== best) {
            moved = true;
            assignments[i] = best;
          }
        }

        // recompute centroids for arbitrary dimension vectors
        const counts = new Array(k).fill(0);
        const sums: number[][] = new Array(k).fill(0).map(() => new Array(pointsArr[0].length).fill(0));
        for (let i = 0; i < pointsArr.length; i++) {
          const a = assignments[i];
          counts[a]++;
          for (let d = 0; d < pointsArr[0].length; d++) sums[a][d] += pointsArr[i][d];
        }
        for (let c = 0; c < k; c++) {
          if (counts[c] > 0) {
            for (let d = 0; d < pointsArr[0].length; d++) centroids[c][d] = sums[c][d] / counts[c];
          }
        }

        if (!moved) break;
      }
      return assignments;
    }
    // Build feature vectors from molecular descriptors (normalized per-feature) so color groups by chemical similarity
    const features: number[][] = displayed.map((m) => {
      const mol = m as any;
      const mw = Number(mol.molecular_weight ?? mol.mw ?? 0);
      const logP = Number(mol.logP ?? mol.XLogP ?? 0);
      const donors = Number(mol.h_bond_donors ?? mol.h_donors ?? mol.HBondDonorCount ?? 0);
      const acceptors = Number(mol.h_bond_acceptors ?? mol.h_acceptors ?? mol.HBondAcceptorCount ?? 0);
      const dl = Number(mol.drug_likeness_score ?? mol.drug_score ?? 0.5);
      const psa = Number(mol.polar_surface_area ?? mol.tpsa ?? 0);
      return [mw, logP, donors, acceptors, dl, psa];
    });

    // normalize each column to 0..1
    const dims = features[0]?.length || 0;
    const mins = new Array(dims).fill(Infinity);
    const maxs = new Array(dims).fill(-Infinity);
    for (const row of features) {
      for (let j = 0; j < dims; j++) {
        mins[j] = Math.min(mins[j], row[j]);
        maxs[j] = Math.max(maxs[j], row[j]);
      }
    }
    const normFeatures = features.map((row) => row.map((v, j) => {
      const span = Math.max(1e-6, maxs[j] - mins[j]);
      return (v - mins[j]) / span;
    }));

    const clusterAssignments = kMeans(normFeatures, Math.min(kForN, Math.max(1, displayed.length)));

    // map cluster -> color (distinct hues with high saturation/lightness)
    const kUsed = Math.max(1, Math.min(12, Math.round(Math.sqrt(Math.max(1, displayed.length)))));
    const cols = displayed.map((m, i) => {
      const cluster = clusterAssignments[i] ?? 0;
      const hue = Math.round(((cluster % kUsed) / kUsed) * 360);
      // vary saturation and lightness slightly per-cluster for contrast
      const sat = 72;
      const light = 48 + ((cluster % 3) * 6);
      return new THREE.Color(`hsl(${hue}, ${sat}%, ${light}%)`);
    });

    const sz = displayed.map((m) => 0.05 + Math.max(0, Math.min(1, Number(m.drug_likeness_score ?? 0.5))) * 0.22);

    return { points: pts, colors: cols, sizes: sz };
  }, [displayed]);

  function InstancedPoints({ onSelect }: { onSelect: (m: ScoredMolecule) => void }) {
    const meshRef = useRef<THREE.InstancedMesh | null>(null);
    const tempMat = useMemo(() => new THREE.Object3D(), []);
    const tmpVec = useMemo(() => new THREE.Vector3(), []);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const colorArray = useMemo(() => {
      const arr = new Float32Array(displayed.length * 3);
      for (let i = 0; i < displayed.length; i++) {
        const c = colors[i] ?? new THREE.Color(0x888888);
        // ensure colors are within 0..1
        arr[i * 3 + 0] = Math.min(1, Math.max(0, c.r));
        arr[i * 3 + 1] = Math.min(1, Math.max(0, c.g));
        arr[i * 3 + 2] = Math.min(1, Math.max(0, c.b));
      }
      return arr;
    }, [colors, displayed.length]);

    useEffect(() => {
      if (!meshRef.current) return;
      const attr = new THREE.InstancedBufferAttribute(colorArray, 3);
      attr.needsUpdate = true;
      meshRef.current.instanceColor = attr;
    }, [colorArray]);

    useFrame((state) => {
      if (!meshRef.current) return;
      for (let i = 0; i < displayed.length; i++) {
        const p = points[i];
        tempMat.position.set(p[0], p[1], p[2]);
        const base = sizes[i] ?? 0.05;
        const isAttractor = Array.isArray(attractorIds) && attractorIds.includes(displayed[i].molecule_id as unknown as string);
        const selected = selectedMoleculeId === (displayed[i].molecule_id as unknown as string);
        const scaleFactor = selected ? 1.6 : (isAttractor ? 1.4 : 1.0);
        if (isAttractor) {
          tmpVec.set(-p[0] * 0.12, -p[1] * 0.12, -p[2] * 0.12);
          tempMat.position.add(tmpVec);
        }
        const s = base * scaleFactor * (1 + Math.sin((i + state.clock.elapsedTime) * 1.5) * 0.06);
        tempMat.scale.setScalar(s);
        tempMat.updateMatrix();
        meshRef.current.setMatrixAt(i, tempMat.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
      <>
        <instancedMesh ref={meshRef} args={[undefined, undefined, displayed.length]} frustumCulled={false}
          onPointerMove={(e: any) => {
            const id = e.instanceId as number | undefined;
            if (typeof id === 'number') setHoveredIndex(id);
          }}
          onPointerOut={() => setHoveredIndex(null)}
          onClick={(e: any) => {
            const id = e.instanceId as number | undefined;
            if (typeof id === 'number') onSelect(displayed[id]);
          }}
        >
          <sphereGeometry args={[1, 16, 16]} />
          <meshPhongMaterial vertexColors shininess={80} />
        </instancedMesh>
      </>
    );
  }

  // Hovered molecule tooltip uses a small stateful ref derived from raycasts
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // We keep a single hovered molecule derived from instanced mesh events if needed

  const hoveredMolecule = hoveredIndex !== null ? displayed[hoveredIndex] : null;

  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-glass-border bg-background/50 relative">
      <ErrorBoundary>
        <Canvas camera={{ position: [8, 6, 8], fov: 50, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
          <hemisphereLight args={[0xffffff, 0x444466, 1.0]} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[10, 10, 6]} intensity={1.2} />
          <directionalLight position={[-8, 8, -6]} intensity={0.6} />
          <pointLight position={[8, 8, 8]} intensity={0.6} color="#00e6e6" />

          <InstancedPoints onSelect={onSelectMolecule} />

          {hoveredMolecule && (
            <Html position={points[hoveredIndex || 0]}>
              <div className="glass-card p-3 text-xs min-w-[220px] pointer-events-none -translate-x-1/2 -translate-y-full mb-2">
                <div className="flex items-start gap-3">
                  <div className="w-20 h-16">
                    <MoleculeSketch smiles={hoveredMolecule.smiles} size={64} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{hoveredMolecule.name}</p>
                    <p className="text-muted-foreground">{hoveredMolecule.molecule_id} • {hoveredMolecule.disease_target}</p>
                    <p className="text-primary">Score: {(typeof ((hoveredMolecule as any).weighted_score ?? (hoveredMolecule as any).score ?? (hoveredMolecule as any).drug_score) === 'number') ? ((hoveredMolecule as any).weighted_score ?? (hoveredMolecule as any).score ?? (hoveredMolecule as any).drug_score).toFixed(3) : '—'}</p>
                    <p className="text-muted-foreground">DL: {(typeof (hoveredMolecule.drug_likeness_score ?? 0) === 'number') ? (hoveredMolecule.drug_likeness_score ?? 0).toFixed(3) : '—'}</p>
                  </div>
                </div>
              </div>
            </Html>
          )}

          <OrbitControls enableDamping dampingFactor={0.08} rotateSpeed={0.45} target={[0, 0, 0]} />
          <gridHelper args={[12, 12, "#1a1a3e", "#1a1a3e"]} position={[0, -4.5, 0]} />
        </Canvas>
      </ErrorBoundary>

      {outbreak && (
        <div className="absolute left-4 top-4 bg-yellow-900/80 text-white px-3 py-1 rounded shadow">Exploring candidates under outbreak constraints</div>
      )}
    </div>
  );
}
