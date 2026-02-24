import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { useWorldStore } from '../store/worldStore';
import { GameRenderer } from '../lib/three-renderer';

export default function Game3D({ onBack }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  // Subscribe to gameStore changes
  const [gs, setGs] = useState(useGameStore.getState());
  useEffect(() => {
    const unsub = useGameStore.subscribe((state) => setGs(state));
    return () => unsub();
  }, []);

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [showPrestige, setShowPrestige] = useState(false);
  const [toast, setToast] = useState(null);
  const [prevPrices, setPrevPrices] = useState({ ...gs.marketPrices });

  // ─── Init renderer + render loop ───
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Check if there's a custom world to load
    const worldObjects = useWorldStore.getState().objects;
    const hasCustomWorld = worldObjects && worldObjects.length > 0;

    // If custom world exists, skip default generation — we'll load manually
    rendererRef.current = new GameRenderer(canvas, useGameStore, {
      skipWorldGen: hasCustomWorld,
    });

    // Once models are ready, load the custom world
    if (hasCustomWorld) {
      const waitForModels = setInterval(() => {
        if (rendererRef.current?.modelsReady) {
          clearInterval(waitForModels);
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
    const interval = setInterval(() => {
      useGameStore.getState().tick(0.016);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  // ─── Track price changes ───
  useEffect(() => {
    setPrevPrices(prev => ({
      cotton: gs.marketPrices.cotton !== prev.cotton ? prev.cotton : prev.cotton,
      cloth: gs.marketPrices.cloth !== prev.cloth ? prev.cloth : prev.cloth,
      textiles: gs.marketPrices.textiles !== prev.textiles ? prev.textiles : prev.textiles,
    }));
  }, [gs.marketPrices.cotton, gs.marketPrices.cloth, gs.marketPrices.textiles]);

  // ─── Toast auto-hide ───
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ─── Sync gameStore buildings → 3D ───
  const renderedIds = useRef(new Set());
  useEffect(() => {
    if (!rendererRef.current) return;
    const all = [
      ...gs.farms.map(f => ({ ...f, type: 'FARM' })),
      ...gs.warehouses.map(w => ({ ...w, type: 'WAREHOUSE' })),
      ...gs.factories.map(f => ({ ...f, type: 'FACTORY' })),
    ];
    all.forEach(b => {
      const key = `${b.type}-${b.id}`;
      if (!renderedIds.current.has(key)) {
        rendererRef.current.createBuilding(b.type, b.position, b.id);
        renderedIds.current.add(key);
      }
    });
  }, [gs.farms, gs.warehouses, gs.factories]);

  // ─── Placement mode ───
  const startPlacement = (type) => {
    if (selectedBuilding === type) {
      cancelPlacement();
      return;
    }
    setSelectedBuilding(type);
    if (rendererRef.current) {
      // Clean up any previous preview
      if (rendererRef.current.previewBuilding) {
        rendererRef.current.scene.remove(rendererRef.current.previewBuilding);
      }
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

  // ─── Click to place building ───
  useEffect(() => {
    if (!selectedBuilding || !rendererRef.current) return;

    const handleClick = (e) => {
      if (!selectedBuilding || !rendererRef.current?.previewBuilding) return;
      // Don't place if clicking on UI
      if (e.target.closest('[data-ui]') || e.target.tagName === 'BUTTON') return;

      const pos = rendererRef.current.previewBuilding.position;
      const position = { x: pos.x, y: 0, z: pos.z };
      const state = useGameStore.getState();
      const cost = state.getBuildingCost(selectedBuilding);

      if (state.money < cost) {
        setToast(`Not enough money! Need $${cost}, have $${state.money.toFixed(0)}`);
        return;
      }

      let ok = false;
      if (selectedBuilding === 'FARM') ok = state.buyFarm(position);
      else if (selectedBuilding === 'WAREHOUSE') ok = state.buyWarehouse(position);
      else if (selectedBuilding === 'FACTORY') ok = state.buyFactory(position);

      if (ok) {
        setToast(`${selectedBuilding} placed! (-$${cost})`);
        cancelPlacement();
      } else {
        setToast('Failed to place building');
      }
    };

    // Use mouseup so it doesn't conflict with orbit controls drag
    document.addEventListener('mouseup', handleClick);
    return () => document.removeEventListener('mouseup', handleClick);
  }, [selectedBuilding]);

  // ─── ESC to cancel ───
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cancelPlacement(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── Helpers ───
  const priceArrow = (cur, prev) => {
    if (Math.abs(cur - prev) < 0.01) return '';
    return cur > prev ? ' ▲' : ' ▼';
  };
  const priceColor = (cur, prev) => {
    if (Math.abs(cur - prev) < 0.01) return '#94a3b8';
    return cur > prev ? '#4ade80' : '#f87171';
  };

  const pm = 1 + gs.prestigeLevel * 0.05; // prestige multiplier

  // ─── STYLES ───
  const panelStyle = {
    background: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid rgba(100, 150, 200, 0.4)',
    borderRadius: '10px',
    padding: '14px 16px',
    color: '#e2e8f0',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize: '13px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  };

  const btnBase = (enabled) => ({
    width: '100%',
    padding: '5px 8px',
    background: enabled ? 'rgba(74, 222, 128, 0.2)' : 'rgba(100,100,100,0.1)',
    border: enabled ? '1px solid rgba(74, 222, 128, 0.5)' : '1px solid rgba(100,100,100,0.2)',
    borderRadius: '5px',
    color: enabled ? '#4ade80' : '#64748b',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: '11px',
    fontWeight: 600,
    marginTop: '5px',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#0f172a' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)', color: '#fbbf24',
          padding: '10px 20px', borderRadius: '8px', zIndex: 200,
          border: '1px solid rgba(251, 191, 36, 0.4)',
          fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: '13px', fontWeight: 600,
        }} data-ui>
          {toast}
        </div>
      )}

      {/* ═══ TOP-LEFT: BACK + MONEY + INVENTORY ═══ */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, ...panelStyle, minWidth: 220 }} data-ui>
        {/* Back button */}
        {onBack && (
          <button onClick={onBack} style={{
            padding: '4px 10px', marginBottom: 8, width: '100%',
            background: 'rgba(100, 150, 200, 0.12)', border: '1px solid rgba(100, 150, 200, 0.3)',
            borderRadius: 5, color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'Segoe UI', Arial, sans-serif",
          }}>← Main Menu</button>
        )}
        {/* Money */}
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#4ade80', marginBottom: 10, letterSpacing: '-0.5px' }}>
          💰 ${gs.money.toFixed(0)}
        </div>

        {/* Resources */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
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
              <button onClick={r.sell} disabled={r.amount < 1} style={btnBase(r.amount >= 1)}>
                Sell All @ ${r.price.toFixed(2)}
              </button>
            </div>
          ))}
        </div>

        {/* Prestige info */}
        {gs.prestigeLevel > 0 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 4, fontSize: 11, color: '#fbbf24' }}>
            ⭐ Prestige Lv.{gs.prestigeLevel} — +{((pm - 1) * 100).toFixed(0)}% speed
          </div>
        )}
      </div>

      {/* ═══ LEFT: BUILDINGS PANEL ═══ */}
      <div style={{
        position: 'fixed', top: 16, left: 252, zIndex: 50, ...panelStyle,
        width: 280, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
      }} data-ui>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
          🏗️ Buildings ({gs.farms.length + gs.warehouses.length + gs.factories.length})
        </div>

        {/* FARMS */}
        <Section title={`🌾 Farms (${gs.farms.length})`}>
          {gs.farms.length === 0 ? <Empty text="Buy a farm to start producing cotton!" /> :
            gs.farms.map((farm, i) => (
              <BuildingCard key={farm.id} label={`Farm #${i + 1}`} color="#4ade80">
                <ProgressBar current={farm.currentProduction} max={5000 / pm} color="#4ade80" />
                <button onClick={() => useGameStore.getState().harvestFarm(farm.id)} disabled={!farm.isReady} style={btnBase(farm.isReady)}>
                  {farm.isReady ? '🌾 Harvest Cotton ($1 cost)' : `Growing... ${(farm.currentProduction / 1000).toFixed(1)}/${(5000 / pm / 1000).toFixed(1)}s`}
                </button>
              </BuildingCard>
            ))
          }
        </Section>

        {/* WAREHOUSES */}
        <Section title={`📦 Warehouses (${gs.warehouses.length})`}>
          {gs.warehouses.length === 0 ? <Empty text="Warehouses convert cotton → cloth" /> :
            gs.warehouses.map((wh, i) => (
              <BuildingCard key={wh.id} label={`Warehouse #${i + 1}`} color="#f59e0b">
                <div style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0' }}>Storage: <b style={{ color: '#fbbf24' }}>{wh.storageAmount}</b> cotton</div>
                {wh.storageAmount === 0 && gs.cotton >= 1 ? (
                  <button onClick={() => useGameStore.getState().sendCottonToWarehouse(wh.id, 1)} style={btnBase(true)}>
                    📥 Load 1 Cotton ($2 cost)
                  </button>
                ) : wh.storageAmount > 0 ? (
                  <>
                    <ProgressBar current={wh.currentProduction} max={8000 / pm} color="#f59e0b" />
                    <button onClick={() => useGameStore.getState().harvestWarehouse(wh.id)} disabled={!wh.isReady} style={btnBase(wh.isReady)}>
                      {wh.isReady ? `🧵 Convert → ${Math.floor(wh.storageAmount * 0.8)} Cloth` : `Processing... ${(wh.currentProduction / 1000).toFixed(1)}/${(8000 / pm / 1000).toFixed(1)}s`}
                    </button>
                  </>
                ) : gs.cotton < 1 ? (
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Need cotton to load</div>
                ) : null}
              </BuildingCard>
            ))
          }
        </Section>

        {/* FACTORIES */}
        <Section title={`🏢 Factories (${gs.factories.length})`}>
          {gs.factories.length === 0 ? <Empty text="Factories convert cloth → textiles" /> :
            gs.factories.map((fac, i) => (
              <BuildingCard key={fac.id} label={`Factory #${i + 1}`} color="#60a5fa">
                <div style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0' }}>Cloth loaded: <b style={{ color: '#60a5fa' }}>{fac.clothInput}</b>/2</div>
                {fac.clothInput < 2 && gs.cloth >= 1 ? (
                  <button onClick={() => useGameStore.getState().sendClothToFactory(fac.id, 1)} style={btnBase(true)}>
                    📥 Load 1 Cloth ($5 cost)
                  </button>
                ) : fac.clothInput >= 2 ? (
                  <>
                    <ProgressBar current={fac.currentProduction} max={10000 / pm} color="#60a5fa" />
                    <button onClick={() => useGameStore.getState().harvestFactory(fac.id)} disabled={!fac.isReady} style={btnBase(fac.isReady)}>
                      {fac.isReady ? '👕 Produce Textile ($5 cost)' : `Manufacturing... ${(fac.currentProduction / 1000).toFixed(1)}/${(10000 / pm / 1000).toFixed(1)}s`}
                    </button>
                  </>
                ) : gs.cloth < 1 ? (
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Need cloth to load</div>
                ) : null}
              </BuildingCard>
            ))
          }
        </Section>
      </div>

      {/* ═══ BOTTOM: BUILD BAR ═══ */}
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 10, zIndex: 50,
        ...panelStyle, padding: '10px 16px',
      }} data-ui>
        {[
          { type: 'FARM', icon: '🌾', cost: 50, label: 'Farm' },
          { type: 'WAREHOUSE', icon: '📦', cost: 100, label: 'Warehouse' },
          { type: 'FACTORY', icon: '🏢', cost: 200, label: 'Factory' },
        ].map(b => {
          const canAfford = gs.money >= b.cost;
          const isSelected = selectedBuilding === b.type;
          return (
            <button key={b.type} onClick={() => startPlacement(b.type)} disabled={!canAfford}
              style={{
                padding: '8px 14px',
                background: isSelected ? 'rgba(74, 222, 128, 0.25)' : canAfford ? 'rgba(100, 150, 200, 0.15)' : 'rgba(60,60,60,0.15)',
                border: isSelected ? '2px solid #4ade80' : canAfford ? '1px solid rgba(100, 150, 200, 0.4)' : '1px solid rgba(60,60,60,0.2)',
                borderRadius: 8,
                color: isSelected ? '#4ade80' : canAfford ? '#cbd5e1' : '#475569',
                fontWeight: 700, fontSize: 13,
                cursor: canAfford ? 'pointer' : 'not-allowed',
                fontFamily: "'Segoe UI', Arial, sans-serif",
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}>
              {b.icon} {b.label} (${b.cost})
            </button>
          );
        })}
      </div>

      {/* ═══ BOTTOM-RIGHT: PRESTIGE (above nav) ═══ */}
      <button onClick={() => setShowPrestige(true)} style={{
        position: 'fixed', bottom: 130, right: 16,
        padding: '10px 18px',
        background: 'rgba(251, 191, 36, 0.15)',
        border: '1px solid rgba(251, 191, 36, 0.5)',
        borderRadius: 8,
        color: '#fbbf24', fontWeight: 700, fontSize: 13,
        cursor: 'pointer', zIndex: 50,
        fontFamily: "'Segoe UI', Arial, sans-serif",
        transition: 'all 0.15s',
      }} data-ui>
        ⭐ Prestige (Lv.{gs.prestigeLevel})
      </button>

      {/* ═══ BOTTOM-RIGHT: NAVIGATION D-PAD ═══ */}
      <NavDPad rendererRef={rendererRef} />

      {/* ═══ PRESTIGE MODAL ═══ */}
      {showPrestige && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
        }} onClick={() => setShowPrestige(false)}>
          <div style={{
            ...panelStyle, maxWidth: 400, textAlign: 'center',
            border: '2px solid rgba(251, 191, 36, 0.6)', padding: '28px 32px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#fbbf24', marginBottom: 14 }}>
              ✨ Prestige Reset
            </div>
            <div style={{ lineHeight: 1.7, color: '#cbd5e1', marginBottom: 20, fontSize: 14 }}>
              <div>Level {gs.prestigeLevel} → <b style={{ color: '#fbbf24' }}>{gs.prestigeLevel + 1}</b></div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>✓ Reset resources & money to $100</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>✓ Keep all buildings</div>
              <div style={{ fontSize: 14, color: '#4ade80', fontWeight: 700, marginTop: 10 }}>
                ⚡ Production speed: {((pm + 0.05) * 100).toFixed(0)}% (+5%)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => { useGameStore.getState().prestige(); setShowPrestige(false); }} style={{
                padding: '10px 24px', background: 'rgba(251, 191, 36, 0.2)',
                border: '2px solid rgba(251, 191, 36, 0.6)', borderRadius: 8,
                color: '#fbbf24', fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>Prestige Now</button>
              <button onClick={() => setShowPrestige(false)} style={{
                padding: '10px 24px', background: 'rgba(100, 150, 200, 0.15)',
                border: '1px solid rgba(100, 150, 200, 0.4)', borderRadius: 8,
                color: '#60a5fa', fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PLACEMENT INDICATOR ═══ */}
      {selectedBuilding && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          ...panelStyle, border: '2px solid rgba(74, 222, 128, 0.7)',
          padding: '16px 24px', textAlign: 'center', zIndex: 100,
          animation: 'pulse 1.5s infinite',
        }} data-ui>
          <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 15 }}>
            🎯 Click on the ground to place {selectedBuilding}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Press ESC to cancel</div>
        </div>
      )}

      {/* ═══ HELP HINT (first time) ═══ */}
      {gs.farms.length === 0 && gs.warehouses.length === 0 && gs.factories.length === 0 && !selectedBuilding && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          ...panelStyle, border: '1px solid rgba(251, 191, 36, 0.4)',
          padding: '10px 20px', textAlign: 'center', zIndex: 40,
          color: '#fbbf24', fontSize: 13,
        }} data-ui>
          👆 Start by buying a Farm below — it produces cotton you can sell!
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

