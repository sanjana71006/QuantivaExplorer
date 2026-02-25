import React, { useMemo, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useExploration, ExplorationMolecule } from '@/context/ExplorationContext';
import ErrorBoundary from '@/components/ErrorBoundary';

// Compute similarity between two molecules based on descriptors
function computeSimilarity(a: ExplorationMolecule, b: ExplorationMolecule): number {
  const normalize = (val: number, min: number, max: number) => (val - min) / (max - min + 1e-6);
  
  const mwDiff = Math.abs(normalize(a.molecular_weight, 0, 1000) - normalize(b.molecular_weight, 0, 1000));
  const logPDiff = Math.abs(normalize(a.logP, -5, 10) - normalize(b.logP, -5, 10));
  const donorDiff = Math.abs(normalize(a.h_bond_donors, 0, 10) - normalize(b.h_bond_donors, 0, 10));
  const acceptorDiff = Math.abs(normalize(a.h_bond_acceptors, 0, 15) - normalize(b.h_bond_acceptors, 0, 15));
  
  const avgDiff = (mwDiff + logPDiff + donorDiff + acceptorDiff) / 4;
  return Math.max(0, 1 - avgDiff);
}

interface Edge {
  from: number;
  to: number;
  similarity: number;
  points: [THREE.Vector3, THREE.Vector3];
}

function NetworkGraph() {
  const { molecules, selectedMolecule, selectMolecule } = useExploration();
  const groupRef = useRef<THREE.Group>(null);
  const { similarityEnabled } = useExploration();

  // Compute positions using force-directed-like layout
  const positions = useMemo(() => {
    if (molecules.length === 0) return [];
    
    // Spread molecules in a wider circular layout centered at origin
    const radius = 8;
    return molecules.map((_, i) => {
      const angle = (i / Math.max(molecules.length, 1)) * Math.PI * 2;
      const r = radius * (0.7 + (i % 3) * 0.15);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = (i % 2 === 0 ? 1 : -1) * (0.5 + Math.random() * 1.5);
      return new THREE.Vector3(x, y, z);
    });
  }, [molecules]);

  // Compute edges based on similarity threshold (only when similarityEnabled)
  const edges = useMemo(() => {
    if (!similarityEnabled) return [] as Edge[];
    const result: Edge[] = [];
    const threshold = 0.7; // Only show edges with similarity > 0.7
    
    for (let i = 0; i < molecules.length; i++) {
      for (let j = i + 1; j < molecules.length; j++) {
        const sim = computeSimilarity(molecules[i], molecules[j]);
        if (sim > threshold && positions[i] && positions[j]) {
          result.push({
            from: i,
            to: j,
            similarity: sim,
            points: [positions[i], positions[j]],
          });
        }
      }
    }
    return result;
  }, [molecules, positions, similarityEnabled]);

  // Animate edges
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  if (molecules.length === 0) {
    return (
      <Html center>
        <div className="text-muted-foreground text-sm bg-card/90 px-4 py-2 rounded-lg">
          Add molecules to visualize the similarity network
        </div>
      </Html>
    );
  }

  return (
    <group ref={groupRef}>
      {/* Edges */}
      {edges.map((edge, i) => (
        <Line
          key={`edge-${i}`}
          points={edge.points}
          color={new THREE.Color().setHSL(0.5 + edge.similarity * 0.2, 0.8, 0.5)}
          lineWidth={1 + edge.similarity * 2}
          transparent
          opacity={0.4 + edge.similarity * 0.4}
        />
      ))}

      {/* Nodes */}
      {molecules.map((mol, i) => {
        const pos = positions[i];
        if (!pos) return null;
        
        const isSelected = selectedMolecule?.id === mol.id;
        const size = 0.25 + mol.drug_likeness_score * 0.35;
        const hue = mol.probability * 0.3;
        
        return (
          <group key={mol.id} position={pos}>
            <mesh
              onClick={() => selectMolecule(mol)}
              scale={isSelected ? 1.5 : 1}
            >
              <sphereGeometry args={[size, 16, 16]} />
              <meshPhongMaterial
                color={new THREE.Color().setHSL(hue, 0.8, 0.6)}
                emissive={new THREE.Color().setHSL(hue, 0.5, 0.2)}
                emissiveIntensity={isSelected ? 0.8 : 0.3}
              />
            </mesh>
            
            {isSelected && (
              <Html distanceFactor={10}>
                <div className="bg-card/95 border border-primary rounded px-2 py-1 text-xs whitespace-nowrap">
                  {mol.name}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

export default function NetworkView() {
  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden border border-border bg-gradient-to-b from-slate-900 to-slate-950 relative">
      <ErrorBoundary>
        <Canvas
          camera={{ position: [0, 3, 16], fov: 60, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#0a0a1a']} />
          
          <hemisphereLight args={[0xffffff, 0x444466, 1.0]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 6]} intensity={0.8} />
          <pointLight position={[0, 5, 0]} intensity={0.5} color="#00ffff" />

          <NetworkGraph />

          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.5}
            target={[0, 0, 0]}
            minDistance={5}
            maxDistance={40}
          />
          
          <gridHelper args={[18, 18, '#1a1a3e', '#1a1a3e']} position={[0, -4, 0]} />
        </Canvas>
      </ErrorBoundary>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 text-xs">
        <p className="font-semibold mb-2">Network View</p>
        <p className="text-muted-foreground">Nodes = Molecules</p>
        <p className="text-muted-foreground">Edges = Similarity &gt; 70%</p>
        <p className="text-muted-foreground">Click node to select</p>
      </div>
    </div>
  );
}
