import { useState } from 'react';
import { User, Key, Bell, Shield, Save, Palette, Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'api', label: 'API Keys', icon: Key },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="max-w-5xl mx-auto space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Manage your account and platform preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Tab Navigation */}
        <div className="space-y-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-left"
                style={{ 
                  backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
                  color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ 
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-tertiary)',
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="ml-3 text-sm font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'profile' && (
            <div className="glass-card p-6 fade-in">
              <h3 className="text-base font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
                Profile Information
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Display Name
                  </label>
                  <input 
                    type="text" 
                    defaultValue="Jane Doe"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    defaultValue="jane@example.com"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Organization
                  </label>
                  <input 
                    type="text" 
                    defaultValue="My Organization"
                    className="input-field"
                  />
                </div>
                <button className="btn-primary">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="glass-card p-6 fade-in">
              <h3 className="text-base font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
                Appearance
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Choose your preferred theme for the platform.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => theme !== 'light' && toggleTheme()}
                  className="p-6 rounded-xl transition-all duration-200 text-center"
                  style={{
                    border: `2px solid ${theme === 'light' ? 'var(--border-focus)' : 'var(--border-primary)'}`,
                    backgroundColor: theme === 'light' ? 'var(--bg-active)' : 'var(--bg-card)',
                  }}
                >
                  <div 
                    className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center"
                    style={{ backgroundColor: '#fef9c3', color: '#ca8a04' }}
                  >
                    <Sun className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Light</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Clean & bright</p>
                </button>

                <button
                  onClick={() => theme !== 'dark' && toggleTheme()}
                  className="p-6 rounded-xl transition-all duration-200 text-center"
                  style={{
                    border: `2px solid ${theme === 'dark' ? 'var(--border-focus)' : 'var(--border-primary)'}`,
                    backgroundColor: theme === 'dark' ? 'var(--bg-active)' : 'var(--bg-card)',
                  }}
                >
                  <div 
                    className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center"
                    style={{ backgroundColor: '#1e1b4b', color: '#a78bfa' }}
                  >
                    <Moon className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dark</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Easy on the eyes</p>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="glass-card p-6 fade-in">
              <h3 className="text-base font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
                Security
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Current Password
                  </label>
                  <input type="password" className="input-field" placeholder="Enter current password" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    New Password
                  </label>
                  <input type="password" className="input-field" placeholder="Enter new password" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Confirm New Password
                  </label>
                  <input type="password" className="input-field" placeholder="Confirm new password" />
                </div>
                <button className="btn-primary">
                  <Shield className="w-4 h-4 mr-2" />
                  Update Password
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="glass-card p-6 fade-in">
              <h3 className="text-base font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
                Notifications
              </h3>
              <div className="space-y-5">
                {[
                  { label: 'Conversion completed', desc: 'Get notified when a conversion finishes' },
                  { label: 'Conversion failed', desc: 'Get notified when a conversion fails' },
                  { label: 'Weekly summary', desc: 'Receive a weekly usage summary email' },
                ].map(item => (
                  <div 
                    key={item.label}
                    className="flex items-center justify-between p-4 rounded-xl"
                    style={{ border: '1px solid var(--border-primary)' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div 
                        className="w-10 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                        style={{ backgroundColor: 'var(--bg-tertiary)' }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="glass-card p-6 fade-in">
              <h3 className="text-base font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
                API Keys
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Generate API keys to integrate with external services.
              </p>
              <div 
                className="p-6 rounded-xl text-center"
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px dashed var(--border-primary)' }}
              >
                <Key className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  No API keys generated yet
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
                  Create your first API key to get started with the API.
                </p>
                <button className="btn-primary">
                  <Key className="w-4 h-4 mr-2" />
                  Generate API Key
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
