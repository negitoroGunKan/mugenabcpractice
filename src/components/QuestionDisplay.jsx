import React, { useState, useEffect } from 'react';

export default function QuestionDisplay({ 
  questionText, 
  isPlaying, 
  onComplete, 
  oshiji = null, 
  showOshiji = false, 
  playUpToOshiji = false,
  revealFull = false
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // 押し字までの制限値（playUpToOshijiが有効かつ押し字が設定されている場合のみ適用）
  const limit = (playUpToOshiji && oshiji !== null && oshiji >= 0)
    ? Math.min(questionText.length, oshiji)
    : questionText.length;

  useEffect(() => {
    // Reset when a new question arrives
    setDisplayedText('');
    setCurrentIndex(0);
  }, [questionText]);

  // 結果表示画面などで全文を開示する場合
  useEffect(() => {
    if (revealFull) {
      setDisplayedText(questionText);
      setCurrentIndex(questionText.length);
    }
  }, [revealFull, questionText]);

  useEffect(() => {
    if (!isPlaying) return;

    if (currentIndex < limit) {
      const timerId = setTimeout(() => {
        setDisplayedText(prev => prev + questionText[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 100); // 1文字0.1秒
      return () => clearTimeout(timerId);
    } else if (currentIndex === limit) {
      setCurrentIndex(prev => prev + 1); // 重複呼び出し防止
      if (onComplete) onComplete();
    }
  }, [isPlaying, currentIndex, questionText, limit, onComplete]);

  // 押し字以降を赤色にするレンダリング処理
  const renderText = () => {
    if (showOshiji && oshiji !== null && oshiji >= 0 && oshiji < questionText.length) {
      const normalPart = displayedText.slice(0, oshiji);
      const redPart = displayedText.slice(oshiji);
      return (
        <>
          {normalPart}
          <span style={{ color: 'var(--error)', textShadow: '0 0 8px rgba(239, 68, 68, 0.4)' }}>
            {redPart}
          </span>
        </>
      );
    }
    return displayedText;
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', minHeight: '150px', marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.5rem', lineHeight: '1.6', marginBottom: '1rem' }}>
        {renderText()}
        {isPlaying && currentIndex < limit && <span className="cursor" style={{ opacity: 0.5 }}>_</span>}
      </h2>
    </div>
  );
}
