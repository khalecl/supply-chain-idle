// ═══════════════════════════════════════════
//  MINERAL & UNDERGROUND RESOURCE DEFINITIONS
// ═══════════════════════════════════════════

export const MINERALS = {
  iron: {
    id: 'iron',
    name: 'Iron Ore',
    icon: '⛏️',
    color: '#b91c1c',
    noiseFreq: 0.015,
    threshold: 0.65,
    extractTime: 8000,
    extractCost: 3,
    priceRange: { min: 2.00, max: 5.00 },
    basePrice: 3.50,
  },
  copper: {
    id: 'copper',
    name: 'Copper Ore',
    icon: '🟤',
    color: '#c2410c',
    noiseFreq: 0.018,
    threshold: 0.68,
    extractTime: 9000,
    extractCost: 3,
    priceRange: { min: 3.00, max: 6.00 },
    basePrice: 4.00,
  },
  coal: {
    id: 'coal',
    name: 'Coal',
    icon: '⚫',
    color: '#1c1917',
    noiseFreq: 0.012,
    threshold: 0.60,
    extractTime: 6000,
    extractCost: 2,
    priceRange: { min: 1.00, max: 3.00 },
    basePrice: 1.80,
  },
  gold: {
    id: 'gold',
    name: 'Gold Ore',
    icon: '✨',
    color: '#eab308',
    noiseFreq: 0.025,
    threshold: 0.85,
    extractTime: 14000,
    extractCost: 8,
    priceRange: { min: 15.00, max: 30.00 },
    basePrice: 22.00,
  },
  diamonds: {
    id: 'diamonds',
    name: 'Diamonds',
    icon: '💎',
    color: '#67e8f9',
    noiseFreq: 0.030,
    threshold: 0.92,
    extractTime: 20000,
    extractCost: 12,
    priceRange: { min: 40.00, max: 80.00 },
    basePrice: 55.00,
  },
};

// Oil & gas use the same noise system but separate layer
export const OIL_GAS = {
  oil: {
    id: 'oil',
    name: 'Crude Oil',
    icon: '🛢️',
    color: '#1e1b4b',
    noiseFreq: 0.006,
    threshold: 0.80,
    extractTime: 12000,
    extractCost: 5,
    priceRange: { min: 5.00, max: 12.00 },
    basePrice: 8.00,
  },
  gas: {
    id: 'gas',
    name: 'Natural Gas',
    icon: '💨',
    color: '#7dd3fc',
    noiseFreq: 0.006,   // co-located with oil
    threshold: 0.85,     // slightly rarer subset of oil zones
    extractTime: 10000,
    extractCost: 4,
    priceRange: { min: 3.00, max: 8.00 },
    basePrice: 5.00,
  },
};

// Processing chains for minerals
export const MINERAL_PROCESSORS = {
  smelter: {
    id: 'smelter',
    name: 'Smelter',
    icon: '🔥',
    cost: 200,
    opCost: 5,
    processTime: 10000,
    // Smelter handles multiple inputs depending on what you load
    recipes: {
      iron:   { input: 'iron',   inputAmount: 1, output: 'steel',    outputAmount: 0.8 },
      copper: { input: 'copper', inputAmount: 1, output: 'wire',     outputAmount: 0.85 },
      gold:   { input: 'gold',   inputAmount: 1, output: 'goldBars', outputAmount: 0.7 },
    },
    description: 'Ore → Refined Metal',
  },
  foundry: {
    id: 'foundry',
    name: 'Foundry',
    icon: '🏭',
    cost: 300,
    opCost: 8,
    processTime: 14000,
    recipes: {
      steel:    { input: 'steel',    inputAmount: 2, output: 'tools',       outputAmount: 1 },
      wire:     { input: 'wire',     inputAmount: 2, output: 'electronics', outputAmount: 1 },
      goldBars: { input: 'goldBars', inputAmount: 1, output: 'jewelry',     outputAmount: 1 },
    },
    description: 'Refined Metal → Products',
  },
};

// All mineral-related resources for market
export const MINERAL_RESOURCES = {
  // Raw
  iron:       { name: 'Iron Ore',     icon: '⛏️', color: '#b91c1c', category: 'raw',       basePrice: 3.50,  min: 2.00,  max: 5.00 },
  copper:     { name: 'Copper Ore',   icon: '🟤', color: '#c2410c', category: 'raw',       basePrice: 4.00,  min: 3.00,  max: 6.00 },
  coal:       { name: 'Coal',         icon: '⚫', color: '#1c1917', category: 'raw',       basePrice: 1.80,  min: 1.00,  max: 3.00 },
  gold:       { name: 'Gold Ore',     icon: '✨', color: '#eab308', category: 'raw',       basePrice: 22.00, min: 15.00, max: 30.00 },
  diamonds:   { name: 'Diamonds',     icon: '💎', color: '#67e8f9', category: 'raw',       basePrice: 55.00, min: 40.00, max: 80.00 },
  oil:        { name: 'Crude Oil',    icon: '🛢️', color: '#1e1b4b', category: 'raw',       basePrice: 8.00,  min: 5.00,  max: 12.00 },
  gas:        { name: 'Natural Gas',  icon: '💨', color: '#7dd3fc', category: 'raw',       basePrice: 5.00,  min: 3.00,  max: 8.00 },
  // Processed
  steel:      { name: 'Steel',        icon: '🔩', color: '#6b7280', category: 'processed', basePrice: 8.00,  min: 4.00,  max: 12.00 },
  wire:       { name: 'Copper Wire',  icon: '🔌', color: '#ea580c', category: 'processed', basePrice: 7.00,  min: 4.00,  max: 10.00 },
  goldBars:   { name: 'Gold Bars',    icon: '🥇', color: '#ca8a04', category: 'processed', basePrice: 45.00, min: 30.00, max: 60.00 },
  // Finished
  tools:      { name: 'Tools',        icon: '🔧', color: '#4b5563', category: 'finished',  basePrice: 20.00, min: 12.00, max: 28.00 },
  electronics:{ name: 'Electronics',  icon: '💻', color: '#2563eb', category: 'finished',  basePrice: 18.00, min: 10.00, max: 25.00 },
  jewelry:    { name: 'Jewelry',      icon: '💍', color: '#fbbf24', category: 'finished',  basePrice: 70.00, min: 50.00, max: 95.00 },
};

export const ALL_MINERAL_IDS = Object.keys(MINERAL_RESOURCES);

// Survey rig constants
export const SURVEY_RIG = {
  cost: 30,
  revealRadius: 20,  // world units
  surveyTime: 5000,  // ms
};

// Mine constants
export const MINE = {
  cost: 150,
  autoSurveyRadius: 8,  // smaller radius — checks just the spot
};
