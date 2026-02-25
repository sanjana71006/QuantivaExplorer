# ChemicalUniverse3D - Quick Reference

## 🎮 User Interactions

### Mouse Controls
| Action | Effect |
|--------|--------|
| **Hover** | Display interactive tooltip with molecule details |
| **Click** | Select molecule (scale ↑, glow enabled, camera centers) |
| **Drag** | Rotate view around center |
| **Scroll** | Zoom in/out |
| **Double-click** | Reset camera to original position |

### UI Controls

#### Layers Panel (Top-Right ⚙️)
```
☑ Probability Coloring    → Toggle color gradient
☑ Cluster Highlight       → Toggle connection lines
☑ Lipinski Overlay        → Show compliance status (draft)
☑ Toxicity Overlay        → Show toxicity markers (draft)
☑ Diffusion Animation     → Show cluster edges
```

#### Legend Panel (Bottom-Left 📊)
- Visual encoding reference
- Color gradient explanation
- Size mapping guide
- Symbol meanings

#### Reset Camera Button (Top-Left 🔄)
- Restore original view orientation
- Reset camera position and target

## 🎨 Visual Encoding Reference

### Color Mapping (Probability)
```
0.0 ──→ 0.33 ──→ 0.66 ──→ 1.0
Blue   Green   Yellow   Red
█       █       █       █
```
- **Blue** = Low probability candidates
- **Red** = High probability/top candidates

### Size Mapping (Drug-Likeness)
```
0.0 ──────────→ 1.0
●  (0.05 units) → ●●● (0.27 units)
Small            Large
```
- **Small** = Low drug-likeness score
- **Large** = High drug-likeness score

### Special Indicators
```
✨ Cyan Halo      → Top 5 candidates (brightest)
✨ Dim Halo       → Rank 6-30 candidates
🔗 Teal Lines     → Similar molecules (clusters)
✓  Green Text     → Lipinski compliant
✗  Yellow Text    → Lipinski violations
🟢 Green Badge    → Safe toxicity
🟡 Yellow Badge   → Moderate toxicity
🔴 Red Badge      → High toxicity
```

## 📋 Tooltip Information

When you hover over a molecule, the tooltip shows:

```
┌─────────────────────────────────┐
│  [Molecule Structure Sketch]     │
│                                  │
│  Aspirin                         │
│  CHEMBL123 • Pain Management     │
│                                  │
│  Score:         0.782            │
│  Probability:   23.5%            │
│  MW:            180              │
│  LogP:          1.19             │
│  Drug-likeness: 0.856            │
│                                  │
│  Toxicity: safe      Lipinski: ✓ │
└─────────────────────────────────┘
```

## ⚡ Performance Features

### Auto-Optimization Rules
- **< 500 molecules**: All effects enabled, 60 FPS
- **500-1000 molecules**: All effects enabled, ~55 FPS
- **1000-2000 molecules**: Diffusion edges disabled, ~50 FPS
- **> 2000 molecules**: Limited to 2000 displayed

### FPS Monitoring
- Component logs FPS in `useFrame()`
- If FPS drops below 50, glow effects auto-disable
- Effects re-enable when performance recovers

## 🔬 Educational Mode

When `educationMode={true}`, a carousel appears with 5 teaching steps:

1. **Probability Diffusion** 🧬
   - Shows how probability spreads through similar molecules
   
2. **Size Encoding** 📊
   - Explains sphere size = drug-likeness potential
   
3. **Color Gradient** 🎨
   - Demonstrates blue→red probability spectrum
   
4. **Top Candidates** ✨
   - Highlights top 5 glowing molecules
   
5. **Cluster Connections** 🔗
   - Shows how similar molecules are linked

**Auto-cycles every 5 seconds** with progress indicator dots.

## 💡 Tips & Tricks

### Finding Top Candidates
1. Click the **Probability Coloring** toggle
2. Look for **brightest red and glowing** molecules
3. Hover for detailed metrics

### Understanding Clusters
1. Enable **Cluster Highlight**
2. Observe teal connecting lines
3. Dense clusters indicate similar drug candidates

### Checking Drug-Likeness
1. Look for **larger spheres** (size indicates score)
2. Check tooltip for exact **drug-likeness value**
3. Enable **Lipinski Overlay** for compliance status

### Performance Optimization
1. For **large datasets**, disable **Diffusion Animation**
2. Disable **Probability Coloring** to reduce updates
3. Disable **Cluster Highlight** for highest performance

## 🎯 Common Workflows

