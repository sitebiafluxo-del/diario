import { useDiary } from '../contexts/DiaryContext';
import { formatDate, addDays, addMonths, addYears, nowInBrazil, isSameDay } from '../lib/dateUtils';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const VIEW_LABELS = {
  day: 'Dia',
  month: 'Mês',
  year: 'Ano',
};

export default function DateNavigator() {
  const { currentDate, setCurrentDate, viewMode, setViewMode } = useDiary();
  const [showCalendar, setShowCalendar] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const navRef = useRef(null);

  const isToday = isSameDay(currentDate, nowInBrazil());

  function navigate(direction) {
    const delta = direction === 'next' ? 1 : -1;
    switch (viewMode) {
      case 'day':
        setCurrentDate(addDays(currentDate, delta));
        break;
      case 'month':
        setCurrentDate(addMonths(currentDate, delta));
        break;
      case 'year':
        setCurrentDate(addYears(currentDate, delta));
        break;
    }
  }

  function getDateDisplay() {
    switch (viewMode) {
      case 'day':
        return formatDate(currentDate, 'full');
      case 'month':
        return formatDate(currentDate, 'monthYear');
      case 'year':
        return formatDate(currentDate, 'year');
    }
  }

  function goToToday() {
    setCurrentDate(nowInBrazil());
  }

  // Swipe handling
  const minSwipeDistance = 50;

  function onTouchStart(e) {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }

  function onTouchMove(e) {
    setTouchEnd(e.targetTouches[0].clientX);
  }

  function onTouchEnd() {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isSwipe = Math.abs(distance) > minSwipeDistance;

    if (isSwipe) {
      if (distance > 0) {
        navigate('next');
      } else {
        navigate('prev');
      }
    }
  }

  function handleCalendarChange(e) {
    setCurrentDate(new Date(e.target.value + 'T12:00:00'));
    setShowCalendar(false);
  }

  // Close calendar on outside click
  useEffect(() => {
    function handleClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div
      className="date-navigator"
      ref={navRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* View Mode Tabs */}
      <div className="view-mode-tabs">
        {Object.entries(VIEW_LABELS).map(([key, label]) => (
          <button
            key={key}
            id={`view-mode-${key}`}
            className={`view-tab ${viewMode === key ? 'active' : ''}`}
            onClick={() => setViewMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date Navigation */}
      <div className="date-nav-row">
        <button
          id="nav-prev"
          className="nav-arrow"
          onClick={() => navigate('prev')}
          aria-label="Anterior"
        >
          <ChevronLeft size={22} />
        </button>

        <button
          id="nav-date-display"
          className="date-display"
          onClick={() => setShowCalendar(!showCalendar)}
        >
          <span className="date-text">{getDateDisplay()}</span>
          <Calendar size={16} className="calendar-icon" />
        </button>

        <button
          id="nav-next"
          className="nav-arrow"
          onClick={() => navigate('next')}
          aria-label="Próximo"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Today button */}
      {!isToday && (
        <button id="go-to-today" className="today-button" onClick={goToToday}>
          Hoje
        </button>
      )}

      {/* Calendar Picker */}
      {showCalendar && (
        <div className="calendar-picker-overlay">
          <input
            type="date"
            className="calendar-picker-input"
            value={currentDate.toISOString().split('T')[0]}
            onChange={handleCalendarChange}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
