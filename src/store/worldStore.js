import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ═══════════════════════════════════════════════════════════════
//  OBJECT CATALOG — 45+ placeable objects for the world builder
// ═══════════════════════════════════════════════════════════════
export const OBJECT_CATALOG = [
  // Trees
  { id: 'tree-oak',        category: 'Trees',       icon: '🌳', label: 'Oak Tree' },
  { id: 'tree-pine',       category: 'Trees',       icon: '🌲', label: 'Pine Tree' },
  { id: 'tree-willow',     category: 'Trees',       icon: '🌳', label: 'Willow Tree' },
  { id: 'tree-palm',       category: 'Trees',       icon: '🌴', label: 'Palm Tree' },
  { id: 'tree-dead',       category: 'Trees',       icon: '🪵', label: 'Dead Tree' },
  { id: 'tree-stump',      category: 'Trees',       icon: '🪵', label: 'Tree Stump' },

  // Plants & Vegetation
  { id: 'bush',            category: 'Plants',      icon: '🌿', label: 'Bush' },
  { id: 'grass-tuft',      category: 'Plants',      icon: '🌱', label: 'Grass Tuft' },
  { id: 'flower-red',      category: 'Plants',      icon: '🌹', label: 'Red Flowers' },
  { id: 'flower-yellow',   category: 'Plants',      icon: '🌻', label: 'Yellow Flowers' },
  { id: 'flower-blue',     category: 'Plants',      icon: '💐', label: 'Blue Flowers' },
  { id: 'hedge',           category: 'Plants',      icon: '🌳', label: 'Hedge Wall' },
  { id: 'mushroom',        category: 'Plants',      icon: '🍄', label: 'Mushroom' },
  { id: 'crop-row',        category: 'Plants',      icon: '🌾', label: 'Crop Row' },
  { id: 'haystack',        category: 'Plants',      icon: '🟡', label: 'Haystack' },
  { id: 'fallen-log',      category: 'Plants',      icon: '🪵', label: 'Fallen Log' },

  // Rocks & Terrain
  { id: 'rock-large',      category: 'Rocks',       icon: '🪨', label: 'Large Rock' },
  { id: 'rock-small',      category: 'Rocks',       icon: '🪨', label: 'Small Rock' },
  { id: 'rock-flat',       category: 'Rocks',       icon: '🪨', label: 'Flat Rock' },
  { id: 'rock-cluster',    category: 'Rocks',       icon: '🪨', label: 'Rock Cluster' },
  { id: 'cliff',           category: 'Rocks',       icon: '⛰️', label: 'Cliff' },

  // Mountains
  { id: 'mountain-high',   category: 'Mountains',   icon: '⛰️', label: 'Tall Mountain' },
  { id: 'mountain-low',    category: 'Mountains',   icon: '🏔️', label: 'Low Mountain' },
  { id: 'hill',            category: 'Mountains',   icon: '⛰️', label: 'Hill' },

  // Structures
  { id: 'fence-wood',      category: 'Structures',  icon: '🪵', label: 'Wood Fence' },
  { id: 'fence-stone',     category: 'Structures',  icon: '🧱', label: 'Stone Wall' },
  { id: 'gate',            category: 'Structures',  icon: '🚪', label: 'Gate' },
  { id: 'bridge-wood',     category: 'Structures',  icon: '🌉', label: 'Wood Bridge' },
  { id: 'well',            category: 'Structures',  icon: '🪣', label: 'Well' },
  { id: 'windmill',        category: 'Structures',  icon: '🌀', label: 'Windmill' },
  { id: 'water-tower',     category: 'Structures',  icon: '🗼', label: 'Water Tower' },
  { id: 'market-stall',    category: 'Structures',  icon: '🏪', label: 'Market Stall' },
  { id: 'signpost',        category: 'Structures',  icon: '🪧', label: 'Signpost' },
  { id: 'lamp-post',       category: 'Structures',  icon: '🏮', label: 'Lamp Post' },
  { id: 'bench',           category: 'Structures',  icon: '🪑', label: 'Bench' },

  // Props
  { id: 'barrel',          category: 'Props',       icon: '🛢️', label: 'Barrel' },
  { id: 'crate',           category: 'Props',       icon: '📦', label: 'Crate' },
  { id: 'pallet',          category: 'Props',       icon: '📦', label: 'Pallet' },
  { id: 'sack',            category: 'Props',       icon: '👝', label: 'Sack' },
  { id: 'wheelbarrow',     category: 'Props',       icon: '🛒', label: 'Wheelbarrow' },
  { id: 'campfire',        category: 'Props',       icon: '🔥', label: 'Campfire' },
  { id: 'tent',            category: 'Props',       icon: '⛺', label: 'Tent' },
  { id: 'flag',            category: 'Props',       icon: '🚩', label: 'Flag' },
  { id: 'fountain',        category: 'Props',       icon: '⛲', label: 'Fountain' },

  // Resources (decorative)
  { id: 'cotton-bundle',   category: 'Resources',   icon: '🌾', label: 'Cotton Bundle' },
  { id: 'cloth-roll',      category: 'Resources',   icon: '🧵', label: 'Cloth Roll' },
  { id: 'textile-box',     category: 'Resources',   icon: '👕', label: 'Textile Box' },
  { id: 'wheat-bundle',    category: 'Resources',   icon: '🌾', label: 'Wheat Bundle' },
  { id: 'flour-sack',      category: 'Resources',   icon: '👝', label: 'Flour Sack' },
  { id: 'bread-basket',    category: 'Resources',   icon: '🍞', label: 'Bread Basket' },

  // Vehicles
  { id: 'cart',            category: 'Vehicles',    icon: '🛒', label: 'Cart' },
  { id: 'truck',           category: 'Vehicles',    icon: '🚛', label: 'Truck' },
  { id: 'wagon',           category: 'Vehicles',    icon: '🛞', label: 'Wagon' },
  { id: 'boat',            category: 'Vehicles',    icon: '⛵', label: 'Boat' },

  // Workers
  { id: 'worker-base',     category: 'Workers',     icon: '👷', label: 'Worker' },
  { id: 'worker-farmer',   category: 'Workers',     icon: '🧑‍🌾', label: 'Farmer' },
  { id: 'worker-processor',category: 'Workers',     icon: '🧑‍🔧', label: 'Processor' },
  { id: 'worker-factory',  category: 'Workers',     icon: '🧑‍🏭', label: 'Factory Worker' },
  { id: 'worker-baker',    category: 'Workers',     icon: '🧑‍🍳', label: 'Baker' },

  // Water
  { id: 'pond',            category: 'Water',       icon: '💧', label: 'Pond' },
  { id: 'river-straight',  category: 'Water',       icon: '🌊', label: 'River (Straight)' },
  { id: 'river-bend',      category: 'Water',       icon: '🌊', label: 'River (Bend)' },
];

