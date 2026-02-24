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

  const btn = (primary) => ({
    padding: '14px 36px',
    background: primary ? 'rgba(74, 222, 128, 0.2)' : 'rgba(100, 150, 200, 0.15)',
    border: primary ? '2px solid rgba(74, 222, 128, 0.6)' : '1px solid rgba(100, 150, 200, 0.4)',
    borderRadius: 10,
    color: primary ? '#4ade80' : '#cbd5e1',
    fontWeight: 700,
    fontSize: primary ? 18 : 15,
    cursor: 'pointer',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    transition: 'all 0.2s',
    minWidth: 220,
    textAlign: 'center',
  });

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(180deg, rgba(10,15,26,0.3) 0%, rgba(10,15,26,0.7) 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20,
      }}>
        {/* Title */}
        <div style={{
          fontSize: 48, fontWeight: 800, color: '#fff',
          fontFamily: "'Segoe UI', Arial, sans-serif",
          textShadow: '0 4px 20px rgba(0,0,0,0.5)',
          letterSpacing: '-1px',
          marginBottom: 4,
        }}>
          🏭 Supply Chain Idle
        </div>
        <div style={{
          fontSize: 16, color: '#94a3b8',
          fontFamily: "'Segoe UI', Arial, sans-serif",
          marginBottom: 24,
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          Build. Produce. Trade. Profit.
        </div>

        {/* Buttons */}
        <button onClick={onPlay} style={btn(true)}
          onMouseEnter={e => e.target.style.background = 'rgba(74, 222, 128, 0.35)'}
          onMouseLeave={e => e.target.style.background = 'rgba(74, 222, 128, 0.2)'}>
          ▶ Play Game
        </button>
        <button onClick={onWorldBuilder} style={btn(false)}
          onMouseEnter={e => e.target.style.background = 'rgba(100, 150, 200, 0.25)'}
          onMouseLeave={e => e.target.style.background = 'rgba(100, 150, 200, 0.15)'}>
          🗺️ World Builder
        </button>

        {/* Footer */}
        <div style={{
          position: 'absolute', bottom: 16, color: '#475569',
          fontSize: 12, fontFamily: "'Segoe UI', Arial, sans-serif",
        }}>
          Arrow keys / WASD to navigate • Mouse to orbit & zoom
        </div>
      </div>
    </div>
  );
}
