# Deploy do Reef System

## 1) Supabase (se quiser sincronização)

1. Crie um projeto no Supabase.
2. No SQL Editor, execute:
   - `supabase_schema.sql`
   - `supabase_permissions.sql` (se o frontend não conseguir ler/gravar)
3. Pegue:
   - Project URL (`https://xxxx.supabase.co`)
   - Anon public key

Variáveis necessárias no app:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Observação: o app não usa login ainda. Quem tiver acesso ao site terá acesso ao mesmo banco configurado no frontend.

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
