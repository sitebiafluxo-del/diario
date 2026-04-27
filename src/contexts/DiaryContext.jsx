import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getEntries, createEntry, updateEntry, deleteEntry, uploadAudio, uploadStationery } from '../lib/store';
import { useAuth } from './AuthContext';
import { nowInBrazil, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, toUTC } from '../lib/dateUtils';

const DiaryContext = createContext(null);

export function DiaryProvider({ children }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(nowInBrazil());
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'month' | 'year'

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      let startDate, endDate;

      switch (viewMode) {
        case 'day':
          startDate = startOfDay(currentDate);
          endDate = endOfDay(currentDate);
          break;
        case 'month':
          startDate = startOfMonth(currentDate);
          endDate = endOfMonth(currentDate);
          break;
        case 'year':
          startDate = startOfYear(currentDate);
          endDate = endOfYear(currentDate);
          break;
      }

      const data = await getEntries({
        startDate: toUTC(startDate),
        endDate: toUTC(endDate),
        userId: user.id,
      });

      setEntries(data);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentDate, viewMode]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = useCallback(
    async (entryData) => {
      if (!user) return null;
      try {
        const entry = await createEntry(entryData, user.id);
        await fetchEntries();
        return entry;
      } catch (error) {
        console.error('Failed to create entry:', error);
        return null;
      }
    },
    [user, fetchEntries]
  );

  const editEntry = useCallback(
    async (id, updates) => {
      if (!user) return null;
      try {
        const entry = await updateEntry(id, updates, user.id);
        await fetchEntries();
        return entry;
      } catch (error) {
        console.error('Failed to update entry:', error);
        return null;
      }
    },
    [user, fetchEntries]
  );

  const removeEntry = useCallback(
    async (id) => {
      if (!user) return false;
      try {
        await deleteEntry(id, user.id);
        await fetchEntries();
        return true;
      } catch (error) {
        console.error('Failed to delete entry:', error);
        return false;
      }
    },
    [user, fetchEntries]
  );

  const saveAudio = useCallback(
    async (audioBlob) => {
      if (!user) return null;
      try {
        return await uploadAudio(audioBlob, user.id);
      } catch (error) {
        console.error('Failed to save audio:', error);
        return null;
      }
    },
    [user]
  );

  const saveStationery = useCallback(
    async (imageFile) => {
      if (!user) return null;
      try {
        return await uploadStationery(imageFile, user.id);
      } catch (error) {
        console.error('Failed to save stationery:', error);
        return null;
      }
    },
    [user]
  );

  return (
    <DiaryContext.Provider
      value={{
        entries,
        loading,
        currentDate,
        setCurrentDate,
        viewMode,
        setViewMode,
        addEntry,
        editEntry,
        removeEntry,
        saveAudio,
        saveStationery,
        refreshEntries: fetchEntries,
      }}
    >
      {children}
    </DiaryContext.Provider>
  );
}

export function useDiary() {
  const context = useContext(DiaryContext);
  if (!context) {
    throw new Error('useDiary must be used within DiaryProvider');
  }
  return context;
}
