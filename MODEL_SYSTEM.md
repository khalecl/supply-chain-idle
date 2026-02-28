# Supply Chain Idle - Model System Documentation

Comprehensive guide to understanding and working with the 3D model system.

---

## Model System Overview

The model system has **two-tier loading**:

```
┌─────────────────────────────────────┐
│   Model Request (getModel/...)      │
└──────────────┬──────────────────────┘
               │
        ┌──────▼──────┐
        │  Check Maps │
        └──────┬──────┘
               │
      ┌────────┴────────┐
      │                 │
   ✅ Found        ❌ Not Found
      │                 │
      │        ┌────────▼────────┐
      │        │  Try GLTFLoader │
      │        └────────┬────────┘
      │                 │
      │      ┌──────────┴──────────┐
      │      │                     │
      │   ✅ Loaded          ❌ Not Found
      │      │                     │
      │      │        ┌────────────▼────────────┐
      │      │        │  Generate Procedural    │
      │      │        │  Model (pf function)    │
      │      │        └─────────────────────────┘
      │      │                     │
      └──────┴─────────┬───────────┘
                       │
              ┌────────▼────────┐
              │  Scale & Return │
              │  to Game        │
              └─────────────────┘
```

---

## Component 1: Model Manifest

### Location: `src/lib/three-renderer.js`, Lines 73-102

### Purpose
Maps model names to file paths for loading.

### Structure

```javascript
const folders = {
  buildings: ['farm', 'warehouse', 'factory', ...],
  characters: ['worker-base', 'worker-farmer', ...],
  landscape: ['tree-oak', 'tree-pine', ...],
  structures: ['fence-wood', 'fence-stone', ...],
  props: ['barrel', 'crate', ...],
  items: ['coin', 'chest', ...],
  vehicles: ['cart', 'truck', ...],
  effects: ['dust-particles', 'fire-particle', ...],
  ui: ['arrow', 'flag-ui', 'star-ui'],
};

// Auto-generates paths: models/buildings/farm.glb, etc.
for (const [folder, names] of Object.entries(folders)) {
  for (const name of names) {
    this.modelManifest[name] = `${base}models/${folder}/${name}.glb`;
  }
}

// Special cases for non-standard filenames
const specialMappings = {
  'bakery': `${base}models/buildings/Bakery.glb`,  // Capital letter
  'mill': `${base}models/buildings/Mill.glb`,
  'truck': `${base}models/vehicles/Truck.glb`,
  // ... more mappings
};
Object.assign(this.modelManifest, specialMappings);
```

### How to Update
1. Add model name to appropriate folder array
2. Place .glb file in `public/models/{folder}/{name}.glb`
3. If filename doesn't match (e.g., capital letters), add to specialMappings

---

## Component 2: Target Sizes

### Location: `src/lib/three-renderer.js`, Lines 49-69

### Purpose
Defines how tall each model should be in the game world.

### Why It Matters
- Ensures consistent visual scale
- Farm isn't tiny, tree isn't huge
- Automatically scales loaded models to target height

### Structure

```javascript
this.targetSizes = {
  'farm': 6,              // Farm is 6 units tall
  'worker-base': 1.6,     // Worker is 1.6 units tall
  'tree-oak': 5,          // Tree is 5 units tall
  'fence-wood': 1.5,      // Fence is 1.5 units tall
  'coin': 0.3,            // Coin is 0.3 units tall
  // ... 100+ more entries
};
```

### Typical Ranges
- **Buildings**: 5-10 units
- **Workers/NPCs**: 1.5-2 units
- **Trees/Large Objects**: 4-7 units
- **Small Props**: 0.5-2 units
- **Items**: 0.2-1 unit

### To Adjust Size
Change the number for any model:
```javascript
'my-building': 7,  // Increased from 6 to 7
```

---

## Component 3: Model Loading

### Location: `src/lib/three-renderer.js`, Lines 101-110

### The Loading Process

```javascript
async loadModel(name, path) {
  try {
    // 1. Request .glb file from path
    const gltf = await this.gltfLoader.loadAsync(path);

    // 2. Extract scene
    const model = gltf.scene;

    // 3. Enable shadows on all meshes
    model.traverse(n => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });

    // 4. Measure natural height
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    // 5. Store in cache with natural height
    this.models.set(name, {
      scene: model,
      naturalHeight: Math.max(size.y, 0.01)
    });
  } catch(e) {
    // Silently fail - procedural fallback will be used
  }
}
```

### What Happens When Loading Fails
1. Promise silently catches error
2. Model doesn't get cached
3. When requested, procedural factory creates it
4. Game continues without missing models

---

## Component 4: Model Retrieval & Scaling

### Location: `src/lib/three-renderer.js`, Lines 134-143

### The Retrieval Process

