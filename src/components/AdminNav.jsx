import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const links = [
  { to: '/admin/setup', label: 'Setup' },
  { to: '/admin/accounts', label: 'Accounts' },
  { to: '/admin/ledger', label: 'Ledger' },
  { to: '/admin/actions', label: 'Actions' },
];

export default function AdminNav() {
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/admin');
  }

  return (
    <nav className="border-b border-warm-gray-light bg-cream-dark">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-serif text-lg text-maroon font-semibold tracking-tight">
            Dollar-A-Day
          </Link>
          <div className="flex gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 text-sm tracking-wide transition-colors ${
                  location.pathname === link.to
                    ? 'bg-maroon text-cream'
                    : 'text-warm-gray-dark hover:text-maroon'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-warm-gray-dark hover:text-maroon transition-colors cursor-pointer"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
