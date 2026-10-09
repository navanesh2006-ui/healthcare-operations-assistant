import React, { useState, useEffect } from 'react';
import { connectionApi } from '../services/api';
import { ConnectionOut } from '../types';
import { Users, CheckCircle, X, ShieldAlert, Building2, Clock, AlertCircle, RefreshCw } from 'lucide-react';

export const PatientRequestsPage: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await connectionApi.getMyConnections();
      setConnections(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed loading connections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleAction = async (connId: number, action: 'accept' | 'decline' | 'revoke') => {
    setActionLoadingId(connId);
    setActionError(null);
    setActionSuccessMsg(null);
    try {
      await connectionApi.action(connId, action);
      const actionLabels = { accept: 'accepted', decline: 'declined', revoke: 'revoked connection for' };
      setActionSuccessMsg(`Successfully ${actionLabels[action]} hospital request.`);
      await loadConnections();
    } catch (err: any) {
      console.error("Connection action error:", err);
      setActionError(err.response?.data?.detail || "Failed to update connection request status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingRequests = connections.filter(c => c.status === 'pending');
  const activeConnections = connections.filter(c => c.status === 'accepted');
  const pastConnections = connections.filter(c => c.status === 'declined' || c.status === 'revoked');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="pb-4 border-b border-forestGreen">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-7 h-7 text-primaryGreen" />
          Hospital Connections & Follow-up Consent
        </h1>
        <p className="text-xs text-textLight/70">
          Manage incoming hospital follow-up requests. Accept to allow hospital follow-up charts, or revoke anytime to stop access.
        </p>
      </div>

      {actionError && (
        <div className="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            {actionError}
          </span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-white font-bold text-sm">✕</button>
        </div>
      )}

      {actionSuccessMsg && (
        <div className="bg-forestGreen/60 border border-primaryGreen text-limeAccent p-4 rounded-xl text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primaryGreen shrink-0" />
            {actionSuccessMsg}
          </span>
          <button onClick={() => setActionSuccessMsg(null)} className="text-limeAccent hover:text-white font-bold text-sm">✕</button>
        </div>
      )}

      {loading ? (
        <div className="bg-panelBg border border-forestGreen rounded-xl p-12 text-center text-limeAccent animate-pulse">
          Loading Connection Requests...
        </div>
      ) : error ? (
        <div className="bg-panelBg border border-red-500/50 rounded-xl p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <div className="text-sm font-bold text-white">{error}</div>
          <button onClick={loadConnections} className="bg-primaryGreen text-darkBg font-bold text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 mx-auto">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Incoming Pending Requests */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-pendingAmber" />
              Incoming Follow-Up Requests ({pendingRequests.length})
            </h2>

            {pendingRequests.length === 0 ? (
              <div className="bg-panelBg border border-forestGreen/60 rounded-xl p-6 text-center text-xs text-textLight/60">
                No pending hospital connection requests.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map(c => (
                  <div key={c.id} className="bg-panelBg border-2 border-pendingAmber/60 rounded-2xl p-5 shadow-lg space-y-3 text-xs">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-forestGreen text-limeAccent flex items-center justify-center font-bold">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">{c.hospital_name || c.hospital_id}</h3>
                          <span className="text-[10px] text-limeAccent font-mono">Hospital ID: {c.hospital_id}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-textLight/50 font-mono">{new Date(c.requested_at).toLocaleDateString()}</span>
                    </div>

                    <div className="bg-darkBg/80 p-3 rounded-xl border border-forestGreen italic text-textLight/90">
                      "{c.message}"
                    </div>

                    <div className="flex gap-3 justify-end pt-1">
                      <button
                        disabled={actionLoadingId === c.id}
                        onClick={() => handleAction(c.id, 'decline')}
                        className="bg-darkBg hover:bg-red-950/60 text-red-300 border border-forestGreen font-semibold text-xs py-2 px-4 rounded-xl transition disabled:opacity-50"
                      >
                        {actionLoadingId === c.id ? 'Processing...' : 'Decline'}
                      </button>
                      <button
                        disabled={actionLoadingId === c.id}
                        onClick={() => handleAction(c.id, 'accept')}
                        className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-xs py-2 px-5 rounded-xl shadow transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {actionLoadingId === c.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing...
                          </>
                        ) : (
                          'Accept & Share Consent'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Connected Hospitals */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-completedGreen" />
              Connected Healthcare Facilities ({activeConnections.length})
            </h2>

            {activeConnections.length === 0 ? (
              <div className="bg-panelBg border border-forestGreen/60 rounded-xl p-6 text-center text-xs text-textLight/60">
                No active connected healthcare facilities. Accept an incoming request above to connect.
              </div>
            ) : (
              <div className="space-y-3">
                {activeConnections.map(c => (
                  <div key={c.id} className="bg-panelBg border border-forestGreen/80 rounded-2xl p-5 shadow flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-forestGreen text-completedGreen flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">{c.hospital_name || c.hospital_id}</h3>
                        <span className="text-[10px] text-limeAccent font-mono">Hospital ID: {c.hospital_id} | Status: Connected</span>
                      </div>
                    </div>

                    <button
                      disabled={actionLoadingId === c.id}
                      onClick={() => handleAction(c.id, 'revoke')}
                      className="bg-darkBg hover:bg-red-950/60 text-red-400 border border-forestGreen font-bold text-xs py-2 px-4 rounded-xl transition disabled:opacity-50"
                    >
                      {actionLoadingId === c.id ? 'Revoking...' : 'Revoke Connection'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
