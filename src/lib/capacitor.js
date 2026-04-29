// Detecta se está rodando dentro do app Capacitor (Android/iOS)
export const isCapacitor = typeof window !== 'undefined' &&
  (window.Capacitor !== undefined || window.location.protocol === 'capacitor:');

// Base URL para chamadas de API:
// - No app Capacitor → vai direto para o Vercel (as rotas /api/ não existem no bundle local)
// - No browser normal → usa caminhos relativos (Vercel serve /api/ diretamente)
const VERCEL_URL = import.meta.env.VITE_APP_URL ||
  'https://diario-sitebiafluxo-dels-projects.vercel.app';

export function apiUrl(path) {
  return isCapacitor ? `${VERCEL_URL}${path}` : path;
}
