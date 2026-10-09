import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi, hospitalApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Provider } from '../types';
import { Building2, Search, AlertCircle, ArrowRight, CheckCircle, LogIn, KeyRound } from 'lucide-react';

export const HospitalRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginHospital } = useAuth();

  const [datasetSearch, setDatasetSearch] = useState('');
  const [matchingHospitals, setMatchingHospitals] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [customHospital, setCustomHospital] = useState(false);

  const [form, setForm] = useState({
    hospital_name: 'Apollo City Center',
    provider_id: '',
    staff_name: '',
    email: '',
    password: '',
    district: 'Chennai',
    facility_type: 'Hospital',
    ownership: 'Private'
  });

  const [error, setError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState<boolean>(false);
  const [resetSentMsg, setResetSentMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (datasetSearch.trim()) {
      hospitalApi.search({ q: datasetSearch }).then(res => setMatchingHospitals(res.slice(0, 8)));
    }
  }, [datasetSearch]);

  const handleSelectDatasetProvider = (p: Provider) => {
    setSelectedProvider(p);
    setForm({
      ...form,
      hospital_name: p.name,
      provider_id: p.provider_id,
      district: p.district,
      facility_type: p.facility_type,
      ownership: p.ownership
    });
    setCustomHospital(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsDuplicate(false);
    setResetSentMsg(null);
    setLoading(true);

    try {
      await authApi.hospitalRegister({
        ...form,
        email: form.email.trim().toLowerCase()
      });
      await loginHospital(form.email.trim().toLowerCase(), form.password);
      navigate('/hospital/dashboard');
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
      await authApi.forgotPassword(form.email.trim().toLowerCase());
      setResetSentMsg("Password reset token dispatched to Email Outbox / Mailpit! Check /outbox to reset.");
    } catch {
      setError("Failed to dispatch password reset token.");
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-forestGreen text-primaryGreen flex items-center justify-center mx-auto text-xl font-bold">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">Register Hospital Facility</h2>
          <p className="text-xs text-textLight/70">Select your facility from the public Tamil Nadu directory or register a new facility</p>
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
                  to="/hospital/login"
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
          {/* Search Dataset Hospital */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-textLight/70 font-semibold">Hospital Facility Name</label>
              <button
                type="button"
                onClick={() => {
                  setCustomHospital(!customHospital);
                  setSelectedProvider(null);
                  setForm({ ...form, provider_id: '', hospital_name: '' });
                }}
                className="text-[11px] text-limeAccent hover:underline"
              >
                {customHospital ? "Search TN Directory Dataset" : "My hospital is not listed"}
              </button>
            </div>

            {!customHospital ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-textLight/50 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={datasetSearch}
                    onChange={e => setDatasetSearch(e.target.value)}
                    placeholder="Type to search ~2,392 Tamil Nadu directory hospitals..."
                    className="w-full bg-darkBg border border-forestGreen rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-primaryGreen"
                  />
                </div>

                {matchingHospitals.length > 0 && (
                  <div className="bg-darkBg border border-forestGreen rounded-xl max-h-44 overflow-y-auto divide-y divide-forestGreen/40">
                    {matchingHospitals.map(p => (
                      <div
                        key={p.provider_id}
                        onClick={() => handleSelectDatasetProvider(p)}
                        className={`p-2.5 cursor-pointer hover:bg-forestGreen/40 flex items-center justify-between ${
                          selectedProvider?.provider_id === p.provider_id ? 'bg-forestGreen/60 font-bold' : ''
                        }`}
                      >
                        <div>
                          <div className="text-white font-semibold">{p.name}</div>
                          <div className="text-[10px] text-textLight/60">{p.district} - {p.facility_type} ({p.ownership})</div>
                        </div>
                        <span className="text-[10px] text-limeAccent font-mono">{p.provider_id}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedProvider && (
                  <div className="bg-forestGreen/30 border border-primaryGreen/40 p-3 rounded-xl text-limeAccent text-xs font-semibold">
                    Selected: {selectedProvider.name} [{selectedProvider.district}] ({selectedProvider.provider_id})
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                required
                value={form.hospital_name}
                onChange={e => setForm({ ...form, hospital_name: e.target.value, provider_id: '' })}
                placeholder="Type hospital facility name..."
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">Staff Admin Name</label>
              <input
                type="text"
                required
                value={form.staff_name}
                onChange={e => setForm({ ...form, staff_name: e.target.value })}
                placeholder="Dr. Rajesh Kumar"
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">Work Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="staff@hospital.demo"
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 6 characters"
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white"
              />
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
            disabled={loading || (!form.hospital_name && !selectedProvider)}
            className="w-full bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50"
          >
            {loading ? 'Registering Facility & Staff Account...' : 'Register Hospital & Access Portal'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-forestGreen/60 text-xs">
          <span className="text-textLight/60">Already registered? </span>
          <Link to="/hospital/login" className="text-primaryGreen font-bold hover:underline">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
};
