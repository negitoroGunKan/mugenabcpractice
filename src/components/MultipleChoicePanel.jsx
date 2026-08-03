// MultipleChoicePanel.jsx

export default function MultipleChoicePanel({ choices, correctAnswer, onResult }) {
  const handleSelect = (choice) => {
    // プレフィックス(1)などを除去してクリーンに比較
    const cleanChoice = choice.replace(/^\(\d\)\s*/, '').trim().toLowerCase();
    const cleanAnswer = correctAnswer.replace(/^\(\d\)\s*/, '').trim().toLowerCase();
    
    const isCorrect = cleanChoice === cleanAnswer;
    onResult(isCorrect, isCorrect ? '〇' : '×');
  };

  return (
    <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.2rem',
        marginTop: '0.5rem'
      }}>
        {choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => handleSelect(choice)}
            className="btn animate-btn"
            style={{
              padding: '1.5rem 1rem',
              fontSize: '1.15rem',
              fontWeight: 'bold',
              minHeight: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 242, 254, 0.1), rgba(79, 172, 254, 0.1))';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 242, 254, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.borderColor = 'var(--glass-border)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            }}
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}
