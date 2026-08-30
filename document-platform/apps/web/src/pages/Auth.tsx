import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function Auth({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const isLogin = mode === 'login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const body = isLogin 
        ? { email, password } 
        : { email, password, organizationName: orgName || 'My Organization' };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Authentication failed');

      localStorage.setItem('token', data.data.accessToken);
      if (data.data.refreshToken) {
        localStorage.setItem('refreshToken', data.data.refreshToken);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex font-sans relative overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="gradient-orb absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-30"
          style={{ 
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
            top: '-15%', left: '-10%' 
          }}
        />
        <div 
          className="gradient-orb-2 absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-20"
          style={{ 
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', 
            bottom: '-10%', right: '-5%' 
          }}
        />
        <div 
          className="gradient-orb absolute w-[400px] h-[400px] rounded-full blur-[120px] opacity-10"
          style={{ 
            background: 'linear-gradient(135deg, #06b6d4, #6366f1)', 
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)' 
          }}
        />
      </div>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-20 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
        style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-primary)',
          color: 'var(--text-secondary)'
        }}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative items-center justify-center p-12">
        <div className="relative z-10 max-w-md">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
          >
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 
            className="text-5xl font-extrabold tracking-tight leading-[1.1] mb-6"
            style={{ color: 'var(--text-primary)' }}
          >
            Transform your
            <span 
              className="block mt-1"
              style={{ 
                background: 'var(--gradient-primary)', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent' 
              }}
            >
              documents.
            </span>
          </h1>
          <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--text-secondary)' }}>
            The most powerful document conversion platform. Convert between formats with pixel-perfect accuracy.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {['50+ Formats', 'Batch Convert', 'API Access', 'Secure'].map((feat) => (
              <span 
                key={feat}
                className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium"
                style={{ 
                  background: 'var(--bg-active)', 
                  color: 'var(--text-accent)',
                  border: '1px solid var(--border-primary)'
                }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
            >
              <FileText className="w-7 h-7 text-white" />
            </div>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {isLogin ? 'Welcome back' : 'Get started'}
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={() => navigate(isLogin ? '/register' : '/login')} 
                className="font-semibold transition-colors"
                style={{ color: 'var(--text-accent)' }}
              >
                {isLogin ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="fade-in">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="Your company name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Email address
              </label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field"
                  style={{ paddingRight: '44px' }}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div 
                className="rounded-xl p-4 text-sm font-medium fade-in"
                style={{ 
                  background: 'rgba(239, 68, 68, 0.08)', 
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.15)'
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ padding: '14px 24px', fontSize: '15px' }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign in' : 'Create account'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>

          {isLogin && (
            <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Forgot your password?{' '}
              <button className="font-medium" style={{ color: 'var(--text-accent)' }}>
                Reset it
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
