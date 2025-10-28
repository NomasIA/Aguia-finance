// Auto-inject public env so deploy funciona sem configurar variáveis na Vercel.
// ⚠️ Apenas chaves públicas (NEXT_PUBLIC_*). Não inclui SERVICE_ROLE_KEY.
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://dzciuwajmbsibdlbtequ.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Y2l1d2FqbWJzaWJkbGJ0ZXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNTg1MzEsImV4cCI6MjA3NjYzNDUzMX0.v376Cp-8IvsMfAmYQnEYeYdsEabascBWGUcWjVaCj-M',
    ENABLE_CONCILIACAO: 'true',
  }
};
export default nextConfig;
