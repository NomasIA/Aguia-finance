
# Deploy automático na Vercel

1. Acesse https://vercel.com/new → **Upload Project**
2. Envie este ZIP
3. Confirme **Build Command** e **Install Command** (já estão no `vercel.json`)
4. Clique em **Deploy**

Pronto. As variáveis públicas do Supabase já estão embutidas no `vercel.json` e `next.config.mjs`.
Se futuramente precisar de operações com permissão de escrita ampla, adicione em *Project Settings → Environment Variables*:
- `SUPABASE_SERVICE_ROLE_KEY`

> Dica: Em produção, prefira mover as chaves do `vercel.json` para as **Environment Variables** do projeto.
