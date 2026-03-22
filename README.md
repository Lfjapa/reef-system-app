# Reef System (Aquário Marinho)

App web responsivo para acompanhar parâmetros do aquário, inventário/fauna, protocolos e fases de iluminação.

- Funciona em modo local (offline-first) usando `localStorage`.
- Opcional: sincronização com Supabase (se não houver credenciais, o app continua 100% local).

## Rodar local

```bash
npm install
npm run dev
```

Se você precisa expor na rede local (celular no Wi‑Fi), use:

```bash
npm run dev:lan
```

## Supabase (opcional)

1. Crie um projeto no Supabase.
2. Habilite login com Google em Authentication → Providers.
3. Configure os Redirect URLs (ex.: `http://localhost:5173` e o domínio do deploy).
2. Execute o schema no SQL Editor:
   - `supabase_schema.sql`
3. Se necessário, aplique permissões para o frontend (anon/authenticated):
   - `supabase_permissions.sql`
4. Aplique migração/policies e otimizações:
   - `supabase_multiuser_migration.sql`
   - `supabase_optimizations.sql`
5. (Opcional) Crie a tabela global de requisitos por espécie:
   - `supabase_bio_requirements.sql`
6. (Opcional) Crie as views nativas de cruzamento e consumo:
   - `supabase_aquarium_views.sql`
4. Configure as variáveis no ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Para desenvolvimento local, use `.env.local` (o arquivo `*.local` é ignorado pelo git) baseado em `.env.example`.

### Primeira carga (bootstrap)

Se o Supabase estiver vazio e você já tiver dados no `localStorage`, ao habilitar o Supabase o app envia automaticamente os dados locais para o banco na primeira sincronização.

### Importar requisitos de espécies (opcional)

1. Gere o CSV a partir do Excel enriquecido:
   - `npm run export:bio-requirements`
2. Importe o `bio_requirements.csv` no Supabase (Table Editor → bio_requirements → Import data).
3. Alternativa: execute no Supabase SQL Editor:
   - `supabase_seed_bio_requirements_from_chat.sql`

## Deploy (Vercel / Netlify)

Build padrão:
- Build: `npm run build`
- Output: `dist`

Arquivos já incluídos para SPA:
- `vercel.json` (rewrite para `index.html`)
- `netlify.toml` (redirect para `index.html`)

Depois do deploy, configure no provedor as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para habilitar a sincronização.
