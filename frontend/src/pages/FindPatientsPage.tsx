import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { connectionApi, patientApi } from '../services/api';
import { PatientSearchResult, Patient, FollowupChart } from '../types';
import { 
  UserPlus, Search, ShieldCheck, CheckCircle2, Clock, X, Send, AlertCircle, 
  RefreshCw, FilePlus, Edit3, Grid, List, Sparkles, UserCheck, XCircle, ArrowRight
} from 'lucide-react';
import { ChartBuilderModal } from '../components/ChartBuilderModal';
import { StatusChip, Skeleton } from '../components/ui/Primitives';

export const FindPatientsPage: React.FC = () => {
  const [patients, setPatients] = useState<PatientSearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');

  // Request modal state
  const [requestTarget, setRequestTarget] = useState<PatientSearchResult | null>(null);
  const [requestMsg, setRequestMsg] = useState("You were treated at our hospital. We would like to coordinate your post-discharge follow-up care.");
  const [sending, setSending] = useState(false);

  // Chart Builder state
  const [builderPatient, setBuilderPatient] = useState<Patient | null>(null);
  const [builderChart, setBuilderChart] = useState<FollowupChart | null>(null);

  const loadPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await connectionApi.findPatients(query);
      setPatients(res);
    } catch (err: any) {
      console.error("Find patients error:", err);
      setError(err.response?.data?.detail || "Failed loading patient registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [query]);

  const handleOpenChartBuilder = async (p: PatientSearchResult) => {
    try {
      const patientObj: Patient = {
        id: p.id,
        patient_code: p.patient_code,
        name: p.name,
        age: 35,
        gender: "Unspecified",
        email: p.masked_email,
        phone: "",
        district: p.district,
        pincode: "",
        hospital_id: null,
        language_preference: "en",
        created_at: new Date().toISOString()
      };
      
      const chart = await patientApi.getChart(p.id);
      setBuilderChart(chart);
      setBuilderPatient(patientObj);
    } catch (err: any) {
      const patientObj: Patient = {
        id: p.id,
        patient_code: p.patient_code,
        name: p.name,
        age: 35,
        gender: "Unspecified",
        email: p.masked_email,
        phone: "",
        district: p.district,
        pincode: "",
        hospital_id: null,
        language_preference: "en",
        created_at: new Date().toISOString()
      };
      setBuilderChart(null);
      setBuilderPatient(patientObj);
    }
  };

  const handleSendRequest = async () => {
    if (!requestTarget) return;
    setSending(true);
    try {
      await connectionApi.sendRequest(requestTarget.id, requestMsg);
      setRequestTarget(null);
      await loadPatients();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed sending request.");
    } finally {
      setSending(false);
    }
  };

  const handleCancelRequest = async (connId: number) => {
    try {
      await connectionApi.action(connId, 'cancel');
      await loadPatients();
    } catch (err) {
      console.error(err);
    }
  };

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === search.toLowerCase() ? (
        <mark key={i} className="bg-mintGlow/40 text-textLight dark:text-textLight light:text-black font-bold px-0.5 rounded">{part}</mark>
      ) : part
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl border-mintGlow/25 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-textLight flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-mintGlow" />
            Find Patients & Post-Discharge Consent Registry
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Search registered patient accounts. Non-connected records display masked privacy email addresses.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-mintGlow/20">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'grid' ? 'bg-primaryGreen text-ink shadow-md font-bold' : 'text-mutedText hover:text-textLight'
            }`}
          >
            <Grid className="w-4 h-4" /> Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'table' ? 'bg-primaryGreen text-ink shadow-md font-bold' : 'text-mutedText hover:text-textLight'
            }`}
          >
            <List className="w-4 h-4" /> Table
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 rounded-2xl border-mintGlow/20 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-mutedText absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by patient name, Patient ID (PAT-XXXXXX), or email..."
            className="w-full bg-white border-2 border-mintGlow/40 rounded-xl pl-10 pr-4 py-2.5 text-xs text-black font-bold placeholder-slate-600 focus:outline-none focus:border-primaryGreen shadow-sm"
          />
        </div>
        <button
          onClick={loadPatients}
          disabled={loading}
          className="bg-forest hover:bg-forest/80 text-mintGlow font-bold text-xs py-2.5 px-4 rounded-xl border border-mintGlow/30 flex items-center gap-1.5 transition shadow"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height="180px" className="rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-card border-declinedRed/50 rounded-2xl p-8 text-center space-y-4 max-w-lg mx-auto shadow-2xl">
          <AlertCircle className="w-10 h-10 text-declinedRed mx-auto" />
          <div className="text-sm font-bold text-textLight">{error}</div>
          <button
            onClick={loadPatients}
            className="bg-primaryGreen text-ink font-bold text-xs py-2.5 px-4 rounded-xl shadow"
          >
            Retry Search
          </button>
        </div>
      ) : patients.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3">
          <Search className="w-10 h-10 text-mutedText mx-auto" />
          <h3 className="font-heading text-base font-bold text-textLight">No Registered Patients Found</h3>
          <p className="text-xs text-mutedText max-w-md mx-auto">
            No patient accounts match "{query}". Make sure the patient has created an account on the Patient Portal.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* CARD GRID VIEW WITH DISTINCT BUTTON COLORS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {patients.map(p => (
            <div key={p.id} className="glass-card glass-card-hover p-5 rounded-2xl border-mintGlow/20 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-forest text-mintGlow font-mono font-bold text-sm flex items-center justify-center border border-mintGlow/30 shadow">
                      {p.name ? p.name[0] : 'P'}
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-textLight dark:text-textLight light:text-slate-900 text-sm">
                        {highlightText(p.name, query)}
                      </h3>
                      <span className="text-[11px] font-mono text-mintGlow font-bold">{highlightText(p.patient_code, query)}</span>
                    </div>
                  </div>
                  <StatusChip 
                    status={
                      p.connection_status === 'accepted' ? 'completed' :
                      p.connection_status === 'pending' ? 'pending' :
                      p.connection_status === 'declined' ? 'declined' : 'needs_review'
                    }
                    customLabel={p.connection_status === 'accepted' ? 'Connected' : p.connection_status === 'pending' ? 'Pending' : 'Not Connected'}
                  />
                </div>

                <div className="space-y-1 text-xs text-mutedText bg-surface/60 p-3 rounded-xl border border-mintGlow/10">
                  <div className="flex items-center justify-between">
                    <span>District:</span>
                    <span className="text-textLight font-medium">{p.district}</span>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span>Privacy Email:</span>
                    <span className="text-textLight font-medium">{highlightText(p.masked_email, query)}</span>
                  </div>
                </div>
              </div>

              {/* DISTINCT ACTION BUTTONS */}
              <div className="pt-2 border-t border-mintGlow/10 space-y-2">
                {p.connection_status === 'pending' && p.connection_id && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-pendingAmber font-mono">Request Pending</span>
                    <button
                      onClick={() => handleCancelRequest(p.connection_id!)}
                      className="bg-declinedRed/15 hover:bg-declinedRed/30 text-declinedRed border border-declinedRed/40 text-xs px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel Request
                    </button>
                  </div>
                )}

                {(p.connection_status === 'not_connected' || p.connection_status === 'declined' || p.connection_status === 'revoked') && (
                  <button
                    onClick={() => setRequestTarget(p)}
                    className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-ink font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Send Follow Request
                  </button>
                )}

                {p.connection_status === 'accepted' && (
                  <div className="flex items-center gap-2 w-full">
                    <button
                      onClick={() => handleOpenChartBuilder(p)}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 hover:opacity-95 text-ink font-bold text-xs py-2.5 px-3.5 rounded-xl shadow-glow-primary transition flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Create Chart
                    </button>
                    <button
                      onClick={() => handleOpenChartBuilder(p)}
                      className="glass-panel hover:bg-forest/50 text-mintGlow border border-mintGlow/30 font-bold text-xs py-2.5 px-3 rounded-xl transition flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="glass-card rounded-2xl overflow-hidden border-mintGlow/20 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-mintGlow uppercase font-mono border-b border-mintGlow/20">
                <tr>
                  <th className="p-3.5">Patient ID</th>
                  <th className="p-3.5">Full Name</th>
                  <th className="p-3.5">Privacy Email</th>
                  <th className="p-3.5">District</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mintGlow/10 text-textLight">
                {patients.map(p => (
                  <tr key={p.id} className="hover:bg-forest/20 transition">
                    <td className="p-3.5 font-mono text-mintGlow font-bold">{highlightText(p.patient_code, query)}</td>
                    <td className="p-3.5 font-bold text-textLight dark:text-textLight light:text-slate-900">{highlightText(p.name, query)}</td>
                    <td className="p-3.5 font-mono text-mutedText">{highlightText(p.masked_email, query)}</td>
                    <td className="p-3.5">{p.district}</td>
                    <td className="p-3.5">
                      <StatusChip 
                        status={
                          p.connection_status === 'accepted' ? 'completed' :
                          p.connection_status === 'pending' ? 'pending' :
                          p.connection_status === 'declined' ? 'declined' : 'needs_review'
                        }
                        customLabel={p.connection_status === 'accepted' ? 'Connected' : p.connection_status === 'pending' ? 'Pending' : 'Not Connected'}
                      />
                    </td>
                    <td className="p-3.5 text-right">
                      {p.connection_status === 'pending' && p.connection_id && (
                        <button
                          onClick={() => handleCancelRequest(p.connection_id!)}
                          className="bg-declinedRed/15 hover:bg-declinedRed/30 text-declinedRed border border-declinedRed/40 text-xs px-3.5 py-1.5 rounded-xl font-bold transition inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel Request
                        </button>
                      )}

                      {(p.connection_status === 'not_connected' || p.connection_status === 'declined' || p.connection_status === 'revoked') && (
                        <button
                          onClick={() => setRequestTarget(p)}
                          className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-ink font-bold text-xs py-1.5 px-3.5 rounded-xl shadow transition inline-flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" /> Send Follow Request
                        </button>
                      )}

                      {p.connection_status === 'accepted' && (
                        <button
                          onClick={() => handleOpenChartBuilder(p)}
                          className="bg-gradient-to-r from-emerald-500 to-lime-500 hover:opacity-95 text-ink font-bold text-xs py-1.5 px-3.5 rounded-xl shadow inline-flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Create Chart
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Send Request Modal */}
      {requestTarget && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 border-mintGlow/30 shadow-2xl text-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-mintGlow/15">
              <h3 className="font-heading font-bold text-textLight text-sm">Send Connection Request</h3>
              <button onClick={() => setRequestTarget(null)} className="text-mutedText hover:text-textLight">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <span className="text-mutedText block">Target Patient:</span>
              <strong className="text-textLight text-sm font-heading">{requestTarget.name} ({requestTarget.patient_code})</strong>
            </div>

            <div>
              <label className="block text-mutedText font-medium mb-1">Custom Request Message:</label>
              <textarea
                rows={3}
                value={requestMsg}
                onChange={e => setRequestMsg(e.target.value)}
                className="w-full bg-surface border border-mintGlow/20 rounded-xl p-3 text-textLight focus:outline-none focus:border-mintGlow"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setRequestTarget(null)} className="px-4 py-2 rounded-xl glass-panel text-mutedText">Cancel</button>
              <button
                onClick={handleSendRequest}
                disabled={sending}
                className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-teal-500 to-cyan-500 text-ink flex items-center gap-1.5 shadow"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Transmitting...' : 'Send Follow Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart Builder Modal */}
      {builderPatient && (
        <ChartBuilderModal
          patient={builderPatient}
          existingChart={builderChart}
          onClose={() => setBuilderPatient(null)}
          onSaved={() => {
            setBuilderPatient(null);
            loadPatients();
          }}
        />
      )}
    </div>
  );
};
