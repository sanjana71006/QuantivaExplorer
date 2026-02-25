import * as THREE from 'three';

/**
 * Color gradient mapping: Probability → Vibrant Blue → Cyan → Green → Yellow → Bright Red
 * Maps probability range [0, 1] to a smooth, VIBRANT color gradient
 */
export function getProbabilityColor(probability: number): THREE.Color {
  // Clamp probability to [0, 1]
  const p = Math.max(0, Math.min(1, probability));
  
  // 5-point vibrant gradient: bright blue → cyan → lime green → golden yellow → hot red
  let r = 0, g = 0, b = 0;
  
  if (p < 0.25) {
    // Bright Blue to Cyan
    const t = p / 0.25;
    r = 0 + t * 0.3;       // 0 → 0.3 (cyan tint)
    g = 0.5 + t * 0.3;     // 0.5 → 0.8 (brighten)
    b = 1;                 // Stay fully blue
  } else if (p < 0.5) {
    // Cyan to Lime Green
    const t = (p - 0.25) / 0.25;
    r = 0.3 - t * 0.3;     // 0.3 → 0 (remove red)
    g = 0.8 + t * 0.2;     // 0.8 → 1 (brighten)
    b = 1 - t * 1;         // 1 → 0 (remove blue)
  } else if (p < 0.75) {
    // Lime Green to Golden Yellow
    const t = (p - 0.5) / 0.25;
    r = 0 + t * 1;         // 0 → 1 (add red)
    g = 1;                 // Stay fully green
    b = 0;                 // Stay zero
  } else {
    // Golden Yellow to Hot Red
    const t = (p - 0.75) / 0.25;
    r = 1;                 // Stay fully red
    g = 1 - t * 0.8;       // 1 → 0.2 (dim green)
    b = 0;                 // Stay zero
  }
  
  return new THREE.Color(
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, b))
  );
}

/**
 * Size mapping: Drug-likeness score → Sphere radius
 * Maps [0, 1] to [0.08, 0.35] with smooth curve for better visibility
 */
export function getDrugLikenessSize(drugLikenessScore: number): number {
  const score = Math.max(0, Math.min(1, drugLikenessScore || 0));
  const minSize = 0.08;    // Slightly larger minimum
  const maxSize = 0.35;    // Larger maximum for visibility
  // Use cubic easing for more pronounced differences
  const eased = score * score * score;
  return minSize + eased * (maxSize - minSize);
}

/**
 * Get glow intensity for top candidates
 */
export function getGlowIntensity(rank: number): number {
  if (rank <= 5) return 0.8;
  if (rank <= 15) return 0.5;
  if (rank <= 30) return 0.2;
  return 0;
}

/**
 * Cluster-based color mapping: assigns vibrant colors to different clusters
 * Uses HSL with rotating hue for distinct cluster identification
 */
export function getClusterColor(clusterIndex: number | undefined): THREE.Color {
  if (clusterIndex === undefined || clusterIndex < 0) {
    // Default gray for unclustered molecules
    return new THREE.Color(0.6, 0.6, 0.6);
  }
  
  // Vibrant cluster colors with full saturation and good lightness
  const clusterColors = [
    new THREE.Color(0xff3366), // Vibrant Pink
    new THREE.Color(0xff8c00), // Orange
    new THREE.Color(0xffee33), // Bright Yellow
    new THREE.Color(0x00dd66), // Emerald Green
    new THREE.Color(0x00ddff), // Cyan
    new THREE.Color(0x3366ff), // Bright Blue
    new THREE.Color(0xaa00ff), // Purple
    new THREE.Color(0xff0066), // Magenta
    new THREE.Color(0x00ff99), // Mint
    new THREE.Color(0xffaa00), // Golden Orange
  ];
  
  return clusterColors[clusterIndex % clusterColors.length];
}

/**
 * Validate Lipinski's Rules (Rule of Five)
 * A molecule is drug-like if it satisfies:
 * - MW ≤ 500 Da
 * - LogP ≤ 5
 * - H-bond donors ≤ 5
 * - H-bond acceptors ≤ 10
 */
export function isLipinskiCompliant(molecule: any): boolean {
  const mw = Number(molecule.molecular_weight ?? 0);
  const logP = Number(molecule.logP ?? 0);
  const donors = Number(molecule.h_bond_donors ?? 0);
  const acceptors = Number(molecule.h_bond_acceptors ?? 0);
  
  return (
    mw <= 500 &&
    logP <= 5 &&
    donors <= 5 &&
    acceptors <= 10
  );
}

/**
 * Check toxicity level
 */
export function getToxicityLevel(toxicityRisk: number): 'safe' | 'moderate' | 'high' {
  const risk = Number(toxicityRisk ?? 0);
  if (risk < 0.3) return 'safe';
  if (risk < 0.7) return 'moderate';
  return 'high';
}

/**
 * Calculate similarity between two molecules (Euclidean distance in PCA space)
 */
export function calculatePCASimilarity(mol1: any, mol2: any): number {
  const dx = (mol1.pca_x ?? 0) - (mol2.pca_x ?? 0);
  const dy = (mol1.pca_y ?? 0) - (mol2.pca_y ?? 0);
  const dz = (mol1.pca_z ?? 0) - (mol2.pca_z ?? 0);
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // Similarity = decay exponentially with distance
  return Math.exp(-distance * 0.5);
}

/**
 * Build cluster edges respecting performance limits
 * Returns array of [from_index, to_index] pairs
 */
export function buildClusterEdges(
  molecules: any[],
  similarityThreshold: number = 0.5,
  maxEdgesPerMolecule: number = 3,
  maxTotalEdges: number = 500
): [number, number][] {
  const edges: [number, number][] = [];
  const edgeCount = new Map<number, number>();
  
  // Initialize edge counts
  for (let i = 0; i < molecules.length; i++) {
    edgeCount.set(i, 0);
  }
  
  // Build edges only if dataset is reasonable
  const n = molecules.length;
  if (n > 1000) return []; // Too many molecules for diffusion edges
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (edges.length >= maxTotalEdges) break;
      
      const similarity = calculatePCASimilarity(molecules[i], molecules[j]);
      if (similarity > similarityThreshold) {
        const count_i = edgeCount.get(i) ?? 0;
        const count_j = edgeCount.get(j) ?? 0;
        
        if (count_i < maxEdgesPerMolecule && count_j < maxEdgesPerMolecule) {
          edges.push([i, j]);
          edgeCount.set(i, count_i + 1);
          edgeCount.set(j, count_j + 1);
        }
      }
    }
    
    if (edges.length >= maxTotalEdges) break;
  }
  
  return edges;
}

/**
 * Performance monitoring hook utilities
 */
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  
  update(): number {
    this.frameCount++;
    const now = performance.now();
    const delta = now - this.lastTime;
    
    if (delta >= 1000) {
      this.fps = this.frameCount * (1000 / delta);
      this.frameCount = 0;
      this.lastTime = now;
    }
    
    return this.fps;
  }
  
  getFPS(): number {
    return this.fps;
  }
  
  shouldDisableEffects(): boolean {
    return this.fps < 50;
  }
}

/**
 * Smooth camera target interpolation
 */
export function smoothLerpVector3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  alpha: number
): THREE.Vector3 {
  return current.clone().lerp(target, alpha);
}

/**
 * Create glow geometry layer
 */
export function createGlowGeometry(baseGeometry: THREE.BufferGeometry, scale: number = 1.05): THREE.BufferGeometry {
  const glowGeometry = baseGeometry.clone();
  return glowGeometry;
}
