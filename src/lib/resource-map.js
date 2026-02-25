import { createNoise2D } from 'simplex-noise';
import { MINERALS, OIL_GAS } from '../data/minerals';

// ═══════════════════════════════════════════
//  RESOURCE MAP — Hidden Underground Layer
//  Generates from seed, query any (x,z) to
//  find what mineral/oil/gas exists there.
// ═══════════════════════════════════════════

// Simple seeded PRNG (mulberry32)
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class ResourceMap {
  constructor(seed = 42) {
    this.seed = seed;
    const rng = mulberry32(seed);

    // Create separate noise functions for each resource layer
    // Each gets a different seed offset so patterns don't overlap
    this.noiseLayers = {};

    // Mineral layers
    Object.values(MINERALS).forEach((mineral, i) => {
      const layerRng = mulberry32(seed + i * 1000 + 100);
      this.noiseLayers[mineral.id] = createNoise2D(layerRng);
    });

    // Oil layer (separate from minerals)
    const oilRng = mulberry32(seed + 5000);
    this.noiseLayers['oil'] = createNoise2D(oilRng);

    // Gas shares oil noise but with higher threshold
    // (gas is a subset of oil zones)
    this.noiseLayers['gas'] = this.noiseLayers['oil'];
  }

  // Sample noise for a specific resource at world position (x, z)
  sampleNoise(resourceId, x, z) {
    const noiseFn = this.noiseLayers[resourceId];
    if (!noiseFn) return 0;

    const def = MINERALS[resourceId] || OIL_GAS[resourceId];
    if (!def) return 0;

    // Sample at the resource's frequency
    const raw = noiseFn(x * def.noiseFreq, z * def.noiseFreq);
    // Normalize from [-1,1] to [0,1]
    return (raw + 1) / 2;
  }

  // Get what resource exists at position (x, z)
  // Returns { id, name, icon, color, ... } or null
  getResourceAt(x, z) {
    // Check minerals first (rarer ones take priority)
    // Priority order: diamonds > gold > copper > iron > coal
    const priority = ['diamonds', 'gold', 'copper', 'iron', 'coal'];
    for (const id of priority) {
      const mineral = MINERALS[id];
      const value = this.sampleNoise(id, x, z);
      if (value > mineral.threshold) {
        return { type: 'mineral', ...mineral };
      }
    }

    // Check oil
    const oilDef = OIL_GAS['oil'];
    const oilValue = this.sampleNoise('oil', x, z);
    if (oilValue > oilDef.threshold) {
      // Check if gas is also present (higher threshold subset)
      const gasDef = OIL_GAS['gas'];
      const gasValue = this.sampleNoise('gas', x, z);
      if (gasValue > gasDef.threshold) {
        return { type: 'oilgas', ...oilDef, hasGas: true };
      }
      return { type: 'oil', ...oilDef, hasGas: false };
    }

    return null; // nothing here
  }

  // Get all resources in a radius around (cx, cz)
  // Returns array of { x, z, resource } hits
  // Samples on a grid within the radius
  surveyArea(cx, cz, radius, step = 5) {
    const results = [];
    const found = new Set();

    for (let dx = -radius; dx <= radius; dx += step) {
      for (let dz = -radius; dz <= radius; dz += step) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > radius) continue;

        const x = cx + dx;
        const z = cz + dz;
        const resource = this.getResourceAt(x, z);
        if (resource && !found.has(resource.id)) {
          found.add(resource.id);
          results.push({ x, z, resource });
        }
      }
    }
    return results;
  }

  // Get a heatmap of resource density for visualization
  // Returns 2D array of { x, z, resources: [{id, value}] }
  getHeatmap(cx, cz, size = 200, resolution = 10) {
    const points = [];
    const half = size / 2;

    for (let x = cx - half; x <= cx + half; x += resolution) {
      for (let z = cz - half; z <= cz + half; z += resolution) {
        const resources = [];

        // Sample all minerals
        Object.values(MINERALS).forEach(mineral => {
          const value = this.sampleNoise(mineral.id, x, z);
          if (value > mineral.threshold * 0.8) { // show slightly wider for heatmap
            resources.push({ id: mineral.id, value, color: mineral.color });
          }
        });

        // Sample oil
        const oilValue = this.sampleNoise('oil', x, z);
        if (oilValue > OIL_GAS.oil.threshold * 0.8) {
          resources.push({ id: 'oil', value: oilValue, color: OIL_GAS.oil.color });
        }

        if (resources.length > 0) {
          // Sort by value, return the strongest
          resources.sort((a, b) => b.value - a.value);
          points.push({ x, z, resource: resources[0] });
        }
      }
    }
    return points;
  }
}
