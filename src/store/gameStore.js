import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ═══════════════════════════════════════════
//  BUILDING CONSTANTS
// ═══════════════════════════════════════════

const BUILDING_COSTS = {
  FARM: 50, WAREHOUSE: 100, FACTORY: 200,
  GRAIN_FARM: 60, MILL: 120, BAKERY: 250,
};
const PRODUCTION_TIMES = {
  FARM: 5000, WAREHOUSE: 8000, FACTORY: 10000,
  GRAIN_FARM: 6000, MILL: 7000, BAKERY: 12000,
};
const OPERATION_COSTS = {
  FARM: 1, WAREHOUSE: 2, FACTORY: 5,
  GRAIN_FARM: 1, MILL: 3, BAKERY: 6,
};

const BASE_PRICES = {
  cotton: 2.50, cloth: 5.00, textiles: 12.00,
  wheat: 2.00, flour: 4.50, bread: 15.00,
};
const PRICE_RANGES = {
  cotton: { min: 1.00, max: 4.00 },
  cloth: { min: 2.00, max: 8.00 },
  textiles: { min: 5.00, max: 19.00 },
  wheat: { min: 0.80, max: 3.50 },
  flour: { min: 2.00, max: 7.00 },
  bread: { min: 8.00, max: 22.00 },
};

