# ChemicalUniverse3D - Technical Reference

## 📦 Component Files

### Main Component
- **File**: `src/components/ChemicalUniverse3D.tsx`
- **Size**: ~800 lines
- **Dependencies**: React Three Fiber, Three.js, @react-three/drei

### Utilities
- **File**: `src/lib/visualization3dUtils.ts`
- **Purpose**: Helper functions for color mapping, sizing, validation
- **Functions**: 10 exports + PerformanceMonitor class

## 🏗️ Component Structure

### Main Component Flow

```
ChemicalUniverse3D
  │
  ├─ State Setup
  │  ├─ hoveredIndex: number | null
  │  ├─ layerVisibility: LayerVisibilityState
  │  └─ tooltipPos: { x, y }
  │
  ├─ Memoized Computations
  │  ├─ displayed: ScoredMolecule[] (slice 0-2000)
  │  ├─ points: [x,y,z][] (normalized PCA)
  │  ├─ sizeArray: number[] (drug-likeness)
  │  └─ clusterEdges: [from, to][] (similarity edges)
  │
  ├─ Three.js Canvas
  │  ├─ Lighting Setup
  │  ├─ EnhancedInstancedPoints
  │  │  ├─ Main instanced mesh (2000 spheres)
  │  │  ├─ Glow instanced mesh (top candidates)
  │  │  └─ EdgeLines (cluster connections)
  │  ├─ AxisLabels
  │  ├─ GridHelper
  │  └─ EnhancedCameraControls
  │
  └─ UI Overlays
     ├─ ResetCameraButton
     ├─ LayersPanel
     ├─ LegendPanel
     ├─ MoleculeTooltip
     ├─ EducationModeOverlay
     └─ OutbreakWarning
```

## 🎨 Visual Properties

### Color Computation
```typescript
// getProbabilityColor(probability: number) → THREE.Color

// Maps [0, 1] to blue-green-yellow-red gradient
// 3 breakpoints at 0.33, 0.66
// Linear interpolation within each segment

// Example values:
0.0   → Color(0, 0, 1)       // Pure blue
0.33  → Color(0, 0.5, 0.5)   // Cyan
0.5   → Color(0.5, 1, 0)     // Green-yellow
0.66  → Color(1, 1, 0)       // Pure yellow
1.0   → Color(1, 0, 0)       // Pure red
```

### Size Computation
```typescript
// getDrugLikenessSize(score: number) → number

// Maps drug-likeness [0, 1] to radius [0.05, 0.27]
// Uses cubic easing: eased = score³
// Formula: minSize + eased × (maxSize - minSize)

// Example values:
0.0   → 0.05    units  (smallest)
0.5³  → 0.17    units  (medium)
1.0³  → 0.27    units  (largest)
```

### Glow Intensity
```typescript
// getGlowIntensity(rank: number) → number

// Rank 1-5:   0.80 (brightest)
// Rank 6-15:  0.50 (medium)
// Rank 16-30: 0.20 (subtle)
// Rank 30+:   0.00 (none)

// Applied as scale factor: 1 + glowIntensity × 0.5
// Rank 1 glow: 1.40× scale
// Rank 6 glow: 1.25× scale
// Rank 16 glow: 1.10× scale
```

## 🔄 Animation System

### Pulse Animation

**Formula:**
```
pulse = 1 + sin(elapsedTime × 2 + moleculeIndex × 0.1) × pulseIntensity

finalScale = baseScale × scaleFactor × pulse
```

**Parameters by State:**
```
Selected:   pulseIntensity = 0.12
Attractor:  pulseIntensity = 0.06
Normal:     pulseIntensity = 0.02

Frequency:  2 rad/s (1.0 second period)
Phase offset: 0.1 rad per molecule (wave effect)
```

**Timeline (1 second cycle):**
```
0.0s: scale = baseScale × 1.00 (equilibrium)
0.25s: scale = baseScale × 1.12 (peak expansion)
0.5s: scale = baseScale × 1.00 (back to center)
0.75s: scale = baseScale × 0.88 (peak contraction)
1.0s: scale = baseScale × 1.00 (full cycle)
```

### Camera Interpolation

**Formula:**
```
newPosition = currentPosition.lerp(targetPosition, 0.05)
```

**Characteristics:**
```
Alpha: 0.05 per frame @ 60 FPS
Duration: 20 frames ≈ 333 ms
Smoothness: Exponential decay ease-out
Damping: Enabled with factor 0.08
```

### Tooltip Animation

**CSS Animation:**
```css
@keyframes fadeIn {
  from { 
    opacity: 0; 
    transform: translate(-50%, calc(-100% + 8px)); 
  }
  to { 
    opacity: 1; 
    transform: translate(-50%, calc(-100% - 8px)); 
  }
}
```

**Duration:** 0.2 seconds
**Easing:** ease-out (smooth deceleration)
**Offset:** 8px upward on appear

## 📊 Data Structures

### LayerVisibilityState
```typescript
interface LayerVisibilityState {
  probabilityColoring: boolean;     // Color gradient toggle
  clusterHighlight: boolean;        // Edge lines toggle
  lipinskiOverlay: boolean;         // Border highlight (future)
  toxicityOverlay: boolean;         // Red outline (future)
  diffusionAnimation: boolean;      // Edge animation toggle
}
```

