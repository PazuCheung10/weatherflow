🌦️ WeatherFlow

WeatherFlow is a modern, frontend-heavy weather application built with Next.js (App Router), TypeScript, and Tailwind CSS.

It is designed as a systems-focused frontend project, emphasizing API abstraction, caching, offline resilience, accessibility, and performance — not just visuals.

Purpose: demonstrate how to build a real-world, user-facing app that remains fast, accessible, and reliable under UX and data complexity.

⸻

TL;DR

WeatherFlow showcases:
	•	Multi-provider weather architecture (Open-Meteo / OpenWeatherMap)
	•	Client-side caching & offline support
	•	Map + chart performance via dynamic imports
	•	Accessibility-first UX (keyboard, screen readers, reduced motion)
	•	PWA-ready design with service worker caching

This is not a toy UI demo — it’s a frontend systems project.

⸻

✨ Key Features

🌤 Weather & Forecasting
	•	Current weather conditions (temperature, humidity, wind, pressure)
	•	5-day forecast with daily highs/lows
	•	24-hour temperature chart with clear hour labels
	•	Dynamic weather icons with day/night variants
	•	Instant Celsius ↔ Fahrenheit conversion (client-side, no refetch)

🔍 Search & Discovery
	•	Debounced city search with live suggestions
	•	React Hook Form validation with accessible error feedback
	•	Recent searches with full geolocation persistence
	•	Keyboard navigation (↑ ↓ Enter Esc)
	•	Geolocation support with permission handling
	•	Persistent “Your Location” card after successful lookup

🗺 Maps & Interaction
	•	Interactive map with weather markers (Leaflet)
	•	Popup navigation to city detail views
	•	Shareable deep links (coordinates + unit preference)
	•	Clipboard sharing with graceful fallback

📦 Offline & PWA
	•	Cached weather data when offline
	•	Offline indicator for stale data
	•	Installable PWA (manifest + service worker)
	•	App-like mobile experience

♿ Accessibility & UX
	•	WCAG AA–compliant contrast and focus management
	•	Screen-reader friendly labels and announcements
	•	Full keyboard navigation across search and favorites
	•	Reduced-motion support (prefers-reduced-motion)
	•	Clean, distraction-free UI with subtle micro-animations

⚡ Performance
	•	TanStack Query with tuned cache/stale times
	•	Dynamic imports for maps and charts
	•	Code splitting for large client features
	•	Optimized bundle (~127 kB main chunk)

⸻

🛠 Tech Stack
	•	Framework: Next.js (App Router)
	•	Language: TypeScript
	•	Styling: Tailwind CSS (CSS variables for theming)
	•	Data Fetching: TanStack Query
	•	Maps: Leaflet + React-Leaflet
	•	Charts: Chart.js (dynamically imported)
	•	Animations: Framer Motion
	•	Forms: React Hook Form
	•	Testing: Vitest + React Testing Library
	•	PWA: Service Worker + Web App Manifest
	•	State: React Context (theme, units)
	•	Storage: LocalStorage (favorites, recents, preferences)

⸻

🚀 Getting Started

Prerequisites
	•	Node.js 18+
	•	npm or yarn

No API key required by default — WeatherFlow uses Open-Meteo, which is free and keyless.

Installation

git clone <repository-url>
cd weatherflow
npm install

Environment Setup

cp .env.example .env.local

Environment Variables

Variable	Required	Description
NEXT_PUBLIC_WEATHER_PROVIDER	No	open-meteo (default) or openweather
NEXT_PUBLIC_WEATHER_API_KEY	Only if OpenWeather	OpenWeatherMap API key
NEXT_PUBLIC_TILE_URL	No	Custom map tile URL
NEXT_PUBLIC_TILE_ATTRIBUTION	No	Map attribution HTML

Default (no API key):

NEXT_PUBLIC_WEATHER_PROVIDER=open-meteo

Optional (OpenWeatherMap):

NEXT_PUBLIC_WEATHER_PROVIDER=openweather
NEXT_PUBLIC_WEATHER_API_KEY=your_api_key_here

Run the App

npm run dev

Open: http://localhost:3000

⸻

🧠 Architectural Highlights

Provider Abstraction
	•	Weather providers are selected via environment variable
	•	Open-Meteo (free) and OpenWeatherMap (paid) share a unified response shape
	•	Clean upgrade path to additional providers

Data Flow

	Search / Location
	   ↓
	Provider API (Open-Meteo / OpenWeather)
	   ↓
	Normalized response
	   ↓
	TanStack Query cache
	   ↓
	UI components

Unit Conversion
	•	All data fetched in metric
	•	Client-side conversion for display
	•	Zero network requests when toggling units

Offline Strategy
	•	Last successful weather data cached
	•	App remains usable without network
	•	Offline indicator shown when data is stale

⸻

🧪 Testing

npm run test

Coverage includes:
	•	Unit tests (formatters, converters)
	•	Component tests (SearchBar, ForecastList)
	•	Accessibility checks
	•	Data flow validation
	•	Performance-sensitive memoization paths

⸻

🚀 Deployment

Vercel (Recommended)
	1.	Push to GitHub
	2.	Import repository into Vercel
	3.	Deploy (no env vars required for Open-Meteo)
	4.	Optional: configure OpenWeatherMap key in dashboard

Includes a health check endpoint:

GET /api/ping
→ { ok: true, environment: "production" }


⸻

📁 Project Structure (Simplified)

src/
├── app/            # App Router pages
├── components/     # UI components
├── lib/            # Utilities, providers, helpers
├── styles/         # Global styles
└── tests/          # Unit & component tests


⸻

🎯 Why This Project Exists

Weather apps are deceptively complex:
	•	high UX expectations
	•	heavy client-side state
	•	offline usage
	•	accessibility requirements
	•	performance under visual load

WeatherFlow exists to show how to balance UX, performance, and correctness in a frontend-dominant application.

⸻

📄 License

ISC License

⸻

Built by Pazu
🌐 https://pazu.dev