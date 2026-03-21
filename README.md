# Reef System (Aquário Marinho)

App web responsivo para acompanhar parâmetros do aquário, inventário/fauna, protocolos e fases de iluminação.

- Funciona em modo local (offline-first) usando `localStorage`.
- Opcional: sincronização com Supabase (se não houver credenciais, o app continua 100% local).

## Rodar local

```bash
npm install
npm run dev
```

## Supabase (opcional)

1. Crie um projeto no Supabase.
2. Execute o schema no SQL Editor:
   - `supabase_schema.sql`
3. Se necessário, aplique permissões para o frontend (anon/authenticated):
   - `supabase_permissions.sql`
4. Configure as variáveis no ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Para desenvolvimento local, use `.env.local` (o arquivo `*.local` é ignorado pelo git) baseado em `.env.example`.

### Primeira carga (bootstrap)

Se o Supabase estiver vazio e você já tiver dados no `localStorage`, ao habilitar o Supabase o app envia automaticamente os dados locais para o banco na primeira sincronização.

## Deploy (Vercel / Netlify)

Build padrão:
- Build: `npm run build`
- Output: `dist`

Arquivos já incluídos para SPA:
- `vercel.json` (rewrite para `index.html`)
- `netlify.toml` (redirect para `index.html`)

Depois do deploy, configure no provedor as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para habilitar a sincronização.
