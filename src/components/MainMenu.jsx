import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default function MainMenu({ onPlay, onWorldBuilder }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const charactersRef = useRef([]);

  // Animated 3D background with characters
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 2000);
    camera.position.set(0, 20, 60);
    camera.lookAt(0, 8, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.width, canvas.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;

    // ═══ ENHANCED LIGHTING ═══
    // Sky gradient background
    const skyColor = new THREE.Color(0x87CEEB);
    const groundColor = new THREE.Color(0x5a8f3c);
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.004);

    // Ambient light (more vibrant)
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    // Main sun - warm and bright
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sun.position.set(80, 120, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    scene.add(sun);

    // Fill light - softer
    const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.5);
    fillLight.position.set(-80, 60, -80);
    scene.add(fillLight);

    // Hemisphere light for better overall lighting
    scene.add(new THREE.HemisphereLight(0x87CEEB, 0x5a8f3c, 0.6));

    // ═══ GROUND ═══
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: 0x5a8f3c, roughness: 0.7 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = 0;
    scene.add(ground);

    // Add some grass variation
    const grassGeometry = new THREE.BufferGeometry();
    const grassPositions = [];
    for (let i = 0; i < 500; i++) {
      grassPositions.push(
        (Math.random() - 0.5) * 600,
        0.05,
        (Math.random() - 0.5) * 600
      );
    }
    grassGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(grassPositions), 3));

    // ═══ DECORATIVE ELEMENTS ═══
    const objects = [];
    const addTree = (x, z, pine, scale = 1) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * scale, 0.35 * scale, 2.5 * scale, 8),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 })
      );
      trunk.position.y = 1.25 * scale;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      g.add(trunk);

      if (pine) {
        for (let j = 0; j < 3; j++) {
          const c = new THREE.Mesh(
            new THREE.ConeGeometry(1.6 * scale - j * 0.3 * scale, 1.8 * scale, 8),
            new THREE.MeshStandardMaterial({ color: 0x1a5c1a, roughness: 0.7 })
          );
          c.position.y = 3 * scale + j * 1.1 * scale;
          c.castShadow = true;
          c.receiveShadow = true;
          g.add(c);
        }
      } else {
        const top = new THREE.Mesh(
          new THREE.SphereGeometry(2 * scale, 12, 8),
          new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.6 })
        );
        top.position.y = 3.8 * scale;
        top.castShadow = true;
        top.receiveShadow = true;
        g.add(top);
      }

      const s = (0.8 + Math.random() * 0.5) * scale;
      g.scale.set(s, s, s);
      g.position.set(x, 0, z);
      g.rotation.y = Math.random() * Math.PI * 2;
      scene.add(g);
      objects.push(g);
    };

    // Ring of trees (increased variety)
    for (let i = 0; i < 35; i++) {
      const angle = (i / 35) * Math.PI * 2;
      const r = 45 + Math.random() * 40;
      const scale = 0.6 + Math.random() * 0.8;
      addTree(Math.cos(angle) * r, Math.sin(angle) * r, Math.random() > 0.4, scale);
    }

    // Mountains
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const mtn = new THREE.Mesh(
        new THREE.ConeGeometry(15 + Math.random() * 12, 25 + Math.random() * 25, 6),
        new THREE.MeshStandardMaterial({ color: 0x6b7b6b, roughness: 0.9 })
      );
      mtn.position.set(Math.cos(a) * 140, 0, Math.sin(a) * 140);
      mtn.castShadow = true;
      mtn.receiveShadow = true;
      scene.add(mtn);
    }

    // ═══ LOAD CHARACTER MODELS ═══
    const loader = new GLTFLoader();
    const characterModels = ['worker-farmer', 'worker-processor', 'npc-merchant', 'worker-base'];
    const characterPositions = [
      { x: -15, z: 5 },
      { x: 15, z: 5 },
      { x: -25, z: 15 },
      { x: 25, z: 15 }
    ];

    let loadedCount = 0;

    characterPositions.forEach((pos, idx) => {
      const modelName = characterModels[idx % characterModels.length];
      loader.load(
        `/models/characters/${modelName}.glb`,
        (gltf) => {
          const model = gltf.scene;
          model.position.set(pos.x, 0, pos.z);
          model.scale.set(1.5, 1.5, 1.5);

          // Enable shadows on all meshes
          model.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });

          // Store animation mixer for later
          const mixer = gltf.animations.length > 0 ? new THREE.AnimationMixer(model) : null;
          if (mixer && gltf.animations.length > 0) {
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
          }

          scene.add(model);
          charactersRef.current.push({
            model,
            mixer,
            positionIndex: idx,
            idleWaveDuration: 3 + Math.random() * 2,
            idleWaveTime: 0,
            bobAmount: 0.3 + Math.random() * 0.2,
            bobSpeed: 2 + Math.random() * 1
          });

          loadedCount++;
        },
        undefined,
        (error) => {
          console.log(`Could not load ${modelName}:`, error);
          loadedCount++;
        }
      );
    });

    // ═══ ANIMATION LOOP ═══
    let raf;
    let time = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      time += 0.016;

      // Rotate camera around center
      const t = time * 0.15;
      camera.position.x = Math.sin(t) * 60;
      camera.position.z = Math.cos(t) * 60;
      camera.position.y = 20 + Math.sin(time * 0.5) * 5;
      camera.lookAt(0, 8, 0);

      // Animate characters - make them idle bob and wave
      charactersRef.current.forEach((char, idx) => {
        const baseY = 0;
        // Bob up and down
        char.model.position.y = baseY + Math.sin(time * char.bobSpeed) * char.bobAmount;

        // Slight rotation - looking around
        char.model.rotation.y = Math.sin(time * 0.3 + idx) * 0.3;

        // Update mixer if it exists
        if (char.mixer) {
          char.mixer.update(0.016);
        }

        // Idle animation - subtle wave
        if (char.model.children.length > 0) {
          char.idleWaveTime += 0.016;
          if (char.idleWaveTime > char.idleWaveDuration) {
            char.idleWaveTime = 0;
          }
          const waveProgress = char.idleWaveTime / char.idleWaveDuration;
          // Subtle hand movement
          if (waveProgress < 0.3) {
            // Wave starts
            const arm = character.model.children[0];
            if (arm) {
              // This would need proper bone access from the model
            }
          }
        }
      });

      // Sway trees slightly
      objects.forEach((tree, idx) => {
        tree.rotation.z = Math.sin(time * 0.5 + idx) * 0.02;
      });

      renderer.render(scene, camera);
    };
    animate();

    // ═══ RESIZE HANDLER ═══
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      camera.aspect = canvas.width / canvas.height;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.width, canvas.height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: "'Segoe UI', 'Roboto', Arial, sans-serif" }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Premium Overlay with Gradient */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.4) 0%, rgba(30,41,59,0.55) 50%, rgba(15,23,42,0.4) 100%)',
        backdropFilter: 'blur(1px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Main Content Container */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
          textAlign: 'center', maxWidth: 600,
          animation: 'fadeInDown 0.8s ease-out',
        }}>
          {/* Header Section with Accent Line */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            {/* Accent line above */}
            <div style={{
              width: 80, height: 3,
              background: 'linear-gradient(90deg, transparent, #4ade80, transparent)',
              borderRadius: 2,
              animation: 'slideInLeft 0.8s ease-out 0.2s both',
            }} />

            {/* Main Title */}
            <h1 style={{
              fontSize: '3.5rem', fontWeight: 900, color: '#ffffff',
              margin: 0, letterSpacing: '-1.5px',
              textShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(74,222,128,0.3)',
              lineHeight: 1.1,
              animation: 'slideInUp 0.8s ease-out 0.3s both',
            }}>
              🏭 Supply Chain Idle
            </h1>

            {/* Tagline */}
            <p style={{
              fontSize: '1.1rem', color: '#cbd5e1', fontWeight: 500,
              margin: 0, letterSpacing: '0.5px',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              animation: 'fadeIn 0.8s ease-out 0.4s both',
            }}>
              Build. Produce. Trade. Profit.
            </p>

            {/* Accent line below */}
            <div style={{
              width: 80, height: 3,
              background: 'linear-gradient(90deg, transparent, #60a5fa, transparent)',
              borderRadius: 2,
              animation: 'slideInRight 0.8s ease-out 0.5s both',
            }} />
          </div>

          {/* Buttons Section */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            width: '100%', maxWidth: 300,
            animation: 'slideInUp 0.8s ease-out 0.6s both',
          }}>
            {/* Primary Button - Play */}
            <button
              onClick={onPlay}
              style={{
                padding: '16px 32px',
                fontSize: '1.05rem',
                fontWeight: 700,
                border: '2px solid #4ade80',
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.15) 0%, rgba(74, 222, 128, 0.05) 100%)',
                color: '#4ade80',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 15px rgba(74, 222, 128, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                whiteSpace: 'nowrap',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.target.style.background = 'linear-gradient(135deg, rgba(74, 222, 128, 0.25) 0%, rgba(74, 222, 128, 0.1) 100%)';
                e.target.style.boxShadow = '0 6px 25px rgba(74, 222, 128, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)';
                e.target.style.transform = 'translateY(-2px) scale(1.02)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'linear-gradient(135deg, rgba(74, 222, 128, 0.15) 0%, rgba(74, 222, 128, 0.05) 100%)';
                e.target.style.boxShadow = '0 4px 15px rgba(74, 222, 128, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)';
                e.target.style.transform = 'translateY(0) scale(1)';
              }}
            >
              ▶ Play Game
            </button>

            {/* Secondary Button - World Builder */}
            <button
              onClick={onWorldBuilder}
              style={{
                padding: '16px 32px',
                fontSize: '1.05rem',
                fontWeight: 700,
                border: '2px solid rgba(96, 165, 250, 0.6)',
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.08) 0%, rgba(96, 165, 250, 0.02) 100%)',
                color: '#93c5fd',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 15px rgba(96, 165, 250, 0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                e.target.style.background = 'linear-gradient(135deg, rgba(96, 165, 250, 0.15) 0%, rgba(96, 165, 250, 0.05) 100%)';
                e.target.style.borderColor = 'rgba(96, 165, 250, 0.9)';
                e.target.style.boxShadow = '0 6px 25px rgba(96, 165, 250, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)';
                e.target.style.transform = 'translateY(-2px) scale(1.02)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'linear-gradient(135deg, rgba(96, 165, 250, 0.08) 0%, rgba(96, 165, 250, 0.02) 100%)';
                e.target.style.borderColor = 'rgba(96, 165, 250, 0.6)';
                e.target.style.boxShadow = '0 4px 15px rgba(96, 165, 250, 0.05), inset 0 1px 0 rgba(255,255,255,0.05)';
                e.target.style.transform = 'translateY(0) scale(1)';
              }}
            >
              🗺️ World Builder
            </button>
          </div>

          {/* Info Text */}
          <div style={{
            fontSize: '0.9rem', color: '#64748b', fontWeight: 500,
            textShadow: '0 1px 3px rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.8s ease-out 0.7s both',
          }}>
            Use Arrow Keys / WASD to explore the world
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
