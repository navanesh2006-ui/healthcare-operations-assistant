import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi, adminApi } from '../services/api';
import { User, KeyRound, Shield, CheckCircle, AlertCircle, Calendar, Mail, Building2, UserCheck, Brain } from 'lucide-react';

export const AccountPage: React.FC = () => {
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: 'Empty', color: 'text-textLight/40', pct: 0 };
    if (pass.length < 6) return { label: 'Too Short', color: 'text-red-400', pct: 25 };
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass) && pass.length >= 8) {
      return { label: 'Strong Password', color: 'text-completedGreen', pct: 100 };
    }
    return { label: 'Medium', color: 'text-pendingAmber', pct: 60 };
  };

  const strength = getPasswordStrength(newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      setMsg({ type: 'success', text: 'Password changed successfully!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update password.' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-8 text-center text-textLight/70 font-mono">
        Please log in to view account details.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-forestGreen text-limeAccent flex items-center justify-center font-bold">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">My Account Profile</h1>
          <p className="text-xs text-textLight/70 font-mono">
            ID: <span className="text-limeAccent font-bold">{user.user_code}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Info Card */}
        <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-6 shadow-xl space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-forestGreen pb-3">
            <UserCheck className="w-5 h-5 text-limeAccent" />
            Account Overview
          </h2>

          <div className="space-y-3 text-xs">
            <div className="bg-darkBg p-3.5 rounded-xl border border-forestGreen/60 flex items-center justify-between">
              <span className="text-textLight/60 font-medium">Assigned User Code</span>
              <span className="font-mono font-bold text-limeAccent text-sm bg-forestGreen/40 px-2.5 py-1 rounded-lg border border-primaryGreen/30">
                {user.user_code}
              </span>
            </div>

            <div className="bg-darkBg p-3.5 rounded-xl border border-forestGreen/60 flex items-center justify-between">
              <span className="text-textLight/60 font-medium">Full Name</span>
              <span className="font-semibold text-white">{user.name}</span>
            </div>

            <div className="bg-darkBg p-3.5 rounded-xl border border-forestGreen/60 flex items-center justify-between">
              <span className="text-textLight/60 font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primaryGreen" />
                Email Address
              </span>
              <span className="font-mono text-white">{user.email}</span>
            </div>

            <div className="bg-darkBg p-3.5 rounded-xl border border-forestGreen/60 flex items-center justify-between">
              <span className="text-textLight/60 font-medium flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-limeAccent" />
                Account Role
              </span>
              <span className="capitalize font-bold text-limeAccent bg-darkBg px-2 py-0.5 rounded border border-limeAccent/30">
                {user.role.replace('_', ' ')}
              </span>
            </div>

            {user.hospital_id && (
              <div className="bg-darkBg p-3.5 rounded-xl border border-forestGreen/60 flex items-center justify-between">
                <span className="text-textLight/60 font-medium flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primaryGreen" />
                  Hospital ID
                </span>
                <span className="font-mono font-bold text-limeAccent">{user.hospital_id}</span>
              </div>
            )}
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-6 shadow-xl space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-forestGreen pb-3">
            <KeyRound className="w-5 h-5 text-pendingAmber" />
            Change Password
          </h2>

          {msg && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2 ${
                msg.type === 'success'
                  ? 'bg-completedGreen/20 border border-completedGreen text-completedGreen'
                  : 'bg-red-950/60 border border-red-500/50 text-red-200'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div>{msg.text}</div>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">Current Password</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white focus:outline-none focus:border-limeAccent"
              />
            </div>

            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white focus:outline-none focus:border-limeAccent"
              />

              {/* Password Strength Meter */}
              {newPassword && (
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
              )}
            </div>

            <div>
              <label className="block text-textLight/70 mb-1 font-semibold">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white focus:outline-none focus:border-limeAccent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-forestGreen hover:bg-forestGreen/80 text-limeAccent font-bold py-3 px-4 rounded-xl border border-primaryGreen/40 transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Advanced: AI Knowledge Base (Admin/Staff Only) */}
      {user.role !== 'patient' && (
        <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-limeAccent" />
                Advanced: AI Knowledge Base
              </h3>
              <p className="text-xs text-textLight/70 mt-1">
                Inspect Second Brain vault nodes, review reviewer decisions, and resync markdown guidelines.
              </p>
            </div>
            <Link
              to="/admin/second-brain"
              className="bg-forestGreen hover:bg-forestGreen/80 text-limeAccent font-bold text-xs py-2.5 px-4 rounded-xl border border-primaryGreen/40 flex items-center gap-2 transition shadow cursor-pointer"
            >
              <Brain className="w-4 h-4" />
              Open AI Knowledge Base (/admin/second-brain)
            </Link>
          </div>
        </div>
      )}

      {/* Hidden/Admin Email System Diagnostics & Status Panel */}
      <EmailSystemDiagnosticPanel />
    </div>
  );
};

const EmailSystemDiagnosticPanel: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [testEmail, setTestEmail] = useState('gmhospital1980@gmail.com');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      const res = await adminApi.getEmailLogs(10);
      setLogs(res);
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    loadLogs();
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    setSending(true);
    setMsg(null);
    try {
      await adminApi.sendTestEmail(testEmail.trim());
      setMsg(`Real test email successfully dispatched via Gmail SMTP to ${testEmail}!`);
      await loadLogs();
    } catch (err: any) {
      setMsg(`SMTP Error: ${err.response?.data?.detail || "Failed to dispatch test email."}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-forestGreen pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-limeAccent" />
            Email System Diagnostic & SMTP Delivery Log
          </h3>
          <p className="text-xs text-textLight/70">
            Internal debugging status (Last 10 emails dispatched via Gmail SMTP to real recipient inboxes)
          </p>
        </div>
        <form onSubmit={handleSendTest} className="flex items-center gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="bg-darkBg border border-forestGreen rounded-lg px-3 py-1.5 text-xs text-white"
          />
          <button
            type="submit"
            disabled={sending}
            className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-xs py-1.5 px-3 rounded-lg shadow disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Test Email'}
          </button>
        </form>
      </div>

      {msg && (
        <div className="bg-forestGreen/40 border border-primaryGreen/40 p-3 rounded-xl text-xs text-limeAccent font-mono">
          {msg}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-forestGreen/60 text-textLight/60 font-semibold">
              <th className="py-2 px-3">Recipient</th>
              <th className="py-2 px-3">Subject</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forestGreen/30">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-textLight/40 italic">
                  No email delivery logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-forestGreen/20 font-mono">
                  <td className="py-2.5 px-3 font-semibold text-white">{log.recipient_email}</td>
                  <td className="py-2.5 px-3 text-textLight/90">{log.subject}</td>
                  <td className="py-2.5 px-3 text-limeAccent">{log.email_type}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.status === 'sent' ? 'bg-completedGreen/20 text-completedGreen border border-completedGreen/40' : 'bg-red-950/60 text-red-300 border border-red-500/40'
                    }`}>
                      {log.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-textLight/50 text-[11px]">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
