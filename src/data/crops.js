// ═══════════════════════════════════════════════════
//  CROP DEFINITIONS — Supply Chain Idle
//  Each crop defines: grow time, sell price range,
//  what it processes into, and visual properties
// ═══════════════════════════════════════════════════

export const CROPS = {
  cotton: {
    id: 'cotton',
    name: 'Cotton',
    icon: '🌾',
    color: '#fbbf24',     // amber
    modelTint: 0xfbbf24,
    growTime: 5000,        // ms
    harvestCost: 1,
    priceRange: { min: 1.00, max: 4.00 },
    basePrice: 2.50,
    chain: 'textile',
    description: 'Fast-growing fiber. Process into cloth then textiles.',
  },
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    icon: '🌾',
    color: '#a3e635',     // lime
    modelTint: 0xa3e635,
    growTime: 6000,
    harvestCost: 1,
    priceRange: { min: 0.80, max: 3.50 },
    basePrice: 2.00,
    chain: 'food',
    description: 'Staple grain. Mill into flour, bake into bread.',
  },
  corn: {
    id: 'corn',
    name: 'Corn',
    icon: '🌽',
    color: '#facc15',     // yellow
    modelTint: 0xfacc15,
    growTime: 4000,
    harvestCost: 1,
    priceRange: { min: 0.50, max: 2.00 },
    basePrice: 1.20,
    chain: 'feed',
    description: 'Quick cheap crop. Process into animal feed or ethanol.',
  },
  sugarcane: {
    id: 'sugarcane',
    name: 'Sugarcane',
    icon: '🎋',
    color: '#34d399',     // emerald
    modelTint: 0x34d399,
    growTime: 8000,
    harvestCost: 2,
    priceRange: { min: 1.00, max: 3.00 },
    basePrice: 2.00,
    chain: 'sugar',
    description: 'Slow but sweet. Refine into sugar, then candy or drinks.',
  },
  coffee: {
    id: 'coffee',
    name: 'Coffee',
    icon: '☕',
    color: '#92400e',     // brown
    modelTint: 0x92400e,
    growTime: 10000,
    harvestCost: 3,
    priceRange: { min: 3.00, max: 6.00 },
    basePrice: 4.50,
    chain: 'coffee',
    description: 'Premium crop. Roast and package for high margins.',
  },
  tobacco: {
    id: 'tobacco',
    name: 'Tobacco',
    icon: '🍂',
    color: '#78716c',     // stone
    modelTint: 0x78716c,
    growTime: 12000,
    harvestCost: 3,
    priceRange: { min: 4.00, max: 8.00 },
    basePrice: 5.50,
    chain: 'tobacco',
    description: 'Slow, expensive to harvest. High raw value.',
  },
};

// ═══════════════════════════════════════════════════
//  PROCESSING BUILDINGS
//  Each defines: what input it needs, what it outputs,
//  cost, timer, operation cost, and conversion ratio
// ═══════════════════════════════════════════════════

