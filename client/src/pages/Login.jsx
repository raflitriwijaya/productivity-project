import { useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

/**
 * Public login page. Handles four states per §7.3:
 *  idle → submitting → success (redirect) → error (inline message)
 *
 * @returns {JSX.Element}
 */
export default function Login() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState('idle'); // 'idle' | 'submitting' | 'error'
  const [serverError, setServerError] = useState('');

  // Already authenticated → bounce to dashboard
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
    // Clear field-level error on change
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.';
    if (!form.password) next.password = 'Password is required.';
    return next;
  };

  const handleSubmit = async () => {
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitStatus('submitting');
    setServerError('');

    try {
      await api.post('/api/auth/login', {
        email: form.email.trim(),
        password: form.password,
      });
      // Session cookie is set by the server; navigate to dashboard
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitStatus('error');
      setServerError(err.message);
    }
  };

  const isSubmitting = submitStatus === 'submitting';

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <p className="text-sm font-bold text-stone-900 dark:text-gray-50 tracking-tight">
            Rafli's Suite
          </p>
          <p className="text-[10px] text-stone-400 dark:text-gray-500 tracking-widest uppercase mt-0.5">
            Laboratory
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-stone-200 dark:border-gray-700 shadow-sm p-6">
          <h1 className="text-lg font-semibold text-stone-900 dark:text-gray-50 tracking-[-0.01em] mb-1">
            Sign in
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mb-6">
            Enter your credentials to access your workspace.
          </p>

          {/* Server-level error banner */}
          {submitStatus === 'error' && serverError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-700 dark:text-red-400">{serverError}</p>
            </div>
          )}

          <div className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              disabled={isSubmitting}
              autoComplete="email"
            />

            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
          </div>

          <Button
            variant="primary"
            size="md"
            className="w-full mt-6 justify-center"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            <LogIn size={16} />
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>

        {/* Footer link */}
        <p className="text-center text-xs text-stone-500 dark:text-gray-400 mt-4">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
