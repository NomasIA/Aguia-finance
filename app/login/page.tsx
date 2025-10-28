'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('yuricv89@hotmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else if (data.user) {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError('Ocorreu um erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 border border-gold/20 mb-4">
            <Lock className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-3xl font-bold text-gold glow-gold mb-2">Dashboard Águia</h1>
          <p className="text-muted">Sistema de Gestão Financeira</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold mb-6 text-center">Acesso Administrativo</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu-email@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="input-dark"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="input-dark"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="bg-danger/10 border-danger/20 text-danger">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="text-center mt-4">
              <p className="text-xs text-muted">
                Email de teste: <span className="text-text font-mono">yuricv89@hotmail.com</span>
              </p>
              <p className="text-xs text-muted mt-1">
                Senha de teste: <span className="text-text font-mono">senha123</span>
              </p>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Apenas administradores autorizados podem acessar
        </p>
      </div>
    </div>
  );
}
