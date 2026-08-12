'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Brain, Heart, Shield } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { setAuthTokenCookie } from '@/lib/utils';
import Logo from '@/components/Logo';

const WORDS = ['Mindfulness', 'Resilience', 'Growth', 'Clarity', 'Balance', 'Joy', 'Flourish'];
const FEATURES = [
  { icon: Brain, text: 'Track your wellness journey' },
  { icon: Heart, text: 'Attend mindfulness workshops' },
  { icon: Shield, text: 'Secure & private platform' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const router = useRouter();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

  useEffect(() => {
    const t = setInterval(() => setWordIndex((i) => (i + 1) % WORDS.length), 2500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Show success message if redirected from email verification.
    // Runs once on mount only — `searchParams` above is a plain `new
    // URLSearchParams(...)` recomputed on every render (not memoized), so
    // depending on it here re-fired this effect on every re-render (e.g.
    // the word-carousel interval above ticking every 2.5s), showing the
    // toast repeatedly for as long as ?verified=true stayed in the URL.
    if (searchParams?.get('verified') === 'true') {
      toast.success('Email verified successfully! You can now login.');
    }
    if (searchParams?.get('reset') === 'true') {
      toast.success('Password reset successfully! Please login with your new password.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateEmail = (val: string) => {
    if (!val) { setEmailError(''); return; }
    if (!val.includes('@')) { setEmailError('Enter a valid email'); return; }
    setEmailError(''); // All emails allowed
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    
    // All emails allowed - no validation needed
    
    if (emailError) { toast.error('Fix email errors first'); return; }
    setLoading(true);
    
    try {
      // Add timeout for slow backend (Render cold start)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store token and user data (single source of truth)
      if (data.data?.accessToken) {
        localStorage.setItem("token", data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem("refreshToken", data.data.refreshToken);
        }

        // Store user data in localStorage (normalize role to hyphen format)
        if (data.data.user) {
          const userToStore = {
            ...data.data.user,
            role: data.data.user.role?.toLowerCase().replace(/_/g, '-') || 'student',
          };
          localStorage.setItem("user", JSON.stringify(userToStore));
        }
        
        // Store in cookie for middleware (hardened version with proper SameSite)
        setAuthTokenCookie(data.data.accessToken, 86400);
        
        toast.success('Welcome back!');
        
        // Small delay to prevent race condition
        setTimeout(() => {
          router.push('/home');
        }, 100);
      } else {
        // Fallback if no delay needed
        router.push('/home');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('Request timeout. Backend might be starting up. Please try again.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-dark">
      {/* Left Panel */}
      <div className="auth-brand-panel hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-[#13132A] to-[#0F0F1A] p-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-56 h-56 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <Logo className="w-10 h-10 rounded-2xl" />
          <div>
            <p className="text-base font-bold text-white">Flourishing Hub</p>
            <p className="text-xs text-white/40">IIT Bombay</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-white/50 text-sm mb-3">Your journey to</p>
            <AnimatePresence mode="wait">
              <motion.h1
                key={wordIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="text-5xl font-black gradient-text"
              >
                {WORDS[wordIndex]}
              </motion.h1>
            </AnimatePresence>
            <p className="text-white/50 text-sm mt-3">starts here.</p>
          </div>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-white/60">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/20">© 2026 Flourishing Hub · IIT Bombay</p>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Logo className="w-8 h-8 rounded-xl" />
            <p className="font-bold text-white">Flourishing Hub</p>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Welcome</h2>
          <p className="text-sm text-white/50 mb-8">Sign in to your Flourish account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-medium text-white/60 mb-1.5 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); validateEmail(e.target.value); }}
                  placeholder="yourname@iitb.ac.in"
                  className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                />
              </div>
              {emailError && <p className="text-xs text-red-400 mt-1">{emailError}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-white/60 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-dark w-full pl-10 pr-10 py-3 rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end -mt-2 mb-1">
              <Link href="/forgot-password" className="text-xs text-primary/70 hover:text-primary transition-colors">
                Forgot password?
              </Link>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="btn-primary w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </motion.button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-sm text-white/50">
              New to Flourishing Hub?{' '}
              <Link href="/signup" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                Create Account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
