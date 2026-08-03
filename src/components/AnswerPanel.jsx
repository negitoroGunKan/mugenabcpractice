import { useState, useEffect } from 'react';
import { generateChoices, getValidAnswers, getValidNextChars, parseAnswers } from '../utils/quizLogic';

export default function AnswerPanel({ primaryAnswer, altAnswer, onResult }) {
  const [currentInput, setCurrentInput] = useState('');
  const [validAnswers, setValidAnswers] = useState([]);
  const [choices, setChoices] = useState([]);
  const [timeLeft, setTimeLeft] = useState(3000); // 3 seconds in ms

  // 初回マウント時
  useEffect(() => {
    // 可能な解答リストを初期化（nullや空文字は除外）
    const parsedPrimary = parseAnswers(primaryAnswer);
    const parsedAlt = parseAnswers(altAnswer);
    const initialAnswers = Array.from(new Set([...parsedPrimary, ...parsedAlt]));
    
    setValidAnswers(initialAnswers);

    const nextChars = getValidNextChars('', initialAnswers);
    setChoices(generateChoices(nextChars, '', initialAnswers));
    setTimeLeft(3000);
  }, [primaryAnswer, altAnswer]);

  // タイマーのカウントダウン処理
  useEffect(() => {
    if (timeLeft <= 0) {
      onResult(false, '×');
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft(prev => Math.max(prev - 50, 0)); // 50msごとに減らす
    }, 50);

    return () => clearInterval(timerId);
  }, [timeLeft, onResult]);

  const handleChoiceClick = (char) => {
    const newInput = currentInput + char;
    
    // 正解パスが残っているか確認
    const newValidAnswers = getValidAnswers(newInput, validAnswers);
    
    if (newValidAnswers.length === 0) {
      // 不正解
      onResult(false, '×');
      return;
    }

    // 正解の文字を選んだ場合
    setCurrentInput(newInput);
    setValidAnswers(newValidAnswers);
    setTimeLeft(3000); // タイマーリセット

    // 全て答えきったか？
    if (newValidAnswers.some(ans => ans === newInput)) {
      onResult(true, '〇');
    } else {
      // 次の文字の選択肢を生成
      const nextChars = getValidNextChars(newInput, newValidAnswers);
      setChoices(generateChoices(nextChars, newInput, newValidAnswers));
    }
  };

  const progressPercentage = (timeLeft / 3000) * 100;
  
  // バーの色（残り時間で赤くする）
  const barColor = progressPercentage > 50 ? 'var(--accent)' : progressPercentage > 20 ? '#fbbf24' : 'var(--error)';

  return (
    <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0', minHeight: '3rem', letterSpacing: '0.2em' }}>
          {currentInput}<span style={{ opacity: 0.5 }}>_</span>
        </div>
      </div>

      {/* タイムプログレスバー */}
      <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '2rem', overflow: 'hidden' }}>
        <div 
          style={{ 
            width: `${progressPercentage}%`, 
            height: '100%', 
            background: barColor,
            transition: 'width 50ms linear, background-color 0.3s'
          }}
        />
      </div>

      {/* 選択肢ボタン */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {choices.map((char, i) => (
          <button 
            key={i} 
            className="btn" 
            style={{ fontSize: '1.5rem', padding: '1rem' }}
            onClick={() => handleChoiceClick(char)}
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
}
