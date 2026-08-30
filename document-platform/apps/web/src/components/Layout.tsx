import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Clock, Settings, LogOut, ArrowLeftRight, Edit, Sun, Moon, ChevronRight } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { name: 'Convert', path: '/', icon: ArrowLeftRight, description: 'Upload & convert files' },
    { name: 'Editor', path: '/editor', icon: Edit, description: 'Write & export docs' },
    { name: 'History', path: '/history', icon: Clock, description: 'Past conversions' },
    { name: 'Settings', path: '/settings', icon: Settings, description: 'Account preferences' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg-primary)', fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        minWidth: '260px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-primary)',
      }}>
        {/* Logo */}
        <div style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          borderBottom: '1px solid var(--border-primary)',
          gap: '12px',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText style={{ width: '18px', height: '18px', color: 'white' }} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>DocConv</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Document Platform</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', overflow: 'auto' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 8px 12px' }}>
            Workspace
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '10px 12px',
                    borderRadius: '12px', textDecoration: 'none',
                    backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
                    color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                    gap: '12px',
                  }}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-tertiary)',
                    flexShrink: 0,
                  }}>
                    <Icon style={{ width: '16px', height: '16px' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{item.description}</div>
                  </div>
                  {isActive && <ChevronRight style={{ width: '14px', height: '14px', flexShrink: 0, color: 'var(--text-accent)' }} />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              width: '100%', padding: '10px 12px', borderRadius: '12px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
              textAlign: 'left',
            }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'var(--bg-tertiary)',
            }}>
              {theme === 'dark' ? <Sun style={{ width: '16px', height: '16px' }} /> : <Moon style={{ width: '16px', height: '16px' }} />}
            </div>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              width: '100%', padding: '10px 12px', borderRadius: '12px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
              textAlign: 'left',
            }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'var(--bg-tertiary)',
            }}>
              <LogOut style={{ width: '16px', height: '16px' }} />
            </div>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Header */}
        <header style={{
          height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {navItems.find(i => i.path === location.pathname)?.name || 'Platform'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {navItems.find(i => i.path === location.pathname)?.description}
            </div>
          </div>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: 'white',
          }}>
            U
          </div>
        </header>

        {/* Page */}
        <main style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
