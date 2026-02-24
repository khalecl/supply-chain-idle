import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class GameRenderer {
  constructor(canvas, gameStore, options = {}) {
    this.canvas = canvas;
    this.gameStore = gameStore;
    this.options = options; // { skipWorldGen: bool }

    // ─── THREE CORE ───
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x9bc4e0, 0.0008);

    this.camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 5000);
    this.camera.position.set(0, 60, 100);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // ─── ORBIT CONTROLS ───
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.15;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 400;
    this.controls.target.set(0, 0, 0);

    // ─── PAN VELOCITY (arrow keys + buttons) ───
    this.panVelocity = new THREE.Vector3();
    this.panKeys = { left: false, right: false, up: false, down: false };
    this.panSpeed = 80; // world units per second

    // ─── RAYCASTER ───
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.placementGround = null;

    // ─── PLACEMENT ───
    this.placementMode = null;
    this.previewBuilding = null;

    // ─── COLLECTIONS ───
    this.models = new Map();
    this.landscapeObjects = [];
    this.buildings = [];
    this.workers = [];

    // ─── LOADER ───
    this.gltfLoader = new GLTFLoader();

    // ─── TARGET SIZES (world-unit heights after scaling) ───
    this.targetSizes = {
      // Buildings — keys match BOTH 'FARM' and 'farm' via normalization
      'farm':               6,
      'warehouse':          5,
      'factory':            8,

      // Landscape
      'tree-oak':           5,
      'tree-pine':          6,
      'rock-large':         2.0,
      'rock-small':         1.0,
      'grass-tuft':         0.5,
      'bush':               1.2,
      'mountain-low':      20,
      'mountain-high':     35,

      // Characters
      'worker-base':        1.6,
      'worker-farmer':      1.6,
      'worker-processor':   1.6,
      'worker-factory':     1.6,

      // Items
      'cotton-bundle':      0.6,
      'cloth-roll':         0.8,
      'textile-box':        0.8,

      // Effects
      'smoke-particle':     0.4,
      'dust-particle':      0.3,
      'spark-particle':     0.3,

      // Vehicles
      'cart':               2.0,
      'truck':              3.0,
    };

    // ─── MODEL MANIFEST ───
    // Use import.meta.env.BASE_URL so paths work on GitHub Pages
    const base = import.meta.env.BASE_URL || '/';
    this.modelManifest = {
      // Buildings
      'farm':              `${base}models/buildings/farm.glb`,
      'warehouse':         `${base}models/buildings/warehouse.glb`,
      'factory':           `${base}models/buildings/factory.glb`,

      // Characters
      'worker-base':       `${base}models/characters/worker-base.glb`,
      'worker-farmer':     `${base}models/characters/worker-farmer.glb`,
      'worker-processor':  `${base}models/characters/worker-processor.glb`,
      'worker-factory':    `${base}models/characters/worker-factory.glb`,

      // Landscape
      'tree-oak':          `${base}models/landscape/tree-oak.glb`,
      'tree-pine':         `${base}models/landscape/tree-pine.glb`,
      'rock-large':        `${base}models/landscape/rock-large.glb`,
      'rock-small':        `${base}models/landscape/rock-small.glb`,
      'grass-tuft':        `${base}models/landscape/grass-tuft.glb`,
      'bush':              `${base}models/landscape/bush.glb`,
      'mountain-low':      `${base}models/landscape/mountain-low.glb`,
      'mountain-high':     `${base}models/landscape/mountain-high.glb`,

      // Items
      'cotton-bundle':     `${base}models/items/cotton-bundle.glb`,
      'cloth-roll':        `${base}models/items/cloth-roll.glb`,
      'textile-box':       `${base}models/items/textile-box.glb`,

      // Effects
      'smoke-particle':    `${base}models/effects/smoke-particle.glb`,
      'dust-particle':     `${base}models/effects/dust-particle.glb`,
      'spark-particle':    `${base}models/effects/spark-particle.glb`,

      // Vehicles
      'cart':              `${base}models/vehicles/cart.glb`,
      'truck':             `${base}models/vehicles/truck.glb`,
    };

    // ─── INIT ───
    this.initScene();
    this.setupLighting();
    this.setupMouseTracking();
    this.setupKeyboardPan();

    this.modelsReady = false;
    this.initAsync();
  }

  // ══════════════════════════════════════════════════════════
  //  ASYNC: Load models → generate world
  // ══════════════════════════════════════════════════════════

  async initAsync() {
    console.log('🔄 Loading GLB models...');
    await this.loadAllModels();
    const loaded = [...this.models.keys()];
    console.log(`✅ ${loaded.length} models loaded: ${loaded.join(', ')}`);
    this.modelsReady = true;

    if (!this.options.skipWorldGen) {
      this.generateWorld();
      console.log('✅ World generated');
    } else {
      console.log('⏭️ World gen skipped (builder mode)');
    }
  }

  async loadAllModels() {
    const promises = Object.entries(this.modelManifest).map(([name, path]) =>
      this.loadModel(name, path)
    );
    await Promise.allSettled(promises);
  }

  async loadModel(name, path) {
    try {
      const gltf = await this.gltfLoader.loadAsync(path);
      const model = gltf.scene;

      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      // Measure natural bounding box
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);

      this.models.set(name, {
        scene: model,
        naturalHeight: Math.max(size.y, 0.01),
        bbox: box.clone(),
      });
      console.log(`  ✅ ${name}  (h=${size.y.toFixed(2)}, w=${size.x.toFixed(2)}, d=${size.z.toFixed(2)})`);
    } catch (err) {
      // Silently fall back to procedural
      console.warn(`  ⚠️ ${name}: fallback  (${err.message?.substring(0, 60)})`);
    }
  }

  // ── Get a model clone, auto-scaled to target size, bottom at y=0 ──
  getModel(name) {
    const key = name.toLowerCase();
    const target = this.targetSizes[key] || 2;
    const entry = this.models.get(key);

    if (entry) {
      const clone = entry.scene.clone();
      const s = target / entry.naturalHeight;
      clone.scale.set(s, s, s);

      // Re-measure after scale and anchor bottom to y=0
      const box = new THREE.Box3().setFromObject(clone);
      clone.position.y = -box.min.y;

      return clone;
    }
    return this.proceduralFallback(key, target);
  }

  // ── Same but with a multiplier on the target size ──
  getModelScaled(name, mult) {
    const key = name.toLowerCase();
    const target = (this.targetSizes[key] || 2) * mult;
    const entry = this.models.get(key);

    if (entry) {
      const clone = entry.scene.clone();
      const s = target / entry.naturalHeight;
      clone.scale.set(s, s, s);
      const box = new THREE.Box3().setFromObject(clone);
      clone.position.y = -box.min.y;
      return clone;
    }
    return this.proceduralFallback(key, target);
  }

  // ══════════════════════════════════════════════════════════
  //  PROCEDURAL FALLBACKS
  // ══════════════════════════════════════════════════════════

  proceduralFallback(key, h) {
    const g = new THREE.Group();

    if (key === 'farm') {
      const barn = this.m(new THREE.BoxGeometry(6, 3, 5), 0x8B4513); barn.position.y = 1.5; g.add(barn);
      const roof = this.m(new THREE.ConeGeometry(4.5, 2.5, 4), 0xc0392b); roof.position.y = 4.2; roof.rotation.y = Math.PI / 4; g.add(roof);
      const silo = this.m(new THREE.CylinderGeometry(1, 1, 5, 8), 0x95a5a6); silo.position.set(4.5, 2.5, 0); g.add(silo);
      const st = this.m(new THREE.ConeGeometry(1.2, 1, 8), 0x7f8c8d); st.position.set(4.5, 5.5, 0); g.add(st);
      return g;
    }
    if (key === 'warehouse') {
      const b = this.m(new THREE.BoxGeometry(8, 4, 6), 0xe67e22); b.position.y = 2; g.add(b);
      const r = this.m(new THREE.BoxGeometry(9, 0.3, 7), 0xd35400); r.position.y = 4.15; g.add(r);
      const d = this.m(new THREE.BoxGeometry(2.5, 3, 0.1), 0x2c3e50); d.position.set(0, 1.5, 3.05); g.add(d);
      return g;
    }
    if (key === 'factory') {
      const b = this.m(new THREE.BoxGeometry(10, 5, 8), 0x2c3e50); b.position.y = 2.5; g.add(b);
      const r = this.m(new THREE.BoxGeometry(11, 0.4, 9), 0x34495e); r.position.y = 5.2; g.add(r);
      const s1 = this.m(new THREE.CylinderGeometry(0.6, 0.8, 6, 8), 0x7f8c8d); s1.position.set(3, 8, 2); g.add(s1);
      for (let i = 0; i < 3; i++) {
        const w = this.m(new THREE.BoxGeometry(1.2, 1.2, 0.1), 0x85c1e9); w.position.set(-3 + i * 3, 3, 4.05); g.add(w);
      }
      return g;
    }
    if (key.startsWith('tree')) {
      const trunk = this.m(new THREE.CylinderGeometry(0.2, 0.35, h * 0.4, 6), 0x8B4513);
      trunk.position.y = h * 0.2; g.add(trunk);
      if (key.includes('pine')) {
        for (let j = 0; j < 3; j++) {
          const c = this.m(new THREE.ConeGeometry(h * 0.22 - j * 0.2, h * 0.25, 6), 0x1a5c1a);
          c.position.y = h * 0.42 + j * h * 0.18; g.add(c);
        }
      } else {
        const top = this.m(new THREE.SphereGeometry(h * 0.3, 8, 6), 0x228B22);
        top.position.y = h * 0.6; g.add(top);
      }
      return g;
    }
    if (key.startsWith('rock')) {
      const r = this.m(new THREE.DodecahedronGeometry(h * 0.5, 0), 0x808080);
      r.position.y = h * 0.25; g.add(r); return g;
    }
    if (key.startsWith('mountain')) {
      const mt = this.m(new THREE.ConeGeometry(h * 0.5, h, 5), 0x6b7b6b);
      mt.position.y = h * 0.5; g.add(mt); return g;
    }
    if (key === 'bush') {
      const b = this.m(new THREE.SphereGeometry(h * 0.5, 6, 5), 0x2d7d2d);
      b.position.y = h * 0.35; g.add(b); return g;
    }
    if (key === 'grass-tuft') {
      const bl = this.m(new THREE.ConeGeometry(0.12, h, 4), 0x4a8f2c);
      bl.position.y = h * 0.5; g.add(bl); return g;
    }
    if (key.startsWith('worker')) {
      const bd = this.m(new THREE.CylinderGeometry(0.25, 0.3, h * 0.55, 8), 0x3498db);
      bd.position.y = h * 0.3; g.add(bd);
      const hd = this.m(new THREE.SphereGeometry(h * 0.14, 8, 6), 0xFFDBAC);
      hd.position.y = h * 0.72; g.add(hd); return g;
    }
    // Generic
    const cube = this.m(new THREE.BoxGeometry(h * 0.6, h, h * 0.6), 0xaaaaaa);
    cube.position.y = h * 0.5; g.add(cube);
    return g;
  }

  /** Shorthand: create a shadowed mesh */
  m(geo, color) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ══════════════════════════════════════════════════════════
  //  SCENE SETUP
  // ══════════════════════════════════════════════════════════

  initScene() {
    // Sky
    const skyGeo = new THREE.SphereGeometry(2500, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x3a7bd5) },
        bottomColor: { value: new THREE.Color(0xd4e8ff) },
        offset: { value: 20 },
        exponent: { value: 0.5 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor, bottomColor;
        uniform float offset, exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Ground
    const groundGeo = new THREE.PlaneGeometry(2000, 2000, 80, 80);
    const pa = groundGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i);
      pa.setZ(i, Math.sin(x * 0.008) * Math.cos(y * 0.008) * 2 + Math.sin(x * 0.02) * Math.cos(y * 0.015) * 0.8);
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: 0x5a8f3c }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Flat invisible plane for placement raycasting
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshBasicMaterial({ visible: false }));
    flat.rotation.x = -Math.PI / 2;
    this.scene.add(flat);
    this.placementGround = flat;
  }

  setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(100, 180, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = 250;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 600;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8ec8ff, 0.2);
    fill.position.set(-60, 80, -60);
    this.scene.add(fill);

    this.scene.add(new THREE.HemisphereLight(0x87CEEB, 0x5a8f3c, 0.25));
  }

  // ══════════════════════════════════════════════════════════
  //  INPUT: Mouse tracking + Keyboard pan + Arrow buttons
  // ══════════════════════════════════════════════════════════

  setupMouseTracking() {
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      if (this.placementMode && this.previewBuilding) this.updatePreviewPosition();
    });
  }

  updatePreviewPosition() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObject(this.placementGround);
    if (hits.length > 0) {
      const p = hits[0].point;
      this.previewBuilding.position.set(Math.round(p.x / 5) * 5, 0, Math.round(p.z / 5) * 5);
    }
  }

  setupKeyboardPan() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.panKeys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') this.panKeys.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w') this.panKeys.up = true;
      if (e.key === 'ArrowDown' || e.key === 's') this.panKeys.down = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.panKeys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') this.panKeys.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w') this.panKeys.up = false;
      if (e.key === 'ArrowDown' || e.key === 's') this.panKeys.down = false;
    });
  }

  /** Called from Game3D UI buttons */
  startPan(direction) { this.panKeys[direction] = true; }
  stopPan(direction) { this.panKeys[direction] = false; }
  stopAllPan() { this.panKeys.left = this.panKeys.right = this.panKeys.up = this.panKeys.down = false; }

  applyPan(dt) {
    const speed = this.panSpeed * dt;
    // Get camera's forward and right directions projected on XZ plane
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (this.panKeys.up) move.add(forward.clone().multiplyScalar(speed));
    if (this.panKeys.down) move.add(forward.clone().multiplyScalar(-speed));
    if (this.panKeys.right) move.add(right.clone().multiplyScalar(speed));
    if (this.panKeys.left) move.add(right.clone().multiplyScalar(-speed));

    if (move.lengthSq() > 0) {
      this.camera.position.add(move);
      this.controls.target.add(move);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  BUILDINGS
  // ══════════════════════════════════════════════════════════

  createBuilding(type, position, id) {
    const mesh = this.getModel(type); // getModel normalizes to lowercase
    mesh.position.set(position.x, 0, position.z);
    mesh.userData = { id, type };
    this.scene.add(mesh);
    this.buildings.push(mesh);

    // Decorative workers near the building
    this.spawnWorkersNear(type, position.x, position.z);
    return mesh;
  }

  createBuildingPreview(type) {
    const mesh = this.getModel(type);
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.4;
      }
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    mesh.add(ring);
    return mesh;
  }

  spawnWorkersNear(buildingType, bx, bz) {
    const wt = buildingType === 'FARM' ? 'worker-farmer'
             : buildingType === 'WAREHOUSE' ? 'worker-processor'
             : 'worker-factory';
    const n = buildingType === 'FARM' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = 8 + Math.random() * 4;
      const w = this.getModel(wt);
      w.position.set(bx + Math.cos(a) * d, 0, bz + Math.sin(a) * d);
      w.rotation.y = Math.random() * Math.PI * 2;
      w.userData = { isWorker: true, seed: Math.random() * 100 };
      this.scene.add(w);
      this.workers.push(w);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  WORLD GENERATION
  // ══════════════════════════════════════════════════════════
  //
  //  Layout concept (top-down):
  //
  //     Mountains (far back, z = -250 to -400)
  //     ────────────────────────────────────
  //     Trees / Forest rings  (z = -80 to -180, and sides)
  //
  //     ┌─────────────────────────────┐
  //     │   CLEAR CENTER  (±40)      │  ← player builds here
  //     └─────────────────────────────┘
  //
  //     Trees / bushes (z = +60 to +180)
  //     Mountains (far sides, optional)
  //

  generateWorld() {
    // ─── MOUNTAINS: far background, anchored to ground ───
    // Back range (behind everything)
    this.ring('mountain-high', 0, -350, 5, 500, 80, [0.8, 1.4]);
    this.ring('mountain-low',  0, -280, 7, 550, 60, [0.6, 1.2]);
    // Left/right distant ranges
    this.ring('mountain-low', -350, 0, 4, 80, 300, [0.5, 1.0]);
    this.ring('mountain-low',  350, 0, 4, 80, 300, [0.5, 1.0]);

    // ─── FORESTS: rings around the buildable center ───
    // North-west forest
    this.ring('tree-oak',  -100, -100, 12, 70, 60, [0.7, 1.3]);
    this.ring('tree-pine', -120,  -80,  8, 50, 40, [0.8, 1.2]);
    this.ring('bush',      -110,  -90, 10, 80, 60, [0.6, 1.3]);

    // North-east forest
    this.ring('tree-pine',  110, -100, 10, 60, 50, [0.7, 1.3]);
    this.ring('tree-oak',   130,  -80,  6, 40, 40, [0.8, 1.2]);
    this.ring('bush',       120,  -90,  8, 70, 50, [0.5, 1.2]);

    // South-west grove
    this.ring('tree-oak',  -100,  80,  8, 50, 40, [0.7, 1.2]);
    this.ring('bush',       -90,  70,  6, 40, 30, [0.6, 1.1]);

    // South-east grove
    this.ring('tree-pine',  100,  90,  7, 50, 45, [0.8, 1.2]);
    this.ring('tree-oak',   120,  70,  5, 35, 30, [0.7, 1.1]);

    // Far south
    this.ring('tree-oak',     0, 160,  8, 80, 40, [0.7, 1.3]);
    this.ring('tree-pine',  -40, 180,  5, 50, 30, [0.8, 1.1]);

    // ─── GRASS scattered all around (avoid center ±25) ───
    this.scatter('grass-tuft', 0, 0, 40, 300, 300, [0.5, 1.5], 25);

    // ─── ROCKS scattered (avoid center ±20) ───
    this.scatter('rock-large', 0, 0, 10, 250, 250, [0.6, 1.3], 20);
    this.scatter('rock-small', 0, 0, 18, 280, 280, [0.5, 1.4], 15);

    // ─── DECORATIVE ITEMS near edge of build area ───
    this.placeSingle('cotton-bundle', -25, -18, 1.0);
    this.placeSingle('cotton-bundle', -22, -20, 0.8);
    this.placeSingle('cloth-roll',    -20, -22, 1.0);
    this.placeSingle('textile-box',   -17, -20, 0.9);

    // ─── VEHICLES parked near edges ───
    this.placeSingle('cart',  30, -18, 1.0, Math.PI * 0.3);
    this.placeSingle('truck', -35, 25, 1.0, -Math.PI * 0.15);
  }

  /** Place models in a rectangular ring area */
  ring(model, cx, cz, count, spreadX, spreadZ, scaleRange) {
    for (let i = 0; i < count; i++) {
      const x = cx + (Math.random() - 0.5) * spreadX;
      const z = cz + (Math.random() - 0.5) * spreadZ;
      const s = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);
      const obj = this.getModelScaled(model, s);
      obj.position.set(x, 0, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(obj);
      this.landscapeObjects.push(obj);
    }
  }

  /** Scatter models, avoiding center radius */
  scatter(model, cx, cz, count, spreadX, spreadZ, scaleRange, avoidRadius) {
    for (let i = 0; i < count; i++) {
      const x = cx + (Math.random() - 0.5) * spreadX;
      const z = cz + (Math.random() - 0.5) * spreadZ;
      if (Math.abs(x - cx) < avoidRadius && Math.abs(z - cz) < avoidRadius) continue;
      const s = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);
      const obj = this.getModelScaled(model, s);
      obj.position.set(x, 0, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(obj);
      this.landscapeObjects.push(obj);
    }
  }

  placeSingle(model, x, z, scale, rotY = 0) {
    const obj = this.getModelScaled(model, scale);
    obj.position.set(x, 0, z);
    obj.rotation.y = rotY;
    this.scene.add(obj);
    this.landscapeObjects.push(obj);
  }

  /**
   * Load a custom world from worldStore objects array.
   * Clears existing landscape objects first.
   * @param {Array} objects - [{ modelId, x, z, rotY, scale }, ...]
   */
  loadCustomWorld(objects) {
    // Clear existing landscape
    this.landscapeObjects.forEach(o => this.scene.remove(o));
    this.landscapeObjects = [];

    if (!objects || objects.length === 0) return;

    objects.forEach(obj => {
      const mesh = this.getModelScaled(obj.modelId, obj.scale || 1.0);
      mesh.position.set(obj.x, 0, obj.z);
      mesh.rotation.y = obj.rotY || 0;
      this.scene.add(mesh);
      this.landscapeObjects.push(mesh);
    });

    console.log(`✅ Custom world loaded: ${objects.length} objects`);
  }

  // ══════════════════════════════════════════════════════════
  //  UPDATE / RENDER / LIFECYCLE
  // ══════════════════════════════════════════════════════════

  update(dt) {
    this.controls.update();
    this.applyPan(dt);

    // Worker idle bob
    const t = Date.now() * 0.001;
    this.workers.forEach(w => {
      if (w.userData.isWorker) {
        w.position.y = Math.sin(t * 2 + w.userData.seed) * 0.08;
        w.rotation.y += dt * 0.3;
      }
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.controls?.dispose();
    const geos = new Set(), mats = new Set();
    this.scene?.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m));
    });
    geos.forEach(g => g.dispose());
    mats.forEach(m => m.dispose());
    this.renderer?.dispose();
    this.models.clear();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}