### Cluster Edge Format
```typescript
// Type: [number, number][]
// Format: Array of [sourceIndex, targetIndex] pairs
// Example: [[0, 5], [0, 12], [5, 8], ...]

// Constraints:
// - sourceIndex < targetIndex (avoids duplicates)
// - Max 4 edges per molecule
// - Max 300 total edges
// - Similarity threshold: 0.6
```

### Position Normalization
```typescript
// Raw PCA coordinates
const xs = molecules.map(m => m.pca_x);

// Find bounds
const min = Math.min(...xs);
const max = Math.max(...xs);
const span = max - min;

// Center and scale to [-4, 4] range with 8.0 scale factor
const normalized = ((raw - min + max) / 2) / span * 8.0 - 4.0;

// Result: molecules fit in ~±4 unit cube
```

## ⚙️ Three.js Setup

### Canvas Configuration
```typescript
<Canvas
  camera={{ 
    position: [8, 6, 8],  // Initial camera position
    fov: 50,              // Field of view (35-90 typical)
    near: 0.1,            // Near clipping plane
    far: 1000             // Far clipping plane (extended)
  }}
  gl={{ 
    antialias: true,      // Smooth edges
    alpha: true,          // Transparent background
    preserveDrawingBuffer: true  // Allow screenshot capture
  }}
/>
```

### Lighting Setup

**Ambient Light:**
- Intensity: 0.8
- Provides base illumination (soft)

**Hemisphere Light:**
- Sky (top): 0xffffff (white) at intensity 1.2
- Ground (bottom): 0x1a1a2e (dark blue)
- Simulates sky+ground illumination

**Directional Lights:**
- Main light: Position [12, 12, 8], intensity 1.5
- Fill light: Position [-10, 8, -6], intensity 0.7

**Point Light:**
- Position: [8, 8, 8]
- Color: 0x00e6e6 (cyan)
- Intensity: 0.8
- Adds accent color

### Fog Setup
```typescript
<fog 
  attach="fog"
  args={["#0f172a", 15, 60]}  // Color, near, far
/>
```
- Linear fog (not exponential)
- Starts at 15 units
- Fully opaque at 60 units
- Color matches background (0f172a)

### Materials

**Main Spheres:**
```typescript
<meshPhongMaterial 
  vertexColors    // Use color from instances
  shininess={100} // Shiny appearance
/>
```

**Glow Layer:**
```typescript
<meshBasicMaterial 
  color={0x00e6e6}    // Cyan
  transparent={true}
  opacity={0.25}      // Very subtle
  wireframe={false}
/>
```

**Grid:**
```typescript
<gridHelper 
  args={[16, 16, "#1e293b", "#0f172a"]}
  position={[0, -5, 0]}  // Below molecules
/>
```

## 🔍 Performance Details

### Instanced Rendering

**Setup:**
```typescript
<instancedMesh 
  ref={meshRef}
  args={[geometry, material, moleculeCount]}
  frustumCulled={true}  // Skip off-screen objects
/>
```

**Matrix Updates:**
```typescript
// Per molecule:
tempObj.position.set(x, y, z);
tempObj.scale.setScalar(size);
tempObj.updateMatrix();
meshRef.current.setMatrixAt(i, tempObj.matrix);

// After all updates:
meshRef.current.instanceMatrix.needsUpdate = true;
```

**Performance Impact:**
- GPU: All instances in single draw call
- CPU: O(n) matrix updates per frame
- Memory: ~1 MB per 1000 molecules (matrices + colors)

### Color Array Management
```typescript
// Pre-computed Float32 array
const colorArray = new Float32Array(molecules.length * 3);
for (let i = 0; i < molecules.length; i++) {
  const color = getProbabilityColor(mol.probability);
  colorArray[i * 3 + 0] = color.r;
  colorArray[i * 3 + 1] = color.g;
  colorArray[i * 3 + 2] = color.b;
}

// Assigned once
const attr = new THREE.InstancedBufferAttribute(colorArray, 3);
meshRef.current.instanceColor = attr;
meshRef.current.instanceColor.needsUpdate = true;
```

**Memoization:**
- Recomputed only when `visibility.probabilityColoring` changes
- Cached across frames while visibility unchanged

### FPS Monitoring

**PerformanceMonitor Class:**
```typescript
class PerformanceMonitor {
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
}
```

**Usage in Frame Loop:**
```typescript
const fps = performanceMonitor.update();
const lowPerformance = fps < 50;
setShouldUseGlow(!lowPerformance && probabilityEnabled);
```

## 🧠 Algorithm Details

### Cluster Edge Building

**Similarity Calculation:**
```typescript
function calculatePCASimilarity(mol1: any, mol2: any): number {
  const dx = mol1.pca_x - mol2.pca_x;
  const dy = mol1.pca_y - mol2.pca_y;
  const dz = mol1.pca_z - mol2.pca_z;
  const distance = Math.sqrt(dx² + dy² + dz²);
  return Math.exp(-distance × 0.5);  // Exponential decay
}
```

