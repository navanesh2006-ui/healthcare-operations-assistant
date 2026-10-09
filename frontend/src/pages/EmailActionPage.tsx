import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { emailActionApi } from '../services/api';
import { EmailActionDetails } from '../types';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Calendar, Building2, User, RefreshCw, HeartPulse } from 'lucide-react';

export const EmailActionPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const preselectedAction = searchParams.get('action');

  const [details, setDetails] = useState<EmailActionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'decline'; message: string } | null>(null);

  const loadTokenDetails = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await emailActionApi.getDetails(token);
      setDetails(res);
    } catch (err: any) {
      console.error("Failed loading action token details:", err);
      setError(err.response?.data?.detail || "Invalid or expired action token link.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokenDetails();
  }, [token]);

  // Auto-execute if query param ?action=accept or ?action=decline is passed
  useEffect(() => {
    if (details && !details.is_used && !details.is_expired && !resultMsg && !submitting) {
      if (preselectedAction === 'accept' || preselectedAction === 'decline') {
        handleAction(preselectedAction as 'accept' | 'decline');
      }
    }
  }, [details, preselectedAction]);

  const handleAction = async (actionType: 'accept' | 'decline') => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await emailActionApi.submitAction(token, actionType);
      if (actionType === 'accept') {
        setResultMsg({
          type: 'success',
          message: "Appointment Confirmed! The patient has been notified via email with an iCalendar (.ics) invite and updated in the app."
        });
      } else {
        setResultMsg({
          type: 'decline',
          message: "Request Declined. The patient has been notified and prompted to choose an alternate time slot."
        });
      }
      await loadTokenDetails();
    } catch (err: any) {
      console.error("Action submit error:", err);
      setError(err.response?.data?.detail || "Failed to process appointment action.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center text-limeAccent animate-pulse space-y-3">
        <HeartPulse className="w-10 h-10 text-primaryGreen animate-spin" />
        <div className="text-base font-semibold">Verifying Secure Email Action Token...</div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="max-w-lg mx-auto my-12 bg-panelBg border-2 border-red-500/50 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Action Link Expired or Invalid</h2>
        <p className="text-xs text-textLight/70">{error || "This action token is invalid, expired, or has already been completed."}</p>
        <div className="pt-4">
          <Link
            to="/hospital/login"
            className="inline-flex items-center gap-2 bg-primaryGreen text-darkBg font-bold text-xs px-5 py-2.5 rounded-xl shadow hover:bg-primaryGreen/90 transition"
          >
            Go to CareBridge Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-10 space-y-6">
      <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 border-b border-forestGreen pb-6">
          <div className="w-12 h-12 rounded-xl bg-forestGreen text-limeAccent flex items-center justify-center mx-auto text-xl font-bold">
            <Calendar className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Follow-Up Booking Action</h1>
          <p className="text-xs text-textLight/70">Single-use secure confirmation portal for hospital care team</p>
        </div>

        {/* Success / Decline Response Banner */}
        {resultMsg ? (
          <div className={`p-5 rounded-xl border text-xs space-y-3 ${
            resultMsg.type === 'success' ? 'bg-completedGreen/20 border-completedGreen text-white' : 'bg-red-950/60 border-red-500/50 text-red-200'
          }`}>
            <div className="flex items-center gap-2 text-base font-bold">
              {resultMsg.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-completedGreen shrink-0" /> : <XCircle className="w-6 h-6 text-red-400 shrink-0" />}
              {resultMsg.type === 'success' ? 'Appointment Confirmed & Reserved' : 'Request Declined'}
            </div>
            <p>{resultMsg.message}</p>
          </div>
        ) : details.is_used ? (
          <div className="bg-forestGreen/40 border border-primaryGreen/40 p-4 rounded-xl text-xs text-limeAccent flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>This single-use action link has already been completed (Current Status: <strong>{details.status}</strong>).</div>
          </div>
        ) : details.is_expired ? (
          <div className="bg-red-950/60 border border-red-500/50 p-4 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <Clock className="w-5 h-5 shrink-0" />
            <div>This action link expired after 7 days. Please review booking requests inside the Hospital Portal.</div>
          </div>
        ) : null}

        {/* Request Details Card */}
        <div className="bg-darkBg/60 border border-forestGreen p-5 rounded-xl space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-forestGreen/40 pb-2.5">
            <span className="text-textLight/60 font-semibold">Requested Facility:</span>
            <span className="font-bold text-white text-sm flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primaryGreen" /> {details.hospital_name} ({details.hospital_district})
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-forestGreen/40 pb-2.5">
            <span className="text-textLight/60 font-semibold">Patient Name & ID:</span>
            <span className="font-bold text-limeAccent flex items-center gap-1.5">
              <User className="w-4 h-4" /> {details.patient_name} <code className="bg-forestGreen text-limeAccent px-1.5 py-0.5 rounded text-[10px] font-mono">{details.patient_code}</code>
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-forestGreen/40 pb-2.5">
            <span className="text-textLight/60 font-semibold">Requested Doctor:</span>
            <span className="font-bold text-white">{details.doctor_name} ({details.department})</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-textLight/60 font-semibold">Date & Time Slot:</span>
            <span className="font-bold text-completedGreen">{details.date_slot} ({details.time_slot})</span>
          </div>
        </div>

        {/* Action Buttons */}
        {!details.is_used && !details.is_expired && !resultMsg && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => handleAction('accept')}
              disabled={submitting}
              className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Accept Appointment
            </button>

            <button
              onClick={() => handleAction('decline')}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Decline Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
