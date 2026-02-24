# 🏭 Supply Chain Idle

A 3D supply chain management simulation game built with React, Three.js, and Zustand.

**This is NOT a clicker game** — it's a strategic simulation where you build farms, warehouses, and factories, manage production timers, and make market timing decisions.

![Supply Chain Idle](https://img.shields.io/badge/status-MVP-yellow) ![React](https://img.shields.io/badge/React-18-blue) ![Three.js](https://img.shields.io/badge/Three.js-r160-green)

## 🎮 How to Play

### Core Loop
1. **Build Farms** ($50) → Produce cotton every 5 seconds → Harvest manually
2. **Sell cotton** at market price OR send to a **Warehouse** ($100) → Converts to cloth (8s)
3. **Sell cloth** OR send to a **Factory** ($200) → Produces textiles (10s)
4. **Sell textiles** for maximum profit — market prices fluctuate ±10% every 10 seconds!

### Strategy
- **Quick cash:** Sell raw cotton immediately
- **Higher margins:** Process through the full supply chain (cotton → cloth → textiles)
- **Market timing:** Watch price arrows — sell when prices are high!
- **Prestige:** Reset resources but keep buildings + gain permanent +5% production speed

### Controls
- **Mouse drag** — Rotate camera
- **Right-drag** — Pan camera
- **Scroll** — Zoom in/out
- **Arrow keys / WASD** — Move camera
- **D-pad buttons** — Bottom-right corner navigation
- **ESC** — Cancel building placement

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/supply-chain-idle.git
cd supply-chain-idle

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:3000` in your browser.

## 📦 Build for Production

```bash
npm run build
npm run preview
```

The built files will be in `dist/`.

## 🗂️ Project Structure

```
supply-chain-idle/
├── index.html              # Entry HTML
├── package.json            # Dependencies & scripts
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS config
├── postcss.config.js       # PostCSS config
├── public/
│   ├── favicon.svg         # Browser tab icon
│   └── models/             # 3D GLB models
│       ├── characters/     # Worker models
│       ├── landscape/      # Trees, rocks, mountains, bushes
│       ├── items/          # Cotton, cloth, textile models
│       ├── effects/        # Particle effect models
│       └── vehicles/       # Cart, truck models
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # App wrapper + error boundary
    ├── index.css           # Tailwind + global styles
    ├── components/
    │   └── Game3D.jsx      # Main game UI + 3D canvas
    ├── lib/
    │   └── three-renderer.js  # 3D engine, model loading, world gen
    └── store/
        └── gameStore.js    # Zustand game state (buildings, economy, production)
```

## 🎨 3D Models

The game loads GLB models from `public/models/`. If a model file is missing, the engine automatically uses a procedural fallback (colored geometric shapes), so the game always works.

### Model Folders

| Folder | Models | Purpose |
|--------|--------|---------|
| `characters/` | worker-base, worker-farmer, worker-processor, worker-factory | Decorative workers near buildings |
| `landscape/` | tree-oak, tree-pine, rock-large, rock-small, grass-tuft, bush, mountain-low, mountain-high | World scenery |
| `buildings/` | farm, warehouse, factory | Player-placed buildings |
| `items/` | cotton-bundle, cloth-roll, textile-box | Decorative resource items |
| `effects/` | smoke-particle, dust-particle, spark-particle | Particle effects |
| `vehicles/` | cart, truck | Decorative vehicles |

### Auto-Scaling
Models are automatically scaled to fit the world proportions based on their bounding box. Target heights are defined in `three-renderer.js` → `targetSizes`. Adjust these numbers if your models look too big or small.

## ⚖️ Game Balance

| Building | Cost | Timer | Op Cost | Output |
|----------|------|-------|---------|--------|
| Farm | $50 | 5s | $1 | 1 Cotton |
| Warehouse | $100 | 8s | $2 | Cotton → Cloth (80% ratio) |
| Factory | $200 | 10s | $5 | 2 Cloth → 1 Textile |

| Resource | Price Range | Base Price |
|----------|-------------|------------|
| Cotton | $1.00 — $4.00 | $2.50 |
| Cloth | $2.00 — $8.00 | $5.00 |
| Textiles | $5.00 — $19.00 | $12.00 |

- **Starting money:** $100
- **Market fluctuation:** ±10% every 10 seconds
- **Prestige bonus:** +5% production speed per level (stacking)

## 🛠️ Tech Stack

- **React 18** + **Vite** — Fast dev server & builds
- **Three.js r160** — 3D rendering with OrbitControls & GLTFLoader
- **Zustand** — Lightweight state management with persistence
- **Tailwind CSS** — Utility styling

## 📋 Roadmap

- [x] Core game loop (build → produce → harvest → sell)
- [x] 3D world with GLB model loading
- [x] Market price fluctuations
- [x] Prestige system
- [x] Camera controls (orbit + keyboard + D-pad)
- [ ] Sound effects
- [ ] Achievements system
- [ ] Leaderboards
- [ ] Multi-chain supply routes
- [ ] Firebase integration
- [ ] Mobile touch optimization

## 📄 License

MIT
