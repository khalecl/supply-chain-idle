import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { useWorldStore } from '../store/worldStore';
import { GameRenderer } from '../lib/three-renderer';
import { CROPS, PROCESSORS, RESOURCES, ALL_RESOURCE_IDS } from '../data/crops';
import CropSelector from './CropSelector';

export default function Game3D({ onBack }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  const [gs, setGs] = useState(useGameStore.getState());
  useEffect(() => useGameStore.subscribe(s => setGs(s)), []);

  const [selectedBuilding, setSelectedBuilding] = useState(null); // 'FARM' or processorType
  const [showPrestige, setShowPrestige] = useState(false);
  const [toast, setToast] = useState(null);
  const [prevPrices, setPrevPrices] = useState({ ...gs.marketPrices });

  // Mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobilePanel, setMobilePanel] = useState(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ─── Init renderer ───
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const worldObjects = useWorldStore.getState().objects;
    const hasCustomWorld = worldObjects && worldObjects.length > 0;
    rendererRef.current = new GameRenderer(canvas, useGameStore, { skipWorldGen: hasCustomWorld });

    if (hasCustomWorld) {
      const wait = setInterval(() => {
        if (rendererRef.current?.modelsReady) { clearInterval(wait); rendererRef.current.loadCustomWorld(worldObjects); }
      }, 100);
    }

    let raf;
    const loop = () => { raf = requestAnimationFrame(loop); rendererRef.current?.update(0.016); rendererRef.current?.render(); };
    loop();

    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; rendererRef.current?.resize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); rendererRef.current?.dispose(); };
  }, []);

  // ─── Game tick ───
  useEffect(() => { const i = setInterval(() => useGameStore.getState().tick(0.016), 16); return () => clearInterval(i); }, []);

  // ─── Price tracking ───
  useEffect(() => { setPrevPrices(p => ({ ...p })); }, [gs.marketPrices]);

  // ─── Toast ───
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  // ─── Sync buildings → 3D ───
  const renderedIds = useRef(new Set());
  useEffect(() => {
    if (!rendererRef.current) return;
    // Farms
    gs.farms.forEach(f => {
      const key = `FARM-${f.id}`;
      if (!renderedIds.current.has(key)) {
        rendererRef.current.createBuilding('FARM', f.position, f.id);
        renderedIds.current.add(key);
      }
    });
    // Processors — map processorType to renderer building type
    gs.processors.forEach(p => {
      const key = `PROC-${p.id}`;
      if (!renderedIds.current.has(key)) {
        // Use processorType as model key (warehouse, mill, bakery, etc.)
        const modelType = p.processorType.toUpperCase();
        rendererRef.current.createBuilding(modelType, p.position, p.id);
        renderedIds.current.add(key);
      }
    });
  }, [gs.farms, gs.processors]);

  // ─── Placement ───
  const startPlacement = (type) => {
    if (selectedBuilding === type) return cancelPlacement();
    setSelectedBuilding(type);
    if (isMobile) setMobilePanel(null);
    if (rendererRef.current) {
      if (rendererRef.current.previewBuilding) rendererRef.current.scene.remove(rendererRef.current.previewBuilding);
      // For renderer preview, use the right model name
      const modelKey = type === 'FARM' ? 'FARM' : type.toUpperCase();
      rendererRef.current.placementMode = modelKey;
      rendererRef.current.previewBuilding = rendererRef.current.createBuildingPreview(modelKey);
      rendererRef.current.scene.add(rendererRef.current.previewBuilding);
    }
  };

  const cancelPlacement = () => {
    setSelectedBuilding(null);
    if (rendererRef.current) {
      rendererRef.current.placementMode = null;
      if (rendererRef.current.previewBuilding) {
        rendererRef.current.scene.remove(rendererRef.current.previewBuilding);
        rendererRef.current.previewBuilding = null;
      }
    }
  };

  // ─── Click/tap to place ───
  useEffect(() => {
    if (!selectedBuilding || !rendererRef.current) return;
    const handlePlace = (e) => {
      if (!selectedBuilding || !rendererRef.current?.previewBuilding) return;
      if (e.target.closest('[data-ui]') || e.target.tagName === 'BUTTON') return;

      if (e.changedTouches) {
        const touch = e.changedTouches[0];
        const rect = canvasRef.current.getBoundingClientRect();
        const mouse = new THREE.Vector2(((touch.clientX - rect.left) / rect.width) * 2 - 1, -((touch.clientY - rect.top) / rect.height) * 2 + 1);
        const rc = new THREE.Raycaster(); rc.setFromCamera(mouse, rendererRef.current.camera);
        const hits = rc.intersectObject(rendererRef.current.placementGround);
        if (hits.length > 0) { const p = hits[0].point; rendererRef.current.previewBuilding.position.set(Math.round(p.x / 5) * 5, 0, Math.round(p.z / 5) * 5); }
      }

      const pos = rendererRef.current.previewBuilding.position;
      const position = { x: pos.x, y: 0, z: pos.z };
      const state = useGameStore.getState();

      if (selectedBuilding === 'FARM') {
        if (state.money < 50) { setToast('Need $50!'); return; }
        const id = state.buyFarm(position);
        if (id !== null) { setToast('Farm placed! Select a crop.'); cancelPlacement(); }
      } else {
        // Processor
        const def = PROCESSORS[selectedBuilding];
        if (!def) return;
        if (state.money < def.cost) { setToast(`Need $${def.cost}!`); return; }
        const id = state.buyProcessor(selectedBuilding, position);
        if (id !== null) { setToast(`${def.name} placed! (-$${def.cost})`); cancelPlacement(); }
      }
    };

    document.addEventListener('mouseup', handlePlace);
    document.addEventListener('touchend', handlePlace);
    return () => { document.removeEventListener('mouseup', handlePlace); document.removeEventListener('touchend', handlePlace); };
  }, [selectedBuilding]);

  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') cancelPlacement(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

  // ─── Helpers ───
  const arrow = (cur, prev) => Math.abs(cur - prev) < 0.01 ? '' : cur > prev ? ' ▲' : ' ▼';
  const pCol = (cur, prev) => Math.abs(cur - prev) < 0.01 ? '#94a3b8' : cur > prev ? '#4ade80' : '#f87171';
  const pm = 1 + gs.prestigeLevel * 0.05;
  const totalBuildings = gs.farms.length + gs.processors.length;

  // ─── STYLES ───
  const P = {
    background: 'rgba(15, 23, 42, 0.94)', border: '1px solid rgba(100, 150, 200, 0.35)',
    borderRadius: 10, color: '#e2e8f0', fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize: 13, backdropFilter: 'blur(10px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  };
  const btnG = (on) => ({
    width: '100%', padding: '5px 8px', fontSize: 11, fontWeight: 600, marginTop: 4,
    background: on ? 'rgba(74, 222, 128, 0.2)' : 'rgba(100,100,100,0.1)',
    border: on ? '1px solid rgba(74, 222, 128, 0.5)' : '1px solid rgba(100,100,100,0.2)',
    borderRadius: 5, color: on ? '#4ade80' : '#64748b', cursor: on ? 'pointer' : 'not-allowed',
    transition: 'all 0.15s',
  });

  // Group resources by category for display
  const resourceGroups = [
    { label: '🌱 Raw Crops', ids: ALL_RESOURCE_IDS.filter(id => RESOURCES[id].category === 'raw') },
    { label: '⚙️ Processed', ids: ALL_RESOURCE_IDS.filter(id => RESOURCES[id].category === 'processed') },
    { label: '🏷️ Finished', ids: ALL_RESOURCE_IDS.filter(id => RESOURCES[id].category === 'finished') },
  ];

  // Build buttons: Farm + all processor types
  const buildOptions = [
    { type: 'FARM', icon: '🌱', cost: 50, label: 'Farm' },
    ...Object.values(PROCESSORS).map(p => ({ type: p.id, icon: p.icon, cost: p.cost, label: p.name })),
  ];

  // ════════════════════════════════
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#0f172a' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', top: isMobile ? 8 : 16, left: '50%', transform: 'translateX(-50%)',
          ...P, padding: '6px 14px', border: '1px solid rgba(251,191,36,0.4)',
          color: '#fbbf24', zIndex: 200, fontWeight: 600, fontSize: 12,
        }} data-ui>{toast}</div>
      )}

      {/* CROP SELECTOR */}
      {gs.pendingFarmId !== null && (
        <CropSelector
          farmId={gs.pendingFarmId}
          onSelect={(fid, crop) => useGameStore.getState().selectCrop(fid, crop)}
          onCancel={() => useGameStore.getState().cancelFarmPlacement()}
        />
      )}

      {/* ═══ MOBILE ═══ */}
      {isMobile ? (
        <>
          {/* Top bar */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
            ...P, borderRadius: 0, padding: '6px 10px',
            display: 'flex', alignItems: 'center', gap: 6,
            borderTop: 'none',
          }} data-ui>
            {onBack && <button onClick={onBack} style={{ padding: '3px 6px', background: 'rgba(100,150,200,0.15)', border: '1px solid rgba(100,150,200,0.3)', borderRadius: 4, color: '#94a3b8', fontSize: 10, cursor: 'pointer' }}>←</button>}
            <span style={{ fontWeight: 700, color: '#4ade80', fontSize: 15 }}>${gs.money.toFixed(0)}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowPrestige(true)} style={{ padding: '2px 6px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 4, color: '#fbbf24', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>⭐{gs.prestigeLevel}</button>
          </div>

          {/* Tab buttons */}
          <div style={{ position: 'fixed', top: 36, left: 6, zIndex: 55, display: 'flex', flexDirection: 'column', gap: 4 }} data-ui>
            <TabBtn active={mobilePanel === 'inventory'} onClick={() => setMobilePanel(mobilePanel === 'inventory' ? null : 'inventory')} label="💰" />
            <TabBtn active={mobilePanel === 'buildings'} onClick={() => setMobilePanel(mobilePanel === 'buildings' ? null : 'buildings')} label={`🏗️`} />
          </div>

          {/* Slide-out: Inventory */}
          {mobilePanel === 'inventory' && (
            <div style={{ position: 'fixed', top: 36, left: 0, bottom: 60, width: '75vw', maxWidth: 300, zIndex: 52, ...P, borderRadius: '0 10px 10px 0', padding: '10px 12px', overflowY: 'auto' }} data-ui>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>💰 Market</div>
              {resourceGroups.map(grp => {
                const hasAny = grp.ids.some(id => gs.resources[id] > 0 || gs.marketPrices[id]);
                if (!hasAny) return null;
                return (
                  <div key={grp.label}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginTop: 6, marginBottom: 3 }}>{grp.label}</div>
                    {grp.ids.map(id => {
                      const r = RESOURCES[id];
                      const amt = Math.floor(gs.resources[id] || 0);
                      const price = gs.marketPrices[id] || 0;
                      return (
                        <div key={id} style={{ marginBottom: 6, padding: '5px 6px', background: 'rgba(100,150,200,0.06)', borderRadius: 5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span>{r.icon} {r.name}: <b style={{ color: r.color }}>{amt}</b></span>
                            <span style={{ color: pCol(price, prevPrices[id] || price), fontSize: 10 }}>${price.toFixed(2)}{arrow(price, prevPrices[id] || price)}</span>
                          </div>
                          {amt >= 1 && (
                            <button onClick={() => useGameStore.getState().sellResource(id, amt)} style={{ ...btnG(true), fontSize: 10, padding: '3px 5px' }}>
                              Sell {amt} @ ${price.toFixed(2)}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Slide-out: Buildings */}
          {mobilePanel === 'buildings' && (
            <div style={{ position: 'fixed', top: 36, left: 0, bottom: 60, width: '75vw', maxWidth: 300, zIndex: 52, ...P, borderRadius: '0 10px 10px 0', padding: '10px 12px', overflowY: 'auto' }} data-ui>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🏗️ Buildings ({totalBuildings})</div>
              <BuildingsList gs={gs} pm={pm} btnG={btnG} compact />
            </div>
          )}

          {/* Bottom build bar */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            ...P, borderRadius: 0, padding: '4px 4px', overflowX: 'auto',
            display: 'flex', gap: 3, borderBottom: 'none',
          }} data-ui>
            {buildOptions.map(b => {
              const can = gs.money >= b.cost;
              const sel = selectedBuilding === b.type;
              return (
                <button key={b.type} onClick={() => startPlacement(b.type)} disabled={!can}
                  style={{
                    padding: '4px 6px', minWidth: 44, flexShrink: 0,
                    background: sel ? 'rgba(74,222,128,0.25)' : can ? 'rgba(100,150,200,0.12)' : 'rgba(40,40,40,0.15)',
                    border: sel ? '2px solid #4ade80' : can ? '1px solid rgba(100,150,200,0.3)' : '1px solid rgba(60,60,60,0.15)',
                    borderRadius: 5, color: sel ? '#4ade80' : can ? '#cbd5e1' : '#475569',
                    fontWeight: 700, fontSize: 8, cursor: can ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}>{b.icon}${b.cost}</button>
              );
            })}
          </div>

          <NavDPad rendererRef={rendererRef} bottom={42} size={28} />
        </>
      ) : (
        /* ═══ DESKTOP ═══ */
        <>
          {/* Top-left: Money + Inventory */}
          <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, ...P, padding: '14px 16px', minWidth: 230, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }} data-ui>
            {onBack && <button onClick={onBack} style={{ padding: '4px 10px', marginBottom: 8, width: '100%', background: 'rgba(100,150,200,0.12)', border: '1px solid rgba(100,150,200,0.3)', borderRadius: 5, color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>← Main Menu</button>}
            <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', marginBottom: 10 }}>💰 ${gs.money.toFixed(0)}</div>

            {resourceGroups.map(grp => {
              const hasAny = grp.ids.some(id => (gs.resources[id] || 0) > 0);
              // Always show raw crops, only show others if player has any
              if (grp.label !== '🌱 Raw Crops' && !hasAny) return null;
              return (
                <div key={grp.label} style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>{grp.label}</div>
                  {grp.ids.map(id => {
                    const r = RESOURCES[id];
                    const amt = Math.floor(gs.resources[id] || 0);
                    const price = gs.marketPrices[id] || 0;
                    // Hide resources with 0 amount (except raw crops)
                    if (amt === 0 && grp.label !== '🌱 Raw Crops') return null;
                    return (
                      <div key={id} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{r.icon} {r.name}: <b style={{ color: r.color }}>{amt}</b></span>
                          <span style={{ fontSize: 11, color: pCol(price, prevPrices[id] || price) }}>
                            ${price.toFixed(2)}{arrow(price, prevPrices[id] || price)}
                          </span>
                        </div>
                        {amt >= 1 && (
                          <button onClick={() => useGameStore.getState().sellResource(id, amt)} style={btnG(true)}>
                            Sell All @ ${price.toFixed(2)}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {gs.prestigeLevel > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 4, fontSize: 11, color: '#fbbf24' }}>
                ⭐ Prestige Lv.{gs.prestigeLevel} — +{((pm - 1) * 100).toFixed(0)}% speed
              </div>
            )}
          </div>

          {/* Buildings panel */}
          <div style={{ position: 'fixed', top: 16, left: 264, zIndex: 50, ...P, padding: '14px 16px', width: 290, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }} data-ui>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
              🏗️ Buildings ({totalBuildings})
            </div>
            <BuildingsList gs={gs} pm={pm} btnG={btnG} />
          </div>

          {/* Bottom build bar */}
          <div style={{
            position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 5, zIndex: 50, ...P, padding: '8px 12px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90vw',
          }} data-ui>
            {buildOptions.map(b => {
              const can = gs.money >= b.cost;
              const sel = selectedBuilding === b.type;
              return (
                <button key={b.type} onClick={() => startPlacement(b.type)} disabled={!can}
                  style={{
                    padding: '5px 10px',
                    background: sel ? 'rgba(74,222,128,0.25)' : can ? 'rgba(100,150,200,0.15)' : 'rgba(60,60,60,0.15)',
                    border: sel ? '2px solid #4ade80' : can ? '1px solid rgba(100,150,200,0.4)' : '1px solid rgba(60,60,60,0.2)',
                    borderRadius: 7, color: sel ? '#4ade80' : can ? '#cbd5e1' : '#475569',
                    fontWeight: 700, fontSize: 11, cursor: can ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                  }}>{b.icon} {b.label} ${b.cost}</button>
              );
            })}
          </div>

          {/* Prestige button */}
          <button onClick={() => setShowPrestige(true)} style={{
            position: 'fixed', bottom: 100, right: 16, padding: '10px 18px',
            background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.5)',
            borderRadius: 8, color: '#fbbf24', fontWeight: 700, fontSize: 13, cursor: 'pointer', zIndex: 50,
          }} data-ui>⭐ Prestige (Lv.{gs.prestigeLevel})</button>

          <NavDPad rendererRef={rendererRef} bottom={16} size={36} />
        </>
      )}

      {/* ═══ Prestige Modal ═══ */}
      {showPrestige && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={() => setShowPrestige(false)}>
          <div style={{ ...P, maxWidth: isMobile ? '85vw' : 400, textAlign: 'center', border: '2px solid rgba(251,191,36,0.6)', padding: isMobile ? '20px' : '28px 32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: '#fbbf24', marginBottom: 12 }}>✨ Prestige Reset</div>
            <div style={{ lineHeight: 1.7, color: '#cbd5e1', marginBottom: 16, fontSize: isMobile ? 12 : 14 }}>
              <div>Level {gs.prestigeLevel} → <b style={{ color: '#fbbf24' }}>{gs.prestigeLevel + 1}</b></div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>✓ Reset resources & money to $100</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>✓ Keep all buildings</div>
              <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 700, marginTop: 8 }}>⚡ Speed: {((pm + 0.05) * 100).toFixed(0)}% (+5%)</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => { useGameStore.getState().prestige(); setShowPrestige(false); }} style={{ padding: '8px 20px', background: 'rgba(251,191,36,0.2)', border: '2px solid rgba(251,191,36,0.6)', borderRadius: 8, color: '#fbbf24', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Prestige Now</button>
              <button onClick={() => setShowPrestige(false)} style={{ padding: '8px 20px', background: 'rgba(100,150,200,0.15)', border: '1px solid rgba(100,150,200,0.4)', borderRadius: 8, color: '#60a5fa', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Placement indicator */}
      {selectedBuilding && (
        <div style={{
          position: 'fixed', top: isMobile ? 44 : '50%', left: '50%',
          transform: isMobile ? 'translateX(-50%)' : 'translate(-50%, -50%)',
          ...P, border: '2px solid rgba(74,222,128,0.7)',
          padding: isMobile ? '8px 14px' : '16px 24px', textAlign: 'center', zIndex: 100,
        }} data-ui>
          <div style={{ color: '#4ade80', fontWeight: 700, fontSize: isMobile ? 12 : 15 }}>
            🎯 {isMobile ? 'Tap' : 'Click'} ground to place {selectedBuilding === 'FARM' ? 'Farm' : PROCESSORS[selectedBuilding]?.name || selectedBuilding}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
            {isMobile ? <button onClick={cancelPlacement} style={{ padding: '2px 8px', background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 4, color: '#f87171', fontSize: 10, cursor: 'pointer' }}>✕ Cancel</button> : 'ESC to cancel'}
          </div>
        </div>
      )}

      {/* First-time hint */}
      {totalBuildings === 0 && !selectedBuilding && gs.pendingFarmId === null && (
        <div style={{
          position: 'fixed', bottom: isMobile ? 50 : 80, left: '50%', transform: 'translateX(-50%)',
          ...P, border: '1px solid rgba(251,191,36,0.4)',
          padding: isMobile ? '6px 12px' : '10px 20px', textAlign: 'center', zIndex: 40,
          color: '#fbbf24', fontSize: isMobile ? 11 : 13,
        }} data-ui>👆 Buy a Farm to start!</div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.85} }`}</style>
    </div>
  );
}

// ═══════════════════════════════
//  BuildingsList — renders all farms + processors
// ═══════════════════════════════
function BuildingsList({ gs, pm, btnG, compact }) {
  const sz = compact ? 10 : 11;

  return (
    <>
      {/* FARMS */}
      <Sect title={`🌱 Farms (${gs.farms.length})`}>
        {gs.farms.length === 0 ? <Em text="Buy a farm to start!" /> :
          gs.farms.map((farm, i) => {
            const crop = farm.cropType ? CROPS[farm.cropType] : null;
            return (
              <Card key={farm.id} label={crop ? `${crop.icon} ${crop.name} Farm #${i + 1}` : `Farm #${i + 1} (no crop)`} color={crop?.color || '#64748b'}>
                {!crop ? (
                  <div style={{ fontSize: sz, color: '#fbbf24', fontStyle: 'italic' }}>Waiting for crop selection...</div>
                ) : (
                  <>
                    <PBar current={farm.currentProduction} max={crop.growTime / pm} color={crop.color} />
                    <button onClick={() => useGameStore.getState().harvestFarm(farm.id)} disabled={!farm.isReady} style={btnG(farm.isReady)}>
                      {farm.isReady ? `${crop.icon} Harvest ($${crop.harvestCost})` : `${compact ? '' : 'Growing... '}${(farm.currentProduction / 1000).toFixed(1)}s`}
                    </button>
                  </>
                )}
              </Card>
            );
          })}
      </Sect>

      {/* PROCESSORS — grouped by chain */}
      {Object.entries(
        gs.processors.reduce((acc, p) => {
          const chain = PROCESSORS[p.processorType]?.chain || 'other';
          if (!acc[chain]) acc[chain] = [];
          acc[chain].push(p);
          return acc;
        }, {})
      ).map(([chain, procs]) => {
        // Group by type within chain
        const byType = {};
        procs.forEach(p => {
          if (!byType[p.processorType]) byType[p.processorType] = [];
          byType[p.processorType].push(p);
        });

        return Object.entries(byType).map(([type, list]) => {
          const def = PROCESSORS[type];
          if (!def) return null;
          const inputRes = RESOURCES[def.input];
          const outputRes = RESOURCES[def.output];

          return (
            <Sect key={type} title={`${def.icon} ${def.name}s (${list.length})`}>
              {list.map((proc, i) => (
                <Card key={proc.id} label={`${def.name} #${i + 1}`} color={outputRes?.color || '#60a5fa'}>
                  <div style={{ fontSize: sz, color: '#94a3b8' }}>
                    {inputRes?.icon} {inputRes?.name}: <b style={{ color: inputRes?.color }}>{proc.storageAmount}</b>
                    {def.inputAmount > 1 && `/${def.inputAmount}`}
                  </div>

                  {proc.storageAmount < def.inputAmount && (gs.resources[def.input] || 0) >= 1 ? (
                    <button onClick={() => useGameStore.getState().loadProcessor(proc.id, 1)} style={btnG(true)}>
                      📥 Load 1 {compact ? '' : inputRes?.name} (${def.opCost})
                    </button>
                  ) : proc.storageAmount >= def.inputAmount ? (
                    <>
                      <PBar current={proc.currentProduction} max={def.processTime / pm} color={outputRes?.color || '#60a5fa'} />
                      <button onClick={() => useGameStore.getState().harvestProcessor(proc.id)} disabled={!proc.isReady} style={btnG(proc.isReady)}>
                        {proc.isReady
                          ? `${outputRes?.icon} ${compact ? 'Produce' : `→ ${def.outputAmount} ${outputRes?.name}`} ($${def.opCost})`
                          : `${compact ? '' : 'Processing... '}${(proc.currentProduction / 1000).toFixed(1)}s`}
                      </button>
                    </>
                  ) : (
                    <Em text={`Need ${inputRes?.name?.toLowerCase()}`} />
                  )}
                </Card>
              ))}
            </Sect>
          );
        });
      })}

      {gs.processors.length === 0 && gs.farms.length > 0 && (
        <Em text="Buy processing buildings to convert raw crops into higher-value products!" />
      )}
    </>
  );
}

// ═══ Sub-components ═══

function TabBtn({ active, onClick, label }) {
  return (
    <button onClick={onClick} data-ui style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'rgba(74,222,128,0.25)' : 'rgba(15,23,42,0.9)',
      border: active ? '2px solid #4ade80' : '1px solid rgba(100,150,200,0.35)',
      borderRadius: 8, fontSize: 14, cursor: 'pointer', color: active ? '#4ade80' : '#cbd5e1',
    }}>{label}</button>
  );
}

function Sect({ title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 11, padding: '5px 8px', background: 'rgba(100,150,200,0.1)', borderRadius: 5, marginBottom: 5 }}>{title}</div>
      {children}
    </div>
  );
}

function Card({ label, color, children }) {
  return (
    <div style={{ background: 'rgba(100,150,200,0.08)', padding: '6px 8px', borderRadius: 6, marginBottom: 5, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

function PBar({ current, max, color }) {
  return (
    <div style={{ background: 'rgba(100,100,100,0.2)', height: 4, borderRadius: 3, margin: '3px 0' }}>
      <div style={{ height: '100%', width: `${Math.min(100, (current / max) * 100)}%`, background: color, borderRadius: 3, transition: 'width 0.1s' }} />
    </div>
  );
}

function Em({ text }) {
  return <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', padding: '2px 4px' }}>{text}</div>;
}

function NavDPad({ rendererRef, bottom = 16, size = 36 }) {
  const ab = (dir) => ({
    onMouseDown: () => rendererRef.current?.startPan(dir),
    onMouseUp: () => rendererRef.current?.stopPan(dir),
    onMouseLeave: () => rendererRef.current?.stopPan(dir),
    onTouchStart: (e) => { e.preventDefault(); rendererRef.current?.startPan(dir); },
    onTouchEnd: () => rendererRef.current?.stopPan(dir),
  });
  const s = {
    width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(100,150,200,0.2)', border: '1px solid rgba(100,150,200,0.4)',
    borderRadius: 6, color: '#cbd5e1', fontSize: size * 0.42, cursor: 'pointer', userSelect: 'none',
  };
  return (
    <div style={{
      position: 'fixed', bottom, right: 10, zIndex: 50,
      display: 'grid', gridTemplateAreas: `". u ." "l c r" ". d ."`,
      gridTemplateColumns: `${size}px ${size}px ${size}px`, gridTemplateRows: `${size}px ${size}px ${size}px`, gap: 2,
    }} data-ui>
      <button {...ab('up')} style={{ ...s, gridArea: 'u' }}>▲</button>
      <button {...ab('left')} style={{ ...s, gridArea: 'l' }}>◀</button>
      <div style={{ ...s, gridArea: 'c', background: 'rgba(100,150,200,0.08)', color: '#475569', fontSize: size * 0.28 }}>⊕</div>
      <button {...ab('right')} style={{ ...s, gridArea: 'r' }}>▶</button>
      <button {...ab('down')} style={{ ...s, gridArea: 'd' }}>▼</button>
    </div>
  );
}
