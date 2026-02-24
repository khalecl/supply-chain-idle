import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// All placeable object types for the world builder
export const OBJECT_CATALOG = [
  // Landscape
  { id: 'tree-oak',       category: 'Trees',      icon: '🌳', label: 'Oak Tree' },
  { id: 'tree-pine',      category: 'Trees',      icon: '🌲', label: 'Pine Tree' },
  { id: 'bush',           category: 'Plants',     icon: '🌿', label: 'Bush' },
  { id: 'grass-tuft',     category: 'Plants',     icon: '🌱', label: 'Grass' },
  { id: 'rock-large',     category: 'Rocks',      icon: '🪨', label: 'Large Rock' },
  { id: 'rock-small',     category: 'Rocks',      icon: '🪨', label: 'Small Rock' },
  { id: 'mountain-high',  category: 'Mountains',  icon: '⛰️', label: 'Tall Mountain' },
  { id: 'mountain-low',   category: 'Mountains',  icon: '🏔️', label: 'Low Mountain' },

  // Items
  { id: 'cotton-bundle',  category: 'Items',      icon: '🌾', label: 'Cotton Bundle' },
  { id: 'cloth-roll',     category: 'Items',      icon: '🧵', label: 'Cloth Roll' },
  { id: 'textile-box',    category: 'Items',      icon: '📦', label: 'Textile Box' },

  // Vehicles
  { id: 'cart',           category: 'Vehicles',   icon: '🛒', label: 'Cart' },
  { id: 'truck',          category: 'Vehicles',   icon: '🚛', label: 'Truck' },

  // Characters
  { id: 'worker-base',    category: 'Workers',    icon: '👷', label: 'Worker' },
  { id: 'worker-farmer',  category: 'Workers',    icon: '🧑‍🌾', label: 'Farmer' },
];

export const useWorldStore = create(
  persist(
    (set, get) => ({
      // Array of placed objects: { uid, modelId, x, z, rotY, scale }
      objects: [],
      nextUid: 1,

      // Save slots
      worlds: {},       // { worldName: objects[] }
      activeWorld: null, // name of currently loaded world

      placeObject: (modelId, x, z, rotY = 0, scale = 1.0) => {
        set(s => ({
          objects: [...s.objects, {
            uid: s.nextUid,
            modelId,
            x: Math.round(x * 10) / 10,
            z: Math.round(z * 10) / 10,
            rotY: Math.round(rotY * 100) / 100,
            scale: Math.round(scale * 100) / 100,
          }],
          nextUid: s.nextUid + 1,
        }));
      },

      removeObject: (uid) => {
        set(s => ({ objects: s.objects.filter(o => o.uid !== uid) }));
      },

      updateObject: (uid, updates) => {
        set(s => ({
          objects: s.objects.map(o => o.uid === uid ? { ...o, ...updates } : o),
        }));
      },

      clearAll: () => set({ objects: [], nextUid: 1 }),

      // ─── Save/Load worlds ───
      saveWorld: (name) => {
        const state = get();
        set(s => ({
          worlds: { ...s.worlds, [name]: [...state.objects] },
          activeWorld: name,
        }));
      },

      loadWorld: (name) => {
        const state = get();
        const saved = state.worlds[name];
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

      // Generate default world (same layout as the hardcoded one)
      generateDefault: () => {
        const objs = [];
        let uid = 1;

        const ring = (model, cx, cz, count, sx, sz, sr) => {
          for (let i = 0; i < count; i++) {
            objs.push({
              uid: uid++, modelId: model,
              x: Math.round((cx + (Math.random() - 0.5) * sx) * 10) / 10,
              z: Math.round((cz + (Math.random() - 0.5) * sz) * 10) / 10,
              rotY: Math.round(Math.random() * Math.PI * 2 * 100) / 100,
              scale: Math.round((sr[0] + Math.random() * (sr[1] - sr[0])) * 100) / 100,
            });
          }
        };

        const scatter = (model, cx, cz, count, sx, sz, sr, avoid) => {
          for (let i = 0; i < count; i++) {
            const x = cx + (Math.random() - 0.5) * sx;
            const z = cz + (Math.random() - 0.5) * sz;
            if (Math.abs(x - cx) < avoid && Math.abs(z - cz) < avoid) continue;
            objs.push({
              uid: uid++, modelId: model,
              x: Math.round(x * 10) / 10,
              z: Math.round(z * 10) / 10,
              rotY: Math.round(Math.random() * Math.PI * 2 * 100) / 100,
              scale: Math.round((sr[0] + Math.random() * (sr[1] - sr[0])) * 100) / 100,
            });
          }
        };

        // Mountains
        ring('mountain-high', 0, -350, 5, 500, 80, [0.8, 1.4]);
        ring('mountain-low',  0, -280, 7, 550, 60, [0.6, 1.2]);
        ring('mountain-low', -350, 0, 4, 80, 300, [0.5, 1.0]);
        ring('mountain-low',  350, 0, 4, 80, 300, [0.5, 1.0]);

        // Forests
        ring('tree-oak',  -100, -100, 12, 70, 60, [0.7, 1.3]);
        ring('tree-pine', -120,  -80,  8, 50, 40, [0.8, 1.2]);
        ring('bush',      -110,  -90, 10, 80, 60, [0.6, 1.3]);
        ring('tree-pine',  110, -100, 10, 60, 50, [0.7, 1.3]);
        ring('tree-oak',   130,  -80,  6, 40, 40, [0.8, 1.2]);
        ring('bush',       120,  -90,  8, 70, 50, [0.5, 1.2]);
        ring('tree-oak',  -100,  80,  8, 50, 40, [0.7, 1.2]);
        ring('bush',       -90,  70,  6, 40, 30, [0.6, 1.1]);
        ring('tree-pine',  100,  90,  7, 50, 45, [0.8, 1.2]);
        ring('tree-oak',     0, 160,  8, 80, 40, [0.7, 1.3]);

        // Grass + rocks
        scatter('grass-tuft', 0, 0, 40, 300, 300, [0.5, 1.5], 25);
        scatter('rock-large', 0, 0, 10, 250, 250, [0.6, 1.3], 20);
        scatter('rock-small', 0, 0, 18, 280, 280, [0.5, 1.4], 15);

        // Decorative
        objs.push({ uid: uid++, modelId: 'cart', x: 30, z: -18, rotY: 0.94, scale: 1.0 });
        objs.push({ uid: uid++, modelId: 'truck', x: -35, z: 25, rotY: -0.47, scale: 1.0 });

        set({ objects: objs, nextUid: uid });
      },
    }),
    { name: 'supply-chain-world-builder', version: 1 }
  )
);
