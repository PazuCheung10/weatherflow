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
import { askLocation, getLocationErrorMessage, GeoLocationError, checkLocationPermission } from '@/lib/geo';
import { addRecentSearch, getLastGeo, setLastGeo } from '@/lib/storage';
import ShareButton from '@/components/ShareButton';
import OfflineIndicator from '@/components/OfflineIndicator';
import FavoritesBar from '@/components/FavoritesBar';
import FavoriteCitiesCards from '@/components/FavoriteCitiesCards';
import YourLocationCard from '@/components/YourLocationCard';
import { useStrings } from '@/lib/LocaleContext';
import { convertCurrentWeather, convertForecast } from '@/lib/unitConversion';
import ThemeToggle from '@/components/ThemeToggle';
import dynamic from 'next/dynamic';

// Lazy-load MapPanel to protect initial bundle
const MapPanel = dynamic(() => import('@/components/MapPanel'), { ssr: false, loading: () => null });

// Lazy-load ForecastList for better code splitting
const ForecastList = dynamic(() => import('@/components/ForecastList'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-6">5-Day Forecast</h3>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 shadow-sm">
          <div className="animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-5 bg-slate-300 dark:bg-slate-700 rounded w-20 mb-3"></div>
                <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-32"></div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-12"></div>
                <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-12"></div>
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
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [showMap, setShowMap] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [lastGeo, setLastGeoState] = useState<{ lat: number; lon: number; label: string; updatedAt: string } | null>(null);
  const [originalCurrentWeather, setOriginalCurrentWeather] = useState<CurrentWeather | null>(null);
  const [originalForecast, setOriginalForecast] = useState<Forecast | null>(null);
  const [originalUnits, setOriginalUnits] = useState<Units>('metric');
  const queryClient = useQueryClient();

  // Load last geolocation on mount
  useEffect(() => {
    const savedGeo = getLastGeo();
    if (savedGeo) {
      setLastGeoState(savedGeo);
    }

    // Check permission state on mount
    checkLocationPermission().then(setPermissionState);
  }, []);

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
    // Create a display name that includes country for better identification
    const displayName = city.country ? `${city.name}, ${city.country}` : city.name;
    setSearchQuery(displayName || '');
    setLocationError(null);
    // Reset original data when selecting a new city
    setOriginalCurrentWeather(null);
    setOriginalForecast(null);
    // Note: Recent search is handled by SearchBar component
  }, []);

  const handleUseLocation = async () => {
    setIsRequestingLocation(true);
    setLocationError(null);
    
    // Always try to request location - the browser will show prompt if possible
    // We can't force it to show, but we should always attempt
    try {
      const location = await askLocation();
      const locationCity: GeoPoint = {
        lat: location.lat,
        lon: location.lon,
        name: location.name || 'Current Location',
        country: location.country
      };
      
      // Save location for persistence
      const locationLabel = locationCity.country 
        ? `${locationCity.name}, ${locationCity.country}`
        : locationCity.name || 'Current Location';
      setLastGeo(location.lat, location.lon, locationLabel);
      setLastGeoState({
        lat: location.lat,
        lon: location.lon,
        label: locationLabel,
        updatedAt: new Date().toISOString(),
      });
      
      setSelectedCity(locationCity);
      setSearchQuery(locationCity.name || 'Current Location');
      if (locationCity.name) {
        addRecentSearch(locationCity);
      }
    } catch (error) {
      const geoError = error as GeoLocationError;
      
      // If permission was denied, the state is definitely "denied"
      if (geoError.type === 'permission_denied') {
        setPermissionState('denied');
      } else {
        // For other errors, check the actual permission state
        const currentState = await checkLocationPermission();
        setPermissionState(currentState);
      }
      
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

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSelectedCity(null);
    // Focus search input after clearing
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        document.querySelector('input')?.focus();
      }, 100);
    }
  }, []);

  const handleGoHome = useCallback(() => {
    setSearchQuery('');
    setSelectedCity(null);
    // Don't focus search input when clicking logo
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none" style={{ overflow: 'hidden', isolation: 'isolate' }}>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-400/20 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-400/10 dark:bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-500" style={{ transform: 'translate(-50%, -50%)' }}></div>
      </div>

      <main className="relative z-10 min-h-screen" role="main">
        {/* Modern Header - Safari-safe structure */}
        <header className="fixed md:sticky top-0 z-[9999] isolate site-header bg-transparent">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <div className="container mx-auto px-6 py-6">
            <div className="flex flex-col lg:flex-row items-center justify-between space-y-6 lg:space-y-0">
              {/* Logo */}
              <button
                onClick={handleGoHome}
                className="flex items-center space-x-4 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 rounded-lg p-2 -m-2"
                aria-label="Go back to main page"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                  WeatherFlow
                </h1>
              </button>
              
              {/* Search and Controls */}
              <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-4 w-full lg:w-auto">
                <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full lg:w-auto">
                  <div className="w-full sm:w-80">
                    <SearchBar onCitySelect={handleCitySelect} />
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleUseLocation}
                      disabled={isRequestingLocation}
                      className="group flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-cyan-400 disabled:to-blue-400 text-white font-medium rounded-2xl transition-all duration-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 hover:shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap"
                      aria-label={isRequestingLocation ? "Getting your current location" : "Use your current location for weather"}
                    >
                      {isRequestingLocation ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      <span className="font-medium text-sm">{strings.useMyLocation}</span>
                    </button>
                    <UnitToggle onChange={handleUnitsChange} />
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Location Error */}
            {locationError && (
              <div className="mt-4 flex justify-center">
                <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl text-red-700 dark:text-red-300 text-sm text-center max-w-md shadow-sm">
                  <p className="mb-2">{locationError}</p>
                  {locationError.includes('permission') && (
                    <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-500/30 text-xs">
                      <div className="space-y-2 text-left">
                        <p className="font-semibold mb-2">Location access was denied.</p>
                        <p className="font-semibold">To enable location access:</p>
                        <ol className="space-y-2 list-decimal list-inside opacity-90 ml-2">
                          <li>
                            <span className="font-medium">Try clicking "Use my location" again</span>
                            <br />
                            <span className="opacity-75">Some browsers may show the permission dialog again.</span>
                          </li>
                          <li>
                            <span className="font-medium">Or enable in browser settings:</span>
                            <ul className="mt-1 space-y-1 list-disc list-inside opacity-75 ml-4">
                              <li>Click the lock icon (🔒) or site info icon in your browser's address bar</li>
                              <li>Open "Site settings" or "Permissions"</li>
                              <li>Find "Location" and change from "Block" to "Allow"</li>
                              <li>Refresh this page and try again</li>
                            </ul>
                          </li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </header>

        {/* Favorites Bar - Only show when viewing a city */}
        {selectedCity && (
          <div className="container mx-auto px-6 pt-8 pb-3">
            <div className="max-w-6xl mx-auto">
              <FavoritesBar onCitySelect={handleCitySelect} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="container mx-auto px-6 pt-8 pb-12">
          <div className="max-w-6xl mx-auto">
            {/* Empty State - only show when no city is selected */}
            {!selectedCity && (
              <div className="space-y-8">
                {/* Your Location Card - show if saved */}
                {lastGeo && (
                  <YourLocationCard
                    lastGeo={lastGeo}
                    units={units}
                    onLocationSelect={(location) => {
                      handleCitySelect({
                        lat: location.lat,
                        lon: location.lon,
                        name: location.name,
                        country: location.country,
                      });
                    }}
                    onRefresh={(updatedGeo) => {
                      setLastGeoState(updatedGeo);
                    }}
                  />
                )}

                {/* Favorite Cities Weather Cards */}
                <FavoriteCitiesCards 
                  units={units} 
                  onCitySelect={handleCitySelect}
                  onFavoritesCountChange={setFavoritesCount}
                />
                
                {/* Empty State - hide if 3 or more favorites */}
                {favoritesCount < 3 && (
                  <div className="flex items-center justify-center min-h-[40vh]">
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
                  </div>
                )}
              </div>
            )}

            {/* Loading State - only show when city is selected and we don't have data yet */}
            {selectedCity && !originalCurrentWeather && (isLoadingWeather || isLoadingForecast) && (
              <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingShimmer 
                  type="full" 
                  message={strings.loadingWeather}
                />
              </div>
            )}

            {/* Error State - only show when city is selected and there's an error */}
            {selectedCity && (weatherError || forecastError) && !isLoadingWeather && !isLoadingForecast && (
              <div className="flex items-center justify-center min-h-[60vh]">
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
              </div>
            )}

            {/* Weather Content - only show when city is selected and data is loaded */}
            {selectedCity && originalCurrentWeather && !isLoadingWeather && !isLoadingForecast && (
              <div className="space-y-8">
                {/* City Header */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-4 mb-6">
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-cyan-200 bg-clip-text text-transparent">
                      {selectedCity?.name || 'Unknown City'}
                    </h2>
                    <div className="flex items-center space-x-3">
                      <ShareButton city={selectedCity} units={units} />
                      <button
                        onClick={handleClearSearch}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label={strings.clearSearchAndReturn}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Weather Cards Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  {/* Current Weather - Takes 2 columns on XL screens */}
                  <div className="xl:col-span-2 h-full">
                    <CurrentCard 
                      weather={convertedCurrentWeather || undefined}
                      location={selectedCity}
                      units={units}
                      hourlyData={convertedForecastData?.hourly}
                    />
                  </div>

                  {/* Map Panel - Takes 1 column on XL screens */}
                  <div className="space-y-6 h-full">
                    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-lg h-full flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Map View</h3>
                        <button
                          onClick={() => setShowMap(!showMap)}
                          className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900"
                          aria-label={showMap ? strings.hideMap : strings.showMap}
                        >
                          <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </button>
                      </div>
                      
                      {showMap ? (
                        <div className="relative flex-1 min-h-[16rem] rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                          {isMapLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                              <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400 border-t-transparent" />
                            </div>
                          )}
                          <MapPanel
                            city={selectedCity}
                            currentWeather={convertedCurrentWeather || null}
                            units={units}
                            isVisible={showMap}
                            onReady={() => setIsMapLoading(false)}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setIsMapLoading(true); setShowMap(true); }}
                          className="flex-1 min-h-[16rem] w-full rounded-2xl bg-slate-100/50 dark:bg-slate-700/50 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center hover:bg-slate-100/80 dark:hover:bg-slate-700/70 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900"
                          aria-label="Show map"
                        >
                          <span className="text-slate-600 dark:text-slate-300">Click to show map</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Forecast Section */}
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                  <ForecastList 
                    forecasts={forecasts} 
                    units={units}
                  />
                </div>

                {/* Offline indicator for cached data */}
                {forecastData && forecastData._cached && forecastData._cachedAt && (
                  <div className="mt-6">
                    <OfflineIndicator 
                      timestamp={forecastData._cachedAt}
                      className="mb-4"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
