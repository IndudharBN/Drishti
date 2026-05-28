import type { Handler } from '@netlify/functions';

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

export const handler: Handler = async (event) => {
  const source = String(event.queryStringParameters?.source || '').toLowerCase();
  const symbol = String(event.queryStringParameters?.symbol || 'MSFT').toUpperCase().replace(/[^A-Z.]/g, '');
  const symbols = String(event.queryStringParameters?.symbols || symbol)
    .split(',')
    .map((item) => item.trim().toLowerCase().replace(/[^a-z.]/g, ''))
    .filter(Boolean);
  if (source === 'nasdaq') {
    const response = await fetch('https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&download=true', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json'
      }
    });
    return {
      statusCode: response.ok ? 200 : response.status,
      headers,
      body: await response.text()
    };
  }

  if (source === 'yahoo-chart') {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return {
      statusCode: response.ok ? 200 : response.status,
      headers,
      body: await response.text()
    };
  }

  const stooqUrl = `https://stooq.com/q/l/?s=${symbols.map((item) => `${item}.us`).join(',')}&f=sd2t2ohlcv&h&e=csv`;
  if (source === 'stooq' || !process.env.ALPHA_VANTAGE_API_KEY) {
    const response = await fetch(stooqUrl);
    return {
      statusCode: response.ok ? 200 : response.status,
      headers,
      body: await response.text()
    };
  }
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', 'TIME_SERIES_DAILY_ADJUSTED');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('outputsize', 'compact');
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  const payload = await response.json();
  return {
    statusCode: response.ok ? 200 : response.status,
    headers,
    body: JSON.stringify({ symbol, source: 'alpha-vantage', payload })
  };
};