```javascript
getModel(name) {
  const key = name.toLowerCase();
  const target = this.targetSizes[key] || 2;  // Default to 2 if not found

  // Try to get from cache
  const entry = this.models.get(key);

  if (entry) {
    // Scale the cached model to target size
    const clone = entry.scene.clone();
    const scale = target / entry.naturalHeight;
    clone.scale.set(scale, scale, scale);

    // Position at origin
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.y = -box.min.y;

    return clone;
  }

  // Fallback to procedural generation
  return this.pf(key, target);
}
```

### Key Steps Explained

**1. Get Target Size**
```javascript
const target = this.targetSizes[key] || 2;
```
- Looks up how tall model should be
- Falls back to 2 units if not specified

**2. Get Cached Model**
```javascript
const entry = this.models.get(key);
```
- Check if .glb was loaded successfully
- Cache stores original model and its natural height

**3. Scale to Target**
```javascript
const scale = target / entry.naturalHeight;
clone.scale.set(scale, scale, scale);
```
- Calculate scale factor
- Natural height 4 units → target 6 units = scale 1.5

**4. Position Properly**
```javascript
const box = new THREE.Box3().setFromObject(clone);
clone.position.y = -box.min.y;
```
- Ensures model sits on ground (y=0)
- Not floating or clipping below

---

## Component 5: Procedural Factory

### Location: `src/lib/three-renderer.js`, Lines 147-205

### Purpose
Creates 3D models using Three.js geometries when .glb files don't exist.

### How It Works

```javascript
pf(key, h) {
  const g = new THREE.Group();

  // Check key and create appropriate model
  if (key === 'farm') {
    // Create farm with Box, Cone, Cylinder primitives
    g.add(/* ... */);
    return g;
  }

  // ... more models ...

  // If key doesn't match any case, return generic box
  g.add(this.mk(new THREE.BoxGeometry(h*0.6, h, h*0.6), 0xaaaaaa));
  return g;
}
```

### Key Functions

**Helper: `mk(geometry, color)`**
```javascript
mk(geo, color) {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color}));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
```
- Creates mesh from geometry
- Applies color
- Enables shadows
- Returns ready-to-use mesh

### Common Patterns

**Box Building**
```javascript
if(key === 'warehouse') {
  g.add(Object.assign(
    this.mk(new THREE.BoxGeometry(8, 4, 6), 0xe67e22),
    {position: new THREE.Vector3(0, 2, 0)}
  ));
  return g;
}
```

**Cone Roof Building**
```javascript
if(key === 'farm') {
  // Base
  g.add(Object.assign(this.mk(...BoxGeometry..., 0x8B4513), {...}));
  // Roof
  g.add(Object.assign(this.mk(...ConeGeometry..., 0xc0392b), {...}));
  return g;
}
```

**Character (Worker)**
```javascript
if(key.startsWith('worker')) {
  // Body
  g.add(this.mk(...CylinderGeometry..., color));
  // Head
  g.add(this.mk(...SphereGeometry..., skinColor));
  return g;
}
```

**Using startsWith for Categories**
```javascript
if(key.startsWith('smelter')) {
  // Works for: smelterIron, smelterCopper, smelterGold
  g.add(/* same base factory */);
  return g;
}
```

### Three.js Geometries Available

| Geometry | Use Case | Example |
|----------|----------|---------|
| `BoxGeometry` | Buildings, boxes, platforms | Warehouse, crate |
| `ConeGeometry` | Roofs, trees, tents | Farm roof, pine tree |
| `CylinderGeometry` | Towers, trunks, pipes | Windmill, tree trunk |
| `SphereGeometry` | Heads, balls, round objects | Worker head, mushroom cap |
| `PlaneGeometry` | Flat surfaces, flags | Market stall top, flag |
| `DodecahedronGeometry` | Irregular rocks | Rock cluster |

---

## Adding a New Procedural Model

### Example: Creating "Lighthouse"

**Step 1**: Determine shape
- Tall tower + light at top
- Use Cylinder for tower, SphereGeometry for light

**Step 2**: Add to targetSizes (Line 69)
```javascript
'lighthouse': 8,  // 8 units tall
```

**Step 3**: Add to procedural factory (Line 200)
```javascript
if(key === 'lighthouse') {
  // Main tower
  g.add(Object.assign(
    this.mk(new THREE.CylinderGeometry(1, 1.2, 7, 8), 0xffffff),
    {position: new THREE.Vector3(0, 3.5, 0)}
  ));

  // Light at top
  g.add(Object.assign(
    this.mk(new THREE.SphereGeometry(0.5, 8, 6), 0xffff00),
    {position: new THREE.Vector3(0, 8, 0)}
  ));

  return g;
}
```

**Step 4**: Use in game
```javascript
const lighthouse = renderer.getModel('lighthouse');
scene.add(lighthouse);
```

---

## Model Categories Explained

### Buildings (23 total)
Production facilities and storage. Typically 5-10 units tall.
- Farms, mills, factories
- Smelters, foundries, warehouses
- Processing facilities

### Characters (6 total)
NPCs and workers. Typically 1.5-2 units tall.
- Workers (farmer, baker, processor, factory)
- NPCs (merchant, base worker)

