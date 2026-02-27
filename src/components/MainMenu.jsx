import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function MainMenu({ onPlay, onWorldBuilder }) {
  const canvasRef = useRef(null);

  // Animated 3D background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 2000);
    camera.position.set(0, 30, 80);
    camera.lookAt(0, 5, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.width, canvas.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // Sky
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.003);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(50, 100, 50);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x87CEEB, 0x5a8f3c, 0.3));

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshLambertMaterial({ color: 0x5a8f3c })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Decorative objects
    const objects = [];
    const addTree = (x, z, pine) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
      trunk.position.y = 1.25; g.add(trunk);
      if (pine) {
        for (let j = 0; j < 3; j++) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 - j * 0.3, 1.8, 6), new THREE.MeshLambertMaterial({ color: 0x1a5c1a }));
          c.position.y = 3 + j * 1.1; g.add(c);
        }
      } else {
        const top = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshLambertMaterial({ color: 0x228B22 }));
        top.position.y = 3.8; g.add(top);
      }
      const s = 0.8 + Math.random() * 0.5;
      g.scale.set(s, s, s);
      g.position.set(x, 0, z);
      g.rotation.y = Math.random() * Math.PI * 2;
      scene.add(g);
      objects.push(g);
    };

    // Ring of trees
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const r = 40 + Math.random() * 30;
      addTree(Math.cos(angle) * r, Math.sin(angle) * r, Math.random() > 0.5);
    }

    // Mountains
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const mtn = new THREE.Mesh(
        new THREE.ConeGeometry(12 + Math.random() * 10, 20 + Math.random() * 20, 5),
        new THREE.MeshLambertMaterial({ color: 0x6b7b6b })
      );
      mtn.position.set(Math.cos(a) * 120, 0, Math.sin(a) * 120);
      scene.add(mtn);
    }

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = Date.now() * 0.0003;
      camera.position.x = Math.sin(t) * 80;
      camera.position.z = Math.cos(t) * 80;
      camera.lookAt(0, 5, 0);
      renderer.render(scene, camera);
    };
    animate();

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
        background: 'linear-gradient(135deg, rgba(15,23,42,0.65) 0%, rgba(30,41,59,0.75) 50%, rgba(15,23,42,0.65) 100%)',
        backdropFilter: 'blur(2px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Main Content Container */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
          textAlign: 'center', maxWidth: 600,
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
            }} />

            {/* Main Title */}
            <h1 style={{
              fontSize: '3.5rem', fontWeight: 900, color: '#ffffff',
              margin: 0, letterSpacing: '-1.5px',
              textShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(74,222,128,0.2)',
              lineHeight: 1.1,
            }}>
              🏭 Supply Chain Idle
            </h1>

            {/* Tagline */}
            <p style={{
              fontSize: '1.1rem', color: '#cbd5e1', fontWeight: 500,
              margin: 0, letterSpacing: '0.5px',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              Build. Produce. Trade. Profit.
            </p>

            {/* Accent line below */}
            <div style={{
              width: 80, height: 3,
              background: 'linear-gradient(90deg, transparent, #60a5fa, transparent)',
              borderRadius: 2,
            }} />
          </div>

          {/* Buttons Section */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            width: '100%', maxWidth: 300,
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
                e.target.style.boxShadow = '0 6px 25px rgba(74, 222, 128, 0.2), inset 0 1px 0 rgba(255,255,255,0.15)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'linear-gradient(135deg, rgba(74, 222, 128, 0.15) 0%, rgba(74, 222, 128, 0.05) 100%)';
                e.target.style.boxShadow = '0 4px 15px rgba(74, 222, 128, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)';
                e.target.style.transform = 'translateY(0)';
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
                e.target.style.boxShadow = '0 6px 25px rgba(96, 165, 250, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'linear-gradient(135deg, rgba(96, 165, 250, 0.08) 0%, rgba(96, 165, 250, 0.02) 100%)';
                e.target.style.borderColor = 'rgba(96, 165, 250, 0.6)';
                e.target.style.boxShadow = '0 4px 15px rgba(96, 165, 250, 0.05), inset 0 1px 0 rgba(255,255,255,0.05)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              🗺️ World Builder
            </button>
          </div>

          {/* Info Text */}
          <div style={{
            fontSize: '0.9rem', color: '#64748b', fontWeight: 500,
            textShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}>
            Use Arrow Keys / WASD to explore the world
          </div>
        </div>
      </div>
    </div>
  );
}
