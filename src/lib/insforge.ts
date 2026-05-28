import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_BASE_URL;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;
export const useInsforge = String(import.meta.env.VITE_USE_INSFORGE || 'false').toLowerCase() === 'true';

export const insforge = createClient({
  baseUrl: baseUrl || 'http://localhost/insforge-not-configured',
  anonKey: anonKey || undefined
});

export const isInsforgeConfigured = Boolean(baseUrl && anonKey);
