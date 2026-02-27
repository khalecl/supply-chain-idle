import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { useWorldStore } from '../store/worldStore';
import { GameRenderer } from '../lib/three-renderer';
import { ResourceMap } from '../lib/resource-map';
import { CROPS, PROCESSORS, RESOURCES, ALL_RESOURCE_IDS } from '../data/crops';
import { MINERALS } from '../data/minerals';
import CropSelector from './CropSelector';

export default function Game3D({ onBack }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const resourceMapRef = useRef(null);

  const [gs, setGs] = useState(useGameStore.getState());
  useEffect(() => useGameStore.subscribe(s => setGs(s)), []);

  // Initialize resource map from world seed
  useEffect(() => {
    const seed = useWorldStore.getState().resourceSeed;
    resourceMapRef.current = new ResourceMap(seed);
  }, []);

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
    gs.farms.forEach(f => {
      const key = `FARM-${f.id}`;
      if (!renderedIds.current.has(key)) {
        rendererRef.current.createBuilding('FARM', f.position, f.id);
        renderedIds.current.add(key);
      }
    });
    gs.processors.forEach(p => {
      const key = `PROC-${p.id}`;
      if (!renderedIds.current.has(key)) {
        rendererRef.current.createBuilding(p.processorType.toUpperCase(), p.position, p.id);
        renderedIds.current.add(key);
      }
    });
    gs.mines.forEach(m => {
      const key = `MINE-${m.id}`;
      if (!renderedIds.current.has(key)) {
        rendererRef.current.createBuilding('MINE', m.position, m.id);
        renderedIds.current.add(key);
      }
    });
    gs.surveyRigs.forEach(r => {
      const key = `SRIG-${r.id}`;
      if (!renderedIds.current.has(key)) {
        rendererRef.current.createBuilding('SURVEYRIG', r.position, r.id);
        renderedIds.current.add(key);
      }
    });
  }, [gs.farms, gs.processors, gs.mines, gs.surveyRigs]);

  // ─── Survey rig completion callback ───
  useEffect(() => {
    if (!resourceMapRef.current) return;
    gs.surveyRigs.forEach(rig => {
      if (!rig.isDone && rig.currentProduction >= 5000) {
        const results = resourceMapRef.current.surveyArea(rig.position.x, rig.position.z, 20, 5);
        useGameStore.getState().completeSurvey(rig.id, results);
        // Store each result in worldStore
        results.forEach(r => useWorldStore.getState().addSurveyResult(r.x, r.z, r.resource));
        if (results.length > 0) {
          const names = [...new Set(results.map(r => r.resource.name))].join(', ');
          setToast(`🔍 Survey found: ${names}!`);
        } else {
          setToast('🔍 Survey complete — nothing found nearby.');
        }
      }
    });
  }, [gs.surveyRigs]);

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
      } else if (selectedBuilding === 'SURVEY_RIG') {
        if (state.money < 30) { setToast('Need $30!'); return; }
        const id = state.buySurveyRig(position);
        if (id !== null) { setToast('🔍 Survey rig deployed! Scanning...'); cancelPlacement(); }
      } else if (selectedBuilding === 'MINE') {
        if (state.money < 150) { setToast('Need $150!'); return; }
        // Auto-survey the spot
        const resource = resourceMapRef.current?.getResourceAt(position.x, position.z) || null;
        const id = state.buyMine(position, resource);
        if (id !== null) {
          if (resource) {
            setToast(`⛏️ ${resource.name} discovered! Mine operational.`);
          } else {
            setToast('❌ Nothing found here. Mine is empty.');
          }
          // Store survey result in worldStore
          useWorldStore.getState().addSurveyResult(position.x, position.z, resource);
          cancelPlacement();
        }
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
  const totalBuildings = gs.farms.length + gs.processors.length + gs.mines.length + gs.surveyRigs.length;

  // ─── PREMIUM STYLES ───
  const P = {
    background: 'rgba(20, 28, 48, 0.95)',
    border: '1px solid rgba(71, 137, 217, 0.25)',
    borderRadius: 12,
    color: '#e2e8f0',
    fontFamily: "'Segoe UI', 'Roboto', Arial, sans-serif",
    fontSize: 13,
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  const btnG = (on) => ({
    width: '100%',
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 600,
    marginTop: 6,
    background: on ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.12) 0%, rgba(74, 222, 128, 0.06) 100%)' : 'rgba(71, 137, 217, 0.08)',
    border: on ? '1px solid rgba(74, 222, 128, 0.35)' : '1px solid rgba(71, 137, 217, 0.15)',
    borderRadius: 7,
    color: on ? '#4ade80' : '#94a3b8',
    cursor: on ? 'pointer' : 'not-allowed',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  });

  // Group resources by category
  const resourceGroups = [
    { label: '🌱 Raw Crops', ids: ALL_RESOURCE_IDS.filter(id => RESOURCES[id].category === 'raw') },
    { label: '⛏️ Minerals', ids: ALL_RESOURCE_IDS.filter(id => RESOURCES[id].category === 'mineral') },
    { label: '⛽ Energy', ids: ALL_RESOURCE_IDS.filter(id => RESOURCES[id].category === 'energy') },
    { label: '⚙️ Processed', ids: ALL_RESOURCE_IDS.filter(id => RESOURCES[id].category === 'processed') },
    { label: '🏷️ Finished', ids: ALL_RESOURCE_IDS.filter(id => RESOURCES[id].category === 'finished') },
  ];

  // Build buttons
  const buildOptions = [
    { type: 'FARM', icon: '🌱', cost: 50, label: 'Farm' },
    { type: 'SURVEY_RIG', icon: '🔍', cost: 30, label: 'Survey' },
    { type: 'MINE', icon: '⛏️', cost: 150, label: 'Mine' },
    ...Object.values(PROCESSORS).map(p => ({ type: p.id, icon: p.icon, cost: p.cost, label: p.name })),
  ];

  // ════════════════════════════════
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#0f172a', fontFamily: "'Segoe UI', 'Roboto', Arial, sans-serif" }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', top: isMobile ? 8 : 16, left: '50%', transform: 'translateX(-50%)',
          ...P, padding: '8px 16px', border: '1px solid rgba(251,191,36,0.4)',
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
            ...P, borderRadius: 0, padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          }} data-ui>
            {onBack && <button onClick={onBack} style={{ padding: '4px 8px', background: 'rgba(71,137,217,0.15)', border: '1px solid rgba(71,137,217,0.3)', borderRadius: 5, color: '#93c5fd', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>← Back</button>}
            <span style={{ fontWeight: 700, color: '#4ade80', fontSize: 16 }}>💰 ${gs.money.toFixed(0)}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowPrestige(true)} style={{ padding: '3px 8px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 5, color: '#fbbf24', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⭐{gs.prestigeLevel}</button>
          </div>

          {/* Tab buttons */}
          <div style={{ position: 'fixed', top: 40, left: 8, zIndex: 55, display: 'flex', flexDirection: 'column', gap: 4 }} data-ui>
            <TabBtn active={mobilePanel === 'inventory'} onClick={() => setMobilePanel(mobilePanel === 'inventory' ? null : 'inventory')} label="💰" />
            <TabBtn active={mobilePanel === 'buildings'} onClick={() => setMobilePanel(mobilePanel === 'buildings' ? null : 'buildings')} label={`🏗️`} />
          </div>

          {/* Slide-out: Inventory */}
          {mobilePanel === 'inventory' && (
            <div style={{ position: 'fixed', top: 40, left: 0, bottom: 60, width: '75vw', maxWidth: 320, zIndex: 52, ...P, borderRadius: '0 12px 12px 0', padding: '12px 14px', overflowY: 'auto', borderLeft: 'none' }} data-ui>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: '#4ade80' }}>💰 Market</div>
              {resourceGroups.map(grp => {
                const hasAny = grp.ids.some(id => gs.resources[id] > 0 || gs.marketPrices[id]);
                if (!hasAny) return null;
                return (
                  <div key={grp.label}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7dd3fc', marginTop: 8, marginBottom: 4, letterSpacing: '0.5px' }}>{grp.label}</div>
                    {grp.ids.map(id => {
                      const r = RESOURCES[id];
                      const amt = Math.floor(gs.resources[id] || 0);
                      const price = gs.marketPrices[id] || 0;
                      return (
                        <div key={id} style={{ marginBottom: 8, padding: '7px 8px', background: 'rgba(71,137,217,0.08)', borderRadius: 7, border: '1px solid rgba(71,137,217,0.1)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span>{r.icon} {r.name}: <b style={{ color: r.color }}>{amt}</b></span>
                            <span style={{ color: pCol(price, prevPrices[id] || price), fontSize: 11 }}>${price.toFixed(2)}{arrow(price, prevPrices[id] || price)}</span>
                          </div>
                          {amt >= 1 && (
                            <button onClick={() => useGameStore.getState().sellResource(id, amt)} style={{ ...btnG(true), fontSize: 11, padding: '4px 6px' }}>
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
            <div style={{ position: 'fixed', top: 40, left: 0, bottom: 60, width: '75vw', maxWidth: 320, zIndex: 52, ...P, borderRadius: '0 12px 12px 0', padding: '12px 14px', overflowY: 'auto', borderLeft: 'none' }} data-ui>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: '#7dd3fc' }}>🏗️ Buildings ({totalBuildings})</div>
              <BuildingsList gs={gs} pm={pm} btnG={btnG} compact />
            </div>
          )}

          {/* Bottom build bar */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            ...P, borderRadius: 0, padding: '6px 6px', overflowX: 'auto',
            display: 'flex', gap: 4, borderBottom: 'none', borderLeft: 'none', borderRight: 'none',
          }} data-ui>
            {buildOptions.map(b => {
              const can = gs.money >= b.cost;
              const sel = selectedBuilding === b.type;
              return (
                <button key={b.type} onClick={() => startPlacement(b.type)} disabled={!can}
                  style={{
                    padding: '6px 8px', minWidth: 48, flexShrink: 0,
                    background: sel ? 'linear-gradient(135deg, rgba(74,222,128,0.2), rgba(74,222,128,0.08))' : can ? 'rgba(71,137,217,0.12)' : 'rgba(40,40,40,0.1)',
                    border: sel ? '1.5px solid #4ade80' : can ? '1px solid rgba(71,137,217,0.25)' : '1px solid rgba(60,60,60,0.15)',
                    borderRadius: 7, color: sel ? '#4ade80' : can ? '#cbd5e1' : '#475569',
                    fontWeight: 700, fontSize: 10, cursor: can ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}>{b.icon}${b.cost}</button>
              );
            })}
          </div>

          <NavDPad rendererRef={rendererRef} bottom={48} size={30} />
        </>
      ) : (
        /* ═══ DESKTOP ═══ */
        <>
          {/* Top-left: Money + Inventory */}
          <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, ...P, padding: '16px 18px', minWidth: 260, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }} data-ui>
            {onBack && <button onClick={onBack} style={{ padding: '6px 12px', marginBottom: 10, width: '100%', background: 'rgba(71,137,217,0.12)', border: '1px solid rgba(71,137,217,0.25)', borderRadius: 7, color: '#93c5fd', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>← Main Menu</button>}
            <div style={{ fontSize: 24, fontWeight: 800, color: '#4ade80', marginBottom: 12, letterSpacing: '-0.5px' }}>💰 ${gs.money.toFixed(0)}</div>

            {resourceGroups.map(grp => {
              const hasAny = grp.ids.some(id => (gs.resources[id] || 0) > 0);
              if (grp.label !== '🌱 Raw Crops' && !hasAny) return null;
              return (
                <div key={grp.label} style={{ borderTop: '1px solid rgba(71,137,217,0.15)', paddingTop: 10, marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7dd3fc', marginBottom: 6, letterSpacing: '0.5px' }}>{grp.label}</div>
                  {grp.ids.map(id => {
                    const r = RESOURCES[id];
                    const amt = Math.floor(gs.resources[id] || 0);
                    const price = gs.marketPrices[id] || 0;
                    if (amt === 0 && grp.label !== '🌱 Raw Crops') return null;
                    return (
                      <div key={id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontSize: 13 }}>{r.icon} {r.name}: <b style={{ color: r.color }}>{amt}</b></span>
                          <span style={{ fontSize: 12, color: pCol(price, prevPrices[id] || price) }}>
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
              <div style={{ borderTop: '1px solid rgba(71,137,217,0.15)', paddingTop: 10, marginTop: 10, fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>
                ⭐ Prestige Lv.{gs.prestigeLevel} — +{((pm - 1) * 100).toFixed(0)}% speed
              </div>
            )}
          </div>

          {/* Buildings panel */}
          <div style={{ position: 'fixed', top: 16, left: 300, zIndex: 50, ...P, padding: '16px 18px', width: 320, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }} data-ui>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, borderBottom: '2px solid rgba(71,137,217,0.2)', paddingBottom: 10, color: '#7dd3fc', letterSpacing: '-0.5px' }}>
              🏗️ Buildings ({totalBuildings})
            </div>
            <BuildingsList gs={gs} pm={pm} btnG={btnG} />
          </div>

          {/* Bottom build bar */}
          <div style={{
            position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6, zIndex: 50, ...P, padding: '10px 14px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90vw',
          }} data-ui>
            {buildOptions.map(b => {
              const can = gs.money >= b.cost;
              const sel = selectedBuilding === b.type;
              return (
                <button key={b.type} onClick={() => startPlacement(b.type)} disabled={!can}
                  style={{
                    padding: '7px 12px',
                    background: sel ? 'linear-gradient(135deg, rgba(74,222,128,0.2), rgba(74,222,128,0.08))' : can ? 'rgba(71,137,217,0.12)' : 'rgba(40,40,40,0.1)',
                    border: sel ? '1.5px solid #4ade80' : can ? '1px solid rgba(71,137,217,0.25)' : '1px solid rgba(60,60,60,0.15)',
                    borderRadius: 8, color: sel ? '#4ade80' : can ? '#cbd5e1' : '#475569',
                    fontWeight: 700, fontSize: 12, cursor: can ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}>{b.icon} {b.label} ${b.cost}</button>
              );
            })}
          </div>

          {/* Prestige button */}
          <button onClick={() => setShowPrestige(true)} style={{
            position: 'fixed', bottom: 110, right: 16, padding: '12px 20px',
            background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.06))',
            border: '1.5px solid rgba(251,191,36,0.35)',
            borderRadius: 10, color: '#fbbf24', fontWeight: 700, fontSize: 14, cursor: 'pointer', zIndex: 50,
            transition: 'all 0.15s',
            boxShadow: '0 4px 15px rgba(251,191,36,0.05)',
          }} data-ui>⭐ Prestige (Lv.{gs.prestigeLevel})</button>

          <NavDPad rendererRef={rendererRef} bottom={16} size={40} />
        </>
      )}

      {/* ═══ Prestige Modal ═══ */}
      {showPrestige && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={() => setShowPrestige(false)}>
          <div style={{ ...P, maxWidth: isMobile ? '85vw' : 420, textAlign: 'center', border: '2px solid rgba(251,191,36,0.5)', padding: isMobile ? '24px' : '32px 36px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#fbbf24', marginBottom: 14, letterSpacing: '-0.5px' }}>✨ Prestige Reset</div>
            <div style={{ lineHeight: 1.8, color: '#cbd5e1', marginBottom: 20, fontSize: isMobile ? 13 : 15 }}>
              <div>Level {gs.prestigeLevel} → <b style={{ color: '#fbbf24' }}>{gs.prestigeLevel + 1}</b></div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>✓ Reset resources & money to $100</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>✓ Keep all buildings</div>
              <div style={{ fontSize: 14, color: '#4ade80', fontWeight: 700, marginTop: 10 }}>⚡ Speed: {((pm + 0.05) * 100).toFixed(0)}% (+5%)</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => { useGameStore.getState().prestige(); setShowPrestige(false); }} style={{ padding: '10px 22px', background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.08))', border: '1.5px solid rgba(251,191,36,0.4)', borderRadius: 8, color: '#fbbf24', fontWeight: 700, cursor: 'pointer', fontSize: 14, transition: 'all 0.15s' }}>Prestige Now</button>
              <button onClick={() => setShowPrestige(false)} style={{ padding: '10px 22px', background: 'rgba(71,137,217,0.12)', border: '1px solid rgba(71,137,217,0.25)', borderRadius: 8, color: '#93c5fd', fontWeight: 700, cursor: 'pointer', fontSize: 14, transition: 'all 0.15s' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Placement indicator */}
      {selectedBuilding && (
        <div style={{
          position: 'fixed', top: isMobile ? 50 : '50%', left: '50%',
          transform: isMobile ? 'translateX(-50%)' : 'translate(-50%, -50%)',
          ...P, border: '2px solid rgba(74,222,128,0.6)',
          padding: isMobile ? '10px 16px' : '18px 28px', textAlign: 'center', zIndex: 100,
        }} data-ui>
          <div style={{ color: '#4ade80', fontWeight: 700, fontSize: isMobile ? 13 : 16, letterSpacing: '-0.5px' }}>
            🎯 {isMobile ? 'Tap' : 'Click'} ground to place {selectedBuilding === 'FARM' ? 'Farm' : PROCESSORS[selectedBuilding]?.name || selectedBuilding}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            {isMobile ? <button onClick={cancelPlacement} style={{ padding: '3px 10px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 5, color: '#f87171', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>✕ Cancel</button> : 'ESC to cancel'}
          </div>
        </div>
      )}

      {/* First-time hint */}
      {totalBuildings === 0 && !selectedBuilding && gs.pendingFarmId === null && (
        <div style={{
          position: 'fixed', bottom: isMobile ? 58 : 90, left: '50%', transform: 'translateX(-50%)',
          ...P, border: '1px solid rgba(251,191,36,0.35)',
          padding: isMobile ? '8px 14px' : '12px 22px', textAlign: 'center', zIndex: 40,
          color: '#fbbf24', fontSize: isMobile ? 12 : 14, fontWeight: 600,
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
  const sz = compact ? 11 : 12;

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

      {gs.processors.length === 0 && gs.farms.length > 0 && gs.mines.length === 0 && (
        <Em text="Buy processing buildings or mines to expand!" />
      )}

      {/* SURVEY RIGS */}
      {gs.surveyRigs.length > 0 && (
        <Sect title={`🔍 Survey Rigs (${gs.surveyRigs.length})`}>
          {gs.surveyRigs.map((rig, i) => (
            <Card key={rig.id} label={`Survey #${i + 1}`} color="#7dd3fc">
              {rig.isDone ? (
                <div style={{ fontSize: sz }}>
                  {rig.results && rig.results.length > 0
                    ? <span style={{ color: '#4ade80' }}>Found: {[...new Set(rig.results.map(r => r.resource.name))].join(', ')}</span>
                    : <span style={{ color: '#f87171' }}>No resources found</span>
                  }
                </div>
              ) : (
                <>
                  <PBar current={rig.currentProduction} max={5000} color="#7dd3fc" />
                  <div style={{ fontSize: sz, color: '#94a3b8' }}>Scanning... {(rig.currentProduction / 1000).toFixed(1)}/5.0s</div>
                </>
              )}
            </Card>
          ))}
        </Sect>
      )}

      {/* MINES */}
      {gs.mines.length > 0 && (
        <Sect title={`⛏️ Mines (${gs.mines.length})`}>
          {gs.mines.map((mine, i) => (
            <Card key={mine.id}
              label={`Mine #${i + 1} — ${mine.resourceIcon} ${mine.resourceName}`}
              color={mine.resourceId ? (RESOURCES[mine.resourceId]?.color || '#6b7280') : '#64748b'}>
              {!mine.resourceId ? (
                <div style={{ fontSize: sz, color: '#f87171' }}>Empty — no resources here</div>
              ) : (
                <>
                  <PBar current={mine.currentProduction} max={mine.extractTime / pm} color={RESOURCES[mine.resourceId]?.color || '#6b7280'} />
                  <button onClick={() => useGameStore.getState().harvestMine(mine.id)} disabled={!mine.isReady} style={btnG(mine.isReady)}>
                    {mine.isReady
                      ? `${mine.resourceIcon} Extract ($${mine.extractCost})`
                      : `${compact ? '' : 'Extracting... '}${(mine.currentProduction / 1000).toFixed(1)}s`}
                  </button>
                </>
              )}
            </Card>
          ))}
        </Sect>
      )}
    </>
  );
}

// ═══ Sub-components ═══

function TabBtn({ active, onClick, label }) {
  return (
    <button onClick={onClick} data-ui style={{
      width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(74,222,128,0.08))' : 'rgba(20,28,48,0.9)',
      border: active ? '1.5px solid #4ade80' : '1px solid rgba(71,137,217,0.25)',
      borderRadius: 9, fontSize: 16, cursor: 'pointer', color: active ? '#4ade80' : '#cbd5e1',
      transition: 'all 0.15s',
      boxShadow: active ? '0 4px 15px rgba(74,222,128,0.1)' : 'none',
    }}>{label}</button>
  );
}

function Sect({ title, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 11, padding: '6px 9px', background: 'rgba(71,137,217,0.1)', borderRadius: 6, marginBottom: 6, color: '#93c5fd', letterSpacing: '0.3px' }}>{title}</div>
      {children}
    </div>
  );
}

function Card({ label, color, children }) {
  return (
    <div style={{ background: 'rgba(71,137,217,0.08)', padding: '8px 10px', borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${color}`, border: `1px solid rgba(71,137,217,0.12)`, borderLeftWidth: 3 }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#cbd5e1' }}>{label}</div>
      {children}
    </div>
  );
}

function PBar({ current, max, color }) {
  return (
    <div style={{ background: 'rgba(71,137,217,0.15)', height: 5, borderRadius: 3, margin: '4px 0', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, (current / max) * 100)}%`, background: color, borderRadius: 3, transition: 'width 0.1s', boxShadow: `0 0 8px ${color}40` }} />
    </div>
  );
}

function Em({ text }) {
  return <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', padding: '3px 5px' }}>{text}</div>;
}

function NavDPad({ rendererRef, bottom = 16, size = 40 }) {
  const ab = (dir) => ({
    onMouseDown: () => rendererRef.current?.startPan(dir),
    onMouseUp: () => rendererRef.current?.stopPan(dir),
    onMouseLeave: () => rendererRef.current?.stopPan(dir),
    onTouchStart: (e) => { e.preventDefault(); rendererRef.current?.startPan(dir); },
    onTouchEnd: () => rendererRef.current?.stopPan(dir),
  });
  const s = {
    width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(71,137,217,0.15)', border: '1px solid rgba(71,137,217,0.25)',
    borderRadius: 8, color: '#93c5fd', fontSize: size * 0.4, cursor: 'pointer', userSelect: 'none',
    transition: 'all 0.15s',
  };
  return (
    <div style={{
      position: 'fixed', bottom, right: 12, zIndex: 50,
      display: 'grid', gridTemplateAreas: `". u ." "l c r" ". d ."`,
      gridTemplateColumns: `${size}px ${size}px ${size}px`, gridTemplateRows: `${size}px ${size}px ${size}px`, gap: 3,
    }} data-ui>
      <button {...ab('up')} style={{ ...s, gridArea: 'u' }}>▲</button>
      <button {...ab('left')} style={{ ...s, gridArea: 'l' }}>◀</button>
      <div style={{ ...s, gridArea: 'c', background: 'rgba(71,137,217,0.08)', color: '#475569', fontSize: size * 0.28 }}>⊕</div>
      <button {...ab('right')} style={{ ...s, gridArea: 'r' }}>▶</button>
      <button {...ab('down')} style={{ ...s, gridArea: 'd' }}>▼</button>
    </div>
  );
}
