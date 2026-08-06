'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Hash, Building, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Programme } from '@/types';
import toast from 'react-hot-toast';
import Logo from '@/components/Logo';

const PROGRAMMES: Programme[] = ['BTech', 'B.Des', 'MTech', 'PhD', 'MSc', 'Staff', 'Dual Degree'];
// Explicit mapping — backend Programme enum values don't always match
// `toUpperCase()` of the label (e.g. "Dual Degree" -> "DUAL_DEGREE", not "DUAL DEGREE").
const PROGRAMME_API_VALUE: Record<string, string> = {
  BTech: 'BTECH', 'B.Des': 'BDES', MTech: 'MTECH', PhD: 'PHD', MSc: 'MSC', 'Dual Degree': 'DUAL_DEGREE',
};
const DEPARTMENTS = [
  'Computer Science & Engineering', 'Electrical Engineering', 'Mechanical Engineering',
  'Civil Engineering', 'Chemical Engineering', 'Aerospace Engineering',
  'Physics', 'Mathematics', 'Chemistry', 'Humanities & Social Sciences',
  'Student Wellness Center', 'Other',
];

// Field component defined outside to prevent re-creation on each render
const Field = ({ label, icon: Icon, error, children }: { label: string; icon: React.ElementType; error?: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium text-white/60 mb-1.5 block">{label}</label>
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 z-10" />
      {children}
    </div>
    {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
  </div>
);

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    name: '', rollNo: '',
    programme: '' as Programme | '',
    department: '', email: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.rollNo.trim()) e.rollNo = 'Roll No / Emp ID is required';
    if (!form.programme) e.programme = 'Programme is required';
    if (!form.department) e.department = 'Department is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    // Both IITB and non-IITB emails are allowed
    // IITB emails get OTP verification, non-IITB emails require admin approval
    
    // Backend password validation requirements
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(form.password)) e.password = 'Must contain an uppercase letter';
    else if (!/[a-z]/.test(form.password)) e.password = 'Must contain a lowercase letter';
    else if (!/[0-9]/.test(form.password)) e.password = 'Must contain a digit';
    
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); toast.error('Please fix the errors below'); return; }
    setLoading(true);
    
    try {
      // Prepare data for backend API
      const requestData = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.programme === 'Staff' ? 'INSTRUCTOR' : 'STUDENT',
        studentProfile: form.programme !== 'Staff' ? {
          rollNumber: form.rollNo,
          department: form.department,
          // Year/batch are no longer collected at signup — the admin's
          // batch-assignment upload fills these in automatically by roll
          // number/email (see autoAssignCohortOnSignup on the backend).
          yearOfStudy: 1,
          programme: PROGRAMME_API_VALUE[form.programme] || form.programme.toUpperCase(),
        } : undefined,
        instructorProfile: form.programme === 'Staff' ? {
          department: form.department
        } : undefined,
        employeeId: form.programme === 'Staff' ? form.rollNo : undefined
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Check if user needs OTP verification or admin approval
      if (data.data?.requiresOTP) {
        // IITB email - redirect to OTP verification
        toast.success('Registration successful! Please check your email for OTP.');
        router.push(`/verify-email?userId=${data.data.userId}&email=${encodeURIComponent(data.data.email)}`);
      } else if (data.data?.requiresApproval) {
        // Non-IITB email - show approval pending message
        toast.success('Account created! Pending admin approval.');
        router.push(`/approval-pending?email=${encodeURIComponent(data.data.email)}`);
      } else {
        // Fallback
        toast.success('Registration successful!');
        router.push('/login');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-dark">
      {/* Left panel */}
      <div className="auth-brand-panel hidden lg:flex flex-col justify-between w-5/12 bg-gradient-to-br from-[#13132A] to-[#0F0F1A] p-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-56 h-56 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <Logo className="w-10 h-10 rounded-2xl" />
          <div>
            <p className="text-base font-bold text-white">Flourishing Hub</p>
            <p className="text-xs text-white/40">IIT Bombay</p>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-black gradient-text leading-tight">Join the<br />Community</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Create your account to access wellness workshops, track your journey, and connect with a supportive community at IIT Bombay.
          </p>
          <div className="glass rounded-2xl p-4 space-y-3">
            {['Access all wellness events', 'Track your progress', 'Connect with peers & mentors'].map((t) => (
              <div key={t} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-accent text-xs">✓</span>
                </div>
                <span className="text-sm text-white/70">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-white/20">© 2026 Flourishing Hub · IIT Bombay</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg py-8"
        >
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <Logo className="w-8 h-8 rounded-xl" />
            <p className="font-bold text-white">Flourishing Hub</p>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <Link href="/login" className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-white">Create Account</h2>
              <p className="text-sm text-white/50">Fill in your IITB details</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" icon={User} error={errors.name}>
                <input value={form.name} onChange={(e) => set('name', e.target.value)}
                  placeholder="Your full name" className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm" />
              </Field>
              <Field label="Roll No / Emp ID" icon={Hash} error={errors.rollNo}>
                <input value={form.rollNo} onChange={(e) => set('rollNo', e.target.value)}
                  placeholder="e.g. 23B030012" className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm" />
              </Field>
            </div>

            <div>
              <label className="text-xs font-medium text-white/60 mb-1.5 block">Programme</label>
              <select value={form.programme} onChange={(e) => set('programme', e.target.value)}
                className="input-dark w-full px-3 py-3 rounded-xl text-sm appearance-none">
                <option value="">Select</option>
                {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.programme && <p className="text-xs text-red-400 mt-1">{errors.programme}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-white/60 mb-1.5 block">Department</label>
              <div className="relative">
                <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 z-10" />
                <select value={form.department} onChange={(e) => set('department', e.target.value)}
                  className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm appearance-none">
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {errors.department && <p className="text-xs text-red-400 mt-1">{errors.department}</p>}
            </div>

            <Field label="Email Address" icon={Mail} error={errors.email}>
              <input value={form.email} onChange={(e) => set('email', e.target.value)}
                type="email" placeholder="yourname@iitb.ac.in"
                className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input value={form.password} onChange={(e) => set('password', e.target.value)}
                    type={showPassword ? 'text' : 'password'} placeholder="Min 8 chars, A-z, 0-9"
                    className="input-dark w-full pl-10 pr-10 py-3 rounded-xl text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)}
                    type={showConfirm ? 'text' : 'password'} placeholder="Re-enter password"
                    className="input-dark w-full pl-10 pr-10 py-3 rounded-xl text-sm" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-400 mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="btn-primary w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/50">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
