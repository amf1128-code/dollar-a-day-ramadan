import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/admin/setup');
      }
      setLoading(false);
    });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      logger.warn('auth', 'Login failed', { code: authError.code, message: authError.message });
      setError('Invalid email or password.');
      return;
    }

    logger.info('auth', 'Admin logged in');
    navigate('/admin/setup');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-warm-gray tracking-widest uppercase text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl mb-2 text-center">Admin</h1>
        <p className="text-xs tracking-widest uppercase text-warm-gray text-center mb-8">Dollar-A-Day</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs tracking-widest uppercase text-warm-gray mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-warm-gray mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
            />
          </div>
          {error && <p className="text-sm text-maroon">{error}</p>}
          <button
            type="submit"
            className="w-full bg-maroon text-cream py-3 text-sm tracking-widest uppercase hover:bg-maroon-dark transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
