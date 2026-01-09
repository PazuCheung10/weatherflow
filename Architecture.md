WeatherFlow — Architecture

A technical overview of WeatherFlow, describing its architecture, design decisions, data flow, and implementation patterns.

WeatherFlow is a frontend-systems–oriented application built to demonstrate how modern web apps balance performance, accessibility, offline resilience, and user experience.

⸻

Table of Contents
	1.	System Overview
	2.	Core Principles
	3.	Technology Stack
	4.	Application Structure
	5.	Routing & Layout Architecture
	6.	Data Flow & State Management
	7.	Component Architecture
	8.	API & Provider Integration
	9.	Performance Strategy
	10.	Accessibility Architecture
	11.	Browser Compatibility (Safari Considerations)
	12.	Testing Strategy
	13.	Deployment Architecture
	14.	Future Evolution

⸻

1. System Overview

WeatherFlow is a modern weather application built with Next.js (App Router), TypeScript, and a client-centric data strategy.

It provides:
	•	real-time weather data
	•	forecasts
	•	interactive maps
	•	offline support

while remaining fast, accessible, and predictable.

The architecture prioritizes frontend correctness, not backend complexity.

⸻

2. Core Principles
	•	Performance First
		Minimize bundle size, lazy-load expensive features, cache aggressively.
	•	Accessibility as Architecture
		Keyboard navigation, screen readers, focus control, reduced motion.
	•	Clear State Boundaries
		Server state ≠ UI state ≠ persistent preferences.
	•	Progressive Enhancement
		App works without JS-heavy features, APIs degrade gracefully.
	•	Browser Reality
		Safari quirks are documented and explicitly handled.

⸻

3. Technology Stack

Framework & Language
	•	Next.js (App Router) — routing, layouts, SSR/ISR
	•	React — modern concurrent rendering model
	•	TypeScript — strict type safety across app boundaries

Styling & UI
	•	Tailwind CSS — utility-first styling with CSS variables
	•	Framer Motion — micro-animations with reduced-motion support

Data & State
	•	TanStack Query — server-state management and caching
	•	React Context — theme, locale, and global preferences

Visualization
	•	Chart.js — hourly temperature charts (dynamically imported)
	•	Leaflet / React-Leaflet — interactive maps (client-only)

Forms & Validation
	•	React Hook Form — performant form handling
	•	Schema-based validation — predictable, accessible errors

PWA & Offline
	•	Service Worker — asset + data caching
	•	Web App Manifest — installable experience

Testing
	•	Vitest
	•	React Testing Library
	•	jsdom

⸻

4. Application Structure

src/
├── app/                # App Router pages and API routes
│   ├── api/ping        # Health check
│   ├── city/[slug]    # Deep-linked city views
│   ├── layout.tsx     # Root layout + providers
│   └── page.tsx       # Home page
│
├── components/         # UI components
│   ├── SearchBar
│   ├── CurrentCard
│   ├── ForecastList
│   ├── MapPanel
│   └── …
│
├── lib/                # Core logic
│   ├── api.ts          # Weather provider abstraction
│   ├── queryClient.ts # TanStack Query config
│   ├── storage.ts     # Safe localStorage wrapper
│   ├── unitConversion.ts
│   ├── theme.ts
│   └── …
│
└── styles/
    └── globals.css     # Global styles + Safari fixes


⸻

5. Routing & Layout Architecture

	Routes

	/                  → Main weather interface
	/city/[slug]       → City detail page (deep link)
	/api/ping          → Health check

	Layout Hierarchy

	RootLayout
	├── ThemeProvider
	├── QueryProvider
	├── LocaleProvider
	├── ServiceWorkerInit
	└── SafariGuard
	    └── Page Content

Each provider has a single responsibility and minimal re-render surface.

⸻

6. Data Flow & State Management

State Layers
	1.	Server State (TanStack Query)
		•	weather data
		•	forecast data
		•	automatic caching & retries
	2.	UI State
		•	selected city
		•	view toggles
		•	component interaction state
	3.	Persistent State
		•	favorites (≤ 8 cities)
		•	recent searches
		•	units (°C / °F)
		•	theme
	4.	Context State
		•	theme
		•	locale
		•	global preferences

Data Flow

	User Action
	 → Component Event
	 → Query Hook
	 → Provider API
	 → Normalized Data
	 → Cache
	 → UI Render

Unit toggles never trigger refetch — all conversion is client-side.

⸻

7. Component Architecture

Design Patterns
	•	Composition over inheritance
	•	Props down, events up
	•	Memoization for expensive components
	•	No side effects during render

Key Components

	SearchBar
		•	debounced input
		•	keyboard navigation
		•	accessible combobox semantics
		•	recent search persistence

	CurrentCard
		•	current conditions
		•	hourly chart (lazy-loaded)
		•	favorites integration
		•	micro-animations

	ForecastList
		•	filters out today
		•	timezone-safe grouping
		•	staggered motion

	MapPanel
		•	dynamically imported
		•	client-only rendering
		•	interactive markers + popups

⸻

8. API & Provider Integration

Provider Abstraction

Weather providers are hidden behind a unified interface.

	Supported:
		•	Open-Meteo (default, no key)
		•	OpenWeatherMap (optional)

Switching providers does not affect UI components.

	Caching Strategy
		•	current weather: ~8 min stale
		•	forecast: ~30 min stale
		•	background refetch
		•	offline fallback to cache

⸻

9. Performance Strategy
	•	route-based code splitting
	•	dynamic imports for maps & charts
	•	memoized calculations
	•	minimal rerenders
	•	request deduplication
	•	debounced search (300ms)

Main bundle stays intentionally small; heavy features load only when needed.

⸻

10. Accessibility Architecture

	WCAG AA Focus
		•	keyboard-only navigation
		•	visible focus rings
		•	screen reader labels
		•	ARIA live regions
		•	reduced motion support

Accessibility is tested, not assumed.

⸻

11. Browser Compatibility (Safari)

	Known Safari Issues Addressed
		•	position: sticky + backdrop-filter
		•	localStorage in private mode
		•	transform/overflow interaction bugs

	Fix Strategy
		•	isolate sticky containers
		•	avoid transition-all
		•	defensive storage access
		•	Safari-specific CSS fallbacks

All fixes are documented and intentional.

⸻

12. Testing Strategy

	Coverage Mix
		•	Unit tests — utilities, converters
		•	Component tests — UI & keyboard flows
		•	Integration tests — API → UI flow

Testing focuses on behavior, not snapshots.

⸻

13. Deployment Architecture

	Deployment Targets
		•	Vercel (recommended)
		•	Any Next.js-compatible platform

	Health Check

	GET /api/ping
	→ { ok: true }

No runtime secrets required for default provider.

⸻

14. Future Evolution

	Possible extensions:
		•	weather alerts
		•	saved user profiles
		•	push notifications
		•	server-side caching (Redis)
		•	additional providers
		•	internationalization

Architecture intentionally leaves room for growth.

⸻

Conclusion

WeatherFlow is designed to show how frontend systems scale, not just how UI looks.

	It demonstrates:
		•	disciplined state boundaries
		•	performance-aware design
		•	accessibility-first thinking
		•	real-world browser handling
		•	production-shaped architecture