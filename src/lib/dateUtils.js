/**
 * Date utilities for pt-BR / America/Sao_Paulo timezone
 */

const TIMEZONE = 'America/Sao_Paulo';
const LOCALE = 'pt-BR';

export function nowInBrazil() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: TIMEZONE })
  );
}

export function formatDate(date, format = 'full') {
  const d = new Date(date);
  const options = { timeZone: TIMEZONE };

  switch (format) {
    case 'full':
      return d.toLocaleDateString(LOCALE, {
        ...options,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'short':
      return d.toLocaleDateString(LOCALE, {
        ...options,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    case 'dayMonth':
      return d.toLocaleDateString(LOCALE, {
        ...options,
        day: 'numeric',
        month: 'short',
      });
    case 'monthYear':
      return d.toLocaleDateString(LOCALE, {
        ...options,
        month: 'long',
        year: 'numeric',
      });
    case 'year':
      return d.toLocaleDateString(LOCALE, {
        ...options,
        year: 'numeric',
      });
    case 'weekday':
      return d.toLocaleDateString(LOCALE, {
        ...options,
        weekday: 'long',
      });
    case 'dayName':
      return d.toLocaleDateString(LOCALE, {
        ...options,
        weekday: 'short',
        day: 'numeric',
      });
    default:
      return d.toLocaleDateString(LOCALE, options);
  }
}

export function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString(LOCALE, {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function toUTC(date) {
  return new Date(date).toISOString();
}

export function fromUTC(utcString) {
  return new Date(utcString);
}

export function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const opts = { timeZone: TIMEZONE };
  return (
    d1.toLocaleDateString('en-US', opts) ===
    d2.toLocaleDateString('en-US', opts)
  );
}

export function isSameMonth(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const opts = { timeZone: TIMEZONE };
  const fmt = { month: 'numeric', year: 'numeric' };
  return (
    d1.toLocaleDateString('en-US', { ...opts, ...fmt }) ===
    d2.toLocaleDateString('en-US', { ...opts, ...fmt })
  );
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfYear(date) {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfYear(date) {
  const d = new Date(date);
  d.setMonth(11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getDaysInMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function getDateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTimeString(date) {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