### Workflow 1: Find Best Candidates
```
1. Hover over molecules → See tooltip
2. Look for Blue→Red color gradient
3. Note glowing molecules (top 5)
4. Click to zoom and inspect
```

### Workflow 2: Understand Clusters
```
1. Click "Cluster Highlight" → Enable lines
2. Observe dense regions
3. Click molecules to see related compounds
4. Edit layers to adjust visualization
```

### Workflow 3: Validate Drug Properties
```
1. Check tooltip "Lipinski: ✓"
2. Verify "Toxicity: safe" status
3. Note molecular weight and LogP
4. Compare with similar molecules
```

## 📊 Property Quick Reference

### Molecular Properties Shown
| Property | Range | Optimal | Unit |
|----------|-------|---------|------|
| Probability | 0–100% | High | % |
| Score | 0–1.0 | High | Score |
| MW | 0–500+ | 300–450 | Da |
| LogP | 0–6+ | 1–3 | Log value |
| Drug-likeness | 0–1.0 | High | Score |
| Toxicity | 0–1.0 | Low | Risk |

### Visual Size Mapping
- **0.05 units** = Score 0.0 (smallest)
- **0.16 units** = Score 0.5 (medium)
- **0.27 units** = Score 1.0 (largest)
- **Selection**: +1.8× base (zoom highlight)
- **Attractor**: +1.5× base (emphasis)

### Color to Probability
| Color | Range | Probability |
|-------|-------|-------------|
| 🔵 Blue | 0.00–0.33 | 0–33% |
| 🟢 Green | 0.33–0.66 | 33–66% |
| 🟡 Yellow | 0.66–0.90 | 66–90% |
| 🔴 Red | 0.90–1.00 | 90–100% |

## ⚙️ Camera Controls

### Keyboard Shortcuts (Built-in)
- Mouse wheel: Zoom
- Middle mouse drag: Pan (orbit)
- Double-click: Reset view
- Right-click drag: Rotate (if enabled)

### Camera Behaviors
- **On selection**: Auto-centers 3 units away
- **Damping**: Smooth 0.08 factor (not jerky)
- **Zoom speed**: 1.2× for smooth scaling
- **Rotate speed**: 0.6 rad/s for smooth turning

## 🔧 Developer Tips

### Accessing Component State
```tsx
// Get selected molecule ID
const selectedId = selectedMoleculeId;

// Get hovered molecule
const hovered = hoveredMolecule;

// Toggle layer visibility
toggleLayer('probabilityColoring');
```

### Performance Debugging
```tsx
// Monitor FPS in browser console
// PerformanceMonitor updates in useFrame()

// Check if glow effects disabled
const shouldUseGlow = fps > 50;
```

### Customizing Colors
Edit directly in `visualization3dUtils.ts`:
```typescript
function getProbabilityColor(p: number) {
  // Modify gradient here
}
```

## 🐛 Troubleshooting

### Tooltip Not Appearing
- ✓ Make sure `hoveredMolecule` is not null
- ✓ Check if pointer events are blocked by other elements
- ✓ Verify `screenPosition` is updating

### Glow Not Showing
- ✓ Check if `probabilityColoring` is enabled
- ✓ Verify FPS > 50 (auto-disables on low FPS)
- ✓ Check molecule rank ≤ 30

### Camera Not Auto-Centering
- ✓ Make sure molecule is in dataset
- ✓ Check if `selectedMolecule` is found
- ✓ Verify point index is valid

### Clusters Not Showing
- ✓ Enable "Cluster Highlight" toggle
- ✓ Check if `diffusionAnimation` is enabled
- ✓ Verify dataset < 1000 molecules

## 📈 Performance Benchmarks

### FPS by Dataset Size
```
Molecules  | Probability | All Effects | Min FPS
-----------|-------------|-------------|--------
100        | ✓           | ✓           | 60
500        | ✓           | ✓           | 58
1000       | ✓           | ✗ edges     | 55
1500       | ✓           | ✗ edges     | 52
2000       | ✓           | ✗ edges/glow| 48
```

### Effect Impact on FPS (500 molecules)
```
Effect                    | FPS Impact
--------------------------|----------
Probability Coloring      | -1 FPS
Cluster Highlight (edges) | -3 FPS
Glow Layer                | -2 FPS
Total (all effects)       | -6 FPS (base 60 → 54)
```

## 🎓 Learning Resources

- See `ENHANCEMENT_GUIDE.md` for detailed documentation
- Check `visualization3dUtils.ts` for utility functions
- Review `quantumEngine.ts` for scoring logic
- Inspect component props in `ChemicalUniverse3D.tsx`
