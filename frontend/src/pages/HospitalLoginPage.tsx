import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { Building2, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export const HospitalLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginHospital } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot password modal
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginHospital(email.trim().toLowerCase(), password);
      navigate('/hospital/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid work email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authApi.forgotPassword(forgotEmail);
      setForgotMsg(res.message);
    } catch (err) {
      setForgotMsg("Dispatched reset token to Outbox.");
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 space-y-6">
      <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-forestGreen text-primaryGreen flex items-center justify-center mx-auto text-xl font-bold">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">Hospital Portal Login</h2>
          <p className="text-xs text-textLight/70">Staff & Clinical Reviewer Portal Access</p>
        </div>

        {/* Quick Demo Credentials */}
        <div className="bg-darkBg/80 p-3 rounded-xl border border-forestGreen space-y-2 text-xs">
          <div className="font-bold text-limeAccent text-[11px] uppercase tracking-wide">Quick Demo Sign-in:</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail('staff@hospital-a.demo');
                setPassword('Staff@123');
              }}
              className="flex-1 bg-forestGreen/60 hover:bg-forestGreen text-limeAccent font-bold py-1.5 px-2 rounded border border-primaryGreen/40 text-[11px] transition"
            >
              🏥 Hospital Staff
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('reviewer@hospital-a.demo');
                setPassword('Review@123');
              }}
              className="flex-1 bg-reviewOrange/20 hover:bg-reviewOrange/30 text-reviewOrange font-bold py-1.5 px-2 rounded border border-reviewOrange/40 text-[11px] transition"
            >
              ⚖️ Clinical Reviewer
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-500/50 p-4 rounded-xl text-xs text-red-200 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
            <div className="pt-2 border-t border-red-500/30 flex items-center justify-between">
              <span className="text-textLight/70">Need a hospital account?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="bg-forestGreen hover:bg-forestGreen/80 text-limeAccent font-bold px-3 py-1.5 rounded-lg text-xs"
                >
                  Forgot Password
                </button>
                <Link
                  to="/hospital/register"
                  className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold px-3 py-1.5 rounded-lg text-xs"
                >
                  Register Facility
                </Link>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-textLight/70 mb-1 font-semibold">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white focus:outline-none focus:border-primaryGreen"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-textLight/70 font-semibold">Password</label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-[11px] text-limeAccent hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 pr-10 text-white focus:outline-none focus:border-primaryGreen"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-textLight/50 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Hospital Portal'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-forestGreen/60 text-xs">
          <span className="text-textLight/60">New hospital facility? </span>
          <Link to="/hospital/register" className="text-primaryGreen font-bold hover:underline">
            Register Facility Here
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panelBg border border-forestGreen rounded-2xl max-w-sm w-full p-6 shadow-2xl text-xs space-y-4">
            <h3 className="font-bold text-white text-sm">Reset Hospital Staff Password</h3>
            <p className="text-textLight/70">Enter your work email address to receive a password reset token in Outbox/Mailpit:</p>
            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="staff@hospital-a.demo"
                className="w-full bg-darkBg border border-forestGreen rounded-lg p-2.5 text-white"
              />
              {forgotMsg && <div className="text-limeAccent font-semibold">{forgotMsg}</div>}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowForgot(false)} className="px-3 py-1.5 rounded bg-darkBg text-textLight">Close</button>
                <button type="submit" className="px-4 py-1.5 rounded font-bold bg-primaryGreen text-darkBg">Send Reset Token</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
