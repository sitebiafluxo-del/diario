import { useState } from 'react';

const MOODS = [
  { emoji: '😊', label: 'Feliz' },
  { emoji: '😢', label: 'Triste' },
  { emoji: '😡', label: 'Irritado' },
  { emoji: '😴', label: 'Cansado' },
  { emoji: '❤️', label: 'Amando' },
  { emoji: '😰', label: 'Ansioso' },
  { emoji: '🤔', label: 'Pensativo' },
  { emoji: '🥳', label: 'Festivo' },
  { emoji: '😌', label: 'Tranquilo' },
  { emoji: '🤩', label: 'Empolgado' },
];

export default function MoodSelector({ value, onChange }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedMood = MOODS.find((m) => m.emoji === value) || MOODS[0];

  return (
    <div className="mood-selector">
      <button
        id="mood-toggle"
        className="mood-selected"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span className="mood-emoji-large">{selectedMood.emoji}</span>
        <span className="mood-label">{selectedMood.label}</span>
      </button>

      {isExpanded && (
        <div className="mood-grid">
          {MOODS.map((mood) => (
            <button
              key={mood.emoji}
              className={`mood-option ${value === mood.emoji ? 'selected' : ''}`}
              onClick={() => {
                onChange(mood.emoji);
                setIsExpanded(false);
              }}
              type="button"
              aria-label={mood.label}
            >
              <span className="mood-emoji">{mood.emoji}</span>
              <span className="mood-name">{mood.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { MOODS };
