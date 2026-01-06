'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SearchBar from '@/components/SearchBar';
import UnitToggle from '@/components/UnitToggle';
import CurrentCard from '@/components/CurrentCard';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingShimmer from '@/components/LoadingShimmer';
import { Units, GeoPoint, CurrentWeather, Forecast } from '@/lib/types';
import { getCurrent, getForecast } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { askLocation, getLocationErrorMessage, GeoLocationError } from '@/lib/geo';
import { addRecentSearch } from '@/lib/storage';
import { generateCityUrl } from '@/lib/cityUtils';
import ShareButton from '@/components/ShareButton';
import OfflineIndicator from '@/components/OfflineIndicator';
import FavoritesBar from '@/components/FavoritesBar';
import { useStrings } from '@/lib/LocaleContext';
import { convertCurrentWeather, convertForecast } from '@/lib/unitConversion';
import ThemeToggle from '@/components/ThemeToggle';
import dynamic from 'next/dynamic';

// Lazy-load MapPanel to protect initial bundle
const MapPanel = dynamic(() => import('@/components/MapPanel'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-slate-800/50 rounded-lg border border-slate-700/30 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400 border-t-transparent mx-auto mb-2"></div>
        <p className="text-slate-400 text-sm">Loading map...</p>
      </div>
    </div>
  )
});

