/**
 * Local storage-based data store for diary entries
 * Acts as primary store with Supabase sync when configured
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { toUTC } from './dateUtils';

const STORAGE_KEY = 'bia-diary-entries';

function getLocalEntries() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function generateId() {
  return `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get all entries, optionally filtered by date range
 */
export async function getEntries({ startDate, endDate, userId } = {}) {
  let entries = [];

  if (isSupabaseConfigured() && userId) {
    try {
      let query = supabase
        .from('entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', toUTC(startDate));
      }
      if (endDate) {
        query = query.lte('created_at', toUTC(endDate));
      }

      const { data, error } = await query;
      if (error) throw error;
      entries = data || [];
    } catch (error) {
      console.error('Supabase fetch failed, using local:', error);
      entries = getLocalEntries();
    }
  } else {
    entries = getLocalEntries();
  }

  // Filter by date range locally
  if (startDate || endDate) {
    entries = entries.filter((entry) => {
      const entryDate = new Date(entry.created_at);
      if (startDate && entryDate < new Date(startDate)) return false;
      if (endDate && entryDate > new Date(endDate)) return false;
      return true;
    });
  }

  return entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Create a new entry
 */
export async function createEntry(entry, userId) {
  const newEntry = {
    id: generateId(),
    user_id: userId || 'local',
    title: entry.title || '',
    content: entry.content || '',
    translated_content: entry.translated_content || '',
    original_language: entry.original_language || 'pt-BR',
    mood: entry.mood || '😊',
    audio_url: entry.audio_url || null,
    stationery_url: entry.stationery_url || null,
    created_at: entry.created_at || toUTC(new Date()),
    updated_at: toUTC(new Date()),
  };

  if (isSupabaseConfigured() && userId && userId !== 'local') {
    try {
      const { data, error } = await supabase
        .from('entries')
        .insert([newEntry])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Supabase insert failed, saving locally:', error);
    }
  }

  // Save locally
  const entries = getLocalEntries();
  entries.unshift(newEntry);
  saveLocalEntries(entries);
  return newEntry;
}

/**
 * Update an existing entry
 */
export async function updateEntry(id, updates, userId) {
  const updatedData = {
    ...updates,
    updated_at: toUTC(new Date()),
  };

  if (isSupabaseConfigured() && userId && userId !== 'local') {
    try {
      const { data, error } = await supabase
        .from('entries')
        .update(updatedData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Supabase update failed, updating locally:', error);
    }
  }

  // Update locally
  const entries = getLocalEntries();
  const index = entries.findIndex((e) => e.id === id);
  if (index !== -1) {
    entries[index] = { ...entries[index], ...updatedData };
    saveLocalEntries(entries);
    return entries[index];
  }

  return null;
}

/**
 * Delete an entry
 */
export async function deleteEntry(id, userId) {
  if (isSupabaseConfigured() && userId && userId !== 'local') {
    try {
      const { error } = await supabase
        .from('entries')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase delete failed, deleting locally:', error);
    }
  }

  // Delete locally
  const entries = getLocalEntries();
  const filtered = entries.filter((e) => e.id !== id);
  saveLocalEntries(filtered);
  return true;
}

/**
 * Upload a custom stationery image to Supabase Storage
 */
export async function uploadStationery(imageFile, userId) {
  if (isSupabaseConfigured() && userId && userId !== 'local') {
    try {
      const ext = imageFile.name.split('.').pop() || 'png';
      const fileName = `${userId}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from('stationery')
        .upload(fileName, imageFile, { contentType: imageFile.type, upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('stationery')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Stationery upload failed:', error);
    }
  }

  // Fallback: base64 data URL (local/demo mode)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Upload audio to Supabase Storage or save as data URL
 */
export async function uploadAudio(audioBlob, userId) {
  if (isSupabaseConfigured() && userId && userId !== 'local') {
    try {
      const fileName = `${userId}/${Date.now()}.webm`;
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('audio')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Audio upload failed, saving as data URL:', error);
    }
  }

  // Fallback: save as base64 data URL (for local/demo mode)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(audioBlob);
  });
}
