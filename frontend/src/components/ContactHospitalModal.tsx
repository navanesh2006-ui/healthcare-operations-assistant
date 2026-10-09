import React, { useState } from 'react';
import { queryApi } from '../services/api';
import { MessageSquare, Send, X, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  taskId?: number;
  taskTitle?: string;
  onSuccess?: () => void;
}

export const ContactHospitalModal: React.FC<Props> = ({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  onSuccess
}) => {
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setSubmitting(true);
    setError(null);
    setSentMsg(null);

    try {
      await queryApi.contactHospital(question.trim(), taskId);
      setSentMsg("Your question was successfully transmitted to the hospital care team! A confirmation email was sent to your inbox.");
      setQuestion('');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSentMsg(null);
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error("Contact hospital error:", err);
      setError(err.response?.data?.detail || "Failed to submit question to hospital.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panelBg border-2 border-forestGreen rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-xs">
        <div className="flex items-center justify-between border-b border-forestGreen pb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-limeAccent" />
            <h2 className="text-base font-bold text-white">Contact Hospital Care Team</h2>
          </div>
          <button onClick={onClose} className="text-textLight/50 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {taskTitle && (
          <div className="bg-forestGreen/40 border border-primaryGreen/30 p-3 rounded-xl text-textLight">
            <span className="text-limeAccent font-semibold">Related Task:</span> {taskTitle}
          </div>
        )}

        {sentMsg ? (
          <div className="bg-completedGreen/20 border border-completedGreen p-4 rounded-xl text-completedGreen flex items-start gap-2">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>{sentMsg}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-950/60 border border-red-500/50 p-3 rounded-xl text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <div>
              <label className="block text-textLight/80 font-semibold mb-1">Your Question or Message for the Care Team:</label>
              <textarea
                required
                rows={4}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ask about your medication, symptoms, wound care, or upcoming follow-up appointments..."
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white placeholder-textLight/40 focus:outline-none focus:border-limeAccent"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-darkBg border border-forestGreen text-textLight hover:bg-forestGreen/30 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !question.trim()}
                className="bg-limeAccent hover:bg-limeAccent/90 text-darkBg font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Transmitting...' : 'Send Question to Hospital'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
