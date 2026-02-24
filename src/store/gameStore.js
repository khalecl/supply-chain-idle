import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CROPS, PROCESSORS, RESOURCES, ALL_RESOURCE_IDS } from '../data/crops';

// Build initial resource state: all resources start at 0
const initResources = () => {
  const r = {};
  ALL_RESOURCE_IDS.forEach(id => r[id] = 0);
  return r;
};

// Build initial market prices from RESOURCES data
const initPrices = () => {
  const p = {};
  ALL_RESOURCE_IDS.forEach(id => p[id] = RESOURCES[id].basePrice);
  return p;
};

export const useGameStore = create(
  persist(
    (set, get) => ({
      resources: initResources(),
      money: 100,

      // Unified buildings
      farms: [],           // each has cropType
      processors: [],      // each has processorType
      buildingIdCounter: 0,

      marketPrices: initPrices(),
      lastPriceUpdate: 0,
      prestigeLevel: 0,
      gameTime: 0,
      lastHarvestEvent: null,

      // Farm awaiting crop selection
      pendingFarmId: null,

      getPrestigeMultiplier: () => 1 + get().prestigeLevel * 0.05,

      // ═══ FARM ═══

      buyFarm: (position) => {
        const s = get();
        if (s.money < 50) return null;
        const id = s.buildingIdCounter;
        set(s => ({
          money: s.money - 50,
          farms: [...s.farms, { id, position, cropType: null, currentProduction: 0, isReady: false }],
          buildingIdCounter: s.buildingIdCounter + 1,
          pendingFarmId: id,
        }));
        return id;
      },

      selectCrop: (farmId, cropType) => {
        if (!CROPS[cropType]) return false;
        set(s => ({
          farms: s.farms.map(f => f.id === farmId ? { ...f, cropType, currentProduction: 0, isReady: false } : f),
          pendingFarmId: null,
        }));
        return true;
      },

      switchCrop: (farmId, newCropType) => {
        const s = get();
        if (s.money < 25 || !CROPS[newCropType]) return false;
        set(s => ({
          money: s.money - 25,
          farms: s.farms.map(f => f.id === farmId ? { ...f, cropType: newCropType, currentProduction: 0, isReady: false } : f),
        }));
        return true;
      },

      cancelFarmPlacement: () => {
        const s = get();
        if (s.pendingFarmId === null) return;
        set(s => ({
          money: s.money + 50,
          farms: s.farms.filter(f => f.id !== s.pendingFarmId),
          pendingFarmId: null,
        }));
      },

      harvestFarm: (farmId) => {
        const s = get();
        const farm = s.farms.find(f => f.id === farmId);
        if (!farm || !farm.isReady || !farm.cropType) return false;
        const crop = CROPS[farm.cropType];
        if (!crop || s.money < crop.harvestCost) return false;
        set(s => ({
          money: s.money - crop.harvestCost,
          resources: { ...s.resources, [farm.cropType]: (s.resources[farm.cropType] || 0) + 1 },
          farms: s.farms.map(f => f.id === farmId ? { ...f, isReady: false, currentProduction: 0 } : f),
          lastHarvestEvent: { type: 'FARM', cropType: farm.cropType, buildingId: farmId, timestamp: Date.now() },
        }));
        return true;
      },

      // ═══ PROCESSORS (unified) ═══

      buyProcessor: (processorType, position) => {
        const def = PROCESSORS[processorType];
        if (!def) return null;
        const s = get();
        if (s.money < def.cost) return null;
        const id = s.buildingIdCounter;
        set(s => ({
          money: s.money - def.cost,
          processors: [...s.processors, { id, position, processorType, storageAmount: 0, currentProduction: 0, isReady: false }],
          buildingIdCounter: s.buildingIdCounter + 1,
        }));
        return id;
      },

      loadProcessor: (processorId, amount) => {
        const s = get();
        const proc = s.processors.find(p => p.id === processorId);
        if (!proc) return false;
        const def = PROCESSORS[proc.processorType];
        if (!def) return false;
        const available = s.resources[def.input] || 0;
        if (available < amount || s.money < def.opCost) return false;
        set(s => ({
          money: s.money - def.opCost,
          resources: { ...s.resources, [def.input]: s.resources[def.input] - amount },
          processors: s.processors.map(p => p.id === processorId
            ? { ...p, storageAmount: p.storageAmount + amount, currentProduction: 0 } : p),
        }));
        return true;
      },

      harvestProcessor: (processorId) => {
        const s = get();
        const proc = s.processors.find(p => p.id === processorId);
        if (!proc || !proc.isReady) return false;
        const def = PROCESSORS[proc.processorType];
        if (!def || proc.storageAmount < def.inputAmount || s.money < def.opCost) return false;
        set(s => ({
          money: s.money - def.opCost,
          resources: { ...s.resources, [def.output]: (s.resources[def.output] || 0) + def.outputAmount },
          processors: s.processors.map(p => p.id === processorId
            ? { ...p, isReady: false, currentProduction: 0, storageAmount: p.storageAmount - def.inputAmount } : p),
        }));
        return true;
      },

      // ═══ SELL (any resource) ═══

      sellResource: (resourceId, amount) => {
        const s = get();
        const available = s.resources[resourceId] || 0;
        if (available < amount) return 0;
        const revenue = amount * (s.marketPrices[resourceId] || 0);
        set(s => ({
          resources: { ...s.resources, [resourceId]: s.resources[resourceId] - amount },
          money: s.money + revenue,
        }));
        return revenue;
      },

      // ═══ MARKET ═══

      updateMarketPrices: () => {
        const s = get();
        if (s.gameTime - s.lastPriceUpdate < 10) return;
        set(s => {
          const newPrices = {};
          ALL_RESOURCE_IDS.forEach(id => {
            const res = RESOURCES[id];
            const variance = (Math.random() - 0.5) * 0.4;
            newPrices[id] = Math.round(Math.max(res.min, Math.min(res.max, res.basePrice + variance)) * 100) / 100;
          });
          return { marketPrices: newPrices, lastPriceUpdate: s.gameTime };
        });
      },

      // ═══ PRODUCTION TICK ═══

      updateProduction: (deltaTime) => {
        const mult = get().getPrestigeMultiplier();
        set(s => ({
          farms: s.farms.map(farm => {
            if (farm.isReady || !farm.cropType) return farm;
            const crop = CROPS[farm.cropType];
            if (!crop) return farm;
            const newProd = farm.currentProduction + deltaTime * 1000;
            if (newProd >= crop.growTime / mult) return { ...farm, isReady: true, currentProduction: 0 };
            return { ...farm, currentProduction: newProd };
          }),
          processors: s.processors.map(proc => {
            if (proc.isReady) return proc;
            const def = PROCESSORS[proc.processorType];
            if (!def || proc.storageAmount < def.inputAmount) return proc;
            const newProd = proc.currentProduction + deltaTime * 1000;
            if (newProd >= def.processTime / mult) return { ...proc, isReady: true, currentProduction: 0 };
            return { ...proc, currentProduction: newProd };
          }),
        }));
      },

      tick: (deltaTime) => {
        set(s => ({ gameTime: s.gameTime + deltaTime }));
        get().updateProduction(deltaTime);
        get().updateMarketPrices();
      },

      // ═══ PRESTIGE + RESET ═══

      prestige: () => {
        set(s => ({ resources: initResources(), money: 100, prestigeLevel: s.prestigeLevel + 1, gameTime: 0 }));
      },

      reset: () => {
        set({
          resources: initResources(), money: 100, farms: [], processors: [],
          buildingIdCounter: 0, marketPrices: initPrices(),
          lastPriceUpdate: 0, prestigeLevel: 0, gameTime: 0, pendingFarmId: null,
        });
      },

      // ═══ HELPERS ═══
      getResource: (id) => get().resources[id] || 0,
      getPrice: (id) => get().marketPrices[id] || 0,
      getBuildingCost: (type) => {
        if (type === 'FARM') return 50;
        const def = PROCESSORS[type];
        return def ? def.cost : 0;
      },
    }),
    { name: 'supply-chain-game-store', version: 3 }
  )
);
