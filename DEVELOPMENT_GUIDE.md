# Supply Chain Idle - Development Guide

This guide explains how to understand, modify, and extend the Supply Chain Idle game.

---

## Architecture Overview

### Core Components

```
src/
├── lib/
│   ├── three-renderer.js          # 3D engine, models, lighting, day/night
│   ├── gameStore.js               # Game state management
│   └── ...
├── components/
│   ├── MainMenu.jsx               # Main menu with animations
│   ├── Game3D.jsx                 # Game world and UI
│   ├── BuilderMode.jsx            # Builder/editor interface
│   └── ...
└── ...
public/
└── models/                        # All 3D assets organized by category
    ├── buildings/                 # Farm, warehouse, factory, etc.
    ├── characters/                # Worker and NPC models
    ├── landscape/                 # Trees, rocks, flowers, terrain
    ├── structures/                # Fences, gates, bridges, wells
    ├── props/                     # Barrels, crates, pallets, etc.
    ├── items/                     # Collectible items
    ├── vehicles/                  # Carts, trucks, boats
    ├── effects/                   # Particle effects
    └── ui/                        # UI decorative elements
```

---

## The 3D Rendering System

### File: `src/lib/three-renderer.js`

This is the heart of the game's visual system. Key sections:

#### 1. **Initialization** (Lines 6-92)
```javascript
constructor(canvas, gameStore, options) {
  // Scene setup with Three.js
  // Camera configuration
  // Lighting setup
  // Model manifest creation
}
```

#### 2. **Model Loading System** (Lines 48-102)
- **targetSizes**: Maps each model to a height for consistent scaling
- **folders**: Defines model categories and names
- **modelManifest**: Maps model keys to .glb file paths
- **specialMappings**: Handles capital-letter filenames

#### 3. **Procedural Factory** `pf()` (Lines 147-205)
When a .glb file doesn't exist, this function generates 3D models using Three.js geometries:

```javascript
pf(key, h) {
  const g = new THREE.Group();

  if(key === 'farm') {
    // Create farm using Box, Cone, Cylinder geometries
    // Add components to group
    // Return group
  }

  // ... more models ...

  // Generic fallback for unknown models
  return g;
}
```

#### 4. **Day/Night Cycle** (Lines 271-346)
```javascript
updateDayNightCycle(dt) {
  // Update time of day
  // Move sun across sky
  // Change colors (orange → white → orange → dark)
  // Update lighting intensity
  // Update fog color
}
```

#### 5. **Model Retrieval** (Lines 134-143)
```javascript
getModel(name) {
  // Check if .glb is loaded
  // Clone and scale to target size
  // Position properly
  // Return ready-to-place model
}
```

---

## How to Add New Content

### Adding a New Building

**Step 1**: Create the .glb file
- Place in `public/models/buildings/my-building.glb`
- Or use procedural implementation (see Step 3)

**Step 2**: Add to manifest (src/lib/three-renderer.js)
```javascript
// Line 74: Add to buildings array
const folders = {
  buildings: [..., 'my-building'],
  // ...
};
```

**Step 3**: Add size mapping (src/lib/three-renderer.js)
```javascript
// Line 49: Add to targetSizes
this.targetSizes = {
  'my-building': 6,  // Height in units
  // ...
};
```

**Step 4**: Add procedural fallback (OPTIONAL, src/lib/three-renderer.js)
```javascript
// Line 149: In pf() function
if(key === 'my-building') {
  g.add(Object.assign(
    this.mk(new THREE.BoxGeometry(6, 3, 5), 0x8B4513),
    {position: new THREE.Vector3(0, 1.5, 0)}
  ));
  return g;
}
```

### Adding New Character/NPC

**Step 1**: Create .glb file
- Place in `public/models/characters/npc-name.glb`

**Step 2**: Add to manifest (src/lib/three-renderer.js, Line 75)
```javascript
characters: [..., 'npc-name'],
```

**Step 3**: Add size mapping (Line 67)
```javascript
'npc-name': 1.6,  // Typical character height
```

**Step 4**: Add to procedural factory (Line 201)
```javascript
if(key.startsWith('worker') || key === 'npc-name') {
  const cols = { ..., 'npc-name': 0xYYYYYY };
  // Create NPC using colors
}
```

### Adding New Landscape Element

**Step 1**: Create .glb file
- Place in `public/models/landscape/element-name.glb`

**Step 2**: Add to folders (Line 76)
```javascript
landscape: [..., 'element-name'],
```

**Step 3**: Add size (Line 55-58)
```javascript
'element-name': 5,  // Size in units
```

**Step 4**: Add procedural version if needed
- Follow tree, flower, or rock pattern
- Trees use startsWith('tree')
- Rocks use startsWith('rock')
- Flowers use startsWith('flower')

---

## Styling the Main Menu

### File: `src/components/MainMenu.jsx`

Key sections:

#### Header Section
- Logo and title
- Gradient background
- Accent decorative lines

#### Menu Buttons
```javascript
const buttonStyle = {
  background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.15) 0%, rgba(74, 222, 128, 0.05) 100%)',
  border: '2px solid #4ade80',
  // ... more styles
};
```

#### Character Loading
```javascript
const characterModels = ['worker-farmer', 'worker-processor', 'npc-merchant', 'worker-base'];
const characterPositions = [
  { x: -15, z: 5 },
  { x: 15, z: 5 },
  // ... more positions
];
```

