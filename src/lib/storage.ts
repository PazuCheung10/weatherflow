/**
 * Local storage helpers for WeatherFlow
 */

import { GeoPoint } from './types';

export function getJSON<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function setJSON<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function removeKey(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // Silently fail if localStorage is not available
  }
}

// Recent searches helpers
export function getRecentSearches(): GeoPoint[] {
  try {
    if (typeof window === 'undefined') return [];
    const recent = getJSON<GeoPoint[]>('weatherflow:recent');
    return recent || [];
  } catch {
    return [];
  }
}

export function addRecentSearch(city: GeoPoint): void {
  try {
    if (typeof window === 'undefined') return;
    const recent = getRecentSearches();
    // Remove existing city if it exists (by lat/lon comparison)
    const filtered = recent.filter(existing => 
      existing.lat !== city.lat || existing.lon !== city.lon
    );
    // Add new city to the beginning
    const updated = [city, ...filtered];
    // Keep only the most recent cities
    const limited = updated.slice(0, 6);
    setJSON('weatherflow:recent', limited);
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function clearRecentSearches(): void {
  try {
    if (typeof window === 'undefined') return;
    removeKey('weatherflow:recent');
  } catch {
    // Silently fail if localStorage is not available
  }
}

function pushUnique<T>(array: T[], item: T, maxLength: number): T[] {
  // Remove existing item if it exists
  const filtered = array.filter(existing => existing !== item);
  // Add new item to the beginning
  const updated = [item, ...filtered];
  // Keep only the most recent items
  return updated.slice(0, maxLength);
}

// Forecast snapshot storage helpers
export interface ForecastSnapshot {
  data: any;
  timestamp: string;
  city: string;
  units: string;
}

export function saveSnapshot(data: any, city: string, units: string): void {
  try {
    if (typeof window === 'undefined') return;
    
    const snapshot: ForecastSnapshot = {
      data,
      timestamp: new Date().toISOString(),
      city,
      units
    };

    setJSON('weatherflow:forecast-snapshot', snapshot);
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function getSnapshot(): ForecastSnapshot | null {
  try {
    if (typeof window === 'undefined') return null;
    return getJSON<ForecastSnapshot>('weatherflow:forecast-snapshot');
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  try {
    if (typeof window === 'undefined') return;
    removeKey('weatherflow:forecast-snapshot');
  } catch {
    // Silently fail if localStorage is not available
  }
}

// Helper to check if snapshot is recent (less than 24 hours old)
export function isSnapshotRecent(snapshot: ForecastSnapshot): boolean {
  const snapshotTime = new Date(snapshot.timestamp).getTime();
  const now = new Date().getTime();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  return (now - snapshotTime) < twentyFourHours;
}

// Helper to format snapshot timestamp for display
export function formatSnapshotTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// Favorites functionality
export interface FavoriteCity {
  name: string;
  country: string;
  lat: number;
  lon: number;
  addedAt: string;
}

const FAVORITES_KEY = 'weatherflow:favorites';
const MAX_FAVORITES = 8;

export function getFavorites(): FavoriteCity[] {
  try {
    if (typeof window === 'undefined') return [];
    return getJSON(FAVORITES_KEY) || [];
  } catch {
    return [];
  }
}

export function addFavorite(city: { name: string; country: string; lat: number; lon: number }): boolean {
  try {
    if (typeof window === 'undefined') return false;
    
    const favorites = getFavorites();
    
    // Check if already exists
    const exists = favorites.some(fav => 
      fav.name === city.name && 
      fav.country === city.country &&
      Math.abs(fav.lat - city.lat) < 0.001 &&
      Math.abs(fav.lon - city.lon) < 0.001
    );
    
    if (exists) return false;
    
    // Add new favorite
    const newFavorite: FavoriteCity = {
      ...city,
      addedAt: new Date().toISOString()
    };
    
    const updatedFavorites = [newFavorite, ...favorites].slice(0, MAX_FAVORITES);
    setJSON(FAVORITES_KEY, updatedFavorites);
    return true;
  } catch {
    return false;
  }
}

export function removeFavorite(city: { name: string; country: string; lat: number; lon: number }): boolean {
  try {
    if (typeof window === 'undefined') return false;
    
    const favorites = getFavorites();
    const updatedFavorites = favorites.filter(fav => 
      !(fav.name === city.name && 
        fav.country === city.country &&
        Math.abs(fav.lat - city.lat) < 0.001 &&
        Math.abs(fav.lon - city.lon) < 0.001)
    );
    
    setJSON(FAVORITES_KEY, updatedFavorites);
    return true;
  } catch {
    return false;
  }
}

export function isFavorite(city: { name: string; country: string; lat: number; lon: number }): boolean {
  try {
    if (typeof window === 'undefined') return false;
    
    const favorites = getFavorites();
    return favorites.some(fav => 
      fav.name === city.name && 
      fav.country === city.country &&
      Math.abs(fav.lat - city.lat) < 0.001 &&
      Math.abs(fav.lon - city.lon) < 0.001
    );
  } catch {
    return false;
  }
}

export function clearFavorites(): void {
  try {
    if (typeof window === 'undefined') return;
    removeKey(FAVORITES_KEY);
  } catch {
    // Silently fail
  }
}

// Last geolocation storage
export interface LastGeo {
  lat: number;
  lon: number;
  label: string;
  updatedAt: string;
}

const LAST_GEO_KEY = 'weatherflow:lastGeo';

export function getLastGeo(): LastGeo | null {
  try {
    if (typeof window === 'undefined') return null;
    return getJSON<LastGeo>(LAST_GEO_KEY);
  } catch {
    return null;
  }
}

export function setLastGeo(lat: number, lon: number, label: string): void {
  try {
    if (typeof window === 'undefined') return;
    const lastGeo: LastGeo = {
      lat,
      lon,
      label,
      updatedAt: new Date().toISOString(),
    };
    setJSON(LAST_GEO_KEY, lastGeo);
  } catch {
    // Silently fail
  }
}

export function clearLastGeo(): void {
  try {
    if (typeof window === 'undefined') return;
    removeKey(LAST_GEO_KEY);
  } catch {
    // Silently fail
  }
}
