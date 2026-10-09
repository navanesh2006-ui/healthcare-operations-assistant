import React, { useState, useEffect } from 'react';
import { taskApi } from '../services/api';
import { Task } from '../types';
import { ShieldAlert, Check, Edit, X, Brain, AlertTriangle, Sparkles } from 'lucide-react';

export const ReviewerQueuePage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editedText, setEditedText] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [loading, setLoading] = useState(true);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await taskApi.getReviewerQueue();
      setTasks(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleAction = async (task: Task, action: 'approve' | 'edit' | 'reject') => {
    try {
      await taskApi.reviewTask(
        task.id,
        action,
        action === 'edit' ? editedText : task.simple_text,
        task.due_date,
        reviewerNotes || "Human clinical reviewer approval."
      );
      setEditingTask(null);
      await loadQueue();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-forestGreen">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-reviewOrange" />
          Human Clinical Reviewer Queue
        </h1>
        <p className="text-xs text-textLight/70">
          Items flagged for ambiguous dates, doses, or clinical sensitivity. Reviewer edits are saved directly into the Second Brain knowledge vault!
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-panelBg border border-forestGreen rounded-xl p-12 text-center text-textLight/70 space-y-2">
          <div className="w-12 h-12 rounded-full bg-forestGreen text-limeAccent flex items-center justify-center mx-auto text-xl font-bold">
            ✓
          </div>
          <h3 className="font-bold text-white text-base">Reviewer Queue is Clear</h3>
          <p className="text-xs">All extracted tasks are verified and approved for publishing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((t) => (
            <div key={t.id} className="bg-panelBg border-2 border-reviewOrange/60 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-reviewOrange text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      Needs Review
                    </span>
                    <h3 className="font-bold text-white text-base">{t.title}</h3>
                  </div>
                  <span className="text-xs text-limeAccent font-mono mt-0.5 block">
                    Category: {t.category} | Confidence: {(t.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-textLight/60 block">Flag Reason:</span>
                  <span className="text-xs text-reviewOrange font-medium">{t.reviewer_notes || "Ambiguous parameters"}</span>
                </div>
              </div>

              {/* Source Evidence Text */}
              <div className="bg-darkBg/90 p-3.5 rounded-xl border border-forestGreen space-y-1">
                <span className="text-[11px] text-textLight/60 font-semibold block">Original Clinical Instruction:</span>
                <p className="text-xs font-mono text-white bg-forestGreen/30 p-2 rounded border border-primaryGreen/30">
                  "{t.instruction_text}"
                </p>
              </div>

              {/* Current Plain Text vs Edit Mode */}
              {editingTask?.id === t.id ? (
                <div className="space-y-3 bg-darkBg/80 p-4 rounded-xl border border-limeAccent">
                  <label className="block text-xs font-bold text-limeAccent">Edit Plain-Language Explanation (Writes to Second Brain):</label>
                  <textarea
                    rows={3}
                    value={editedText}
                    onChange={e => setEditedText(e.target.value)}
                    className="w-full bg-darkBg border border-forestGreen rounded-lg p-3 text-xs text-white"
                  />
                  <label className="block text-xs font-bold text-limeAccent">Clinical Reviewer Rationale Note:</label>
                  <input
                    type="text"
                    value={reviewerNotes}
                    onChange={e => setReviewerNotes(e.target.value)}
                    placeholder="e.g. Fixed ambiguity to 7-day fixed return window..."
                    className="w-full bg-darkBg border border-forestGreen rounded-lg p-2 text-xs text-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingTask(null)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-darkBg text-textLight border border-forestGreen"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAction(t, 'edit')}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primaryGreen text-darkBg flex items-center gap-1"
                    >
                      <Brain className="w-3.5 h-3.5" /> Save Edit & Sync to Second Brain
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-forestGreen/30 p-3.5 rounded-xl border border-primaryGreen/30">
                  <span className="text-[10px] text-limeAccent uppercase font-bold block mb-1">Generated Plain Explanation:</span>
                  <p className="text-xs text-white">{t.simple_text}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-forestGreen">
                <button
                  onClick={() => handleAction(t, 'reject')}
                  className="bg-red-950/60 hover:bg-red-900/60 text-red-200 border border-red-500/40 text-xs font-bold py-2 px-3.5 rounded-xl flex items-center gap-1 transition"
                >
                  <X className="w-4 h-4" /> Reject Item
                </button>
                <button
                  onClick={() => {
                    setEditingTask(t);
                    setEditedText(t.simple_text);
                    setReviewerNotes(t.reviewer_notes || '');
                  }}
                  className="bg-forestGreen hover:bg-forestGreen/80 text-limeAccent border border-primaryGreen/40 text-xs font-bold py-2 px-3.5 rounded-xl flex items-center gap-1 transition"
                >
                  <Edit className="w-4 h-4" /> Edit & Fix Ambiguity
                </button>
                <button
                  onClick={() => handleAction(t, 'approve')}
                  className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1 shadow transition"
                >
                  <Check className="w-4 h-4" /> Approve & Publish Task
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
