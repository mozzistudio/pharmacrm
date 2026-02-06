import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', path: '/', icon: 'grid' },
  { name: 'HCPs', path: '/hcps', icon: 'users' },
  { name: 'Interactions', path: '/interactions', icon: 'message-circle' },
  { name: 'Tasks', path: '/tasks', icon: 'check-square' },
  { name: 'Field Force', path: '/field-force', icon: 'map-pin' },
  { name: 'Campaigns', path: '/campaigns', icon: 'mail' },
  { name: 'Analytics', path: '/analytics', icon: 'bar-chart' },
  { name: 'Compliance', path: '/compliance', icon: 'shield' },
  { name: 'AI Copilot', path: '/copilot', icon: 'cpu' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-pharma-navy text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight">PharmaCRM</h1>
          <p className="text-xs text-blue-300 mt-1">AI-Powered CRM Platform</p>
        </div>

        <nav className="flex-1 px-3">
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors',
                location.pathname === item.path
                  ? 'bg-white/10 text-white'
                  : 'text-blue-200 hover:bg-white/5 hover:text-white'
              )}
            >
              <span className="w-5 h-5 flex items-center justify-center text-xs opacity-70">
                [{item.icon.charAt(0).toUpperCase()}]
              </span>
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-pharma-blue flex items-center justify-center text-sm font-bold">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-blue-300 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={logout}
              className="text-blue-300 hover:text-white text-xs"
              title="Logout"
            >
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
