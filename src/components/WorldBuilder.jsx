import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameRenderer } from '../lib/three-renderer';
import { useWorldStore, OBJECT_CATALOG } from '../store/worldStore';

export default function WorldBuilder({ onBack, onPlay }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  const worldStore = useWorldStore();
  const [selectedTool, setSelectedTool] = useState(null);      // modelId to place
  const [selectedObject, setSelectedObject] = useState(null);   // uid of selected placed object
  const [category, setCategory] = useState('Trees');
  const [toast, setToast] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [objectScale, setObjectScale] = useState(1.0);

  // Track 3D meshes by uid
  const meshMap = useRef(new Map());

  // ─── Init renderer (builder mode — no game world gen) ───
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create renderer in builder mode (skipWorldGen = true)
    rendererRef.current = new GameRenderer(canvas, null, { skipWorldGen: true });

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (rendererRef.current) {
        rendererRef.current.update(0.016);
        rendererRef.current.render();
      }
    };
    loop();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      rendererRef.current?.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
      rendererRef.current?.dispose();
    };
  }, []);

  // ─── Sync store objects → 3D scene ───
  useEffect(() => {
    if (!rendererRef.current || !rendererRef.current.modelsReady) return;
    syncObjectsToScene();
  });

  const syncObjectsToScene = useCallback(() => {
    const r = rendererRef.current;
    if (!r) return;

    const currentUids = new Set(worldStore.objects.map(o => o.uid));

    // Remove meshes no longer in store
    for (const [uid, mesh] of meshMap.current) {
      if (!currentUids.has(uid)) {
        r.scene.remove(mesh);
        meshMap.current.delete(uid);
      }
    }

    // Add/update meshes
    worldStore.objects.forEach(obj => {
      if (!meshMap.current.has(obj.uid)) {
        const mesh = r.getModelScaled(obj.modelId, obj.scale);
        mesh.position.set(obj.x, 0, obj.z);
        mesh.rotation.y = obj.rotY;
        mesh.userData = { builderUid: obj.uid, modelId: obj.modelId };
        r.scene.add(mesh);
        meshMap.current.set(obj.uid, mesh);
      } else {
        // Update position/rotation/scale if changed
        const mesh = meshMap.current.get(obj.uid);
        mesh.position.set(obj.x, 0, obj.z);
        mesh.rotation.y = obj.rotY;
      }
    });
  }, [worldStore.objects]);

  // ─── Toast ───
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }
  }, [toast]);

  // ─── Click to place / select ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (e) => {
      if (e.target.closest('[data-ui]') || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      const r = rendererRef.current;
      if (!r) return;

      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, r.camera);

      if (selectedTool) {
        // Place mode: raycast against ground
        const hits = raycaster.intersectObject(r.placementGround);
        if (hits.length > 0) {
          const p = hits[0].point;
          const x = Math.round(p.x / 2) * 2;
          const z = Math.round(p.z / 2) * 2;
          worldStore.placeObject(selectedTool, x, z, 0, objectScale);
          setToast(`Placed ${selectedTool}`);
        }
      } else {
        // Select mode: raycast against placed objects
        const allMeshes = [];
        for (const [uid, mesh] of meshMap.current) {
          mesh.traverse(child => { if (child.isMesh) allMeshes.push(child); });
        }
        const hits = raycaster.intersectObjects(allMeshes, false);
        if (hits.length > 0) {
          // Walk up to find the root with builderUid
          let obj = hits[0].object;
          while (obj && !obj.userData?.builderUid) obj = obj.parent;
          if (obj?.userData?.builderUid) {
            setSelectedObject(obj.userData.builderUid);
          }
        } else {
          setSelectedObject(null);
        }
      }
    };

    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [selectedTool, objectScale, worldStore]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setSelectedTool(null); setSelectedObject(null); }
      if (e.key === 'Delete' && selectedObject) {
        worldStore.removeObject(selectedObject);
        const mesh = meshMap.current.get(selectedObject);
        if (mesh) rendererRef.current?.scene.remove(mesh);
        meshMap.current.delete(selectedObject);
        setSelectedObject(null);
        setToast('Deleted');
      }
      if (e.key === 'r' && selectedObject) {
        const obj = worldStore.objects.find(o => o.uid === selectedObject);
        if (obj) worldStore.updateObject(selectedObject, { rotY: obj.rotY + Math.PI / 4 });
        // Re-sync mesh rotation
        const mesh = meshMap.current.get(selectedObject);
        if (mesh && obj) mesh.rotation.y = obj.rotY + Math.PI / 4;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedObject, worldStore]);

  // ─── Preview ghost for placement mode ───
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;

    // Clean up previous preview
    if (r.previewBuilding) {
      r.scene.remove(r.previewBuilding);
      r.previewBuilding = null;
    }

    if (selectedTool && r.modelsReady) {
      const preview = r.getModelScaled(selectedTool, objectScale);
      preview.traverse(c => {
        if (c.isMesh) {
          c.material = c.material.clone();
          c.material.transparent = true;
          c.material.opacity = 0.4;
        }
      });
      r.previewBuilding = preview;
      r.placementMode = selectedTool;
      r.scene.add(preview);
    } else {
      r.placementMode = null;
    }

    return () => {
      if (r.previewBuilding) {
        r.scene.remove(r.previewBuilding);
        r.previewBuilding = null;
        r.placementMode = null;
      }
    };
  }, [selectedTool, objectScale]);

  // ─── Helpers ───
  const categories = [...new Set(OBJECT_CATALOG.map(o => o.category))];
  const filteredItems = OBJECT_CATALOG.filter(o => o.category === category);
  const selectedObjData = selectedObject ? worldStore.objects.find(o => o.uid === selectedObject) : null;

  const handleSave = () => {
    if (!saveName.trim()) return;
    worldStore.saveWorld(saveName.trim());
    setShowSaveModal(false);
    setToast(`Saved "${saveName.trim()}"`);
    setSaveName('');
  };

  const handlePlay = () => {
    if (onPlay) onPlay();
  };

  // ─── STYLES ───
  const panel = {
    background: 'rgba(15, 23, 42, 0.94)',
    border: '1px solid rgba(100, 150, 200, 0.4)',
    borderRadius: 10,
    padding: '12px 14px',
    color: '#e2e8f0',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize: 13,
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  };

  const toolBtn = (active) => ({
    padding: '6px 10px',
    background: active ? 'rgba(74, 222, 128, 0.25)' : 'rgba(100, 150, 200, 0.12)',
    border: active ? '2px solid #4ade80' : '1px solid rgba(100, 150, 200, 0.3)',
    borderRadius: 6,
    color: active ? '#4ade80' : '#cbd5e1',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    transition: 'all 0.12s',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#0a0f1a' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
          ...panel, padding: '8px 18px', border: '1px solid rgba(251, 191, 36, 0.4)',
          color: '#fbbf24', zIndex: 200, fontWeight: 600,
        }} data-ui>{toast}</div>
      )}

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        position: 'fixed', top: 14, left: 14, right: 14,
        display: 'flex', alignItems: 'center', gap: 10, zIndex: 50,
        ...panel, padding: '8px 14px',
      }} data-ui>
        <button onClick={onBack} style={toolBtn(false)}>← Menu</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24', flex: 1 }}>
          🗺️ World Builder
          {worldStore.activeWorld && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>({worldStore.activeWorld})</span>}
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{worldStore.objects.length} objects</span>
        <button onClick={() => setShowSaveModal(true)} style={toolBtn(false)}>💾 Save</button>
        <button onClick={() => setShowLoadModal(true)} style={toolBtn(false)}>📂 Load</button>
        <button onClick={() => { worldStore.generateDefault(); setToast('Default world generated'); }} style={toolBtn(false)}>🌍 Default</button>
        <button onClick={() => { if (confirm('Clear all objects?')) { worldStore.clearAll(); meshMap.current.forEach((m) => rendererRef.current?.scene.remove(m)); meshMap.current.clear(); } }} style={{ ...toolBtn(false), color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}>🗑️ Clear</button>
        <button onClick={handlePlay} style={{ ...toolBtn(false), color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.4)', fontWeight: 700 }}>▶ Play</button>
      </div>

      {/* ═══ LEFT: OBJECT PALETTE ═══ */}
      <div style={{
        position: 'fixed', top: 64, left: 14, bottom: 14, width: 220,
        ...panel, overflowY: 'auto', zIndex: 50,
      }} data-ui>
        {/* Categories */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              style={{ ...toolBtn(category === c), padding: '4px 8px', fontSize: 11 }}>{c}</button>
          ))}
        </div>

        {/* Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredItems.map(item => (
            <button key={item.id}
              onClick={() => { setSelectedTool(selectedTool === item.id ? null : item.id); setSelectedObject(null); }}
              style={{
                ...toolBtn(selectedTool === item.id),
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
              }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Scale slider */}
        {selectedTool && (
          <div style={{ marginTop: 12, padding: '8px', background: 'rgba(100,150,200,0.1)', borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Scale: {objectScale.toFixed(1)}x</div>
            <input type="range" min="0.3" max="3.0" step="0.1" value={objectScale}
              onChange={e => setObjectScale(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#4ade80' }} />
          </div>
        )}

        {/* Placement hint */}
        {selectedTool && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#fbbf24', textAlign: 'center' }}>
            Click ground to place • ESC to cancel
          </div>
        )}
      </div>

      {/* ═══ RIGHT: SELECTED OBJECT PROPERTIES ═══ */}
      {selectedObjData && (
        <div style={{
          position: 'fixed', top: 64, right: 14, width: 220,
          ...panel, zIndex: 50,
        }} data-ui>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
            Selected: {OBJECT_CATALOG.find(c => c.id === selectedObjData.modelId)?.label || selectedObjData.modelId}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
            Position: ({selectedObjData.x}, {selectedObjData.z})
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
            Rotation: {(selectedObjData.rotY / Math.PI * 180).toFixed(0)}° • Scale: {selectedObjData.scale}x
          </div>

          {/* Scale */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Scale</div>
            <input type="range" min="0.3" max="3.0" step="0.1" value={selectedObjData.scale}
              onChange={e => {
                const newScale = parseFloat(e.target.value);
                worldStore.updateObject(selectedObject, { scale: newScale });
                // Recreate mesh with new scale
                const oldMesh = meshMap.current.get(selectedObject);
                if (oldMesh) rendererRef.current?.scene.remove(oldMesh);
                const newMesh = rendererRef.current?.getModelScaled(selectedObjData.modelId, newScale);
                if (newMesh) {
                  newMesh.position.set(selectedObjData.x, 0, selectedObjData.z);
                  newMesh.rotation.y = selectedObjData.rotY;
                  newMesh.userData = { builderUid: selectedObject, modelId: selectedObjData.modelId };
                  rendererRef.current?.scene.add(newMesh);
                  meshMap.current.set(selectedObject, newMesh);
                }
              }}
              style={{ width: '100%', accentColor: '#60a5fa' }} />
          </div>

          {/* Rotation */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Rotation</div>
            <input type="range" min="0" max={Math.PI * 2} step="0.1" value={selectedObjData.rotY}
              onChange={e => {
                const rot = parseFloat(e.target.value);
                worldStore.updateObject(selectedObject, { rotY: rot });
                const mesh = meshMap.current.get(selectedObject);
                if (mesh) mesh.rotation.y = rot;
              }}
              style={{ width: '100%', accentColor: '#60a5fa' }} />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => {
              worldStore.removeObject(selectedObject);
              const mesh = meshMap.current.get(selectedObject);
              if (mesh) rendererRef.current?.scene.remove(mesh);
              meshMap.current.delete(selectedObject);
              setSelectedObject(null);
            }} style={{ ...toolBtn(false), flex: 1, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>
              🗑️ Delete
            </button>
            <button onClick={() => setSelectedObject(null)} style={{ ...toolBtn(false), flex: 1 }}>
              ✓ Done
            </button>
          </div>

          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, textAlign: 'center' }}>
            R = rotate 45° • DEL = delete
          </div>
        </div>
      )}

      {/* ═══ SAVE MODAL ═══ */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
          onClick={() => setShowSaveModal(false)}>
          <div style={{ ...panel, padding: '24px 28px', minWidth: 320, border: '2px solid rgba(74,222,128,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, color: '#4ade80' }}>💾 Save World</div>
            <input value={saveName} onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="World name..."
              style={{
                width: '100%', padding: '8px 12px', background: 'rgba(100,150,200,0.15)',
                border: '1px solid rgba(100,150,200,0.4)', borderRadius: 6,
                color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12,
                boxSizing: 'border-box',
              }} autoFocus />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} style={{ ...toolBtn(false), flex: 1, color: '#4ade80' }}>Save</button>
              <button onClick={() => setShowSaveModal(false)} style={{ ...toolBtn(false), flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOAD MODAL ═══ */}
      {showLoadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
          onClick={() => setShowLoadModal(false)}>
          <div style={{ ...panel, padding: '24px 28px', minWidth: 320, maxHeight: '60vh', overflowY: 'auto', border: '2px solid rgba(96,165,250,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, color: '#60a5fa' }}>📂 Load World</div>
            {worldStore.getWorldNames().length === 0 ? (
              <div style={{ color: '#64748b', fontStyle: 'italic' }}>No saved worlds yet</div>
            ) : (
              worldStore.getWorldNames().map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', background: 'rgba(100,150,200,0.1)', borderRadius: 6 }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{name}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{worldStore.worlds[name]?.length || 0} obj</span>
                  <button onClick={() => {
                    // Clear current scene
                    meshMap.current.forEach(m => rendererRef.current?.scene.remove(m));
                    meshMap.current.clear();
                    worldStore.loadWorld(name);
                    setShowLoadModal(false);
                    setToast(`Loaded "${name}"`);
                  }} style={{ ...toolBtn(false), padding: '3px 8px', fontSize: 11 }}>Load</button>
                  <button onClick={() => { worldStore.deleteWorld(name); }}
                    style={{ ...toolBtn(false), padding: '3px 8px', fontSize: 11, color: '#f87171' }}>×</button>
                </div>
              ))
            )}
            <button onClick={() => setShowLoadModal(false)} style={{ ...toolBtn(false), width: '100%', marginTop: 8 }}>Close</button>
          </div>
        </div>
      )}

      {/* ═══ NAV D-PAD ═══ */}
      <NavDPad rendererRef={rendererRef} />
    </div>
  );
}

function NavDPad({ rendererRef }) {
  const arrowBtn = (dir) => ({
    onMouseDown: () => rendererRef.current?.startPan(dir),
    onMouseUp: () => rendererRef.current?.stopPan(dir),
    onMouseLeave: () => rendererRef.current?.stopPan(dir),
    onTouchStart: (e) => { e.preventDefault(); rendererRef.current?.startPan(dir); },
    onTouchEnd: () => rendererRef.current?.stopPan(dir),
  });
  const s = {
    width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(100,150,200,0.2)', border: '1px solid rgba(100,150,200,0.4)',
    borderRadius: 6, color: '#cbd5e1', fontSize: 15, cursor: 'pointer', userSelect: 'none',
  };
  return (
    <div style={{
      position: 'fixed', bottom: 14, right: 14, zIndex: 50,
      display: 'grid',
      gridTemplateAreas: `". up ." "left c right" ". down ."`,
      gridTemplateColumns: '34px 34px 34px', gridTemplateRows: '34px 34px 34px', gap: 2,
    }} data-ui>
      <button {...arrowBtn('up')} style={{ ...s, gridArea: 'up' }}>▲</button>
      <button {...arrowBtn('left')} style={{ ...s, gridArea: 'left' }}>◀</button>
      <div style={{ ...s, gridArea: 'c', background: 'rgba(100,150,200,0.08)', color: '#475569', fontSize: 10 }}>⊕</div>
      <button {...arrowBtn('right')} style={{ ...s, gridArea: 'right' }}>▶</button>
      <button {...arrowBtn('down')} style={{ ...s, gridArea: 'down' }}>▼</button>
    </div>
  );
}
