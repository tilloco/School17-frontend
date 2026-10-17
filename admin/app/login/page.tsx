'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Email yoki parol noto'g'ri");
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl text-paper tracking-tight">School17 Admin</p>
          <p className="text-inkLight text-sm mt-1">Boshqaruv paneliga kirish</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-panel border border-line rounded-md p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-muted mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line rounded-sm px-3 py-2 text-ink900 focus:border-brass outline-none"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-muted mb-1">
              Parol
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line rounded-sm px-3 py-2 text-ink900 focus:border-brass outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-rust text-sm bg-rustLight rounded-sm px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-paper rounded-sm py-2.5 font-medium hover:bg-inkLight transition-colors disabled:opacity-60"
          >
            {loading ? 'Kirilmoqda...' : 'Kirish'}
          </button>
        </form>
      </div>
    </div>
  );
}