// Lazy-load ForecastList for better code splitting
const ForecastList = dynamic(() => import('@/components/ForecastList'), {
  ssr: false,
  loading: () => (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-200 mb-4">5-Day Forecast</h3>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-slate-700/30">
          <div className="animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-slate-700 rounded w-16 mb-2"></div>
                <div className="h-3 bg-slate-700 rounded w-24"></div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-4 bg-slate-700 rounded w-8"></div>
                <div className="h-4 bg-slate-700 rounded w-8"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
});

type AppState = 'empty' | 'loading' | 'error' | 'success';

export default function Home() {
  const strings = useStrings();
  const [selectedCity, setSelectedCity] = useState<GeoPoint | null>(null);
  const [units, setUnits] = useState<Units>('metric');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [originalCurrentWeather, setOriginalCurrentWeather] = useState<CurrentWeather | null>(null);
  const [originalForecast, setOriginalForecast] = useState<Forecast | null>(null);
  const [originalUnits, setOriginalUnits] = useState<Units>('metric');
  const queryClient = useQueryClient();

  // Fetch current weather when city is selected (always in metric for consistency)
  const { 
    data: currentWeather, 
    isLoading: isLoadingWeather, 
    error: weatherError 
  } = useQuery({
    queryKey: selectedCity ? queryKeys.current(selectedCity.lat, selectedCity.lon, 'metric') : ['no-query'],
    queryFn: async () => {
      if (!selectedCity) return null;
      // Only fetch on client side
      if (typeof window === 'undefined') return null;
      return getCurrent(selectedCity.lat, selectedCity.lon, 'metric');
    },
    enabled: !!selectedCity && typeof window !== 'undefined',
    staleTime: 8 * 60 * 1000, // 8 minutes - current weather changes more frequently
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (error && 'status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 1; // Only retry once for other errors
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Fetch forecast when city is selected (always in metric for consistency)
  const { 
    data: forecastData, 
    isLoading: isLoadingForecast, 
    error: forecastError 
  } = useQuery({
    queryKey: selectedCity ? queryKeys.forecast(selectedCity.lat, selectedCity.lon, 'metric') : ['no-forecast-query'],
    queryFn: async () => {
      if (!selectedCity) return null;
      // Only fetch on client side
      if (typeof window === 'undefined') return null;
      return getForecast(selectedCity.lat, selectedCity.lon, 'metric');
    },
    enabled: !!selectedCity && typeof window !== 'undefined',
    staleTime: 30 * 60 * 1000, // 30 minutes - forecast changes less frequently
    gcTime: 60 * 60 * 1000, // 1 hour garbage collection
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (error && 'status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 1; // Only retry once for other errors
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Store original data when it's first fetched (always in metric)
  useEffect(() => {
    if (currentWeather && !originalCurrentWeather) {
      setOriginalCurrentWeather(currentWeather);
      setOriginalUnits('metric'); // Always metric since we fetch in metric
    }
  }, [currentWeather, originalCurrentWeather]);

  useEffect(() => {
    if (forecastData && !originalForecast) {
      setOriginalForecast(forecastData);
    }
  }, [forecastData, originalForecast]);

  // Convert data based on current units (always from metric)
  const convertedCurrentWeather = useMemo(() => {
    if (!originalCurrentWeather) return currentWeather;
    if (units === 'metric') return originalCurrentWeather;
    return convertCurrentWeather(originalCurrentWeather, 'metric', units);
  }, [originalCurrentWeather, units, currentWeather]);

  const convertedForecastData = useMemo(() => {
    if (!originalForecast) return forecastData;
    if (units === 'metric') return originalForecast;
    return convertForecast(originalForecast, 'metric', units);
  }, [originalForecast, units, forecastData]);

  // Get forecast data from API - memoized to prevent unnecessary re-renders
  const forecasts = useMemo(() => convertedForecastData?.daily || [], [convertedForecastData?.daily]);

  const handleCitySelect = useCallback((city: GeoPoint) => {
    setSelectedCity(city);
    setSearchQuery(city.name || '');
    setLocationError(null);
    // Reset original data when selecting a new city
    setOriginalCurrentWeather(null);
    setOriginalForecast(null);
    if (city.name) {
      addRecentSearch(city);
    }
  }, []);

  const handleUseLocation = async () => {
    setIsRequestingLocation(true);
    setLocationError(null);
    
    try {
      const location = await askLocation();
      const locationCity: GeoPoint = {
        lat: location.lat,
        lon: location.lon,
        name: location.name || 'Current Location',
        country: location.country
      };
      
      setSelectedCity(locationCity);
      setSearchQuery(locationCity.name || 'Current Location');
      addRecentSearch(locationCity);
    } catch (error) {
      const geoError = error as GeoLocationError;
      setLocationError(getLocationErrorMessage(geoError));
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const handleUnitsChange = useCallback((newUnits: Units) => {
    setUnits(newUnits);
    // No need to refetch - we'll convert the existing data client-side
  }, []);

  const handleRetry = useCallback(() => {
    if (selectedCity) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.current(selectedCity.lat, selectedCity.lon, units)
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.forecast(selectedCity.lat, selectedCity.lon, units)
      });
    }
  }, [selectedCity, units, queryClient]);

  const handleNavigateToCity = useCallback(() => {
    if (selectedCity) {
      const cityUrl = generateCityUrl(selectedCity, units);
      window.location.href = cityUrl;
    }
  }, [selectedCity, units]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSelectedCity(null);
    // Focus search input after clearing
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const input = document.querySelector('input[type="text"]') as HTMLInputElement | null;
        input?.focus();
      }, 100);
    }
  }, []);

  return (
    <main className="min-h-screen" role="main">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <h1 className="text-2xl font-bold text-cyan-300">WeatherFlow</h1>
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <SearchBar onCitySelect={handleCitySelect} />
              <UnitToggle onChange={handleUnitsChange} />
            </div>
          </div>
          
          {/* Location Button and Error */}
          <div className="mt-4 flex flex-col items-center space-y-2">
            <button
              onClick={handleUseLocation}
              disabled={isRequestingLocation}
              className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 text-white rounded-lg transition-all duration-200 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 hover:shadow-lg hover:scale-105 active:scale-95"
              aria-label={isRequestingLocation ? "Getting your current location" : "Use your current location for weather"}
            >
              {isRequestingLocation ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" aria-hidden="true"></div>
                  <span>Getting location...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{strings.useMyLocation}</span>
                </>
              )}
            </button>
            
            {locationError && (
              <div 
                className="text-sm text-red-400 text-center max-w-md p-3 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm"
                role="alert"
                aria-live="polite"
              >
                {locationError}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Favorites Bar */}
      <div className="container mx-auto px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <FavoritesBar onCitySelect={handleCitySelect} />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Empty State - only show when no city is selected */}
          {!selectedCity && (
            <EmptyState 
              action={{
                label: strings.searchForCity,
                onClick: () => {
                  if (typeof window !== 'undefined') {
                    document.querySelector('input')?.focus();
                  }
                }
              }}
            />
          )}

          {/* Loading State - only show when city is selected and we don't have data yet */}
          {selectedCity && !originalCurrentWeather && (isLoadingWeather || isLoadingForecast) && (
            <LoadingShimmer 
              type="full" 
              message={strings.loadingWeather}
            />
          )}

          {/* Error State - only show when city is selected and there's an error */}
          {selectedCity && (weatherError || forecastError) && !isLoadingWeather && !isLoadingForecast && (
            <ErrorState 
              title={strings.errorTitle}
              message={
                weatherError instanceof Error ? weatherError.message :
                forecastError instanceof Error ? forecastError.message :
                strings.errorMessage
              }
              onRetry={handleRetry}
              autoFocus={true}
            />
          )}

          {/* Weather Content - only show when city is selected and data is loaded */}
          {selectedCity && originalCurrentWeather && !isLoadingWeather && !isLoadingForecast && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-200">
                  Weather for {selectedCity.name}
                </h2>
                <div className="flex items-center space-x-3">
                  <ShareButton city={selectedCity} units={units} />
                  <button
                    onClick={handleNavigateToCity}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 hover:shadow-lg hover:scale-105 active:scale-95"
                    aria-label={`View detailed weather page for ${selectedCity.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span>{strings.viewPage}</span>
                  </button>
                  <button
                    onClick={handleClearSearch}
                    className="text-slate-400 hover:text-slate-300 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-2 py-1"
                    aria-label={strings.clearSearchAndReturn}
                  >
                    {strings.clearSearch}
                  </button>
                </div>
              </div>
              
              <CurrentCard 
                weather={convertedCurrentWeather || undefined}
                location={selectedCity}
                units={units}
                hourlyData={convertedForecastData?.hourly}
              />
              
              {/* Map Toggle and Panel */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowMap(!showMap)}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 hover:shadow-lg hover:scale-105 active:scale-95"
                  aria-label={showMap ? strings.hideMapView : strings.showMapView}
                  aria-expanded={showMap}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>{showMap ? strings.hideMap : strings.showMap}</span>
                </button>
                
                {showMap && (
                  <MapPanel
                    city={selectedCity}
                    currentWeather={convertedCurrentWeather || null}
                    units={units}
                    isVisible={showMap}
                  />
                )}
              </div>
              
              {/* Offline indicator for cached data */}
              {forecastData && forecastData._cached && forecastData._cachedAt && (
                <OfflineIndicator 
                  timestamp={forecastData._cachedAt}
                  className="mb-4"
                />
              )}
              
              <ForecastList 
                forecasts={forecasts}
                units={units}
                isLoading={isLoadingForecast}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
