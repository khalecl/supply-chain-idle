import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const BUILDING_COSTS = { FARM: 50, WAREHOUSE: 100, FACTORY: 200 };
const PRODUCTION_TIMES = { FARM: 5000, WAREHOUSE: 8000, FACTORY: 10000 };
const OPERATION_COSTS = { FARM: 1, WAREHOUSE: 2, FACTORY: 5 };
const BASE_PRICES = { cotton: 2.50, cloth: 5.00, textiles: 12.00 };
const PRICE_RANGES = {
  cotton: { min: 1.00, max: 4.00 },
  cloth: { min: 2.00, max: 8.00 },
  textiles: { min: 5.00, max: 19.00 }
};

export const useGameStore = create(
  persist(
    (set, get) => ({
      cotton: 0,
      cloth: 0,
      textiles: 0,
      money: 100,
      farms: [],
      warehouses: [],
      factories: [],
      buildingIdCounter: 0,
      marketPrices: { cotton: 2.50, cloth: 5.00, textiles: 12.00 },
      lastPriceUpdate: 0,
      prestigeLevel: 0,
      gameTime: 0,
      lastHarvestEvent: null,

      getPrestigeMultiplier: () => 1 + get().prestigeLevel * 0.05,

      getAdjustedProductionTime: (baseTime) => baseTime / get().getPrestigeMultiplier(),

      getBuildingCost: (type) => BUILDING_COSTS[type] || 0,

      // BUY BUILDINGS - WITH PROPER MONEY CHECK
      buyFarm: (position) => {
        const state = get();
        const cost = BUILDING_COSTS.FARM;
        
        // MUST have money
        if (state.money < cost) {
          console.log(`Can't afford farm. Need $${cost}, have $${state.money}`);
          return false;
        }

        const newFarmId = state.buildingIdCounter;
        set((s) => ({
          money: s.money - cost,
          farms: [...s.farms, {
            id: newFarmId,
            position,
            productionTime: PRODUCTION_TIMES.FARM,
            currentProduction: 0,
            isReady: false
          }],
          buildingIdCounter: s.buildingIdCounter + 1
        }));

        console.log(`Farm bought! Money now: ${get().money}`);
        return true;
      },

      buyWarehouse: (position) => {
        const state = get();
        const cost = BUILDING_COSTS.WAREHOUSE;
        
        if (state.money < cost) {
          console.log(`Can't afford warehouse. Need $${cost}, have $${state.money}`);
          return false;
        }

        const newWarehouseId = state.buildingIdCounter;
        set((s) => ({
          money: s.money - cost,
          warehouses: [...s.warehouses, {
            id: newWarehouseId,
            position,
            productionTime: PRODUCTION_TIMES.WAREHOUSE,
            currentProduction: 0,
            storageAmount: 0,
            isReady: false
          }],
          buildingIdCounter: s.buildingIdCounter + 1
        }));

        console.log(`Warehouse bought! Money now: ${get().money}`);
        return true;
      },

      buyFactory: (position) => {
        const state = get();
        const cost = BUILDING_COSTS.FACTORY;
        
        if (state.money < cost) {
          console.log(`Can't afford factory. Need $${cost}, have $${state.money}`);
          return false;
        }

        const newFactoryId = state.buildingIdCounter;
        set((s) => ({
          money: s.money - cost,
          factories: [...s.factories, {
            id: newFactoryId,
            position,
            productionTime: PRODUCTION_TIMES.FACTORY,
            currentProduction: 0,
            clothInput: 0,
            isReady: false
          }],
          buildingIdCounter: s.buildingIdCounter + 1
        }));

        console.log(`Factory bought! Money now: ${get().money}`);
        return true;
      },

      // HARVEST FARM
      harvestFarm: (farmId) => {
        const state = get();
        const farm = state.farms.find(f => f.id === farmId);

        if (!farm) return false;
        if (!farm.isReady) return false;
        if (state.money < OPERATION_COSTS.FARM) return false;

        set((s) => ({
          money: s.money - OPERATION_COSTS.FARM,
          cotton: s.cotton + 1,
          farms: s.farms.map(f =>
            f.id === farmId ? { ...f, isReady: false, currentProduction: 0 } : f
          ),
          lastHarvestEvent: { type: 'FARM', buildingId: farmId, timestamp: Date.now() }
        }));

        console.log(`Harvested farm! Cotton now: ${get().cotton}, Money: ${get().money}`);
        return true;
      },

      // SEND COTTON TO WAREHOUSE
      sendCottonToWarehouse: (warehouseId, amount) => {
        const state = get();
        const warehouse = state.warehouses.find(w => w.id === warehouseId);

        if (!warehouse) return false;
        if (state.cotton < amount) return false;
        if (state.money < OPERATION_COSTS.WAREHOUSE) return false;

        set((s) => ({
          money: s.money - OPERATION_COSTS.WAREHOUSE,
          cotton: s.cotton - amount,
          warehouses: s.warehouses.map(w =>
            w.id === warehouseId ? { ...w, storageAmount: w.storageAmount + amount, currentProduction: 0 } : w
          )
        }));

        console.log(`Sent ${amount} cotton to warehouse. Storage now: ${warehouse.storageAmount + amount}`);
        return true;
      },

      // HARVEST WAREHOUSE (convert cotton to cloth)
      harvestWarehouse: (warehouseId) => {
        const state = get();
        const warehouse = state.warehouses.find(w => w.id === warehouseId);

        if (!warehouse) return false;
        if (warehouse.storageAmount === 0) return false;
        if (!warehouse.isReady) return false;

        const clothProduced = warehouse.storageAmount * 0.8; // 20% loss

        set((s) => ({
          cloth: s.cloth + clothProduced,
          warehouses: s.warehouses.map(w =>
            w.id === warehouseId ? { ...w, isReady: false, currentProduction: 0, storageAmount: 0 } : w
          )
        }));

        console.log(`Warehouse conversion done! Cloth now: ${get().cloth}`);
        return true;
      },

      // SEND CLOTH TO FACTORY
      sendClothToFactory: (factoryId, amount) => {
        const state = get();
        const factory = state.factories.find(f => f.id === factoryId);

        if (!factory) return false;
        if (state.cloth < amount) return false;
        if (state.money < OPERATION_COSTS.FACTORY) return false;

        set((s) => ({
          money: s.money - OPERATION_COSTS.FACTORY,
          cloth: s.cloth - amount,
          factories: s.factories.map(f =>
            f.id === factoryId ? { ...f, clothInput: f.clothInput + amount, currentProduction: 0 } : f
          )
        }));

        console.log(`Sent ${amount} cloth to factory. Input now: ${factory.clothInput + amount}`);
        return true;
      },

      // HARVEST FACTORY
      harvestFactory: (factoryId) => {
        const state = get();
        const factory = state.factories.find(f => f.id === factoryId);

        if (!factory) return false;
        if (!factory.isReady) return false;
        if (factory.clothInput < 2) return false;
        if (state.money < OPERATION_COSTS.FACTORY) return false;

        set((s) => ({
          money: s.money - OPERATION_COSTS.FACTORY,
          textiles: s.textiles + 1,
          factories: s.factories.map(f =>
            f.id === factoryId ? { ...f, isReady: false, currentProduction: 0, clothInput: f.clothInput - 2 } : f
          )
        }));

        console.log(`Factory produced textile! Textiles now: ${get().textiles}`);
        return true;
      },

      // SELL
      sellCotton: (amount) => {
        const state = get();
        if (state.cotton < amount) return 0;

        const revenue = amount * state.marketPrices.cotton;
        set((s) => ({
          cotton: s.cotton - amount,
          money: s.money + revenue
        }));

        console.log(`Sold ${amount} cotton for $${revenue.toFixed(2)}`);
        return revenue;
      },

      sellCloth: (amount) => {
        const state = get();
        if (state.cloth < amount) return 0;

        const revenue = amount * state.marketPrices.cloth;
        set((s) => ({
          cloth: s.cloth - amount,
          money: s.money + revenue
        }));

        console.log(`Sold ${amount} cloth for $${revenue.toFixed(2)}`);
        return revenue;
      },

      sellTextiles: (amount) => {
        const state = get();
        if (state.textiles < amount) return 0;

        const revenue = amount * state.marketPrices.textiles;
        set((s) => ({
          textiles: s.textiles - amount,
          money: s.money + revenue
        }));

        console.log(`Sold ${amount} textiles for $${revenue.toFixed(2)}`);
        return revenue;
      },

      // MARKET PRICES
      updateMarketPrices: () => {
        const state = get();
        if (state.gameTime - state.lastPriceUpdate < 10) return;

        set((s) => {
          const newPrices = {};
          Object.keys(BASE_PRICES).forEach((product) => {
            const base = BASE_PRICES[product];
            const range = PRICE_RANGES[product];
            const variance = (Math.random() - 0.5) * 0.4; // ±20%
            const newPrice = Math.max(range.min, Math.min(range.max, base + variance));
            newPrices[product] = Math.round(newPrice * 100) / 100;
          });

          return { marketPrices: newPrices, lastPriceUpdate: s.gameTime };
        });
      },

      // PRODUCTION UPDATE
      updateProduction: (deltaTime) => {
        const state = get();
        const multiplier = state.getPrestigeMultiplier();

        set((s) => {
          // Farms
          const updatedFarms = s.farms.map(farm => {
            if (farm.isReady) return farm;
            const newProd = farm.currentProduction + deltaTime * 1000;
            const adjTime = PRODUCTION_TIMES.FARM / multiplier;
            if (newProd >= adjTime) return { ...farm, isReady: true, currentProduction: 0 };
            return { ...farm, currentProduction: newProd };
          });

          // Warehouses
          const updatedWarehouses = s.warehouses.map(w => {
            if (w.storageAmount === 0 || w.isReady) return w;
            const newProd = w.currentProduction + deltaTime * 1000;
            const adjTime = PRODUCTION_TIMES.WAREHOUSE / multiplier;
            if (newProd >= adjTime) return { ...w, isReady: true, currentProduction: 0 };
            return { ...w, currentProduction: newProd };
          });

          // Factories
          const updatedFactories = s.factories.map(f => {
            if (f.clothInput < 2 || f.isReady) return f;
            const newProd = f.currentProduction + deltaTime * 1000;
            const adjTime = PRODUCTION_TIMES.FACTORY / multiplier;
            if (newProd >= adjTime) return { ...f, isReady: true, currentProduction: 0 };
            return { ...f, currentProduction: newProd };
          });

          return { farms: updatedFarms, warehouses: updatedWarehouses, factories: updatedFactories };
        });
      },

      // TICK
      tick: (deltaTime) => {
        set((s) => ({ gameTime: s.gameTime + deltaTime }));
        const state = get();
        state.updateProduction(deltaTime);
        state.updateMarketPrices();
      },

      // PRESTIGE
      prestige: () => {
        set((s) => ({
          cotton: 0,
          cloth: 0,
          textiles: 0,
          money: 100,
          prestigeLevel: s.prestigeLevel + 1,
          gameTime: 0
        }));
        console.log(`Prestiged! Level now: ${get().prestigeLevel}`);
      },

      reset: () => {
        set({
          cotton: 0, cloth: 0, textiles: 0, money: 100,
          farms: [], warehouses: [], factories: [],
          buildingIdCounter: 0,
          marketPrices: { cotton: 2.50, cloth: 5.00, textiles: 12.00 },
          lastPriceUpdate: 0, prestigeLevel: 0, gameTime: 0
        });
      }
    }),
    { name: 'supply-chain-game-store', version: 1 }
  )
);
