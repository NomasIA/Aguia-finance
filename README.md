# 🏗️ Águia Dashboard

Dashboard financeiro & obras com Supabase e Next.js, pronto para deploy na Vercel e publicação no GitHub.

## 🚀 Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (DB/Auth)
- SheetJS (Excel) • Recharts (gráficos)

## ▶️ Rodar local
```bash
npm install
npm run dev
```
Acesse http://localhost:3000

## ☁️ Deploy (Vercel via GitHub)
1. Crie um repositório `aguiadash` no GitHub
2. Suba **todos os arquivos** desta pasta (não suba o ZIP)
3. Em https://vercel.com/new → Import Git Repository → selecione `aguiadash` → Deploy

## 🔑 Variáveis de ambiente (exemplo)
Crie `.env.local` ou adicione na Vercel:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://dzciuwajmbsibdlbtequ.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Y2l1d2FqbWJzaWJkbGJ0ZXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNTg1MzEsImV4cCI6MjA3NjYzNDUzMX0.v376Cp-8IvsMfAmYQnEYeYdsEabascBWGUcWjVaCj-M
ENABLE_CONCILIACAO=true
# SUPABASE_SERVICE_ROLE_KEY=... (opcional para ações admin)
```

## 🧩 Funcionalidades
- Entradas & Saídas com ações de linha (Editar/Conciliar/Desfazer/Excluir/Salvar data)
- Conciliação com Importar Extrato (CSV/XLSX/OFX), auto-match, dedupe (±2 dias)
- Relatórios Excel (visual preto+dourado, totais e subtotais)
- Datas com feriados/FDS (America/Sao_Paulo)
- Diaristas com valor de fim de semana