export const PROCESSORS = {
  // ── Textile Chain ──
  warehouse: {
    id: 'warehouse',
    name: 'Warehouse',
    icon: '📦',
    cost: 100,
    opCost: 2,
    processTime: 8000,
    input: 'cotton',
    inputAmount: 1,
    output: 'cloth',
    outputAmount: 0.8,
    chain: 'textile',
    description: 'Cotton → Cloth (80% yield)',
  },
  factory: {
    id: 'factory',
    name: 'Factory',
    icon: '🏢',
    cost: 200,
    opCost: 5,
    processTime: 10000,
    input: 'cloth',
    inputAmount: 2,
    output: 'textiles',
    outputAmount: 1,
    chain: 'textile',
    description: 'Cloth → Textiles (2:1)',
  },

  // ── Food Chain ──
  mill: {
    id: 'mill',
    name: 'Mill',
    icon: '⚙️',
    cost: 120,
    opCost: 3,
    processTime: 7000,
    input: 'wheat',
    inputAmount: 1,
    output: 'flour',
    outputAmount: 0.75,
    chain: 'food',
    description: 'Wheat → Flour (75% yield)',
  },
  bakery: {
    id: 'bakery',
    name: 'Bakery',
    icon: '🍞',
    cost: 250,
    opCost: 6,
    processTime: 12000,
    input: 'flour',
    inputAmount: 3,
    output: 'bread',
    outputAmount: 1,
    chain: 'food',
    description: 'Flour → Bread (3:1)',
  },

  // ── Feed Chain ──
  feedMill: {
    id: 'feedMill',
    name: 'Feed Mill',
    icon: '🏭',
    cost: 100,
    opCost: 2,
    processTime: 6000,
    input: 'corn',
    inputAmount: 2,
    output: 'animalFeed',
    outputAmount: 1,
    chain: 'feed',
    description: 'Corn → Animal Feed (2:1)',
  },
  ethanolPlant: {
    id: 'ethanolPlant',
    name: 'Ethanol Plant',
    icon: '⛽',
    cost: 200,
    opCost: 4,
    processTime: 10000,
    input: 'corn',
    inputAmount: 3,
    output: 'ethanol',
    outputAmount: 1,
    chain: 'feed',
    description: 'Corn → Ethanol (3:1)',
  },

  // ── Sugar Chain ──
  sugarMill: {
    id: 'sugarMill',
    name: 'Sugar Mill',
    icon: '🏭',
    cost: 150,
    opCost: 3,
    processTime: 8000,
    input: 'sugarcane',
    inputAmount: 1,
    output: 'sugar',
    outputAmount: 0.6,
    chain: 'sugar',
    description: 'Sugarcane → Sugar (60% yield)',
  },
  candyFactory: {
    id: 'candyFactory',
    name: 'Candy Factory',
    icon: '🍬',
    cost: 300,
    opCost: 6,
    processTime: 14000,
    input: 'sugar',
    inputAmount: 2,
    output: 'candy',
    outputAmount: 1,
    chain: 'sugar',
    description: 'Sugar → Candy (2:1)',
  },

  // ── Coffee Chain ──
  roaster: {
    id: 'roaster',
    name: 'Coffee Roaster',
    icon: '🔥',
    cost: 180,
    opCost: 4,
    processTime: 9000,
    input: 'coffee',
    inputAmount: 1,
    output: 'roastedCoffee',
    outputAmount: 0.85,
    chain: 'coffee',
    description: 'Coffee beans → Roasted (85% yield)',
  },
  packager: {
    id: 'packager',
    name: 'Packaging Plant',
    icon: '📦',
    cost: 250,
    opCost: 5,
    processTime: 11000,
    input: 'roastedCoffee',
    inputAmount: 2,
    output: 'packagedCoffee',
    outputAmount: 1,
    chain: 'coffee',
    description: 'Roasted → Packaged Coffee (2:1)',
  },

  // ── Tobacco Chain ──
  tobaccoProcessor: {
    id: 'tobaccoProcessor',
    name: 'Tobacco Processor',
    icon: '🏭',
    cost: 200,
    opCost: 5,
    processTime: 10000,
    input: 'tobacco',
    inputAmount: 1,
    output: 'processedTobacco',
    outputAmount: 0.7,
    chain: 'tobacco',
    description: 'Raw → Processed Tobacco (70% yield)',
  },

  // ── Mineral Processing ──
  smelterIron: {
    id: 'smelterIron',
    name: 'Iron Smelter',
    icon: '🔥',
    cost: 200,
    opCost: 5,
    processTime: 10000,
    input: 'iron',
    inputAmount: 1,
    output: 'steel',
    outputAmount: 0.8,
    chain: 'mineral',
    description: 'Iron Ore → Steel (80% yield)',
  },
  smelterCopper: {
    id: 'smelterCopper',
    name: 'Copper Smelter',
    icon: '🔥',
    cost: 200,
    opCost: 5,
    processTime: 10000,
    input: 'copper',
    inputAmount: 1,
    output: 'wire',
    outputAmount: 0.85,
    chain: 'mineral',
    description: 'Copper Ore → Wire (85% yield)',
  },
  smelterGold: {
    id: 'smelterGold',
    name: 'Gold Smelter',
    icon: '🔥',
    cost: 250,
    opCost: 8,
    processTime: 14000,
    input: 'gold',
    inputAmount: 1,
    output: 'goldBars',
    outputAmount: 0.7,
    chain: 'mineral',
    description: 'Gold Ore → Gold Bars (70% yield)',
  },
  foundrySteel: {
    id: 'foundrySteel',
    name: 'Tool Foundry',
    icon: '🏭',
    cost: 300,
    opCost: 8,
    processTime: 14000,
    input: 'steel',
    inputAmount: 2,
    output: 'tools',
    outputAmount: 1,
    chain: 'mineral',
    description: 'Steel → Tools (2:1)',
  },
  foundryWire: {
    id: 'foundryWire',
    name: 'Electronics Factory',
    icon: '💻',
    cost: 300,
    opCost: 8,
    processTime: 14000,
    input: 'wire',
    inputAmount: 2,
    output: 'electronics',
    outputAmount: 1,
    chain: 'mineral',
    description: 'Wire → Electronics (2:1)',
  },
  foundryGold: {
    id: 'foundryGold',
    name: 'Jeweler',
    icon: '💍',
    cost: 350,
    opCost: 10,
    processTime: 16000,
    input: 'goldBars',
    inputAmount: 1,
    output: 'jewelry',
    outputAmount: 1,
    chain: 'mineral',
    description: 'Gold Bars → Jewelry',
  },
};

