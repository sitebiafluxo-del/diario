/**
 * Leitura "à prova de colagem" das variáveis de ambiente:
 * remove espaços, quebras de linha e aspas que costumam vir junto ao colar
 * valores no painel da Vercel (um erro comum que derruba a conexão).
 */
export function env(...names) {
  for (const name of names) {
    let v = process.env[name];
    if (typeof v !== 'string') continue;
    v = v.trim().replace(/^['"`]+|['"`]+$/g, '').trim();
    if (v) return v;
  }
  return undefined;
}

/** URL sem barra final, validada (https). */
export function envUrl(...names) {
  const v = env(...names);
  if (!v) return undefined;
  try {
    const u = new URL(v.replace(/\/+$/, ''));
    if (u.protocol !== 'https:') return undefined;
    return u.origin;
  } catch {
    console.error(`Variável ${names[0]} não é uma URL válida (confira o valor na Vercel)`);
    return undefined;
  }
}
