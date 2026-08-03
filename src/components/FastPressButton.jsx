import React, { useEffect } from 'react';

export default function FastPressButton({ onFastPress }) {

  useEffect(() => {
    // 物理キーボードのスペースキーでも早押しできるようにする
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onFastPress();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFastPress]);

  return (
    <div className="flex-center" style={{ margin: '3rem 0' }}>
      <button className="fast-press-btn animate-fade-in-up" onClick={onFastPress}>
        押
      </button>
      <div style={{ position: 'absolute', marginTop: '180px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        スペースキーでも押せます
      </div>
    </div>
  );
}
