import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ScoredMolecule } from "@/lib/quantumEngine";
import MoleculeSketch from "@/components/MoleculeSketch";

interface MoleculePointProps {
  molecule: ScoredMolecule;
  position: [number, number, number];
  color: THREE.Color;
  size: number;
  onHover: (mol: ScoredMolecule | null) => void;
  onClick: (mol: ScoredMolecule) => void;
  isSelected: boolean;
}

function MoleculePoint({ molecule, position, color, size, onHover, onClick, isSelected }: MoleculePointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current && isSelected) {
      meshRef.current.rotation.y += delta * 2;
    }
    if (glowRef.current) {
      const s = 1 + Math.sin(Date.now() * 0.003) * 0.1;
      glowRef.current.scale.setScalar(s);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={glowRef}
        onPointerEnter={() => onHover(molecule)}
        onPointerLeave={() => onHover(null)}
        onClick={() => onClick(molecule)}
      >
        <sphereGeometry args={[size * 1.5, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : 0.3}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
    </group>
  );
}

function Scene({
  molecules,
  onSelect,
  selectedId,
  attractorIds,
}: {
  molecules: ScoredMolecule[];
  onSelect: (mol: ScoredMolecule) => void;
  selectedId: string | null;
  attractorIds?: string[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Limit rendered molecules for performance
  const displayed = useMemo(() => molecules.slice(0, 2000), [molecules]);

  // Normalize positions
  const { points, colors, sizes } = useMemo(() => {
    const xs = displayed.map((m) => m.pca_x);
    const ys = displayed.map((m) => m.pca_y);
    const zs = displayed.map((m) => m.pca_z);
    const range = (arr: number[]) => {
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      return { min, max, span: max - min || 1 };
    };
    const rx = range(xs), ry = range(ys), rz = range(zs);
    const scale = 10;

    return {
      points: displayed.map((m) => [
        ((m.pca_x - rx.min) / rx.span - 0.5) * scale,
        ((m.pca_y - ry.min) / ry.span - 0.5) * scale,
        ((m.pca_z - rz.min) / rz.span - 0.5) * scale,
      ] as [number, number, number]),
      colors: displayed.map((m) => {
        // Prefer coloring by dataset/source when available, otherwise fall back to probability
        const src = (m as any).source_dataset || (m as any).source || (m as any).disease_target || "unknown";
        // map known source keys to pleasant colors
        const mapping: Record<string, string> = {
          pubchem_antibiotic: "#0ea5a4", // teal-cyan
          delaney_solubility: "#ef4444", // bright red
          quantum_candidates: "#8b5cf6", // vivid violet
          PubChem: "#0ea5a4",
          Delaney: "#ef4444",
          Quantum: "#8b5cf6",
          unknown: "#3b82f6", // blue for probability-based
        };

        const hex = mapping[String(src)] || mapping.unknown;
        const color = new THREE.Color(hex);
        // if no explicit source, modulate brightness by probability
        if (!((m as any).source_dataset || (m as any).source || (m as any).disease_target)) {
          const t = Math.max(0, Math.min(1, m.probability));
          color.offsetHSL(0, 0, (t - 0.5) * 0.4);
        }
        return color;
      }),
      sizes: displayed.map((m) => 0.03 + Math.max(0, Math.min(1, m.drug_likeness_score)) * 0.12),
    };
  }, [displayed]);

  function InstancedPoints() {
    const meshRef = useRef<THREE.InstancedMesh | null>(null);
    const glowRef = useRef<THREE.InstancedMesh | null>(null);
    const tempMat = useMemo(() => new THREE.Object3D(), []);
    const tempVec = useMemo(() => new THREE.Vector3(), []);

    // Prepare instance color buffer
    const colorArray = useMemo(() => {
      const arr = new Float32Array(displayed.length * 3);
      for (let i = 0; i < displayed.length; i++) {
        const c = colors[i];
        arr[i * 3 + 0] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      return arr;
    }, [colors, displayed.length]);

    useFrame((state, delta) => {
      if (!meshRef.current) return;

      for (let i = 0; i < displayed.length; i++) {
        const p = points[i];
        tempMat.position.set(p[0], p[1], p[2]);
        const baseScale = sizes[i];
        // Pulse selected item or attractors
        const isAttractor = Array.isArray(attractorIds) && attractorIds.includes(displayed[i].molecule_id);
        const scaleFactor = hoveredIndex === i || selectedId === displayed[i].molecule_id ? 1.6 : (isAttractor ? 1.4 : 1.0);
        // attractor pull toward origin
        if (isAttractor) {
          tempVec.set(-p[0] * 0.12, -p[1] * 0.12, -p[2] * 0.12);
          tempMat.position.add(tempVec);
        }
        const s = baseScale * scaleFactor * (1 + Math.sin((i + state.clock.elapsedTime) * 2.0) * 0.05);
        tempMat.scale.setScalar(s);
        tempMat.updateMatrix();
        meshRef.current.setMatrixAt(i, tempMat.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    });

    // Attach instance color attribute
    useEffect(() => {
      if (!meshRef.current) return;
      // Use InstancedMesh.instanceColor for per-instance colors so the standard material picks them up
      try {
        (meshRef.current as any).instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
      } catch (e) {
        const geo = meshRef.current.geometry as THREE.BufferGeometry;
        geo.setAttribute("instanceColor", new THREE.InstancedBufferAttribute(colorArray, 3));
      }
    }, [colorArray]);

    return (
      <>
        <instancedMesh ref={meshRef} args={[undefined, undefined, displayed.length]} castShadow receiveShadow frustumCulled={false} onPointerMove={(e: any) => {
          const id = e.instanceId as number | undefined;
          if (typeof id === 'number') setHoveredIndex(id);
        }} onPointerOut={() => setHoveredIndex(null)} onClick={(e: any) => {
          const id = e.instanceId as number | undefined;
          if (typeof id === 'number') onSelect(displayed[id]);
        }}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial vertexColors opacity={1} transparent={false} roughness={0.25} metalness={0.6} emissiveIntensity={0.6} />
        </instancedMesh>

        {/* Soft glow layer */}
        <instancedMesh ref={glowRef} args={[undefined, undefined, displayed.length]} frustumCulled={false} raycast={() => null}>
          <sphereGeometry args={[1.0, 12, 12]} />
          <meshBasicMaterial toneMapped={false} transparent opacity={0.12} blending={THREE.AdditiveBlending} />
        </instancedMesh>
      </>
    );
  }

  const hoveredMolecule = hoveredIndex !== null ? displayed[hoveredIndex] : null;

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[10, 10, 10]} intensity={0.9} color="#00e6e6" />
      <pointLight position={[-10, -5, -10]} intensity={0.45} color="#7c3aed" />

      <InstancedPoints />

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
                <p className="text-primary">Score: {hoveredMolecule.weighted_score.toFixed(3)}</p>
                <p className="text-muted-foreground">DL: {hoveredMolecule.drug_likeness_score.toFixed(3)}</p>
              </div>
            </div>
          </div>
        </Html>
      )}

      <OrbitControls enableDamping dampingFactor={0.05} rotateSpeed={0.5} />

      {/* Grid helper */}
      <gridHelper args={[12, 12, "#1a1a3e", "#1a1a3e"]} position={[0, -5.5, 0]} />
    </>
  );
}

// Legend overlay for colors
function LegendOverlay({ className }: { className?: string }) {
  const items = [
    { label: "PubChem", color: "#0ea5a4" },
    { label: "Delaney", color: "#ef4444" },
    { label: "Quantum", color: "#8b5cf6" },
    { label: "Unknown / Prob-based", color: "#3b82f6" },
  ];

  return (
    <div className={`absolute right-4 top-4 z-40 rounded-md bg-white/70 backdrop-blur-sm p-2 text-xs shadow ${className ?? ""}`}>
      <div className="font-semibold mb-1">Color Legend</div>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2">
            <div style={{ width: 14, height: 14, background: it.color, borderRadius: 4 }} />
            <div className="text-xs text-muted-foreground">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChemicalUniverse3DProps {
  molecules: ScoredMolecule[];
  onSelectMolecule: (mol: ScoredMolecule) => void;
  selectedMoleculeId: string | null;
  attractorIds?: string[];
  outbreak?: boolean;
}

export default function ChemicalUniverse3D({ molecules, onSelectMolecule, selectedMoleculeId, attractorIds, outbreak = false }: ChemicalUniverse3DProps) {
  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-glass-border bg-background/50 relative">
      <ErrorBoundary>
        <Canvas
          camera={{ position: [8, 6, 8], fov: 50, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <Scene
            molecules={molecules}
            onSelect={onSelectMolecule}
            selectedId={selectedMoleculeId}
            attractorIds={attractorIds}
          />
        </Canvas>
      </ErrorBoundary>
      {/* Outbreak banner overlay */}
      {outbreak && (
        <div className="absolute left-4 top-4 bg-yellow-900/80 text-white px-3 py-1 rounded shadow">
          Exploring candidates under outbreak constraints
        </div>
      )}
    </div>
  );
}
