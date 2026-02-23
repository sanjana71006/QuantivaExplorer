import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useExploration, ExplorationMolecule } from '@/context/ExplorationContext';
import ErrorBoundary from '@/components/ErrorBoundary';

function InstancedMolecules() {
  const { molecules, selectedMolecule, selectMolecule, outbreakMode } = useExploration();
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const tempMat = useMemo(() => new THREE.Object3D(), []);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Normalize positions
  const { points, colors, sizes } = useMemo(() => {
    if (molecules.length === 0) {
      return { points: [], colors: [], sizes: [] };
    }

    const xs = molecules.map(m => m.pca_x);
    const ys = molecules.map(m => m.pca_y);
    const zs = molecules.map(m => m.pca_z);
    
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    
    const centerX = (maxX + minX) / 2;
    const centerY = (maxY + minY) / 2;
    const centerZ = (maxZ + minZ) / 2;
    
    // Use minimum span of 2 to ensure molecules spread out even with few data points
    const maxSpan = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 2);
    const scale = 10.0;

    const pts = molecules.map(m => {
      const x = ((m.pca_x - centerX) / maxSpan) * scale;
      const y = ((m.pca_y - centerY) / maxSpan) * scale;
      const z = ((m.pca_z - centerZ) / maxSpan) * scale;
      return [x, y, z] as [number, number, number];
    });

    // Color by probability (quantum-inspired gradient: purple -> cyan -> yellow)
    const cols = molecules.map(m => {
      const p = Math.max(0, Math.min(1, m.probability));
      const hue = 280 - p * 240; // purple to yellow
      const sat = 70 + p * 20;
      const light = 45 + p * 20;
      return new THREE.Color(`hsl(${hue}, ${sat}%, ${light}%)`);
    });

    // Size by drug-likeness - larger for visibility
    const sz = molecules.map(m => 0.15 + m.drug_likeness_score * 0.35);

    return { points: pts, colors: cols, sizes: sz };
  }, [molecules]);

  // Color buffer
  const colorArray = useMemo(() => {
    const arr = new Float32Array(molecules.length * 3);
    for (let i = 0; i < molecules.length; i++) {
      const c = colors[i] ?? new THREE.Color(0x888888);
      arr[i * 3 + 0] = Math.min(1, Math.max(0, c.r));
      arr[i * 3 + 1] = Math.min(1, Math.max(0, c.g));
      arr[i * 3 + 2] = Math.min(1, Math.max(0, c.b));
    }
    return arr;
  }, [colors, molecules.length]);

  useEffect(() => {
    if (!meshRef.current || colorArray.length === 0) return;
    const attr = new THREE.InstancedBufferAttribute(colorArray, 3);
    attr.needsUpdate = true;
    meshRef.current.instanceColor = attr;
  }, [colorArray]);

  useFrame((state) => {
    if (!meshRef.current || molecules.length === 0) return;
    
    for (let i = 0; i < molecules.length; i++) {
      const p = points[i];
      if (!p) continue;
      
      tempMat.position.set(p[0], p[1], p[2]);
      
      const baseSize = sizes[i] ?? 0.1;
      const isSelected = selectedMolecule?.id === molecules[i].id;
      const isHovered = hoveredIndex === i;
      
      // Glow effect based on confidence
      const glowFactor = molecules[i].confidence;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2 + i) * 0.05 * glowFactor;
      
      let scaleFactor = pulse;
      if (isSelected) scaleFactor *= 1.8;
      else if (isHovered) scaleFactor *= 1.4;
      
      tempMat.scale.setScalar(baseSize * scaleFactor);
      tempMat.updateMatrix();
      meshRef.current.setMatrixAt(i, tempMat.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (molecules.length === 0) {
    return (
      <Html center>
        <div className="text-muted-foreground text-sm bg-card/90 px-4 py-2 rounded-lg">
          Search for molecules to populate the galaxy
        </div>
      </Html>
    );
  }

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, molecules.length]}
        frustumCulled={false}
        onPointerMove={(e: any) => {
          const id = e.instanceId;
          if (typeof id === 'number') setHoveredIndex(id);
        }}
        onPointerOut={() => setHoveredIndex(null)}
        onClick={(e: any) => {
          const id = e.instanceId;
          if (typeof id === 'number') {
            selectMolecule(molecules[id]);
          }
        }}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshPhongMaterial vertexColors shininess={80} />
      </instancedMesh>

      {/* Hovered tooltip */}
      {hoveredIndex !== null && molecules[hoveredIndex] && (
        <Html position={points[hoveredIndex]}>
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 text-xs min-w-[180px] pointer-events-none shadow-lg -translate-x-1/2 -translate-y-full mb-2">
            <p className="font-semibold text-foreground">{molecules[hoveredIndex].name}</p>
            <p className="text-muted-foreground">MW: {molecules[hoveredIndex].molecular_weight.toFixed(1)}</p>
            <p className="text-primary">Probability: {(molecules[hoveredIndex].probability * 100).toFixed(1)}%</p>
            <p className="text-muted-foreground">Drug-likeness: {molecules[hoveredIndex].drug_likeness_score.toFixed(2)}</p>
          </div>
        </Html>
      )}
    </>
  );
}

export default function GalaxyView() {
  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden border border-border bg-gradient-to-b from-slate-900 to-slate-950 relative">
      <ErrorBoundary>
        <Canvas
          camera={{ position: [0, 5, 18], fov: 60, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#0a0a1a']} />
          
          {/* Lighting for colorful display */}
          <hemisphereLight args={[0xffffff, 0x444466, 1.2]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 6]} intensity={1.0} />
          <directionalLight position={[-8, 8, -6]} intensity={0.5} color="#00aaff" />
          <pointLight position={[0, 10, 0]} intensity={0.5} color="#ff00ff" />

          <InstancedMolecules />

          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.5}
            target={[0, 0, 0]}
            minDistance={3}
            maxDistance={50}
          />

          <gridHelper args={[24, 24, '#1a1a3e', '#1a1a3e']} position={[0, -3, 0]} />
        </Canvas>
      </ErrorBoundary>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 text-xs">
        <p className="font-semibold mb-2">Color Legend</p>
        <div className="flex items-center gap-2">
          <div className="w-12 h-3 rounded" style={{ background: 'linear-gradient(90deg, #8b5cf6, #06b6d4, #eab308)' }} />
          <span className="text-muted-foreground">Probability →</span>
        </div>
        <p className="mt-2 text-muted-foreground">Size = Drug-likeness</p>
        <p className="text-muted-foreground">Glow = Confidence</p>
      </div>
    </div>
  );
}