// ═══════════════════════════════════════════════════
//  ALL TRADEABLE RESOURCES
//  Used for market prices, inventory display, etc.
// ═══════════════════════════════════════════════════

export const RESOURCES = {
  // Raw crops
  cotton:           { name: 'Cotton',           icon: '🌾', color: '#fbbf24', category: 'raw', basePrice: 2.50, min: 1.00, max: 4.00 },
  wheat:            { name: 'Wheat',            icon: '🌾', color: '#a3e635', category: 'raw', basePrice: 2.00, min: 0.80, max: 3.50 },
  corn:             { name: 'Corn',             icon: '🌽', color: '#facc15', category: 'raw', basePrice: 1.20, min: 0.50, max: 2.00 },
  sugarcane:        { name: 'Sugarcane',        icon: '🎋', color: '#34d399', category: 'raw', basePrice: 2.00, min: 1.00, max: 3.00 },
  coffee:           { name: 'Coffee Beans',     icon: '☕', color: '#92400e', category: 'raw', basePrice: 4.50, min: 3.00, max: 6.00 },
  tobacco:          { name: 'Tobacco Leaf',     icon: '🍂', color: '#78716c', category: 'raw', basePrice: 5.50, min: 4.00, max: 8.00 },

  // Processed — Textile
  cloth:            { name: 'Cloth',            icon: '🧵', color: '#60a5fa', category: 'processed', basePrice: 5.00, min: 2.00, max: 8.00 },
  textiles:         { name: 'Textiles',         icon: '👕', color: '#f472b6', category: 'finished', basePrice: 12.00, min: 5.00, max: 19.00 },

  // Processed — Food
  flour:            { name: 'Flour',            icon: '🫘', color: '#fcd34d', category: 'processed', basePrice: 4.50, min: 2.00, max: 7.00 },
  bread:            { name: 'Bread',            icon: '🍞', color: '#fb923c', category: 'finished', basePrice: 15.00, min: 8.00, max: 22.00 },

  // Processed — Feed
  animalFeed:       { name: 'Animal Feed',      icon: '🥣', color: '#d97706', category: 'processed', basePrice: 3.00, min: 1.50, max: 5.00 },
  ethanol:          { name: 'Ethanol',          icon: '⛽', color: '#059669', category: 'finished', basePrice: 8.00, min: 5.00, max: 12.00 },

  // Processed — Sugar
  sugar:            { name: 'Sugar',            icon: '🧂', color: '#f0fdf4', category: 'processed', basePrice: 5.00, min: 2.50, max: 8.00 },
  candy:            { name: 'Candy',            icon: '🍬', color: '#f472b6', category: 'finished', basePrice: 16.00, min: 10.00, max: 25.00 },

  // Processed — Coffee
  roastedCoffee:    { name: 'Roasted Coffee',   icon: '☕', color: '#78350f', category: 'processed', basePrice: 8.00, min: 5.00, max: 12.00 },
  packagedCoffee:   { name: 'Packaged Coffee',  icon: '📦', color: '#451a03', category: 'finished', basePrice: 22.00, min: 15.00, max: 30.00 },

  // Processed — Tobacco
  processedTobacco: { name: 'Processed Tobacco',icon: '🚬', color: '#57534e', category: 'finished', basePrice: 14.00, min: 12.00, max: 20.00 },

  // ── Minerals (raw) ──
  iron:             { name: 'Iron Ore',         icon: '⛏️', color: '#b91c1c', category: 'mineral',   basePrice: 3.50,  min: 2.00,  max: 5.00 },
  copper:           { name: 'Copper Ore',       icon: '🟤', color: '#c2410c', category: 'mineral',   basePrice: 4.00,  min: 3.00,  max: 6.00 },
  coal:             { name: 'Coal',             icon: '⚫', color: '#44403c', category: 'mineral',   basePrice: 1.80,  min: 1.00,  max: 3.00 },
  gold:             { name: 'Gold Ore',         icon: '✨', color: '#eab308', category: 'mineral',   basePrice: 22.00, min: 15.00, max: 30.00 },
  diamonds:         { name: 'Diamonds',         icon: '💎', color: '#67e8f9', category: 'mineral',   basePrice: 55.00, min: 40.00, max: 80.00 },

  // ── Oil & Gas (raw) ──
  oil:              { name: 'Crude Oil',        icon: '🛢️', color: '#4c1d95', category: 'energy',    basePrice: 8.00,  min: 5.00,  max: 12.00 },
  gas:              { name: 'Natural Gas',      icon: '💨', color: '#7dd3fc', category: 'energy',    basePrice: 5.00,  min: 3.00,  max: 8.00 },

  // ── Refined Minerals ──
  steel:            { name: 'Steel',            icon: '🔩', color: '#6b7280', category: 'processed', basePrice: 8.00,  min: 4.00,  max: 12.00 },
  wire:             { name: 'Copper Wire',      icon: '🔌', color: '#ea580c', category: 'processed', basePrice: 7.00,  min: 4.00,  max: 10.00 },
  goldBars:         { name: 'Gold Bars',        icon: '🥇', color: '#ca8a04', category: 'processed', basePrice: 45.00, min: 30.00, max: 60.00 },

  // ── Finished Mineral Products ──
  tools:            { name: 'Tools',            icon: '🔧', color: '#4b5563', category: 'finished',  basePrice: 20.00, min: 12.00, max: 28.00 },
  electronics:      { name: 'Electronics',      icon: '💻', color: '#2563eb', category: 'finished',  basePrice: 18.00, min: 10.00, max: 25.00 },
  jewelry:          { name: 'Jewelry',          icon: '💍', color: '#fbbf24', category: 'finished',  basePrice: 70.00, min: 50.00, max: 95.00 },
};

// Helper: get all resource IDs
export const ALL_RESOURCE_IDS = Object.keys(RESOURCES);

// Helper: get crop list for UI
export const CROP_LIST = Object.values(CROPS);

// Helper: get processor list for UI
export const PROCESSOR_LIST = Object.values(PROCESSORS);
