import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class GameRenderer {
  constructor(canvas, gameStore, options = {}) {
    this.canvas = canvas;
    this.gameStore = gameStore;
    this.options = options;
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
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.15;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 400;
    this.controls.target.set(0, 0, 0);
    this.panKeys = { left: false, right: false, up: false, down: false };
    this.panSpeed = 80;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.placementGround = null;
    this.placementMode = null;
    this.previewBuilding = null;
    this.models = new Map();
    this.landscapeObjects = [];
    this.buildings = [];
    this.gltfLoader = new GLTFLoader();

    this.targetSizes = {
      'farm':6,'warehouse':5,'factory':8,'grain_farm':6,'mill':7,'bakery':6,
      'feedmill':5,'ethanolplant':6,'sugarmill':6,'candyfactory':5,
      'roaster':4,'packager':5,'tobaccoprocessor':5,
      'surveyrig':3,'mine':6,
      'smelteriron':6,'smeltercopper':6,'smeltergold':6,
      'foundrysteel':6,'foundrywire':6,'foundrygold':6,
      'tree-oak':5,'tree-pine':6,'tree-willow':5.5,'tree-palm':7,'tree-dead':4,'tree-stump':1,
      'bush':1.2,'grass-tuft':0.5,'flower-red':0.6,'flower-yellow':0.7,'flower-blue':0.6,
      'hedge':1.8,'mushroom':0.5,'crop-row':0.8,'haystack':2,'fallen-log':1,
      'rock-large':2,'rock-small':1,'rock-flat':0.6,'rock-cluster':1.8,'cliff':8,
      'mountain-high':35,'mountain-low':20,'hill':8,
      'fence-wood':1.5,'fence-stone':1.8,'gate':3,'bridge-wood':2,'well':2.5,
      'windmill':10,'water-tower':8,'market-stall':3,'signpost':2.5,'lamp-post':3.5,'bench':1,
      'barrel':1,'crate':0.8,'pallet':0.4,'sack':0.7,'wheelbarrow':1.2,
      'campfire':1,'tent':2.5,'flag':3,'fountain':2.5,
      'cotton-bundle':0.6,'cloth-roll':0.8,'textile-box':0.8,
      'wheat-bundle':0.6,'flour-sack':0.7,'bread-basket':0.5,
      'cart':2,'truck':3,'wagon':2.5,'boat':2,
      'worker-base':1.6,'worker-farmer':1.6,'worker-processor':1.6,'worker-factory':1.6,'worker-baker':1.6,
      'pond':1,'river-straight':0.5,'river-bend':0.5,
    };

    const base = import.meta.env.BASE_URL || '/';
    this.modelManifest = {};
    const folders = {
      buildings:['farm','warehouse','factory','grain_farm','mill','bakery','feedmill','ethanolplant','sugarmill','candyfactory','roaster','packager','tobaccoprocessor','surveyrig','mine','smelteriron','smeltercopper','smeltergold','foundrysteel','foundrywire','foundrygold'],
      characters:['worker-base','worker-farmer','worker-processor','worker-factory','worker-baker'],
      landscape:['tree-oak','tree-pine','tree-willow','tree-palm','tree-dead','tree-stump','bush','grass-tuft','flower-red','flower-yellow','flower-blue','hedge','mushroom','crop-row','haystack','fallen-log','rock-large','rock-small','rock-flat','rock-cluster','cliff','mountain-high','mountain-low','hill','pond','river-straight','river-bend'],
      structures:['fence-wood','fence-stone','gate','bridge-wood','well','windmill','water-tower','market-stall','signpost','lamp-post','bench'],
      props:['barrel','crate','pallet','sack','wheelbarrow','campfire','tent','flag','fountain'],
      items:['cotton-bundle','cloth-roll','textile-box','wheat-bundle','flour-sack','bread-basket'],
      vehicles:['cart','truck','wagon','boat'],
    };
    for (const [folder,names] of Object.entries(folders)) for (const name of names) this.modelManifest[name]=`${base}models/${folder}/${name}.glb`;

    this.initScene();
    this.setupLighting();
    this.setupMouseTracking();
    this.setupKeyboardPan();
    this.modelsReady = false;
    this.initAsync();
  }

  async initAsync() {
    await Promise.allSettled(Object.entries(this.modelManifest).map(([n,p])=>this.loadModel(n,p)));
    this.modelsReady = true;
    if (!this.options.skipWorldGen) this.generateWorld();
  }

  async loadModel(name, path) {
    try {
      const gltf = await this.gltfLoader.loadAsync(path);
      const model = gltf.scene;
      model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3(); box.getSize(size);
      this.models.set(name, { scene:model, naturalHeight:Math.max(size.y,0.01) });
    } catch(e) {}
  }

  getModel(name) {
    const key=name.toLowerCase(); const target=this.targetSizes[key]||2; const entry=this.models.get(key);
    if(entry){const c=entry.scene.clone();const s=target/entry.naturalHeight;c.scale.set(s,s,s);const b=new THREE.Box3().setFromObject(c);c.position.y=-b.min.y;return c;}
    return this.pf(key,target);
  }

  getModelScaled(name,mult) {
    const key=name.toLowerCase();const target=(this.targetSizes[key]||2)*mult;const entry=this.models.get(key);
    if(entry){const c=entry.scene.clone();const s=target/entry.naturalHeight;c.scale.set(s,s,s);const b=new THREE.Box3().setFromObject(c);c.position.y=-b.min.y;return c;}
    return this.pf(key,target);
  }

  mk(geo,color){const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color}));m.castShadow=true;m.receiveShadow=true;return m;}

  pf(key,h) {
    const g=new THREE.Group();
    if(key==='farm'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(6,3,5),0x8B4513),{position:new THREE.Vector3(0,1.5,0)}));g.add(Object.assign(this.mk(new THREE.ConeGeometry(4.5,2.5,4),0xc0392b),{position:new THREE.Vector3(0,4.2,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(1,1,5,8),0x95a5a6),{position:new THREE.Vector3(4.5,2.5,0)}));return g;}
    if(key==='warehouse'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(8,4,6),0xe67e22),{position:new THREE.Vector3(0,2,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(9,0.3,7),0xd35400),{position:new THREE.Vector3(0,4.15,0)}));return g;}
    if(key==='factory'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(10,5,8),0x2c3e50),{position:new THREE.Vector3(0,2.5,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.6,0.8,6,8),0x7f8c8d),{position:new THREE.Vector3(3,8,2)}));return g;}
    if(key==='grain_farm'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(7,3,5),0xdaa520),{position:new THREE.Vector3(0,1.5,0)}));g.add(Object.assign(this.mk(new THREE.ConeGeometry(5,2,4),0xb8860b),{position:new THREE.Vector3(0,3.5,0)}));return g;}
    if(key==='mill'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(2,3,6,8),0xf5deb3),{position:new THREE.Vector3(0,3,0)}));g.add(Object.assign(this.mk(new THREE.ConeGeometry(3,2,8),0x8B4513),{position:new THREE.Vector3(0,7,0)}));return g;}
    if(key==='bakery'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(7,4,6),0xd2691e),{position:new THREE.Vector3(0,2,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.5,0.5,3,6),0x696969),{position:new THREE.Vector3(3,5.5,-2)}));return g;}
    if(key==='feedmill'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(6,4,5),0xd97706),{position:new THREE.Vector3(0,2,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(1.5,1.5,3,8),0xb45309),{position:new THREE.Vector3(0,5.5,0)}));return g;}
    if(key==='ethanolplant'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(8,5,6),0x059669),{position:new THREE.Vector3(0,2.5,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(1,1,6,8),0x047857),{position:new THREE.Vector3(3,5,1)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.8,0.8,5,8),0x047857),{position:new THREE.Vector3(-3,4.5,-1)}));return g;}
    if(key==='sugarmill'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(2.5,3,5,8),0xf0fdf4),{position:new THREE.Vector3(0,2.5,0)}));g.add(Object.assign(this.mk(new THREE.ConeGeometry(3,2.5,8),0x34d399),{position:new THREE.Vector3(0,6.25,0)}));return g;}
    if(key==='candyfactory'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(8,4,6),0xf472b6),{position:new THREE.Vector3(0,2,0)}));g.add(Object.assign(this.mk(new THREE.SphereGeometry(1.5,8,6),0xfbbf24),{position:new THREE.Vector3(0,5.5,0)}));return g;}
    if(key==='roaster'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(5,3,4),0x78350f),{position:new THREE.Vector3(0,1.5,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.4,0.4,4,6),0x451a03),{position:new THREE.Vector3(2,3.5,0)}));return g;}
    if(key==='packager'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(7,4,6),0x451a03),{position:new THREE.Vector3(0,2,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(8,0.3,7),0x78350f),{position:new THREE.Vector3(0,4.15,0)}));return g;}
    if(key==='tobaccoprocessor'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(7,4,5),0x57534e),{position:new THREE.Vector3(0,2,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.5,0.6,5,6),0x78716c),{position:new THREE.Vector3(3,4.5,1)}));return g;}
    if(key==='surveyrig'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.15,0.15,h*0.8,6),0x808080),{position:new THREE.Vector3(0,h*0.4,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(2,0.4,2),0x8B4513),{position:new THREE.Vector3(0,0.2,0)}));g.add(Object.assign(this.mk(new THREE.ConeGeometry(0.3,1,4),0xfbbf24),{position:new THREE.Vector3(0,h*0.85,0)}));return g;}
    if(key==='mine'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(8,1,8),0x5c534e),{position:new THREE.Vector3(0,0.5,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0,3,4,4),0x78716c),{position:new THREE.Vector3(0,3,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(1.5,4,1.5),0x8B4513),{position:new THREE.Vector3(3,2,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.3,0.3,2,6),0x333333),{position:new THREE.Vector3(3,4.5,0)}));return g;}
    if(key.startsWith('smelter')){g.add(Object.assign(this.mk(new THREE.BoxGeometry(7,5,6),0x78350f),{position:new THREE.Vector3(0,2.5,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.8,1,6,8),0x991b1b),{position:new THREE.Vector3(2,5,1)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.6,0.8,5,8),0x991b1b),{position:new THREE.Vector3(-2,4.5,-1)}));g.add(Object.assign(this.mk(new THREE.SphereGeometry(0.5,6,4),0xff4500),{position:new THREE.Vector3(0,1,3)}));return g;}
    if(key.startsWith('foundry')){g.add(Object.assign(this.mk(new THREE.BoxGeometry(9,5,7),0x4b5563),{position:new THREE.Vector3(0,2.5,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(10,0.4,8),0x374151),{position:new THREE.Vector3(0,5.2,0)}));g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.5,0.5,3,6),0x6b7280),{position:new THREE.Vector3(4,6.5,2)}));return g;}
    if(key.startsWith('tree')){const t=this.mk(new THREE.CylinderGeometry(0.2,0.35,h*0.4,6),0x8B4513);t.position.y=h*0.2;g.add(t);if(key.includes('pine')){for(let j=0;j<3;j++){const c=this.mk(new THREE.ConeGeometry(h*0.22-j*0.2,h*0.25,6),0x1a5c1a);c.position.y=h*0.42+j*h*0.18;g.add(c);}}else if(key.includes('palm')){for(let i=0;i<5;i++){const l=this.mk(new THREE.ConeGeometry(h*0.15,h*0.3,4),0x228B22);l.position.set(Math.cos(i*1.26)*1.5,h*0.75,Math.sin(i*1.26)*1.5);l.rotation.x=0.8;l.rotation.y=i*1.26;g.add(l);}}else if(key.includes('dead')){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.05,0.1,h*0.3,4),0x5c4033),{position:new THREE.Vector3(0.5,h*0.35,0)}));}else if(key.includes('stump')){const s=this.mk(new THREE.CylinderGeometry(0.6,0.7,h,8),0x8B4513);s.position.y=h*0.5;g.add(s);return g;}else{const top=this.mk(new THREE.SphereGeometry(h*0.3,8,6),key.includes('willow')?0x3CB371:0x228B22);top.position.y=h*0.6;g.add(top);}return g;}
    if(key==='bush'){g.add(Object.assign(this.mk(new THREE.SphereGeometry(h*0.5,6,5),0x2d7d2d),{position:new THREE.Vector3(0,h*0.35,0)}));return g;}
    if(key==='grass-tuft'){g.add(Object.assign(this.mk(new THREE.ConeGeometry(0.12,h,4),0x4a8f2c),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key.startsWith('flower')){const cols={'flower-red':0xff4444,'flower-yellow':0xffd700,'flower-blue':0x4488ff};for(let i=0;i<5;i++){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.02,0.02,h*0.7,4),0x228B22),{position:new THREE.Vector3((Math.random()-0.5)*0.5,h*0.35,( Math.random()-0.5)*0.5)}));g.add(Object.assign(this.mk(new THREE.SphereGeometry(h*0.15,6,4),cols[key]||0xff4444),{position:new THREE.Vector3((Math.random()-0.5)*0.5,h*0.75,(Math.random()-0.5)*0.5)}));}return g;}
    if(key==='hedge'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(3,h,0.8),0x2d7d2d),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key==='mushroom'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.08,0.1,h*0.6,6),0xf5deb3),{position:new THREE.Vector3(0,h*0.3,0)}));g.add(Object.assign(this.mk(new THREE.SphereGeometry(h*0.35,8,4),0xcc3333),{position:new THREE.Vector3(0,h*0.65,0)}));return g;}
    if(key==='crop-row'){for(let i=0;i<8;i++)g.add(Object.assign(this.mk(new THREE.ConeGeometry(0.08,h,4),0xdaa520),{position:new THREE.Vector3(-2+i*0.6,h*0.5,0)}));return g;}
    if(key==='haystack'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(h*0.4,h*0.5,h,8),0xdaa520),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key==='fallen-log'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.3,0.35,3,6),0x8B4513),{position:new THREE.Vector3(0,0.3,0),rotation:new THREE.Euler(0,0,Math.PI/2)}));return g;}
    if(key.startsWith('rock')){g.add(Object.assign(this.mk(new THREE.DodecahedronGeometry(h*0.5,0),0x808080),{position:new THREE.Vector3(0,h*0.25,0)}));return g;}
    if(key==='cliff'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(6,h,3),0x696969),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key.startsWith('mountain')||key==='hill'){g.add(Object.assign(this.mk(new THREE.ConeGeometry(h*0.5,h,5),0x6b7b6b),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key.includes('fence')){g.add(Object.assign(this.mk(new THREE.BoxGeometry(4,h,0.15),key.includes('stone')?0x808080:0x8B4513),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key==='gate'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(0.3,h,0.3),0x8B4513),{position:new THREE.Vector3(-1.5,h*0.5,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(0.3,h,0.3),0x8B4513),{position:new THREE.Vector3(1.5,h*0.5,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(3.3,0.3,0.3),0x8B4513),{position:new THREE.Vector3(0,h,0)}));return g;}
    if(key==='well'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(1,1,h,8),0x808080),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key==='windmill'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(1.5,2.5,h*0.7,6),0xf5f5dc),{position:new THREE.Vector3(0,h*0.35,0)}));g.add(Object.assign(this.mk(new THREE.ConeGeometry(2,h*0.2,6),0x8B4513),{position:new THREE.Vector3(0,h*0.8,0)}));return g;}
    if(key==='water-tower'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(2,2,h*0.4,8),0x4682B4),{position:new THREE.Vector3(0,h*0.8,0)}));for(let i=0;i<4;i++){const l=this.mk(new THREE.CylinderGeometry(0.15,0.15,h*0.6,4),0x696969);l.position.set(Math.cos(i*Math.PI/2)*1.5,h*0.3,Math.sin(i*Math.PI/2)*1.5);g.add(l);}return g;}
    if(key==='market-stall'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(3,1.5,2),0x8B4513),{position:new THREE.Vector3(0,0.75,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(3.5,0.1,2.5),0xcc3333),{position:new THREE.Vector3(0,h,0)}));return g;}
    if(key==='signpost'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.08,0.08,h,6),0x8B4513),{position:new THREE.Vector3(0,h*0.5,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(1.5,0.4,0.1),0xf5deb3),{position:new THREE.Vector3(0.5,h*0.8,0)}));return g;}
    if(key==='lamp-post'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.06,0.08,h*0.85,6),0x333333),{position:new THREE.Vector3(0,h*0.42,0)}));g.add(Object.assign(this.mk(new THREE.SphereGeometry(0.3,8,6),0xffffaa),{position:new THREE.Vector3(0,h*0.9,0)}));return g;}
    if(key==='bench'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(2,0.15,0.6),0x8B4513),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key==='barrel'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.4,0.4,h,8),0x8B4513),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key==='crate'){g.add(Object.assign(this.mk(new THREE.BoxGeometry(h,h,h),0xdeb887),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key==='campfire'){g.add(Object.assign(this.mk(new THREE.ConeGeometry(0.5,h,6),0xff4500),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key==='tent'){g.add(Object.assign(this.mk(new THREE.ConeGeometry(h,h,4),0xf5deb3),{position:new THREE.Vector3(0,h*0.5,0)}));return g;}
    if(key==='flag'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.04,0.04,h,6),0x808080),{position:new THREE.Vector3(0,h*0.5,0)}));g.add(Object.assign(this.mk(new THREE.BoxGeometry(1,0.6,0.02),0xff0000),{position:new THREE.Vector3(0.5,h*0.8,0)}));return g;}
    if(key==='fountain'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(1.2,1.5,h*0.5,8),0xb0b0b0),{position:new THREE.Vector3(0,h*0.25,0)}));return g;}
    if(key==='pond'){g.add(Object.assign(this.mk(new THREE.CylinderGeometry(3,3,0.2,16),0x4488cc),{position:new THREE.Vector3(0,0.1,0)}));return g;}
    if(key.startsWith('river')){g.add(Object.assign(this.mk(new THREE.BoxGeometry(2,0.15,8),0x4488cc),{position:new THREE.Vector3(0,0.08,0)}));return g;}
    if(key.startsWith('worker')){const cols={'worker-farmer':0x228B22,'worker-baker':0xdaa520,'worker-factory':0x4682B4,'worker-processor':0xe67e22};g.add(Object.assign(this.mk(new THREE.CylinderGeometry(0.25,0.3,h*0.55,8),cols[key]||0x3498db),{position:new THREE.Vector3(0,h*0.3,0)}));g.add(Object.assign(this.mk(new THREE.SphereGeometry(h*0.14,8,6),0xFFDBAC),{position:new THREE.Vector3(0,h*0.72,0)}));return g;}
    // generic
    g.add(Object.assign(this.mk(new THREE.BoxGeometry(h*0.6,h,h*0.6),0xaaaaaa),{position:new THREE.Vector3(0,h*0.5,0)}));
    return g;
  }

  initScene() {
    const skyGeo=new THREE.SphereGeometry(2500,32,32);
    const skyMat=new THREE.ShaderMaterial({uniforms:{topColor:{value:new THREE.Color(0x3a7bd5)},bottomColor:{value:new THREE.Color(0xd4e8ff)},offset:{value:20},exponent:{value:0.5}},vertexShader:`varying vec3 vWP;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWP=wp.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform vec3 topColor,bottomColor;uniform float offset,exponent;varying vec3 vWP;void main(){float h=normalize(vWP+offset).y;gl_FragColor=vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0);}`,side:THREE.BackSide});
    this.scene.add(new THREE.Mesh(skyGeo,skyMat));
    const gGeo=new THREE.PlaneGeometry(2000,2000,80,80);const pa=gGeo.attributes.position;
    for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i);pa.setZ(i,Math.sin(x*0.008)*Math.cos(y*0.008)*2+Math.sin(x*0.02)*Math.cos(y*0.015)*0.8);}
    gGeo.computeVertexNormals();
    const ground=new THREE.Mesh(gGeo,new THREE.MeshLambertMaterial({color:0x5a8f3c}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;this.scene.add(ground);
    const flat=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshBasicMaterial({visible:false}));flat.rotation.x=-Math.PI/2;this.scene.add(flat);this.placementGround=flat;
  }

  setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff,0.45));
    const sun=new THREE.DirectionalLight(0xfff5e6,1.0);sun.position.set(100,180,80);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    const d=250;sun.shadow.camera.near=1;sun.shadow.camera.far=600;sun.shadow.camera.left=-d;sun.shadow.camera.right=d;sun.shadow.camera.top=d;sun.shadow.camera.bottom=-d;
    this.scene.add(sun);
    const fill=new THREE.DirectionalLight(0x8ec8ff,0.2);fill.position.set(-60,80,-60);this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight(0x87CEEB,0x5a8f3c,0.25));
  }

  setupMouseTracking(){this.canvas.addEventListener('mousemove',(e)=>{const r=this.canvas.getBoundingClientRect();this.mouse.x=((e.clientX-r.left)/r.width)*2-1;this.mouse.y=-((e.clientY-r.top)/r.height)*2+1;if(this.placementMode&&this.previewBuilding)this.updatePreviewPosition();});}
  updatePreviewPosition(){this.raycaster.setFromCamera(this.mouse,this.camera);const h=this.raycaster.intersectObject(this.placementGround);if(h.length>0){const p=h[0].point;this.previewBuilding.position.set(Math.round(p.x/5)*5,0,Math.round(p.z/5)*5);}}

  setupKeyboardPan(){
    window.addEventListener('keydown',(e)=>{if(e.key==='ArrowLeft'||e.key==='a')this.panKeys.left=true;if(e.key==='ArrowRight'||e.key==='d')this.panKeys.right=true;if(e.key==='ArrowUp'||e.key==='w')this.panKeys.up=true;if(e.key==='ArrowDown'||e.key==='s')this.panKeys.down=true;});
    window.addEventListener('keyup',(e)=>{if(e.key==='ArrowLeft'||e.key==='a')this.panKeys.left=false;if(e.key==='ArrowRight'||e.key==='d')this.panKeys.right=false;if(e.key==='ArrowUp'||e.key==='w')this.panKeys.up=false;if(e.key==='ArrowDown'||e.key==='s')this.panKeys.down=false;});
  }

  startPan(d){this.panKeys[d]=true;} stopPan(d){this.panKeys[d]=false;} stopAllPan(){this.panKeys.left=this.panKeys.right=this.panKeys.up=this.panKeys.down=false;}
  applyPan(dt){const sp=this.panSpeed*dt;const fw=new THREE.Vector3();this.camera.getWorldDirection(fw);fw.y=0;fw.normalize();const rt=new THREE.Vector3();rt.crossVectors(fw,new THREE.Vector3(0,1,0)).normalize();const mv=new THREE.Vector3();if(this.panKeys.up)mv.add(fw.clone().multiplyScalar(sp));if(this.panKeys.down)mv.add(fw.clone().multiplyScalar(-sp));if(this.panKeys.right)mv.add(rt.clone().multiplyScalar(sp));if(this.panKeys.left)mv.add(rt.clone().multiplyScalar(-sp));if(mv.lengthSq()>0){this.camera.position.add(mv);this.controls.target.add(mv);}}

  createBuilding(type,position,id){const m=this.getModel(type);m.position.set(position.x,0,position.z);m.userData={id,type};this.scene.add(m);this.buildings.push(m);return m;}
  createBuildingPreview(type){const m=this.getModel(type);m.traverse(c=>{if(c.isMesh){c.material=c.material.clone();c.material.transparent=true;c.material.opacity=0.4;}});const ring=new THREE.Mesh(new THREE.RingGeometry(7,8,32),new THREE.MeshBasicMaterial({color:0x2ecc71,transparent:true,opacity:0.35,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=0.05;m.add(ring);return m;}

  loadCustomWorld(objects){this.landscapeObjects.forEach(o=>this.scene.remove(o));this.landscapeObjects=[];if(!objects||!objects.length)return;objects.forEach(obj=>{const m=this.getModelScaled(obj.modelId,obj.scale||1.0);m.position.set(obj.x,obj.y||0,obj.z);m.rotation.set(obj.rotX||0,obj.rotY||0,obj.rotZ||0);this.scene.add(m);this.landscapeObjects.push(m);});}

  generateWorld(){
    const ring=(m,cx,cz,n,sx,sz,sr)=>{for(let i=0;i<n;i++){const o=this.getModelScaled(m,sr[0]+Math.random()*(sr[1]-sr[0]));o.position.set(cx+(Math.random()-0.5)*sx,0,cz+(Math.random()-0.5)*sz);o.rotation.y=Math.random()*Math.PI*2;this.scene.add(o);this.landscapeObjects.push(o);}};
    const sc=(m,cx,cz,n,sx,sz,sr,av)=>{for(let i=0;i<n;i++){const x=cx+(Math.random()-0.5)*sx,z=cz+(Math.random()-0.5)*sz;if(Math.abs(x)<av&&Math.abs(z)<av)continue;const o=this.getModelScaled(m,sr[0]+Math.random()*(sr[1]-sr[0]));o.position.set(x,0,z);o.rotation.y=Math.random()*Math.PI*2;this.scene.add(o);this.landscapeObjects.push(o);}};
    ring('mountain-high',0,-350,5,500,80,[0.8,1.4]);ring('mountain-low',0,-280,7,550,60,[0.6,1.2]);
    ring('mountain-low',-350,0,4,80,300,[0.5,1.0]);ring('mountain-low',350,0,4,80,300,[0.5,1.0]);
    ring('tree-oak',-100,-100,12,70,60,[0.7,1.3]);ring('tree-pine',-120,-80,8,50,40,[0.8,1.2]);
    ring('bush',-110,-90,10,80,60,[0.6,1.3]);ring('tree-pine',110,-100,10,60,50,[0.7,1.3]);
    ring('tree-oak',-100,80,8,50,40,[0.7,1.2]);ring('tree-pine',100,90,7,50,45,[0.8,1.2]);
    ring('tree-oak',0,160,8,80,40,[0.7,1.3]);
    sc('grass-tuft',0,0,40,300,300,[0.5,1.5],25);sc('rock-large',0,0,10,250,250,[0.6,1.3],20);sc('rock-small',0,0,18,280,280,[0.5,1.4],15);
  }

  update(dt){this.controls.update();this.applyPan(dt);}
  render(){this.renderer.render(this.scene,this.camera);}
  resize(w,h){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
  dispose(){this.controls?.dispose();const geos=new Set(),mats=new Set();this.scene?.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());this.renderer?.dispose();this.models.clear();this.scene=null;this.camera=null;this.renderer=null;}
}
