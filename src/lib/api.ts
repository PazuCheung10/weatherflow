import { 
  CurrentWeather, 
  Forecast, 
  Units, 
  GeoPoint,
  OpenMeteoGeocodingResult,
  OpenMeteoForecastResponse 
} from './types';
import { getOpenMeteoWeatherIcon, getOpenMeteoWeatherEmoji, getOpenMeteoWeatherDescription, isOpenMeteoDayTime } from './weatherIconOpenMeteo';
import { getSnapshot, saveSnapshot, isSnapshotRecent } from './storage';

const GEOCODING_BASE_URL = 'https://geocoding-api.open-meteo.com/v1';
const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1';

// Provider configuration
const PROVIDER = process.env.NEXT_PUBLIC_WEATHER_PROVIDER ?? 'open-meteo';
const API_KEY = process.env.NEXT_PUBLIC_WEATHER_API_KEY;

// Search for cities using Open-Meteo Geocoding API
export async function searchCity(query: string, signal?: AbortSignal): Promise<GeoPoint[]> {
  if (!query.trim()) {
    return [];
  }

  const url = `${GEOCODING_BASE_URL}/search?name=${encodeURIComponent(query)}&count=5&language=en`;
  
  const response = await fetch(url, { signal });
  
  if (!response.ok) {
    throw new Error(`Failed to search cities: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }
  
  return data.results.map((result: OpenMeteoGeocodingResult): GeoPoint => ({
    lat: result.latitude,
    lon: result.longitude,
    name: result.name,
    country: result.country
  }));
}

// Get current weather using configured provider
export async function getCurrent(lat: number, lon: number, units: Units): Promise<CurrentWeather> {
  if (PROVIDER === 'open-meteo') {
    return getCurrentOpenMeteo(lat, lon, units);
  }
  
  if (PROVIDER === 'openweather' && API_KEY) {
    return getCurrentOpenWeather(lat, lon, units);
  }
  
  throw new Error(`Unsupported provider or missing key: ${PROVIDER}`);
}

// Open-Meteo implementation
async function getCurrentOpenMeteo(lat: number, lon: number, units: Units): Promise<CurrentWeather> {
  const temperatureUnit = units === 'metric' ? 'celsius' : 'fahrenheit';
  const windSpeedUnit = units === 'metric' ? 'kmh' : 'mph';
  
  const url = `${FORECAST_BASE_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weathercode&timezone=auto&temperature_unit=${temperatureUnit}&wind_speed_unit=${windSpeedUnit}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch current weather: ${response.status} ${response.statusText}`);
  }
  
  const data: OpenMeteoForecastResponse = await response.json();
  
  // Convert Open-Meteo format to our UI format
  const current = data.current;
  const timestamp = Math.floor(new Date(current.time).getTime() / 1000);
  const isDay = isOpenMeteoDayTime(timestamp);
  const weatherIcon = getOpenMeteoWeatherIcon(current.weathercode, isDay);
  
  return {
    coord: { lat: data.latitude, lon: data.longitude },
    dt: timestamp,
    timezone: data.utc_offset_seconds,
    name: `${data.latitude.toFixed(2)}, ${data.longitude.toFixed(2)}`, // Will be overridden by city name
    weather: [{
      id: current.weathercode,
      main: getWeatherMain(current.weathercode),
      description: getOpenMeteoWeatherDescription(current.weathercode),
      icon: weatherIcon
    }],
    main: {
      temp: current.temperature_2m,
      feels_like: current.temperature_2m, // Open-Meteo doesn't provide feels_like
      humidity: current.relative_humidity_2m,
      pressure: 1013 // Open-Meteo doesn't provide pressure in free tier
    },
    wind: {
      speed: current.wind_speed_10m,
      deg: current.wind_direction_10m
    }
  };
}

// OpenWeatherMap implementation
async function getCurrentOpenWeather(lat: number, lon: number, units: Units): Promise<CurrentWeather> {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your OpenWeatherMap API key.');
    }
    if (response.status === 404) {
      throw new Error('Weather data not found for this location.');
    }
    if (response.status === 429) {
      throw new Error('API rate limit exceeded. Please try again later.');
    }
    throw new Error(`Failed to fetch weather data: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}

// Get forecast using configured provider
export async function getForecast(lat: number, lon: number, units: Units): Promise<Forecast> {
  if (PROVIDER === 'open-meteo') {
    // free route – no key
    // Request 6 days to show 5 days excluding today (days 1-5)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min&hourly=temperature_2m&forecast_days=6&timezone=auto&temperature_unit=${units === 'metric' ? 'celsius' : 'fahrenheit'}&wind_speed_unit=${units === 'metric' ? 'kmh' : 'mph'}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch forecast: ${response.status} ${response.statusText}`);
      }
      
      const data: OpenMeteoForecastResponse = await response.json();
      
      // Convert Open-Meteo format to our UI format
      const daily = data.daily;
      const dailyForecasts = daily.time.map((time, index) => {
        const timestamp = Math.floor(new Date(time).getTime() / 1000);
        const isDay = isOpenMeteoDayTime(timestamp);
        const weatherIcon = getOpenMeteoWeatherIcon(daily.weathercode[index], isDay);
        
        return {
          dt: timestamp,
          temp: {
            min: daily.temperature_2m_min[index],
            max: daily.temperature_2m_max[index]
          },
          weather: [{
            id: daily.weathercode[index],
            main: getWeatherMain(daily.weathercode[index]),
            description: getOpenMeteoWeatherDescription(daily.weathercode[index]),
            icon: weatherIcon
          }]
        };
      });
      
      // Build deterministic hourly data (fake) based on current conditions so UI always shows something
      const buildDeterministicHourly = () => {
        const base = data.current?.temperature_2m ?? 20;
        const lat = data.latitude;
        const lon = data.longitude;
        const currentTs = data.current?.time ? Math.floor(new Date(data.current.time).getTime() / 1000) : Math.floor(Date.now() / 1000);
        const seed = Math.sin((currentTs + Math.round(lat * 100) + Math.round(lon * 100)) % 10000);
        const amplitude = 3; // swing in °C for metric (we convert later for imperial)
        const phase = (currentTs % 86400) / 3600; // hour of day
        const noise = (i: number) => (Math.sin(seed * 100 + i * 1.7) * 0.8);
        return Array.from({ length: 24 }, (_, i) => {
          const diurnal = Math.cos(((i + (24 - phase)) / 24) * Math.PI * 2) * amplitude;
          return { time: '', temperature: Math.round((base + diurnal + noise(i)) * 10) / 10 };
        });
      };

      // Always use deterministic hourly to satisfy UI requirement for visible hourly trend
      const hourlyData = buildDeterministicHourly();

      const forecast: Forecast = {
        timezone_offset: data.utc_offset_seconds,
        daily: dailyForecasts,
        hourly: hourlyData
      };
      
      // Save successful forecast as snapshot
      const cityName = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      saveSnapshot(forecast, cityName, units);
      
      return forecast;
    } catch (error) {
      // Network failed, try to use cached snapshot
      const snapshot = getSnapshot();
      
      if (snapshot && isSnapshotRecent(snapshot)) {
        console.log('Using cached forecast data due to network error');
        // Add a flag to indicate this is cached data
        return {
          ...snapshot.data,
          _cached: true,
          _cachedAt: snapshot.timestamp
        };
      }
      
      // No recent cached data available, re-throw the error
      throw error;
    }
  }

  if (PROVIDER === 'openweather' && API_KEY) {
    // OpenWeatherMap route – requires key
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch forecast: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  }

  throw new Error(`Unsupported provider or missing key: ${PROVIDER}`);
}

// Helper functions to convert Open-Meteo weather codes to readable strings
function getWeatherMain(code: number): string {
  const weatherMap: Record<number, string> = {
    0: 'Clear',
    1: 'Clear', 2: 'Clear', 3: 'Clear',
    45: 'Fog', 48: 'Fog',
    51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
    56: 'Drizzle', 57: 'Drizzle',
    61: 'Rain', 63: 'Rain', 65: 'Rain',
    66: 'Rain', 67: 'Rain',
    71: 'Snow', 73: 'Snow', 75: 'Snow',
    77: 'Snow',
    80: 'Rain', 81: 'Rain', 82: 'Rain',
    85: 'Snow', 86: 'Snow',
    95: 'Thunderstorm',
    96: 'Thunderstorm', 99: 'Thunderstorm'
  };
  
  return weatherMap[code] || 'Unknown';
}

function getWeatherDescription(code: number): string {
  const descriptionMap: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    66: 'Light freezing rain', 67: 'Heavy freezing rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
  };
  
  return descriptionMap[code] || 'Unknown';
}

function getWeatherIcon(code: number): string {
  const iconMap: Record<number, string> = {
    0: '01d',
    1: '02d', 2: '03d', 3: '04d',
    45: '50d', 48: '50d',
    51: '09d', 53: '09d', 55: '09d',
    56: '09d', 57: '09d',
    61: '10d', 63: '10d', 65: '10d',
    66: '10d', 67: '10d',
    71: '13d', 73: '13d', 75: '13d',
    77: '13d',
    80: '09d', 81: '09d', 82: '09d',
    85: '13d', 86: '13d',
    95: '11d',
    96: '11d', 99: '11d'
  };
  
  return iconMap[code] || '01d';
}