export const useWorldStore = create(
  persist(
    (set, get) => ({
      // Objects now support: y, rotX, rotZ in addition to rotY
      objects: [],
      nextUid: 1,
      gridSnap: true,  // toggle grid snapping

      worlds: {},
      activeWorld: null,

      toggleGridSnap: () => set(s => ({ gridSnap: !s.gridSnap })),

      placeObject: (modelId, x, z, rotY = 0, scale = 1.0, y = 0) => {
        set(s => ({
          objects: [...s.objects, {
            uid: s.nextUid,
            modelId,
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            z: Math.round(z * 10) / 10,
            rotX: 0,
            rotY: Math.round(rotY * 100) / 100,
            rotZ: 0,
            scale: Math.round(scale * 100) / 100,
          }],
          nextUid: s.nextUid + 1,
        }));
      },

      removeObject: (uid) => set(s => ({ objects: s.objects.filter(o => o.uid !== uid) })),

      updateObject: (uid, updates) => {
        set(s => ({
          objects: s.objects.map(o => o.uid === uid ? { ...o, ...updates } : o),
        }));
      },

      clearAll: () => set({ objects: [], nextUid: 1 }),

      saveWorld: (name) => {
        const state = get();
        set(s => ({
          worlds: { ...s.worlds, [name]: [...state.objects] },
          activeWorld: name,
        }));
      },

      loadWorld: (name) => {
        const saved = get().worlds[name];
        if (saved) {
          const maxUid = saved.reduce((max, o) => Math.max(max, o.uid || 0), 0);
          set({ objects: [...saved], activeWorld: name, nextUid: maxUid + 1 });
        }
      },

      deleteWorld: (name) => {
        set(s => {
          const w = { ...s.worlds };
          delete w[name];
          return { worlds: w, activeWorld: s.activeWorld === name ? null : s.activeWorld };
        });
      },

      getWorldNames: () => Object.keys(get().worlds),

      generateDefault: () => {
        const objs = [];
        let uid = 1;
        const add = (modelId, x, z, rotY, scale, y = 0) => {
          objs.push({ uid: uid++, modelId, x: Math.round(x * 10) / 10, y, z: Math.round(z * 10) / 10, rotX: 0, rotY: Math.round(rotY * 100) / 100, rotZ: 0, scale: Math.round(scale * 100) / 100 });
        };
        const ring = (m, cx, cz, n, sx, sz, sr) => {
          for (let i = 0; i < n; i++) add(m, cx + (Math.random() - 0.5) * sx, cz + (Math.random() - 0.5) * sz, Math.random() * Math.PI * 2, sr[0] + Math.random() * (sr[1] - sr[0]));
        };
        const scatter = (m, cx, cz, n, sx, sz, sr, av) => {
          for (let i = 0; i < n; i++) { const x = cx + (Math.random() - 0.5) * sx, z = cz + (Math.random() - 0.5) * sz; if (Math.abs(x - cx) < av && Math.abs(z - cz) < av) continue; add(m, x, z, Math.random() * Math.PI * 2, sr[0] + Math.random() * (sr[1] - sr[0])); }
        };
        ring('mountain-high', 0, -350, 5, 500, 80, [0.8, 1.4]);
        ring('mountain-low', 0, -280, 7, 550, 60, [0.6, 1.2]);
        ring('mountain-low', -350, 0, 4, 80, 300, [0.5, 1.0]);
        ring('mountain-low', 350, 0, 4, 80, 300, [0.5, 1.0]);
        ring('tree-oak', -100, -100, 12, 70, 60, [0.7, 1.3]);
        ring('tree-pine', -120, -80, 8, 50, 40, [0.8, 1.2]);
        ring('bush', -110, -90, 10, 80, 60, [0.6, 1.3]);
        ring('tree-pine', 110, -100, 10, 60, 50, [0.7, 1.3]);
        ring('tree-oak', 130, -80, 6, 40, 40, [0.8, 1.2]);
        ring('bush', 120, -90, 8, 70, 50, [0.5, 1.2]);
        ring('tree-oak', -100, 80, 8, 50, 40, [0.7, 1.2]);
        ring('bush', -90, 70, 6, 40, 30, [0.6, 1.1]);
        ring('tree-pine', 100, 90, 7, 50, 45, [0.8, 1.2]);
        ring('tree-oak', 0, 160, 8, 80, 40, [0.7, 1.3]);
        scatter('grass-tuft', 0, 0, 40, 300, 300, [0.5, 1.5], 25);
        scatter('rock-large', 0, 0, 10, 250, 250, [0.6, 1.3], 20);
        scatter('rock-small', 0, 0, 18, 280, 280, [0.5, 1.4], 15);
        add('cart', 30, -18, 0.94, 1.0);
        add('truck', -35, 25, -0.47, 1.0);
        set({ objects: objs, nextUid: uid });
      },
    }),
    { name: 'supply-chain-world-builder', version: 2 }
  )
);
