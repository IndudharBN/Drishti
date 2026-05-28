# Swing Trading Strategy Dashboard

Standalone React/Vite app for U.S. swing-trading analysis. It ranks stocks across 10 technical strategies plus a stricter Pro Trader master strategy, with a default 5% target and ATR/support-based risk controls.

## Run Locally

```bash
npm install
npm run dev
```

## Build for Netlify

```bash
npm run build
```

Netlify should publish `dist` and use `netlify/functions` for server-side API calls.

## Data

The app does not display generated market prices. It loads Yahoo Finance delayed daily chart data for prices/candles and Nasdaq screener metadata for market cap, sector, industry, and volume. If market data cannot be loaded, the dashboard shows a data-unavailable state instead of fallback prices.

Trading 212 support is intentionally a secure connector stub in v1. API keys must remain server-side.
