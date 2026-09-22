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

  if (source === 'nasdaq100') {
    const response = await fetch('https://api.nasdaq.com/api/quote/list-type/nasdaq100', {
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

  if (source === 'sp500-constituents') {
    const response = await fetch('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await response.text();
    const rows = Array.from(html.matchAll(/<tr>[\s\S]*?<td>\s*<a[^>]*>([^<]+)<\/a>\s*<\/td>[\s\S]*?<td>\s*<a[^>]*>([^<]+)<\/a>\s*<\/td>[\s\S]*?<td>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?\s*<\/td>/g))
      .map((match) => ({
        symbol: match[1].trim().replace('.', '-'),
        company: match[2].trim(),
        sector: match[3].trim(),
        marketCap: 0
      }));
    return {
      statusCode: response.ok ? 200 : response.status,
      headers,
      body: JSON.stringify({ rows })
    };
  }

  if (source === 'nasdaq-earnings') {
    const date = String(event.queryStringParameters?.date || '').replace(/[^0-9-]/g, '');
    const response = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
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
    const range = String(event.queryStringParameters?.range || '6mo').replace(/[^0-9a-z]/gi, '');
    const interval = String(event.queryStringParameters?.interval || '1d').replace(/[^0-9a-z]/gi, '');
    const includePrePost = String(event.queryStringParameters?.includePrePost || 'false') === 'true';
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}${includePrePost ? '&includePrePost=true' : ''}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return {
      statusCode: response.ok ? 200 : response.status,
      headers,
      body: await response.text()
    };
  }

  if (source === 'yahoo-chart-intraday') {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m&includePrePost=true`, {
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
