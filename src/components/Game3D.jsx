import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { useWorldStore } from '../store/worldStore';
import { GameRenderer } from '../lib/three-renderer';

export default function Game3D({ onBack }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  const [gs, setGs] = useState(useGameStore.getState());
  useEffect(() => useGameStore.subscribe((s) => setGs(s)), []);

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [showPrestige, setShowPrestige] = useState(false);
  const [toast, setToast] = useState(null);
  const [prevPrices, setPrevPrices] = useState({ ...gs.marketPrices });

  // Mobile state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobilePanel, setMobilePanel] = useState(null); // null | 'inventory' | 'buildings'

  // ─── Responsive detection ───
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

    rendererRef.current = new GameRenderer(canvas, useGameStore, {
      skipWorldGen: hasCustomWorld,
    });

    if (hasCustomWorld) {
      const wait = setInterval(() => {
        if (rendererRef.current?.modelsReady) {
          clearInterval(wait);
          rendererRef.current.loadCustomWorld(worldObjects);
        }
      }, 100);
    }

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

  // ─── Game tick ───
  useEffect(() => {
    const interval = setInterval(() => useGameStore.getState().tick(0.016), 16);
    return () => clearInterval(interval);
  }, []);

  // ─── Track price changes ───
  useEffect(() => {
    setPrevPrices(prev => ({ ...prev }));
  }, [gs.marketPrices.cotton, gs.marketPrices.cloth, gs.marketPrices.textiles]);

  // ─── Toast ───
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
  }, [toast]);

  // ─── Sync buildings → 3D ───
  const renderedIds = useRef(new Set());
  useEffect(() => {
    if (!rendererRef.current) return;
    [...gs.farms.map(f => ({ ...f, type: 'FARM' })),
     ...gs.warehouses.map(w => ({ ...w, type: 'WAREHOUSE' })),
     ...gs.factories.map(f => ({ ...f, type: 'FACTORY' })),
     ...gs.grainFarms.map(f => ({ ...f, type: 'GRAIN_FARM' })),
     ...gs.mills.map(m => ({ ...m, type: 'MILL' })),
     ...gs.bakeries.map(b => ({ ...b, type: 'BAKERY' })),
    ].forEach(b => {
      const key = `${b.type}-${b.id}`;
      if (!renderedIds.current.has(key)) {
        rendererRef.current.createBuilding(b.type, b.position, b.id);
        renderedIds.current.add(key);
      }
    });
  }, [gs.farms, gs.warehouses, gs.factories]);

  // ─── Placement ───
  const startPlacement = (type) => {
    if (selectedBuilding === type) return cancelPlacement();
    setSelectedBuilding(type);
    if (isMobile) setMobilePanel(null); // close panels on mobile
    if (rendererRef.current) {
      if (rendererRef.current.previewBuilding) rendererRef.current.scene.remove(rendererRef.current.previewBuilding);
      rendererRef.current.placementMode = type;
      rendererRef.current.previewBuilding = rendererRef.current.createBuildingPreview(type);
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

      // For touch: update preview position first
      if (e.changedTouches) {
        const touch = e.changedTouches[0];
        const rect = canvasRef.current.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((touch.clientX - rect.left) / rect.width) * 2 - 1,
          -((touch.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, rendererRef.current.camera);
        const hits = raycaster.intersectObject(rendererRef.current.placementGround);
        if (hits.length > 0) {
          const p = hits[0].point;
          rendererRef.current.previewBuilding.position.set(
            Math.round(p.x / 5) * 5, 0, Math.round(p.z / 5) * 5
          );
        }
      }

      const pos = rendererRef.current.previewBuilding.position;
      const position = { x: pos.x, y: 0, z: pos.z };
      const state = useGameStore.getState();
      const cost = state.getBuildingCost(selectedBuilding);

      if (state.money < cost) { setToast(`Need $${cost}!`); return; }

      let ok = false;
      if (selectedBuilding === 'FARM') ok = state.buyFarm(position);
      else if (selectedBuilding === 'WAREHOUSE') ok = state.buyWarehouse(position);
      else if (selectedBuilding === 'FACTORY') ok = state.buyFactory(position);
      else if (selectedBuilding === 'GRAIN_FARM') ok = state.buyGrainFarm(position);
      else if (selectedBuilding === 'MILL') ok = state.buyMill(position);
      else if (selectedBuilding === 'BAKERY') ok = state.buyBakery(position);

      if (ok) {
        setToast(`${selectedBuilding} placed! (-$${cost})`);
        cancelPlacement();
      }
    };

    document.addEventListener('mouseup', handlePlace);
    document.addEventListener('touchend', handlePlace);
    return () => {
      document.removeEventListener('mouseup', handlePlace);
      document.removeEventListener('touchend', handlePlace);
    };
  }, [selectedBuilding]);

  // ─── ESC ───
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cancelPlacement(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── Helpers ───
  const priceArrow = (cur, prev) => Math.abs(cur - prev) < 0.01 ? '' : cur > prev ? ' ▲' : ' ▼';
  const priceColor = (cur, prev) => Math.abs(cur - prev) < 0.01 ? '#94a3b8' : cur > prev ? '#4ade80' : '#f87171';
  const pm = 1 + gs.prestigeLevel * 0.05;
  const totalBuildings = gs.farms.length + gs.warehouses.length + gs.factories.length + gs.grainFarms.length + gs.mills.length + gs.bakeries.length;

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

  // ════════════════════════════════
  //  RENDER
  // ════════════════════════════════
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#0f172a' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div style={{
          position: 'fixed', top: isMobile ? 8 : 16, left: '50%', transform: 'translateX(-50%)',
          ...P, padding: '6px 14px', border: '1px solid rgba(251,191,36,0.4)',
          color: '#fbbf24', zIndex: 200, fontWeight: 600, fontSize: 12,
        }} data-ui>{toast}</div>
      )}

      {/* ══════════════════════════════════════════
            MOBILE LAYOUT
         ══════════════════════════════════════════ */}
      {isMobile ? (
        <>
          {/* ─── TOP BAR: compact money + resources ─── */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
            ...P, borderRadius: 0, padding: '6px 10px',
            display: 'flex', alignItems: 'center', gap: 6,
            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          }} data-ui>
            {onBack && (
              <button onClick={onBack} style={{
                padding: '3px 6px', background: 'rgba(100,150,200,0.15)',
                border: '1px solid rgba(100,150,200,0.3)', borderRadius: 4,
                color: '#94a3b8', fontSize: 10, cursor: 'pointer',
              }}>←</button>
            )}
            <span style={{ fontWeight: 700, color: '#4ade80', fontSize: 15 }}>${gs.money.toFixed(0)}</span>
            <div style={{ flex: 1, display: 'flex', gap: 4, justifyContent: 'center', fontSize: 10, flexWrap: 'wrap' }}>
              <span>🌾<b style={{ color: '#fbbf24' }}>{Math.floor(gs.cotton)}</b></span>
              <span>🧵<b style={{ color: '#60a5fa' }}>{Math.floor(gs.cloth)}</b></span>
              <span>👕<b style={{ color: '#f472b6' }}>{Math.floor(gs.textiles)}</b></span>
              <span style={{ color: '#475569' }}>|</span>
              <span>🌾<b style={{ color: '#a3e635' }}>{Math.floor(gs.wheat)}</b></span>
              <span>🫘<b style={{ color: '#fcd34d' }}>{Math.floor(gs.flour)}</b></span>
              <span>🍞<b style={{ color: '#fb923c' }}>{Math.floor(gs.bread)}</b></span>
            </div>
            <button onClick={() => setShowPrestige(true)} style={{
              padding: '2px 6px', background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(251,191,36,0.4)', borderRadius: 4,
              color: '#fbbf24', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            }}>⭐{gs.prestigeLevel}</button>
          </div>

          {/* ─── TAB BUTTONS: toggle panels ─── */}
          <div style={{
            position: 'fixed', top: 36, left: 6, zIndex: 55,
            display: 'flex', flexDirection: 'column', gap: 4,
          }} data-ui>
            <TabBtn active={mobilePanel === 'inventory'} onClick={() => setMobilePanel(mobilePanel === 'inventory' ? null : 'inventory')} label="💰" />
            <TabBtn active={mobilePanel === 'buildings'} onClick={() => setMobilePanel(mobilePanel === 'buildings' ? null : 'buildings')} label={`🏗️${totalBuildings}`} />
          </div>

          {/* ─── SLIDE-OUT: INVENTORY ─── */}
          {mobilePanel === 'inventory' && (
            <div style={{
              position: 'fixed', top: 36, left: 0, bottom: 60, width: '70vw', maxWidth: 280, zIndex: 52,
              ...P, borderRadius: '0 10px 10px 0', padding: '10px 12px',
              overflowY: 'auto',
            }} data-ui>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>💰 Inventory</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#fbbf24', marginBottom: 4 }}>🧶 Textile Chain</div>
              {[
                { icon: '🌾', label: 'Cotton', amount: gs.cotton, price: gs.marketPrices.cotton, sell: () => useGameStore.getState().sellCotton(Math.floor(gs.cotton)), color: '#fbbf24' },
                { icon: '🧵', label: 'Cloth', amount: gs.cloth, price: gs.marketPrices.cloth, sell: () => useGameStore.getState().sellCloth(Math.floor(gs.cloth)), color: '#60a5fa' },
                { icon: '👕', label: 'Textiles', amount: gs.textiles, price: gs.marketPrices.textiles, sell: () => useGameStore.getState().sellTextiles(Math.floor(gs.textiles)), color: '#f472b6' },
              ].map(r => (
                <div key={r.label} style={{ marginBottom: 8, padding: '6px 8px', background: 'rgba(100,150,200,0.08)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{r.icon} {r.label}: <b style={{ color: r.color }}>{Math.floor(r.amount)}</b></span>
                    <span style={{ color: priceColor(r.price, prevPrices[r.label.toLowerCase()]), fontSize: 11 }}>
                      ${r.price.toFixed(2)}{priceArrow(r.price, prevPrices[r.label.toLowerCase()])}
                    </span>
                  </div>
                  <button onClick={r.sell} disabled={r.amount < 1} style={{ ...btnG(r.amount >= 1), fontSize: 11, padding: '4px 6px' }}>
                    Sell @ ${r.price.toFixed(2)}
                  </button>
                </div>
              ))}
              <div style={{ fontSize: 11, fontWeight: 600, color: '#a3e635', marginBottom: 4, marginTop: 6 }}>🍞 Food Chain</div>
              {[
                { icon: '🌾', label: 'Wheat', amount: gs.wheat, price: gs.marketPrices.wheat, sell: () => useGameStore.getState().sellWheat(Math.floor(gs.wheat)), color: '#a3e635' },
                { icon: '🫘', label: 'Flour', amount: gs.flour, price: gs.marketPrices.flour, sell: () => useGameStore.getState().sellFlour(Math.floor(gs.flour)), color: '#fcd34d' },
                { icon: '🍞', label: 'Bread', amount: gs.bread, price: gs.marketPrices.bread, sell: () => useGameStore.getState().sellBread(Math.floor(gs.bread)), color: '#fb923c' },
              ].map(r => (
                <div key={r.label} style={{ marginBottom: 8, padding: '6px 8px', background: 'rgba(100,150,200,0.08)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{r.icon} {r.label}: <b style={{ color: r.color }}>{Math.floor(r.amount)}</b></span>
                    <span style={{ color: priceColor(r.price, prevPrices[r.label.toLowerCase()]), fontSize: 11 }}>
                      ${r.price.toFixed(2)}{priceArrow(r.price, prevPrices[r.label.toLowerCase()])}
                    </span>
                  </div>
                  <button onClick={r.sell} disabled={r.amount < 1} style={{ ...btnG(r.amount >= 1), fontSize: 11, padding: '4px 6px' }}>
                    Sell @ ${r.price.toFixed(2)}
                  </button>
                </div>
              ))}
              {gs.prestigeLevel > 0 && (
                <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 4 }}>⭐ Prestige +{((pm - 1) * 100).toFixed(0)}% speed</div>
              )}
            </div>
          )}

          {/* ─── SLIDE-OUT: BUILDINGS ─── */}
          {mobilePanel === 'buildings' && (
            <div style={{
              position: 'fixed', top: 36, left: 0, bottom: 60, width: '75vw', maxWidth: 300, zIndex: 52,
              ...P, borderRadius: '0 10px 10px 0', padding: '10px 12px',
              overflowY: 'auto',
            }} data-ui>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🏗️ Buildings ({totalBuildings})</div>
              <MobileBuildings gs={gs} pm={pm} btnG={btnG} />
            </div>
          )}

          {/* ─── BOTTOM: BUILD BAR (compact, 2 rows) ─── */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            ...P, borderRadius: 0, padding: '4px 6px',
            display: 'flex', flexDirection: 'column', gap: 3,
            borderBottom: 'none', borderLeft: 'none', borderRight: 'none',
          }} data-ui>
            <div style={{ display: 'flex', gap: 4, fontSize: 9, color: '#94a3b8', paddingLeft: 2 }}>
              <span style={{ flex: 1, textAlign: 'center' }}>🧶 Textile</span>
              <span style={{ flex: 1, textAlign: 'center' }}>🍞 Food</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { type: 'FARM', icon: '🌾', cost: 50, label: 'Farm' },
                { type: 'WAREHOUSE', icon: '📦', cost: 100, label: 'WH' },
                { type: 'FACTORY', icon: '🏢', cost: 200, label: 'Fac' },
                { type: 'GRAIN_FARM', icon: '🌾', cost: 60, label: 'Grain' },
                { type: 'MILL', icon: '⚙️', cost: 120, label: 'Mill' },
                { type: 'BAKERY', icon: '🍞', cost: 250, label: 'Bake' },
              ].map(b => {
                const can = gs.money >= b.cost;
                const sel = selectedBuilding === b.type;
                return (
                  <button key={b.type} onClick={() => startPlacement(b.type)} disabled={!can}
                    style={{
                      padding: '4px 2px', flex: 1,
                      background: sel ? 'rgba(74,222,128,0.25)' : can ? 'rgba(100,150,200,0.12)' : 'rgba(40,40,40,0.15)',
                      border: sel ? '2px solid #4ade80' : can ? '1px solid rgba(100,150,200,0.3)' : '1px solid rgba(60,60,60,0.15)',
                      borderRadius: 5, color: sel ? '#4ade80' : can ? '#cbd5e1' : '#475569',
                      fontWeight: 700, fontSize: 9, cursor: can ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                    }}>{b.icon}${b.cost}</button>
                );
              })}
            </div>
          </div>

          {/* ─── NAV D-PAD (above bottom bar) ─── */}
          <NavDPad rendererRef={rendererRef} bottom={52} size={30} />
        </>
      ) : (
        /* ══════════════════════════════════════════
             DESKTOP LAYOUT (original, cleaned up)
           ══════════════════════════════════════════ */
        <>
          {/* ─── TOP-LEFT: MONEY + INVENTORY ─── */}
          <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, ...P, padding: '14px 16px', minWidth: 220 }} data-ui>
            {onBack && (
              <button onClick={onBack} style={{
                padding: '4px 10px', marginBottom: 8, width: '100%',
                background: 'rgba(100,150,200,0.12)', border: '1px solid rgba(100,150,200,0.3)',
                borderRadius: 5, color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>← Main Menu</button>
            )}
            <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', marginBottom: 10 }}>
              💰 ${gs.money.toFixed(0)}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', marginBottom: 4 }}>🧶 Textile Chain</div>
              {[
                { icon: '🌾', label: 'Cotton', amount: gs.cotton, price: gs.marketPrices.cotton, sell: () => useGameStore.getState().sellCotton(Math.floor(gs.cotton)), color: '#fbbf24' },
                { icon: '🧵', label: 'Cloth', amount: gs.cloth, price: gs.marketPrices.cloth, sell: () => useGameStore.getState().sellCloth(Math.floor(gs.cloth)), color: '#60a5fa' },
                { icon: '👕', label: 'Textiles', amount: gs.textiles, price: gs.marketPrices.textiles, sell: () => useGameStore.getState().sellTextiles(Math.floor(gs.textiles)), color: '#f472b6' },
              ].map(r => (
                <div key={r.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{r.icon} {r.label}: <b style={{ color: r.color }}>{Math.floor(r.amount)}</b></span>
                    <span style={{ fontSize: 11, color: priceColor(r.price, prevPrices[r.label.toLowerCase()]) }}>
                      ${r.price.toFixed(2)}{priceArrow(r.price, prevPrices[r.label.toLowerCase()])}
                    </span>
                  </div>
                  <button onClick={r.sell} disabled={r.amount < 1} style={btnG(r.amount >= 1)}>
                    Sell All @ ${r.price.toFixed(2)}
                  </button>
                </div>
              ))}
              <div style={{ fontSize: 10, fontWeight: 600, color: '#a3e635', marginBottom: 4, marginTop: 6 }}>🍞 Food Chain</div>
              {[
                { icon: '🌾', label: 'Wheat', amount: gs.wheat, price: gs.marketPrices.wheat, sell: () => useGameStore.getState().sellWheat(Math.floor(gs.wheat)), color: '#a3e635' },
                { icon: '🫘', label: 'Flour', amount: gs.flour, price: gs.marketPrices.flour, sell: () => useGameStore.getState().sellFlour(Math.floor(gs.flour)), color: '#fcd34d' },
                { icon: '🍞', label: 'Bread', amount: gs.bread, price: gs.marketPrices.bread, sell: () => useGameStore.getState().sellBread(Math.floor(gs.bread)), color: '#fb923c' },
              ].map(r => (
                <div key={r.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{r.icon} {r.label}: <b style={{ color: r.color }}>{Math.floor(r.amount)}</b></span>
                    <span style={{ fontSize: 11, color: priceColor(r.price, prevPrices[r.label.toLowerCase()]) }}>
                      ${r.price.toFixed(2)}{priceArrow(r.price, prevPrices[r.label.toLowerCase()])}
                    </span>
                  </div>
                  <button onClick={r.sell} disabled={r.amount < 1} style={btnG(r.amount >= 1)}>
                    Sell All @ ${r.price.toFixed(2)}
                  </button>
                </div>
              ))}
            </div>
            {gs.prestigeLevel > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 4, fontSize: 11, color: '#fbbf24' }}>
                ⭐ Prestige Lv.{gs.prestigeLevel} — +{((pm - 1) * 100).toFixed(0)}% speed
              </div>
            )}
          </div>

          {/* ─── LEFT: BUILDINGS PANEL ─── */}
          <div style={{
            position: 'fixed', top: 16, left: 252, zIndex: 50, ...P, padding: '14px 16px',
            width: 280, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
          }} data-ui>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
              🏗️ Buildings ({totalBuildings})
            </div>
            <DesktopBuildings gs={gs} pm={pm} btnG={btnG} />
          </div>

          {/* ─── BOTTOM: BUILD BAR ─── */}
          <div style={{
            position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6, zIndex: 50, ...P, padding: '8px 12px', flexDirection: 'column', alignItems: 'center',
          }} data-ui>
            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
              <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600, width: 50, textAlign: 'right', alignSelf: 'center' }}>🧶</span>
              {[
                { type: 'FARM', icon: '🌾', cost: 50, label: 'Farm' },
                { type: 'WAREHOUSE', icon: '📦', cost: 100, label: 'Warehouse' },
                { type: 'FACTORY', icon: '🏢', cost: 200, label: 'Factory' },
              ].map(b => {
                const can = gs.money >= b.cost; const sel = selectedBuilding === b.type;
                return <button key={b.type} onClick={() => startPlacement(b.type)} disabled={!can} style={{
                  padding: '6px 12px', background: sel ? 'rgba(74,222,128,0.25)' : can ? 'rgba(100,150,200,0.15)' : 'rgba(60,60,60,0.15)',
                  border: sel ? '2px solid #4ade80' : can ? '1px solid rgba(100,150,200,0.4)' : '1px solid rgba(60,60,60,0.2)',
                  borderRadius: 7, color: sel ? '#4ade80' : can ? '#cbd5e1' : '#475569', fontWeight: 700, fontSize: 12, cursor: can ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                }}>{b.icon} {b.label} ${b.cost}</button>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
              <span style={{ fontSize: 10, color: '#a3e635', fontWeight: 600, width: 50, textAlign: 'right', alignSelf: 'center' }}>🍞</span>
              {[
                { type: 'GRAIN_FARM', icon: '🌾', cost: 60, label: 'Grain Farm' },
                { type: 'MILL', icon: '⚙️', cost: 120, label: 'Mill' },
                { type: 'BAKERY', icon: '🍞', cost: 250, label: 'Bakery' },
              ].map(b => {
                const can = gs.money >= b.cost; const sel = selectedBuilding === b.type;
                return <button key={b.type} onClick={() => startPlacement(b.type)} disabled={!can} style={{
                  padding: '6px 12px', background: sel ? 'rgba(74,222,128,0.25)' : can ? 'rgba(100,150,200,0.15)' : 'rgba(60,60,60,0.15)',
                  border: sel ? '2px solid #4ade80' : can ? '1px solid rgba(100,150,200,0.4)' : '1px solid rgba(60,60,60,0.2)',
                  borderRadius: 7, color: sel ? '#4ade80' : can ? '#cbd5e1' : '#475569', fontWeight: 700, fontSize: 12, cursor: can ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                }}>{b.icon} {b.label} ${b.cost}</button>;
              })}
            </div>
          </div>

          {/* ─── PRESTIGE BUTTON ─── */}
          <button onClick={() => setShowPrestige(true)} style={{
            position: 'fixed', bottom: 130, right: 16, padding: '10px 18px',
            background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.5)',
            borderRadius: 8, color: '#fbbf24', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', zIndex: 50,
          }} data-ui>⭐ Prestige (Lv.{gs.prestigeLevel})</button>

          {/* ─── NAV D-PAD ─── */}
          <NavDPad rendererRef={rendererRef} bottom={16} size={36} />
        </>
      )}

      {/* ══════════ SHARED: Prestige Modal ══════════ */}
      {showPrestige && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
        }} onClick={() => setShowPrestige(false)}>
          <div style={{
            ...P, maxWidth: isMobile ? '85vw' : 400, textAlign: 'center',
            border: '2px solid rgba(251,191,36,0.6)', padding: isMobile ? '20px' : '28px 32px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: '#fbbf24', marginBottom: 12 }}>
              ✨ Prestige Reset
            </div>
            <div style={{ lineHeight: 1.7, color: '#cbd5e1', marginBottom: 16, fontSize: isMobile ? 12 : 14 }}>
              <div>Level {gs.prestigeLevel} → <b style={{ color: '#fbbf24' }}>{gs.prestigeLevel + 1}</b></div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>✓ Reset resources & money to $100</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>✓ Keep all buildings</div>
              <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 700, marginTop: 8 }}>
                ⚡ Speed: {((pm + 0.05) * 100).toFixed(0)}% (+5%)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => { useGameStore.getState().prestige(); setShowPrestige(false); }} style={{
                padding: '8px 20px', background: 'rgba(251,191,36,0.2)',
                border: '2px solid rgba(251,191,36,0.6)', borderRadius: 8,
                color: '#fbbf24', fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}>Prestige Now</button>
              <button onClick={() => setShowPrestige(false)} style={{
                padding: '8px 20px', background: 'rgba(100,150,200,0.15)',
                border: '1px solid rgba(100,150,200,0.4)', borderRadius: 8,
                color: '#60a5fa', fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SHARED: Placement indicator ══════════ */}
      {selectedBuilding && (
        <div style={{
          position: 'fixed', top: isMobile ? 44 : '50%', left: '50%',
          transform: isMobile ? 'translateX(-50%)' : 'translate(-50%, -50%)',
          ...P, border: '2px solid rgba(74,222,128,0.7)',
          padding: isMobile ? '8px 14px' : '16px 24px', textAlign: 'center', zIndex: 100,
        }} data-ui>
          <div style={{ color: '#4ade80', fontWeight: 700, fontSize: isMobile ? 12 : 15 }}>
            🎯 {isMobile ? 'Tap' : 'Click'} ground to place {selectedBuilding}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
            {isMobile ? 'Tap here to cancel' : 'ESC to cancel'}
            {isMobile && <button onClick={cancelPlacement} style={{
              marginLeft: 8, padding: '2px 8px', background: 'rgba(248,113,113,0.2)',
              border: '1px solid rgba(248,113,113,0.4)', borderRadius: 4,
              color: '#f87171', fontSize: 10, cursor: 'pointer',
            }}>✕ Cancel</button>}
          </div>
        </div>
      )}

      {/* ══════════ SHARED: First-time hint ══════════ */}
      {totalBuildings === 0 && !selectedBuilding && (
        <div style={{
          position: 'fixed', bottom: isMobile ? 50 : 80, left: '50%', transform: 'translateX(-50%)',
          ...P, border: '1px solid rgba(251,191,36,0.4)',
          padding: isMobile ? '6px 12px' : '10px 20px', textAlign: 'center', zIndex: 40,
          color: '#fbbf24', fontSize: isMobile ? 11 : 13,
        }} data-ui>
          👆 Buy a Farm to start!
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.02); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════

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

function MobileBuildings({ gs, pm, btnG }) {
  return (
    <>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>🧶 TEXTILE CHAIN</div>
      <Sect title={`🌾 Farms (${gs.farms.length})`}>
        {gs.farms.length === 0 ? <Em text="Buy a farm!" /> :
          gs.farms.map((f, i) => (
            <Card key={f.id} label={`Farm #${i + 1}`} color="#4ade80">
              <PBar current={f.currentProduction} max={5000 / pm} color="#4ade80" />
              <button onClick={() => useGameStore.getState().harvestFarm(f.id)} disabled={!f.isReady} style={btnG(f.isReady)}>
                {f.isReady ? '🌾 Harvest ($1)' : `${(f.currentProduction / 1000).toFixed(1)}s`}
              </button>
            </Card>
          ))}
      </Sect>
      <Sect title={`📦 Warehouses (${gs.warehouses.length})`}>
        {gs.warehouses.length === 0 ? <Em text="Cotton → Cloth" /> :
          gs.warehouses.map((w, i) => (
            <Card key={w.id} label={`WH #${i + 1}`} color="#f59e0b">
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Cotton: <b style={{ color: '#fbbf24' }}>{w.storageAmount}</b></div>
              {w.storageAmount === 0 && gs.cotton >= 1 ? (
                <button onClick={() => useGameStore.getState().sendCottonToWarehouse(w.id, 1)} style={btnG(true)}>📥 Load ($2)</button>
              ) : w.storageAmount > 0 ? (
                <>
                  <PBar current={w.currentProduction} max={8000 / pm} color="#f59e0b" />
                  <button onClick={() => useGameStore.getState().harvestWarehouse(w.id)} disabled={!w.isReady} style={btnG(w.isReady)}>
                    {w.isReady ? '🧵 Convert' : `${(w.currentProduction / 1000).toFixed(1)}s`}
                  </button>
                </>
              ) : <Em text="Need cotton" />}
            </Card>
          ))}
      </Sect>
      <Sect title={`🏢 Factories (${gs.factories.length})`}>
        {gs.factories.length === 0 ? <Em text="Cloth → Textiles" /> :
          gs.factories.map((f, i) => (
            <Card key={f.id} label={`Factory #${i + 1}`} color="#60a5fa">
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Cloth: <b style={{ color: '#60a5fa' }}>{f.clothInput}</b>/2</div>
              {f.clothInput < 2 && gs.cloth >= 1 ? (
                <button onClick={() => useGameStore.getState().sendClothToFactory(f.id, 1)} style={btnG(true)}>📥 Load ($5)</button>
              ) : f.clothInput >= 2 ? (
                <>
                  <PBar current={f.currentProduction} max={10000 / pm} color="#60a5fa" />
                  <button onClick={() => useGameStore.getState().harvestFactory(f.id)} disabled={!f.isReady} style={btnG(f.isReady)}>
                    {f.isReady ? '👕 Produce ($5)' : `${(f.currentProduction / 1000).toFixed(1)}s`}
                  </button>
                </>
              ) : <Em text="Need cloth" />}
            </Card>
          ))}
      </Sect>

      <div style={{ fontSize: 10, fontWeight: 700, color: '#a3e635', marginTop: 8, marginBottom: 4 }}>🍞 FOOD CHAIN</div>
      <Sect title={`🌾 Grain Farms (${gs.grainFarms.length})`}>
        {gs.grainFarms.length === 0 ? <Em text="Buy a grain farm!" /> :
          gs.grainFarms.map((f, i) => (
            <Card key={f.id} label={`Grain #${i + 1}`} color="#a3e635">
              <PBar current={f.currentProduction} max={6000 / pm} color="#a3e635" />
              <button onClick={() => useGameStore.getState().harvestGrainFarm(f.id)} disabled={!f.isReady} style={btnG(f.isReady)}>
                {f.isReady ? '🌾 Harvest ($1)' : `${(f.currentProduction / 1000).toFixed(1)}s`}
              </button>
            </Card>
          ))}
      </Sect>
      <Sect title={`⚙️ Mills (${gs.mills.length})`}>
        {gs.mills.length === 0 ? <Em text="Wheat → Flour" /> :
          gs.mills.map((m, i) => (
            <Card key={m.id} label={`Mill #${i + 1}`} color="#fcd34d">
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Wheat: <b style={{ color: '#a3e635' }}>{m.storageAmount}</b></div>
              {m.storageAmount === 0 && gs.wheat >= 1 ? (
                <button onClick={() => useGameStore.getState().sendWheatToMill(m.id, 1)} style={btnG(true)}>📥 Load ($3)</button>
              ) : m.storageAmount > 0 ? (
                <>
                  <PBar current={m.currentProduction} max={7000 / pm} color="#fcd34d" />
                  <button onClick={() => useGameStore.getState().harvestMill(m.id)} disabled={!m.isReady} style={btnG(m.isReady)}>
                    {m.isReady ? '🫘 Grind' : `${(m.currentProduction / 1000).toFixed(1)}s`}
                  </button>
                </>
              ) : <Em text="Need wheat" />}
            </Card>
          ))}
      </Sect>
      <Sect title={`🍞 Bakeries (${gs.bakeries.length})`}>
        {gs.bakeries.length === 0 ? <Em text="Flour → Bread" /> :
          gs.bakeries.map((b, i) => (
            <Card key={b.id} label={`Bakery #${i + 1}`} color="#fb923c">
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Flour: <b style={{ color: '#fcd34d' }}>{b.flourInput}</b>/3</div>
              {b.flourInput < 3 && gs.flour >= 1 ? (
                <button onClick={() => useGameStore.getState().sendFlourToBakery(b.id, 1)} style={btnG(true)}>📥 Load ($6)</button>
              ) : b.flourInput >= 3 ? (
                <>
                  <PBar current={b.currentProduction} max={12000 / pm} color="#fb923c" />
                  <button onClick={() => useGameStore.getState().harvestBakery(b.id)} disabled={!b.isReady} style={btnG(b.isReady)}>
                    {b.isReady ? '🍞 Bake ($6)' : `${(b.currentProduction / 1000).toFixed(1)}s`}
                  </button>
                </>
              ) : <Em text="Need flour" />}
            </Card>
          ))}
      </Sect>
    </>
  );
}

function DesktopBuildings({ gs, pm, btnG }) {
  return (
    <>
      <Sect title={`🌾 Farms (${gs.farms.length})`}>
        {gs.farms.length === 0 ? <Em text="Buy a farm to start producing cotton!" /> :
          gs.farms.map((f, i) => (
            <Card key={f.id} label={`Farm #${i + 1}`} color="#4ade80">
              <PBar current={f.currentProduction} max={5000 / pm} color="#4ade80" />
              <button onClick={() => useGameStore.getState().harvestFarm(f.id)} disabled={!f.isReady} style={btnG(f.isReady)}>
                {f.isReady ? '🌾 Harvest Cotton ($1 cost)' : `Growing... ${(f.currentProduction / 1000).toFixed(1)}/${(5000 / pm / 1000).toFixed(1)}s`}
              </button>
            </Card>
          ))}
      </Sect>
      <Sect title={`📦 Warehouses (${gs.warehouses.length})`}>
        {gs.warehouses.length === 0 ? <Em text="Warehouses convert cotton → cloth" /> :
          gs.warehouses.map((w, i) => (
            <Card key={w.id} label={`Warehouse #${i + 1}`} color="#f59e0b">
              <div style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0' }}>Storage: <b style={{ color: '#fbbf24' }}>{w.storageAmount}</b> cotton</div>
              {w.storageAmount === 0 && gs.cotton >= 1 ? (
                <button onClick={() => useGameStore.getState().sendCottonToWarehouse(w.id, 1)} style={btnG(true)}>📥 Load 1 Cotton ($2 cost)</button>
              ) : w.storageAmount > 0 ? (
                <>
                  <PBar current={w.currentProduction} max={8000 / pm} color="#f59e0b" />
                  <button onClick={() => useGameStore.getState().harvestWarehouse(w.id)} disabled={!w.isReady} style={btnG(w.isReady)}>
                    {w.isReady ? `🧵 Convert → ${Math.floor(w.storageAmount * 0.8)} Cloth` : `Processing... ${(w.currentProduction / 1000).toFixed(1)}/${(8000 / pm / 1000).toFixed(1)}s`}
                  </button>
                </>
              ) : <Em text="Need cotton to load" />}
            </Card>
          ))}
      </Sect>
      <Sect title={`🏢 Factories (${gs.factories.length})`}>
        {gs.factories.length === 0 ? <Em text="Factories convert cloth → textiles" /> :
          gs.factories.map((f, i) => (
            <Card key={f.id} label={`Factory #${i + 1}`} color="#60a5fa">
              <div style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0' }}>Cloth loaded: <b style={{ color: '#60a5fa' }}>{f.clothInput}</b>/2</div>
              {f.clothInput < 2 && gs.cloth >= 1 ? (
                <button onClick={() => useGameStore.getState().sendClothToFactory(f.id, 1)} style={btnG(true)}>📥 Load 1 Cloth ($5 cost)</button>
              ) : f.clothInput >= 2 ? (
                <>
                  <PBar current={f.currentProduction} max={10000 / pm} color="#60a5fa" />
                  <button onClick={() => useGameStore.getState().harvestFactory(f.id)} disabled={!f.isReady} style={btnG(f.isReady)}>
                    {f.isReady ? '👕 Produce Textile ($5 cost)' : `Manufacturing... ${(f.currentProduction / 1000).toFixed(1)}/${(10000 / pm / 1000).toFixed(1)}s`}
                  </button>
                </>
              ) : <Em text="Need cloth to load" />}
            </Card>
          ))}
      </Sect>

      <div style={{ fontSize: 11, fontWeight: 700, color: '#a3e635', marginTop: 10, marginBottom: 4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>🍞 FOOD CHAIN</div>
      <Sect title={`🌾 Grain Farms (${gs.grainFarms.length})`}>
        {gs.grainFarms.length === 0 ? <Em text="Grain farms produce wheat" /> :
          gs.grainFarms.map((f, i) => (
            <Card key={f.id} label={`Grain Farm #${i + 1}`} color="#a3e635">
              <PBar current={f.currentProduction} max={6000 / pm} color="#a3e635" />
              <button onClick={() => useGameStore.getState().harvestGrainFarm(f.id)} disabled={!f.isReady} style={btnG(f.isReady)}>
                {f.isReady ? '🌾 Harvest Wheat ($1 cost)' : `Growing... ${(f.currentProduction / 1000).toFixed(1)}/${(6000 / pm / 1000).toFixed(1)}s`}
              </button>
            </Card>
          ))}
      </Sect>
      <Sect title={`⚙️ Mills (${gs.mills.length})`}>
        {gs.mills.length === 0 ? <Em text="Mills convert wheat → flour" /> :
          gs.mills.map((m, i) => (
            <Card key={m.id} label={`Mill #${i + 1}`} color="#fcd34d">
              <div style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0' }}>Wheat stored: <b style={{ color: '#a3e635' }}>{m.storageAmount}</b></div>
              {m.storageAmount === 0 && gs.wheat >= 1 ? (
                <button onClick={() => useGameStore.getState().sendWheatToMill(m.id, 1)} style={btnG(true)}>📥 Load 1 Wheat ($3 cost)</button>
              ) : m.storageAmount > 0 ? (
                <>
                  <PBar current={m.currentProduction} max={7000 / pm} color="#fcd34d" />
                  <button onClick={() => useGameStore.getState().harvestMill(m.id)} disabled={!m.isReady} style={btnG(m.isReady)}>
                    {m.isReady ? `🫘 Grind → ${Math.floor(m.storageAmount * 0.75)} Flour` : `Grinding... ${(m.currentProduction / 1000).toFixed(1)}/${(7000 / pm / 1000).toFixed(1)}s`}
                  </button>
                </>
              ) : <Em text="Need wheat to load" />}
            </Card>
          ))}
      </Sect>
      <Sect title={`🍞 Bakeries (${gs.bakeries.length})`}>
        {gs.bakeries.length === 0 ? <Em text="Bakeries convert flour → bread" /> :
          gs.bakeries.map((b, i) => (
            <Card key={b.id} label={`Bakery #${i + 1}`} color="#fb923c">
              <div style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0' }}>Flour loaded: <b style={{ color: '#fcd34d' }}>{b.flourInput}</b>/3</div>
              {b.flourInput < 3 && gs.flour >= 1 ? (
                <button onClick={() => useGameStore.getState().sendFlourToBakery(b.id, 1)} style={btnG(true)}>📥 Load 1 Flour ($6 cost)</button>
              ) : b.flourInput >= 3 ? (
                <>
                  <PBar current={b.currentProduction} max={12000 / pm} color="#fb923c" />
                  <button onClick={() => useGameStore.getState().harvestBakery(b.id)} disabled={!b.isReady} style={btnG(b.isReady)}>
                    {b.isReady ? '🍞 Bake Bread ($6 cost)' : `Baking... ${(b.currentProduction / 1000).toFixed(1)}/${(12000 / pm / 1000).toFixed(1)}s`}
                  </button>
                </>
              ) : <Em text="Need flour to load" />}
            </Card>
          ))}
      </Sect>
    </>
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
      display: 'grid',
      gridTemplateAreas: `". u ." "l c r" ". d ."`,
      gridTemplateColumns: `${size}px ${size}px ${size}px`,
      gridTemplateRows: `${size}px ${size}px ${size}px`,
      gap: 2,
    }} data-ui>
      <button {...ab('up')} style={{ ...s, gridArea: 'u' }}>▲</button>
      <button {...ab('left')} style={{ ...s, gridArea: 'l' }}>◀</button>
      <div style={{ ...s, gridArea: 'c', background: 'rgba(100,150,200,0.08)', color: '#475569', fontSize: size * 0.28 }}>⊕</div>
      <button {...ab('right')} style={{ ...s, gridArea: 'r' }}>▶</button>
      <button {...ab('down')} style={{ ...s, gridArea: 'd' }}>▼</button>
    </div>
  );
}
