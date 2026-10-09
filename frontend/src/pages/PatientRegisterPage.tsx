import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle, CheckCircle, ArrowRight, KeyRound, LogIn } from 'lucide-react';

export const PatientRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginPatient } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    age: 45,
    gender: 'Male',
    district: 'Chennai',
    pincode: '600001',
    language_preference: 'en'
  });

  const [error, setError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState<boolean>(false);
  const [resetSentMsg, setResetSentMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: 'Empty', color: 'text-textLight/40', pct: 0 };
    if (pass.length < 6) return { label: 'Too Short', color: 'text-red-400', pct: 25 };
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass) && pass.length >= 8) {
      return { label: 'Strong Password', color: 'text-completedGreen', pct: 100 };
    }
    return { label: 'Medium', color: 'text-pendingAmber', pct: 60 };
  };

  const strength = getPasswordStrength(form.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsDuplicate(false);
    setResetSentMsg(null);
    setLoading(true);

    try {
      await authApi.patientRegister({
        ...form,
        email: form.email.trim().toLowerCase()
      });
      await loginPatient(form.email.trim().toLowerCase(), form.password);
      navigate('/patient-portal');
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Registration failed. Please check inputs.";
      setError(errMsg);
      if (err.response?.status === 409 || errMsg.toLowerCase().includes("already exists")) {
        setIsDuplicate(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email) {
      setError("Please enter your email address first.");
      return;
    }
    try {
      const res = await authApi.forgotPassword(form.email.trim().toLowerCase());
      setResetSentMsg("Password reset token dispatched to Email Outbox / Mailpit! Check /outbox to reset.");
    } catch {
      setError("Failed to dispatch password reset token.");
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-forestGreen text-limeAccent flex items-center justify-center mx-auto text-xl font-bold">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">Create Patient Account</h2>
          <p className="text-xs text-textLight/70">Register to receive an assigned unique Patient ID (PAT-XXXXXX)</p>
        </div>

        {resetSentMsg && (
          <div className="bg-completedGreen/20 border border-completedGreen p-4 rounded-xl text-xs text-completedGreen flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{resetSentMsg}</div>
          </div>
        )}

        {error && (
          <div className="bg-red-950/60 border border-red-500/50 p-4 rounded-xl text-xs text-red-200 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>

            {isDuplicate && (
              <div className="pt-2 border-t border-red-500/30 flex flex-wrap items-center justify-end gap-2">
                <Link
                  to="/patient/login"
                  className="bg-primaryGreen hover:bg-primaryGreen/80 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 text-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </Link>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="bg-forestGreen hover:bg-forestGreen/80 text-limeAccent px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 text-xs"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Forgot Password
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">Full Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Karthik Raman"
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white focus:outline-none focus:border-limeAccent"
              />
            </div>

            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">Email Address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="patient@example.com"
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white focus:outline-none focus:border-limeAccent"
              />
            </div>
          </div>

          <div>
            <label className="block text-textLight/70 mb-1 font-semibold">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Minimum 6 characters"
              className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white focus:outline-none focus:border-limeAccent"
            />
            {/* Password Strength Meter */}
            <div className="mt-2 flex items-center justify-between">
              <div className="w-full bg-darkBg h-1.5 rounded-full overflow-hidden mr-3">
                <div
                  className={`h-full transition-all duration-300 ${
                    strength.pct === 100 ? 'bg-completedGreen' : strength.pct >= 60 ? 'bg-pendingAmber' : 'bg-red-400'
                  }`}
                  style={{ width: `${strength.pct}%` }}
                />
              </div>
              <span className={`text-[10px] font-bold shrink-0 ${strength.color}`}>{strength.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">Age</label>
              <input
                type="number"
                required
                value={form.age}
                onChange={e => setForm({ ...form, age: parseInt(e.target.value) })}
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">Gender</label>
              <select
                value={form.gender}
                onChange={e => setForm({ ...form, gender: e.target.value })}
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">District</label>
              <select
                value={form.district}
                onChange={e => setForm({ ...form, district: e.target.value })}
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white"
              >
                <option value="Chennai">Chennai</option>
                <option value="Kanchipuram">Kanchipuram</option>
                <option value="Coimbatore">Coimbatore</option>
                <option value="Madurai">Madurai</option>
                <option value="Salem">Salem</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-limeAccent hover:bg-limeAccent/90 text-darkBg font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50"
          >
            {loading ? 'Creating Account & Assigned Patient ID...' : 'Register & Access Care Portal'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-forestGreen/60 text-xs">
          <span className="text-textLight/60">Already registered? </span>
          <Link to="/patient/login" className="text-limeAccent font-bold hover:underline">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
};