**Decay Characteristics:**
```
Distance | Similarity | Edge Created?
---------|-----------|----------------
0.0      | 1.00      | Yes (self)
0.5      | 0.78      | Yes
1.0      | 0.61      | Yes
1.5      | 0.47      | No (< 0.6 threshold)
2.0      | 0.37      | No
```

**Edge Selection Algorithm:**
```
1. For each molecule pair (i, j):
   a. Calculate similarity = exp(-distance × 0.5)
   b. If similarity > 0.6:
      - Check edge count for both molecules
      - If both < maxPerMolecule (4):
        * Add edge [i, j]
        * Increment both counts
   c. If totalEdges >= maxTotalEdges (300):
      - Stop processing
2. Return array of [from, to] pairs
```

**Complexity:**
- Time: O(n²) for similarity matrix (< 1000 molecules only)
- Space: O(e) where e = edges (max 300)
- Triggers: Only when dataset < 1000 AND animation enabled

## 🎯 Event Handling

### Pointer Events
```typescript
onPointerMove={(e) => {
  const id = (e as any).instanceId as number;
  setHoveredIndex(id);
  onHover(id);
}}

onPointerOut={() => {
  setHoveredIndex(null);
  onHover(null);
}}

onClick={(e) => {
  const id = (e as any).instanceId as number;
  onSelect(molecules[id]);
}}
```

### Mouse Position Tracking
```typescript
useEffect(() => {
  if (!hoveredMolecule) return;
  
  const handleMouseMove = (e: MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };
  
  window.addEventListener("mousemove", handleMouseMove);
  return () => window.removeEventListener("mousemove", handleMouseMove);
}, [hoveredMolecule]);
```

### Double-Click Camera Reset
```typescript
<OrbitControls
  onDoubleClick={() => {
    orbitControlsRef.current?.reset();
  }}
/>
```

## 📡 Props Interface

### ChemicalUniverse3DProps
```typescript
interface ChemicalUniverse3DProps {
  molecules: ScoredMolecule[];    // All scored molecules
  onSelectMolecule: (mol: ScoredMolecule) => void;  // Selection callback
  selectedMoleculeId: string | null;  // External selection state
  attractorIds?: string[];         // Special highlight molecules
  outbreak?: boolean;              // Show warning banner
  educationMode?: boolean;         // Enable teaching carousel
}
```

## 🔗 Dependencies

### React
- `useState` - UI state
- `useRef` - DOM references
- `useMemo` - Cached computations
- `useEffect` - Side effects
- `useCallback` - Stable function references

### Three.js
- `Vector3`, `Color`, `Object3D` - Math utilities
- `InstancedMesh`, `InstancedBufferAttribute` - Rendering
- `Material`, `Geometry` - Graphics

### React Three Fiber
- `Canvas` - WebGL context
- `useFrame` - Animation loop
- `useThree` - Scene access

### React Three Drei
- `OrbitControls` - Camera interaction
- `Html` - DOM overlays
- `Text` - 3D text labels
- `Line` - Direct line rendering

## 🚀 Extension Points

### Adding New Encodings
```typescript
// 1. Add to LayerVisibilityState
interface LayerVisibilityState {
  // ... existing
  myNewEncoding: boolean;
}

// 2. Add toggle in LayersPanel
<label>
  <input 
    type="checkbox"
    checked={visibility.myNewEncoding}
    onChange={() => onToggle("myNewEncoding")}
  />
  <span>🆕 My New Encoding</span>
</label>

// 3. Update EnhancedInstancedPoints
if (visibility.myNewEncoding) {
  // Compute encoding in useFrame
}
```

### Custom Color Schemes
```typescript
// Modify visualization3dUtils.ts
export function getProbabilityColor(p: number): THREE.Color {
  // Replace blue-green-yellow-red with custom gradient
}
```

### Adding Filter Controls
```typescript
// Create new component FilterPanel
function FilterPanel({ onFilter }: { onFilter: (fn: FilterFunc) => void }) {
  // Sliders for MW, LogP, Toxicity, etc.
}

// Pass displayed molecules through filter
const filtered = useMemo(() => 
  displayed.filter(filterFunction),
  [displayed, filterFunction]
);
```

## 🐛 Debugging Tips

### Enable Three.js Debug Mode
```typescript
gl.debug.checkShaderErrors = true;
gl.debug.onShaderError = (gl, program, err) => console.error(err);
```

### Monitor Instance Updates
```typescript
useFrame(() => {
  if (meshRef.current) {
    const geometry = meshRef.current.geometry;
    console.log('Instances:', geometry.attributes);
  }
});
```

### Check FPS Drops
```typescript
const fps = performanceMonitor.getFPS();
console.log(`FPS: ${fps.toFixed(1)}`);
if (fps < 50) console.warn('Low performance!');
```

### Validate Color Gradient
```typescript
for (let p = 0; p <= 1.0; p += 0.1) {
  const color = getProbabilityColor(p);
  console.log(`p=${p}: rgb(${color.r}, ${color.g}, ${color.b})`);
}
```