// ─── Sub-components ───

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontWeight: 600, fontSize: 12, padding: '6px 8px',
        background: 'rgba(100, 150, 200, 0.1)', borderRadius: 5, marginBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function BuildingCard({ label, color, children }) {
  return (
    <div style={{
      background: 'rgba(100, 150, 200, 0.08)', padding: '8px 10px',
      borderRadius: 6, marginBottom: 6, borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function ProgressBar({ current, max, color }) {
  const pct = Math.min(100, (current / max) * 100);
  return (
    <div style={{ background: 'rgba(100,100,100,0.2)', height: 5, borderRadius: 3, margin: '4px 0' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: color,
        borderRadius: 3, transition: 'width 0.1s',
      }} />
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', padding: '2px 4px' }}>{text}</div>;
}

function NavDPad({ rendererRef }) {
  const arrowBtn = (label, dir) => ({
    onMouseDown: () => rendererRef.current?.startPan(dir),
    onMouseUp: () => rendererRef.current?.stopPan(dir),
    onMouseLeave: () => rendererRef.current?.stopPan(dir),
    onTouchStart: (e) => { e.preventDefault(); rendererRef.current?.startPan(dir); },
    onTouchEnd: () => rendererRef.current?.stopPan(dir),
    style: {
      width: 36, height: 36,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(100, 150, 200, 0.2)',
      border: '1px solid rgba(100, 150, 200, 0.4)',
      borderRadius: 6,
      color: '#cbd5e1', fontSize: 16,
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background 0.1s',
    },
    'data-ui': true,
  });

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 50,
      display: 'grid',
      gridTemplateAreas: `". up ." "left center right" ". down ."`,
      gridTemplateColumns: '36px 36px 36px',
      gridTemplateRows: '36px 36px 36px',
      gap: 3,
    }} data-ui>
      <button {...arrowBtn('↑', 'up')} style={{ ...arrowBtn('↑', 'up').style, gridArea: 'up' }}>▲</button>
      <button {...arrowBtn('←', 'left')} style={{ ...arrowBtn('←', 'left').style, gridArea: 'left' }}>◀</button>
      <div style={{
        gridArea: 'center', width: 36, height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(100, 150, 200, 0.1)',
        borderRadius: 6,
        color: '#64748b', fontSize: 10,
      }}>⊕</div>
      <button {...arrowBtn('→', 'right')} style={{ ...arrowBtn('→', 'right').style, gridArea: 'right' }}>▶</button>
      <button {...arrowBtn('↓', 'down')} style={{ ...arrowBtn('↓', 'down').style, gridArea: 'down' }}>▼</button>
    </div>
  );
}
