import { neon } from '@neondatabase/serverless';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

function equalSecret(a, b) {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (!env.DATABASE_URL || !env.APP_PASSWORD) return json({ error: 'A configuração do servidor está incompleta.' }, 503);
  if (!equalSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''), env.APP_PASSWORD)) {
    return json({ error: 'Senha incorreta ou sessão expirada.' }, 401);
  }

  const sql = neon(env.DATABASE_URL);
  try {
    if (request.method === 'GET' && url.pathname === '/api/servidores') {
      const rows = await sql`SELECT id, nome, categoria, marcado, marcado_em, ordem FROM public.servidores ORDER BY CASE categoria WHEN 'docentes' THEN 1 WHEN 'tecnicos' THEN 2 ELSE 3 END, ordem, nome`;
      return json(rows);
    }

    if (request.method === 'PATCH' && url.pathname.startsWith('/api/servidores/')) {
      const id = url.pathname.split('/').pop();
      const body = await request.json();
      if (!/^[0-9a-f-]{36}$/i.test(id) || typeof body.marcado !== 'boolean') return json({ error: 'Dados inválidos.' }, 400);
      const stamped = body.marcado_em !== undefined ? body.marcado_em : (body.marcado ? new Date().toISOString() : null);
      const rows = await sql`UPDATE public.servidores SET marcado = ${body.marcado}, marcado_em = ${stamped}, atualizado_em = NOW() WHERE id = ${id} RETURNING id, nome, categoria, marcado, marcado_em, ordem`;
      return rows.length ? json(rows[0]) : json({ error: 'Servidor não encontrado.' }, 404);
    }

    if (request.method === 'POST' && url.pathname === '/api/servidores') {
      const body = await request.json();
      const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
      const categoria = body.categoria;
      if (!nome || nome.length > 120 || !['docentes', 'tecnicos', 'terceirizados'].includes(categoria)) return json({ error: 'Informe nome e categoria válidos.' }, 400);
      const rows = await sql`INSERT INTO public.servidores (nome, categoria, ordem) VALUES (${nome}, ${categoria}, COALESCE((SELECT MAX(ordem) + 1 FROM public.servidores WHERE categoria = ${categoria}), 0)) ON CONFLICT (categoria, (LOWER(nome))) DO NOTHING RETURNING id, nome, categoria, marcado, marcado_em, ordem`;
      if (!rows.length) return json({ error: 'Já existe uma pessoa com esse nome nessa categoria.' }, 409);
      return json(rows[0], 201);
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/servidores/')) {
      const id = url.pathname.split('/').pop();
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Identificador inválido.' }, 400);
      const rows = await sql`DELETE FROM public.servidores WHERE id = ${id} RETURNING id`;
      return rows.length ? json({ ok: true }) : json({ error: 'Servidor não encontrado.' }, 404);
    }

    if (request.method === 'POST' && url.pathname === '/api/validar') return json({ ok: true });
    return json({ error: 'Endereço não encontrado.' }, 404);
  } catch (error) {
    console.error('API error', error);
    return json({ error: 'Não foi possível concluir a operação. Tente novamente.' }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  }
};
