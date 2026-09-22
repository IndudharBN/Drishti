# Swing Trading Strategy Dashboard

SwingDesk is a standalone React/Vite app for U.S. swing-trading analysis, with technical strategy rankings, target levels, and ATR/support-based risk controls.

The app includes Band Bounce Scanner, Most Volatile Today, Range Bound Shares, Penny Stocks, Index Drivers, AI Runner Radar, watchlists, alerts, and trade plans. Scanner results are analysis candidates, not guaranteed returns.

## Run Locally

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 5174
```

Open http://127.0.0.1:5174/ after the server starts. Run `npm test` to check the strategy tests.

See `.env.example` for optional integrations. Keep actual credentials in local environment files or your hosting provider's environment settings; never commit them. Server-only credentials must not use the `VITE_` prefix.

## Build for Netlify

```bash
npm run build
```

Netlify should publish `dist` and use `netlify/functions` for server-side API calls.

## Data

The app loads Yahoo Finance chart data and Nasdaq screener metadata for prices, candles, market cap, sector, industry, and volume. Index Drivers also requests intraday data with extended hours and labels the available quote session. Quotes can be delayed; refreshing does not guarantee exchange-live data. If market data cannot be loaded, the dashboard shows a data-unavailable state instead of generated fallback prices.

Trading 212 support is intentionally a secure connector stub in v1. API keys must remain server-side.
