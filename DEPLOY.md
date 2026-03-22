# Deploy do Reef System

O app funciona em modo local (sem Supabase). Quando as variáveis do Supabase são configuradas, ele habilita login com Google e sincronização com isolamento por usuário (RLS).

## 1) Supabase (se quiser sincronização)

1. Crie um projeto no Supabase.
2. Em Authentication → Providers, habilite **Google** e configure as credenciais.
3. Em Authentication → URL Configuration:
   - Adicione os domínios de desenvolvimento e produção em “Redirect URLs” (ex.: `http://localhost:5173`, `https://seu-app.vercel.app`).
4. No SQL Editor, execute (na ordem):
   - `supabase_schema.sql`
   - `supabase_permissions.sql`
   - `supabase_multiuser_migration.sql`
   - `supabase_optimizations.sql`
   - `supabase_repair_user_id_fk.sql` (se você já teve erros de FK em `user_id`)
   - `supabase_bio_requirements.sql` (catálogo global de requisitos por espécie)
   - `supabase_aquarium_views.sql` (views nativas: zona segura e taxa de consumo)
5. Pegue:
   - Project URL (`https://xxxx.supabase.co`)
   - Anon public key

Variáveis necessárias no app:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Observação: a sincronização só funciona após login com Google. Sem login, o app permanece no modo local.

## 1.1) Importar requisitos (opcional)

1. Gere o CSV localmente (a partir do `dados_enriquecidos_v2.xlsx`):
   - `npm run export:bio-requirements`
2. No Supabase Dashboard → Table Editor → `bio_requirements` → Import data, importe o arquivo `bio_requirements.csv`.

## 2) Vercel (recomendado)

1. Suba o código para um repositório (GitHub/GitLab/Bitbucket).
2. Na Vercel: Add New → Project → importe o repositório.
3. Configure:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Em Settings → Environment Variables, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Faça o deploy.

O `vercel.json` já está no projeto para garantir que rotas SPA retornem `index.html`.

## 3) Netlify

1. Suba o código para um repositório.
2. Na Netlify: Add new site → Import from Git.
3. Configure:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

O `netlify.toml` já está no projeto para redirect de SPA.