export const useGameStore = create(
  persist(
    (set, get) => ({
      // ─── RESOURCES ───
      cotton: 0, cloth: 0, textiles: 0,
      wheat: 0, flour: 0, bread: 0,
      money: 100,

      // ─── TEXTILE CHAIN BUILDINGS ───
      farms: [],
      warehouses: [],
      factories: [],

      // ─── FOOD CHAIN BUILDINGS ───
      grainFarms: [],
      mills: [],
      bakeries: [],

      buildingIdCounter: 0,
      marketPrices: { ...BASE_PRICES },
      lastPriceUpdate: 0,
      prestigeLevel: 0,
      gameTime: 0,
      lastHarvestEvent: null,

      getPrestigeMultiplier: () => 1 + get().prestigeLevel * 0.05,
      getAdjustedProductionTime: (baseTime) => baseTime / get().getPrestigeMultiplier(),
      getBuildingCost: (type) => BUILDING_COSTS[type] || 0,

      // ═══════════════════════════════════════
      //  TEXTILE CHAIN: Farm → Warehouse → Factory
      // ═══════════════════════════════════════

      buyFarm: (position) => {
        const s = get();
        if (s.money < BUILDING_COSTS.FARM) return false;
        const id = s.buildingIdCounter;
        set(s => ({
          money: s.money - BUILDING_COSTS.FARM,
          farms: [...s.farms, { id, position, productionTime: PRODUCTION_TIMES.FARM, currentProduction: 0, isReady: false }],
          buildingIdCounter: s.buildingIdCounter + 1
        }));
        return true;
      },

      buyWarehouse: (position) => {
        const s = get();
        if (s.money < BUILDING_COSTS.WAREHOUSE) return false;
        const id = s.buildingIdCounter;
        set(s => ({
          money: s.money - BUILDING_COSTS.WAREHOUSE,
          warehouses: [...s.warehouses, { id, position, productionTime: PRODUCTION_TIMES.WAREHOUSE, currentProduction: 0, storageAmount: 0, isReady: false }],
          buildingIdCounter: s.buildingIdCounter + 1
        }));
        return true;
      },

      buyFactory: (position) => {
        const s = get();
        if (s.money < BUILDING_COSTS.FACTORY) return false;
        const id = s.buildingIdCounter;
        set(s => ({
          money: s.money - BUILDING_COSTS.FACTORY,
          factories: [...s.factories, { id, position, productionTime: PRODUCTION_TIMES.FACTORY, currentProduction: 0, clothInput: 0, isReady: false }],
          buildingIdCounter: s.buildingIdCounter + 1
        }));
        return true;
      },

      harvestFarm: (farmId) => {
        const s = get();
        const farm = s.farms.find(f => f.id === farmId);
        if (!farm || !farm.isReady || s.money < OPERATION_COSTS.FARM) return false;
        set(s => ({
          money: s.money - OPERATION_COSTS.FARM,
          cotton: s.cotton + 1,
          farms: s.farms.map(f => f.id === farmId ? { ...f, isReady: false, currentProduction: 0 } : f),
          lastHarvestEvent: { type: 'FARM', buildingId: farmId, timestamp: Date.now() }
        }));
        return true;
      },

      sendCottonToWarehouse: (warehouseId, amount) => {
        const s = get();
        const wh = s.warehouses.find(w => w.id === warehouseId);
        if (!wh || s.cotton < amount || s.money < OPERATION_COSTS.WAREHOUSE) return false;
        set(s => ({
          money: s.money - OPERATION_COSTS.WAREHOUSE,
          cotton: s.cotton - amount,
          warehouses: s.warehouses.map(w => w.id === warehouseId ? { ...w, storageAmount: w.storageAmount + amount, currentProduction: 0 } : w)
        }));
        return true;
      },

      harvestWarehouse: (warehouseId) => {
        const s = get();
        const wh = s.warehouses.find(w => w.id === warehouseId);
        if (!wh || wh.storageAmount === 0 || !wh.isReady) return false;
        const produced = wh.storageAmount * 0.8;
        set(s => ({
          cloth: s.cloth + produced,
          warehouses: s.warehouses.map(w => w.id === warehouseId ? { ...w, isReady: false, currentProduction: 0, storageAmount: 0 } : w)
        }));
        return true;
      },

      sendClothToFactory: (factoryId, amount) => {
        const s = get();
        const fac = s.factories.find(f => f.id === factoryId);
        if (!fac || s.cloth < amount || s.money < OPERATION_COSTS.FACTORY) return false;
        set(s => ({
          money: s.money - OPERATION_COSTS.FACTORY,
          cloth: s.cloth - amount,
          factories: s.factories.map(f => f.id === factoryId ? { ...f, clothInput: f.clothInput + amount, currentProduction: 0 } : f)
        }));
        return true;
      },

      harvestFactory: (factoryId) => {
        const s = get();
        const fac = s.factories.find(f => f.id === factoryId);
        if (!fac || !fac.isReady || fac.clothInput < 2 || s.money < OPERATION_COSTS.FACTORY) return false;
        set(s => ({
          money: s.money - OPERATION_COSTS.FACTORY,
          textiles: s.textiles + 1,
          factories: s.factories.map(f => f.id === factoryId ? { ...f, isReady: false, currentProduction: 0, clothInput: f.clothInput - 2 } : f)
        }));
        return true;
      },

      // ═══════════════════════════════════════
      //  FOOD CHAIN: Grain Farm → Mill → Bakery
      // ═══════════════════════════════════════

      buyGrainFarm: (position) => {
        const s = get();
        if (s.money < BUILDING_COSTS.GRAIN_FARM) return false;
        const id = s.buildingIdCounter;
        set(s => ({
          money: s.money - BUILDING_COSTS.GRAIN_FARM,
          grainFarms: [...s.grainFarms, { id, position, productionTime: PRODUCTION_TIMES.GRAIN_FARM, currentProduction: 0, isReady: false }],
          buildingIdCounter: s.buildingIdCounter + 1
        }));
        return true;
      },

      buyMill: (position) => {
        const s = get();
        if (s.money < BUILDING_COSTS.MILL) return false;
        const id = s.buildingIdCounter;
        set(s => ({
          money: s.money - BUILDING_COSTS.MILL,
          mills: [...s.mills, { id, position, productionTime: PRODUCTION_TIMES.MILL, currentProduction: 0, storageAmount: 0, isReady: false }],
          buildingIdCounter: s.buildingIdCounter + 1
        }));
        return true;
      },

      buyBakery: (position) => {
        const s = get();
        if (s.money < BUILDING_COSTS.BAKERY) return false;
        const id = s.buildingIdCounter;
        set(s => ({
          money: s.money - BUILDING_COSTS.BAKERY,
          bakeries: [...s.bakeries, { id, position, productionTime: PRODUCTION_TIMES.BAKERY, currentProduction: 0, flourInput: 0, isReady: false }],
          buildingIdCounter: s.buildingIdCounter + 1
        }));
        return true;
      },

      harvestGrainFarm: (id) => {
        const s = get();
        const gf = s.grainFarms.find(f => f.id === id);
        if (!gf || !gf.isReady || s.money < OPERATION_COSTS.GRAIN_FARM) return false;
        set(s => ({
          money: s.money - OPERATION_COSTS.GRAIN_FARM,
          wheat: s.wheat + 1,
          grainFarms: s.grainFarms.map(f => f.id === id ? { ...f, isReady: false, currentProduction: 0 } : f),
          lastHarvestEvent: { type: 'GRAIN_FARM', buildingId: id, timestamp: Date.now() }
        }));
        return true;
      },

      sendWheatToMill: (millId, amount) => {
        const s = get();
        const mill = s.mills.find(m => m.id === millId);
        if (!mill || s.wheat < amount || s.money < OPERATION_COSTS.MILL) return false;
        set(s => ({
          money: s.money - OPERATION_COSTS.MILL,
          wheat: s.wheat - amount,
          mills: s.mills.map(m => m.id === millId ? { ...m, storageAmount: m.storageAmount + amount, currentProduction: 0 } : m)
        }));
        return true;
      },

      harvestMill: (millId) => {
        const s = get();
        const mill = s.mills.find(m => m.id === millId);
        if (!mill || mill.storageAmount === 0 || !mill.isReady) return false;
        const produced = mill.storageAmount * 0.75; // 25% milling loss
        set(s => ({
          flour: s.flour + produced,
          mills: s.mills.map(m => m.id === millId ? { ...m, isReady: false, currentProduction: 0, storageAmount: 0 } : m)
        }));
        return true;
      },

      sendFlourToBakery: (bakeryId, amount) => {
        const s = get();
        const bak = s.bakeries.find(b => b.id === bakeryId);
        if (!bak || s.flour < amount || s.money < OPERATION_COSTS.BAKERY) return false;
        set(s => ({
          money: s.money - OPERATION_COSTS.BAKERY,
          flour: s.flour - amount,
          bakeries: s.bakeries.map(b => b.id === bakeryId ? { ...b, flourInput: b.flourInput + amount, currentProduction: 0 } : b)
        }));
        return true;
      },

      harvestBakery: (bakeryId) => {
        const s = get();
        const bak = s.bakeries.find(b => b.id === bakeryId);
        if (!bak || !bak.isReady || bak.flourInput < 3 || s.money < OPERATION_COSTS.BAKERY) return false;
        set(s => ({
          money: s.money - OPERATION_COSTS.BAKERY,
          bread: s.bread + 1,
          bakeries: s.bakeries.map(b => b.id === bakeryId ? { ...b, isReady: false, currentProduction: 0, flourInput: b.flourInput - 3 } : b)
        }));
        return true;
      },

      // ═══════════════════════════════════════
      //  SELL (both chains)
      // ═══════════════════════════════════════

      sellCotton: (amount) => {
        const s = get(); if (s.cotton < amount) return 0;
        const rev = amount * s.marketPrices.cotton;
        set(s => ({ cotton: s.cotton - amount, money: s.money + rev }));
        return rev;
      },
      sellCloth: (amount) => {
        const s = get(); if (s.cloth < amount) return 0;
        const rev = amount * s.marketPrices.cloth;
        set(s => ({ cloth: s.cloth - amount, money: s.money + rev }));
        return rev;
      },
      sellTextiles: (amount) => {
        const s = get(); if (s.textiles < amount) return 0;
        const rev = amount * s.marketPrices.textiles;
        set(s => ({ textiles: s.textiles - amount, money: s.money + rev }));
        return rev;
      },
      sellWheat: (amount) => {
        const s = get(); if (s.wheat < amount) return 0;
        const rev = amount * s.marketPrices.wheat;
        set(s => ({ wheat: s.wheat - amount, money: s.money + rev }));
        return rev;
      },
      sellFlour: (amount) => {
        const s = get(); if (s.flour < amount) return 0;
        const rev = amount * s.marketPrices.flour;
        set(s => ({ flour: s.flour - amount, money: s.money + rev }));
        return rev;
      },
      sellBread: (amount) => {
        const s = get(); if (s.bread < amount) return 0;
        const rev = amount * s.marketPrices.bread;
        set(s => ({ bread: s.bread - amount, money: s.money + rev }));
        return rev;
      },

      // ═══════════════════════════════════════
      //  MARKET PRICES
      // ═══════════════════════════════════════

      updateMarketPrices: () => {
        const s = get();
        if (s.gameTime - s.lastPriceUpdate < 10) return;
        set(s => {
          const newPrices = {};
          Object.keys(BASE_PRICES).forEach(product => {
            const base = BASE_PRICES[product];
            const range = PRICE_RANGES[product];
            const variance = (Math.random() - 0.5) * 0.4;
            newPrices[product] = Math.round(Math.max(range.min, Math.min(range.max, base + variance)) * 100) / 100;
          });
          return { marketPrices: newPrices, lastPriceUpdate: s.gameTime };
        });
      },

      // ═══════════════════════════════════════
      //  PRODUCTION + TICK
      // ═══════════════════════════════════════

      updateProduction: (deltaTime) => {
        const mult = get().getPrestigeMultiplier();
        set(s => {
          const updateTimers = (arr, baseTime, readyCondition = () => true) =>
            arr.map(b => {
              if (b.isReady || !readyCondition(b)) return b;
              const newProd = b.currentProduction + deltaTime * 1000;
              if (newProd >= baseTime / mult) return { ...b, isReady: true, currentProduction: 0 };
              return { ...b, currentProduction: newProd };
            });

          return {
            farms: updateTimers(s.farms, PRODUCTION_TIMES.FARM),
            warehouses: updateTimers(s.warehouses, PRODUCTION_TIMES.WAREHOUSE, w => w.storageAmount > 0),
            factories: updateTimers(s.factories, PRODUCTION_TIMES.FACTORY, f => f.clothInput >= 2),
            grainFarms: updateTimers(s.grainFarms, PRODUCTION_TIMES.GRAIN_FARM),
            mills: updateTimers(s.mills, PRODUCTION_TIMES.MILL, m => m.storageAmount > 0),
            bakeries: updateTimers(s.bakeries, PRODUCTION_TIMES.BAKERY, b => b.flourInput >= 3),
          };
        });
      },

      tick: (deltaTime) => {
        set(s => ({ gameTime: s.gameTime + deltaTime }));
        get().updateProduction(deltaTime);
        get().updateMarketPrices();
      },

      // ═══════════════════════════════════════
      //  PRESTIGE + RESET
      // ═══════════════════════════════════════

      prestige: () => {
        set(s => ({
          cotton: 0, cloth: 0, textiles: 0,
          wheat: 0, flour: 0, bread: 0,
          money: 100,
          prestigeLevel: s.prestigeLevel + 1,
          gameTime: 0
        }));
      },

      reset: () => {
        set({
          cotton: 0, cloth: 0, textiles: 0,
          wheat: 0, flour: 0, bread: 0,
          money: 100,
          farms: [], warehouses: [], factories: [],
          grainFarms: [], mills: [], bakeries: [],
          buildingIdCounter: 0,
          marketPrices: { ...BASE_PRICES },
          lastPriceUpdate: 0, prestigeLevel: 0, gameTime: 0
        });
      }
    }),
    { name: 'supply-chain-game-store', version: 2 }
  )
);
