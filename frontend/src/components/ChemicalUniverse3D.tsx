import { useRef, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ScoredMolecule } from "@/lib/quantumEngine";

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
}: {
  molecules: ScoredMolecule[];
  onSelect: (mol: ScoredMolecule) => void;
  selectedId: string | null;
}) {
  const [hovered, setHovered] = useState<ScoredMolecule | null>(null);

  // Limit rendered molecules for performance
  const displayed = useMemo(() => molecules.slice(0, 500), [molecules]);

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
        // Color by probability: cyan (high) → purple (mid) → dim (low)
        const t = Math.min(m.probability * displayed.length * 2, 1);
        return new THREE.Color().setHSL(0.52 - t * 0.25, 0.8, 0.3 + t * 0.4);
      }),
      sizes: displayed.map((m) => 0.05 + m.drug_likeness_score * 0.15),
    };
  }, [displayed]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#00e6e6" />
      <pointLight position={[-10, -5, -10]} intensity={0.4} color="#7c3aed" />

      {displayed.map((mol, i) => (
        <MoleculePoint
          key={mol.molecule_id}
          molecule={mol}
          position={points[i]}
          color={colors[i]}
          size={sizes[i]}
          onHover={setHovered}
          onClick={onSelect}
          isSelected={selectedId === mol.molecule_id}
        />
      ))}

      {hovered && (
        <Html position={points[displayed.indexOf(hovered)]}>
          <div className="glass-card p-3 text-xs min-w-[180px] pointer-events-none -translate-x-1/2 -translate-y-full mb-2">
            <p className="font-semibold text-foreground">{hovered.name}</p>
            <p className="text-muted-foreground">{hovered.molecule_id} • {hovered.disease_target}</p>
            <p className="text-primary">Score: {hovered.weighted_score.toFixed(3)}</p>
            <p className="text-muted-foreground">DL: {hovered.drug_likeness_score.toFixed(3)}</p>
          </div>
        </Html>
      )}

      <OrbitControls enableDamping dampingFactor={0.05} rotateSpeed={0.5} />

      {/* Grid helper */}
      <gridHelper args={[12, 12, "#1a1a3e", "#1a1a3e"]} position={[0, -5.5, 0]} />
    </>
  );
}

interface ChemicalUniverse3DProps {
  molecules: ScoredMolecule[];
  onSelectMolecule: (mol: ScoredMolecule) => void;
  selectedMoleculeId: string | null;
}

export default function ChemicalUniverse3D({ molecules, onSelectMolecule, selectedMoleculeId }: ChemicalUniverse3DProps) {
  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-glass-border bg-background/50">
      <Canvas
        camera={{ position: [8, 6, 8], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene
          molecules={molecules}
          onSelect={onSelectMolecule}
          selectedId={selectedMoleculeId}
        />
      </Canvas>
    </div>
  );
}
