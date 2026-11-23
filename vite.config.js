import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Tudo que começa com VITE_ vai para o JavaScript público do navegador/APK.
// Só a URL e a anon key do Supabase podem (são públicas por design, protegidas por RLS).
const ALLOWED_PUBLIC_VARS = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_APP_URL'])
const SECRET_PATTERN = /(KEY|SECRET|TOKEN|PASSWORD|PRIVATE)/i

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const leaked = Object.keys(env).filter(
    (k) => SECRET_PATTERN.test(k) && !ALLOWED_PUBLIC_VARS.has(k) && env[k]
  )
  if (leaked.length) {
    throw new Error(
      `[segurança] Variáveis secretas com prefixo VITE_ seriam publicadas no bundle: ${leaked.join(', ')}.\n` +
      'Renomeie sem o prefixo VITE_ (ex: GEMINI_API_KEY) e use as rotas /api do servidor.'
    )
  }
  return { plugins: [react()] }
})
