import React from 'react';
import { CROP_LIST } from '../data/crops';

export default function CropSelector({ farmId, onSelect, onCancel }) {
  const P = {
    background: 'rgba(15, 23, 42, 0.96)',
    border: '1px solid rgba(100, 150, 200, 0.4)',
    borderRadius: 12,
    color: '#e2e8f0',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
    }} onClick={onCancel}>
      <div style={{ ...P, padding: '20px 24px', maxWidth: 420, width: '90vw' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', marginBottom: 4, textAlign: 'center' }}>
          🌱 Choose Your Crop
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 14 }}>
          Each crop feeds a different supply chain. Choose wisely!
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {CROP_LIST.map(crop => (
            <button key={crop.id}
              onClick={() => onSelect(farmId, crop.id)}
              style={{
                padding: '10px 12px',
                background: 'rgba(100, 150, 200, 0.08)',
                border: '1px solid rgba(100, 150, 200, 0.25)',
                borderRadius: 8,
                color: '#e2e8f0',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = crop.color;
                e.currentTarget.style.background = `${crop.color}15`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(100, 150, 200, 0.25)';
                e.currentTarget.style.background = 'rgba(100, 150, 200, 0.08)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 22 }}>{crop.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: crop.color }}>{crop.name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{crop.growTime / 1000}s grow • ${crop.harvestCost} cost</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4, marginTop: 2 }}>
                {crop.description}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                💰 ${crop.priceRange.min.toFixed(2)}-${crop.priceRange.max.toFixed(2)}
              </div>
            </button>
          ))}
        </div>

        <button onClick={onCancel} style={{
          marginTop: 12, width: '100%', padding: '8px',
          background: 'rgba(248, 113, 113, 0.15)',
          border: '1px solid rgba(248, 113, 113, 0.3)',
          borderRadius: 6, color: '#f87171', fontWeight: 600, fontSize: 12,
          cursor: 'pointer',
        }}>
          ✕ Cancel (refund $50)
        </button>
      </div>
    </div>
  );
}
