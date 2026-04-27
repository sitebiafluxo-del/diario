import { useDiary } from '../contexts/DiaryContext';
import { formatDate, formatTime, isSameDay, isSameMonth } from '../lib/dateUtils';
import AudioPlayer from './AudioPlayer';
import { Mic, Clock, ChevronRight, BookOpen } from 'lucide-react';

export default function EntryList({ onEditEntry }) {
  const { entries, loading, viewMode, currentDate } = useDiary();

  if (loading) {
    return (
      <div className="entry-list-loading">
        <div className="loading-shimmer"></div>
        <div className="loading-shimmer"></div>
        <div className="loading-shimmer"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="entry-list-empty">
        <BookOpen size={48} strokeWidth={1} className="empty-icon" />
        <p className="empty-title">Nenhum registro ainda</p>
        <p className="empty-subtitle">
          Toque no <strong>+</strong> para começar a escrever ✍️
        </p>
      </div>
    );
  }

  // Group entries based on view mode
  if (viewMode === 'day') {
    return <DayView entries={entries} onEditEntry={onEditEntry} />;
  }

  if (viewMode === 'month') {
    return <MonthView entries={entries} onEditEntry={onEditEntry} currentDate={currentDate} />;
  }

  return <YearView entries={entries} onEditEntry={onEditEntry} currentDate={currentDate} />;
}

function DayView({ entries, onEditEntry }) {
  return (
    <div className="entry-list day-view">
      <div className="timeline">
        {entries.map((entry, index) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onClick={() => onEditEntry(entry)}
            showTime
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

function MonthView({ entries, onEditEntry, currentDate }) {
  // Group by day
  const grouped = {};
  entries.forEach((entry) => {
    const dayKey = formatDate(entry.created_at, 'dayMonth');
    if (!grouped[dayKey]) {
      grouped[dayKey] = [];
    }
    grouped[dayKey].push(entry);
  });

  return (
    <div className="entry-list month-view">
      {Object.entries(grouped).map(([day, dayEntries]) => (
        <div key={day} className="day-group">
          <div className="day-group-header">
            <span className="day-group-label">{day}</span>
            <span className="day-group-count">{dayEntries.length} registro{dayEntries.length > 1 ? 's' : ''}</span>
          </div>
          {dayEntries.map((entry, index) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onClick={() => onEditEntry(entry)}
              showTime
              compact
              index={index}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function YearView({ entries, onEditEntry, currentDate }) {
  // Group by month
  const grouped = {};
  entries.forEach((entry) => {
    const monthKey = formatDate(entry.created_at, 'monthYear');
    if (!grouped[monthKey]) {
      grouped[monthKey] = [];
    }
    grouped[monthKey].push(entry);
  });

  return (
    <div className="entry-list year-view">
      {Object.entries(grouped).map(([month, monthEntries]) => (
        <div key={month} className="month-group">
          <div className="month-group-header">
            <span className="month-group-label">{month}</span>
            <span className="month-group-count">{monthEntries.length} registro{monthEntries.length > 1 ? 's' : ''}</span>
          </div>
          {monthEntries.slice(0, 5).map((entry, index) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onClick={() => onEditEntry(entry)}
              compact
              index={index}
            />
          ))}
          {monthEntries.length > 5 && (
            <div className="month-group-more">
              + {monthEntries.length - 5} registros
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EntryCard({ entry, onClick, showTime = false, compact = false, index = 0 }) {
  const truncatedContent = entry.content
    ? entry.content.length > 120
      ? entry.content.substring(0, 120) + '...'
      : entry.content
    : '';

  return (
    <div
      className={`entry-card ${compact ? 'compact' : ''} animate-fade-in`}
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Timeline dot */}
      {showTime && !compact && (
        <div className="timeline-connector">
          <div className="timeline-dot"></div>
          <div className="timeline-line"></div>
        </div>
      )}

      <div className="entry-card-content">
        {/* Header */}
        <div className="entry-card-header">
          <span className="entry-mood">{entry.mood || '📝'}</span>
          {showTime && (
            <span className="entry-time">
              <Clock size={12} />
              {formatTime(entry.created_at)}
            </span>
          )}
          {entry.audio_url && (
            <span className="entry-audio-badge">
              <Mic size={12} />
            </span>
          )}
          <ChevronRight size={16} className="entry-chevron" />
        </div>

        {/* Title */}
        {entry.title && <h3 className="entry-title">{entry.title}</h3>}

        {/* Content preview */}
        {truncatedContent && (
          <p className="entry-preview">{truncatedContent}</p>
        )}

        {/* Audio mini player */}
        {entry.audio_url && !compact && (
          <div className="entry-mini-audio" onClick={(e) => e.stopPropagation()}>
            <AudioPlayer src={entry.audio_url} />
          </div>
        )}
      </div>
    </div>
  );
}
