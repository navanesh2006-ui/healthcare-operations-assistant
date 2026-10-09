import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { EmailLogItem } from '../types';
import { Mail, Send, CheckCircle, AlertCircle, RefreshCw, Shield, AlertTriangle } from 'lucide-react';

export const EmailStatusPage: React.FC = () => {
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('gmhospital1980@gmail.com');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getEmailLogs(20);
      setLogs(data);
    } catch (err: any) {
      console.error("Failed loading email logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setSending(true);
    setToast(null);
    try {
      const res = await adminApi.sendTestEmail(testEmail.trim());
      setToast({ type: 'success', text: res.message || 'Test email dispatched successfully via SMTP!' });
      await fetchLogs();
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Email delivery failed via SMTP.';
      setToast({ type: 'error', text: `Email failed: ${errorMsg}` });
      await fetchLogs();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xl animate-fade-in ${
            toast.type === 'success'
              ? 'bg-forestGreen/40 border-primaryGreen text-limeAccent'
              : 'bg-red-500/20 border-red-500 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-limeAccent shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-textLight/60 hover:text-white ml-4">✕</button>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-forestGreen text-limeAccent flex items-center justify-center font-bold">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              CareBridge Email System Status
              <span className="text-xs bg-forestGreen text-limeAccent border border-primaryGreen/40 px-2 py-0.5 rounded-full font-mono">
                /admin/email-status
              </span>
            </h1>
            <p className="text-xs text-textLight/70 font-mono">
              Live Gmail SMTP delivery logs & diagnostic status viewer (Last 20 attempts)
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="bg-darkBg hover:bg-darkBg/80 text-limeAccent border border-forestGreen px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      {/* Send Test Email Panel */}
      <div className="bg-panelBg border border-forestGreen rounded-2xl p-6 shadow-lg space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-limeAccent" />
          Send SMTP Diagnostic Test Email
        </h2>

        <form onSubmit={handleSendTestEmail} className="flex flex-wrap gap-3 items-center">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter target recipient email address..."
            className="flex-1 min-w-[280px] bg-darkBg border border-forestGreen/70 rounded-xl px-4 py-2.5 text-xs text-white placeholder-textLight/40 focus:outline-none focus:border-limeAccent"
            required
          />
          <button
            type="submit"
            disabled={sending}
            className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition shadow disabled:opacity-50"
          >
            {sending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Dispatching via SMTP...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Test Email
              </>
            )}
          </button>
        </form>
      </div>

      {/* Logs Table */}
      <div className="bg-panelBg border border-forestGreen rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-limeAccent" />
            Last 20 Email Dispatch Log Entries
          </span>
          <span className="text-xs text-textLight/60 font-mono font-normal">
            Total fetched: {logs.length}
          </span>
        </h2>

        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-textLight border-collapse">
              <thead>
                <tr className="border-b border-forestGreen/60 text-limeAccent font-mono uppercase text-[11px]">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Error / Details</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forestGreen/30 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-darkBg/50 transition">
                    <td className="py-3 px-3 text-textLight/60">#{log.id}</td>
                    <td className="py-3 px-3 font-semibold text-white">{log.recipient_email}</td>
                    <td className="py-3 px-3 text-textLight font-sans max-w-[200px] truncate">{log.subject}</td>
                    <td className="py-3 px-3 text-limeAccent/80">{log.email_type}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          log.status === 'sent'
                            ? 'bg-forestGreen/40 border-primaryGreen text-limeAccent'
                            : log.status === 'failed'
                            ? 'bg-red-500/20 border-red-500 text-red-400'
                            : 'bg-pendingAmber/20 border-pendingAmber text-pendingAmber'
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-red-300 max-w-[220px] truncate" title={log.error_message || ''}>
                      {log.error_message || '—'}
                    </td>
                    <td className="py-3 px-3 text-textLight/50">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-textLight/50 italic py-8 text-xs">
            No email log records found in the database yet. Click "Send Test Email" above to test SMTP delivery!
          </div>
        )}
      </div>
    </div>
  );
};