#### Animation Loop
```javascript
// Character bobbing
char.model.position.y = baseY + Math.sin(time * char.bobSpeed) * char.bobAmount;

// Character rotation
char.model.rotation.y = Math.sin(time * 0.3 + idx) * 0.3;

// Camera animation
// Tree swaying
```

### To Modify Menu Appearance:
1. Change colors in gradient definitions
2. Adjust lighting values (ambientLight intensity)
3. Modify character positions/animations
4. Change background gradients

---

## Understanding the Game UI

### File: `src/components/Game3D.jsx`

Main game interface with:
- Resource displays
- Building menu
- Settings
- World interaction

### Panel Styling Pattern
```javascript
const panelStyle = {
  background: 'rgba(20, 28, 48, 0.95)',
  border: '1px solid rgba(71, 137, 217, 0.25)',
  color: '#e0e7ff',
  padding: '12px',
  borderRadius: '6px',
};
```

### To Add New UI Elements:
1. Create style object with similar pattern
2. Use color variables for consistency:
   - Dark background: `rgba(20, 28, 48, 0.95)`
   - Border color: `rgba(71, 137, 217, 0.25)`
   - Text color: `#e0e7ff`
3. Add to JSX with conditional rendering

---

## Day/Night Cycle Customization

In `src/lib/three-renderer.js` (Lines 271-346):

### Adjust Cycle Speed
```javascript
this.cycleSpeed = 0.00005;  // Lower = slower cycle
```

### Modify Sun Colors
```javascript
// Adjust these colors for different atmosphere:
sunColor = new THREE.Color(0xff9950);  // Orange
sunColor = new THREE.Color(0xfff5e6);  // White
sunColor = new THREE.Color(0xff6b35);  // Red-orange
```

### Change Sky Colors
```javascript
topColor: new THREE.Color(0x87ceeb);    // Light blue
bottomColor: new THREE.Color(0xe6f3ff); // Very light blue
```

### Lighting Intensity
```javascript
sunIntensity = 1.0;        // Noon brightness
ambientIntensity = 0.5;    // Ambient light strength
```

---

## Building the Game

### Development
```bash
npm run dev
```
- Hot reload enabled
- See console errors immediately

### Production Build
```bash
npm run build
```
- Optimized output in `dist/`
- ~227KB gzipped

### Testing Locally
```bash
npm run preview
```
- Serves production build locally
- Test final performance

---

## Performance Tips

### Model Optimization
- Keep procedural implementations simple
- Use fewer vertices in geometries
- Reuse geometries where possible

### Lighting
- Shadow maps are 2048x2048 (moderate quality)
- Increase for better shadows, decrease for performance
- Only directional light casts shadows

### Terrain
- Terrain is a 2000x2000 plane with 100x100 segments
- Increase segments for detail, decrease for performance

---

## Debugging

### Browser Console
Check for:
- Model loading errors
- Three.js warnings
- Animation frame rate issues

### Common Issues

**Model not appearing:**
1. Check targetSizes has entry
2. Verify .glb path is correct
3. Check procedural implementation in pf()
4. Look for console errors

**Performance drops:**
1. Check how many models are visible
2. Monitor shadow map performance
3. Reduce terrain complexity
4. Check for animation loop issues

**UI looks wrong:**
1. Check browser zoom level
2. Verify CSS classes are applied
3. Check gradient color values
4. Test on different screen sizes

---

## Code Style & Patterns

### Naming Conventions
- **Variables**: camelCase (`myVariable`)
- **Classes**: PascalCase (`MyClass`)
- **Constants**: UPPER_SNAKE_CASE (`MY_CONSTANT`)
- **Files**: kebab-case (`my-file.js`) or PascalCase for React

### Three.js Patterns
```javascript
// Creating geometry
const geo = new THREE.BoxGeometry(width, height, depth, segmentsX, segmentsY, segmentsZ);

// Creating material
const mat = new THREE.MeshLambertMaterial({color: 0xFFFFFF});

// Creating mesh
const mesh = new THREE.Mesh(geo, mat);
mesh.castShadow = true;
mesh.receiveShadow = true;

// Adding to scene
scene.add(mesh);
```

### React Patterns
```javascript
// Inline styles for 3D UI
const style = {
  position: 'absolute',
  background: 'linear-gradient(...)',
  transition: 'all 0.3s ease',
};

// Conditional rendering
{showPanel && <div style={panelStyle}>...</div>}

// Event handlers
onClick={() => handleClick()}
```

---

## Future Enhancements

### High Priority
- [ ] Game balance and economy tuning
- [ ] Save/load functionality
- [ ] Audio system

### Medium Priority
- [ ] Advanced particle effects
- [ ] LOD system for performance
- [ ] NPC behavior/pathfinding

### Low Priority
- [ ] Premium model replacements
- [ ] Advanced physics
- [ ] Multiplayer support

---

## Getting Help

### Documentation
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Project overview
- [MODEL_SYSTEM.md](./MODEL_SYSTEM.md) - Detailed model system
- Comments in `src/lib/three-renderer.js`

### Resources
- [Three.js Documentation](https://threejs.org/docs)
- [React Documentation](https://react.dev)
- Recent git commits for context

---

*Last Updated: Session 2 Final
For model-specific details, see [MODEL_SYSTEM.md](./MODEL_SYSTEM.md)*