### Landscape (27 total)
Environment and terrain elements. Varies widely.
- **Trees** (oak, pine, willow, palm, dead, stump): 4-7 units
- **Rocks** (large, small, flat, cluster): 0.5-2 units
- **Flowers** (red, yellow, blue): Small clusters
- **Terrain** (mountains, hills, cliffs): 8-35 units
- **Water** (pond, river-straight, river-bend): 0.5-1 unit

### Structures (11 total)
Infrastructure and utilities. Varies by type.
- Fences, gates, bridges
- Wells, windmills, water towers
- Market stalls, signposts, lamp posts, benches

### Props (9 total)
Decorative and functional items. 0.5-3 units.
- Storage (barrel, crate, pallet)
- Resources (sack, wheelbarrow)
- Decoration (campfire, tent, flag, fountain)

### Items (8 total)
Collectible game objects. Less than 1 unit.
- Resources (cotton-bundle, wheat-bundle)
- Products (cloth-roll, flour-sack, bread-basket, textile-box)
- Special (coin, chest)

### Vehicles (5 total)
Transportation. 2-3 units.
- Land (cart, truck, wagon)
- Water (boat, ship)

### Effects (4 total)
Visual effects for events. Procedural particles.
- Dust-particles (gray spheres)
- Fire-particle (orange flame effect)
- Smoke-particle (gray smoke)
- Spark-particle (yellow sparks)

### UI (3 total)
User interface decorative elements. Small, 0.5-1 unit.
- Arrow (pointer)
- Flag-ui (flag decoration)
- Star-ui (achievement marker)

---

## Performance Optimization

### Reducing File Size
- Use .glb format instead of .gltf (binary vs text)
- Compress textures
- Remove unused materials
- Reduce polygon count

### Reducing Load Time
- Don't load all models at once in large games
- Use LOD (Level of Detail) system
- Load procedural versions first, swap .glb later
- Implement model pooling (reuse clones)

### Rendering Performance
- Limit shadow-casting objects
- Use less detailed procedural models for distant objects
- Implement frustum culling (don't render offscreen)
- Consider LOD system for distant objects

---

## Troubleshooting

### Model Not Appearing

**Check 1**: Size mapping exists
```javascript
// In console:
renderer.targetSizes['my-model']  // Should return a number
```

**Check 2**: Path is correct
```javascript
// In console:
renderer.modelManifest['my-model']  // Should show valid path
```

**Check 3**: Procedural fallback implemented
```javascript
// In three-renderer.js, search for:
if(key === 'my-model')  // Should exist
```

**Check 4**: File exists
- Verify `public/models/{category}/{name}.glb` exists
- Check exact filename and case sensitivity

### Model Wrong Scale

**Issue**: Model too big/small

**Solution**: Adjust targetSizes
```javascript
'my-model': 8,  // Increase from 5 to 8
```

Test in game and adjust until correct.

### Model Wrong Color

**Issue**: Procedural model wrong color

**Solution**: Change color in pf() function
```javascript
// Current:
this.mk(new THREE.BoxGeometry(...), 0x8B4513)  // Brown

// Change to:
this.mk(new THREE.BoxGeometry(...), 0xFF0000)  // Red
```

Color format is hexadecimal RGB.

### Performance Drop When Model Loads

**Issue**: Game slows when .glb loads

**Solution**: Implement async loading or use simpler procedural version
- Keep procedural version for initial load
- Load .glb in background and swap
- Or pre-load critical models

---

## Model System Statistics

```
Total Models:              100+
  - GLTFLoader models:     69
  - Procedural fallbacks:  31+

Model Categories:          9
  - buildings              23
  - characters             6
  - landscape              27
  - structures             11
  - props                  9
  - items                  8
  - vehicles               5
  - effects                4
  - ui                     3

Average Model Size:        1-3 KB (.glb)
Procedural Model Cost:     Minimal (math-based)
Total Asset Size:          ~50 MB (includes high-res)
Loaded Bundle Size:        227 KB (gzipped)
```

---

## Advanced: Custom Model Loading

### Load Single Model
```javascript
const model = renderer.getModel('farm');
scene.add(model);
```

### Load and Position
```javascript
const model = renderer.getModel('tree-oak');
model.position.set(10, 0, 20);
scene.add(model);
```

### Load Multiple Copies
```javascript
for (let i = 0; i < 5; i++) {
  const tree = renderer.getModel('tree-oak');
  tree.position.set(i * 10, 0, 0);
  scene.add(tree);
}
```

### Load with Custom Scale
```javascript
const model = renderer.getModel('rock-large');
model.scale.multiplyScalar(1.5);  // 50% larger
scene.add(model);
```

---

## References

- [Three.js Geometries](https://threejs.org/docs/#api/en/geometries/BoxGeometry)
- [GLTF Format](https://www.khronos.org/gltf/)
- [Blender Export to GLB](https://docs.blender.org/manual/en/latest/addons/io_scene_gltf2/index.html)

---

*Last Updated: Session 2 Final
See [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) for broader context*
