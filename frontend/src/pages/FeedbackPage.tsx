import React, { useState, useEffect } from 'react';
import { feedbackApi } from '../services/api';
import { FeedbackItem } from '../types';
import { Star, MessageSquare, Filter } from 'lucide-react';

export const FeedbackPage: React.FC = () => {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [dept, setDept] = useState('All');

  const loadFeedback = async () => {
    const res = await feedbackApi.list(dept === 'All' ? undefined : dept);
    setFeedback(res);
  };

  useEffect(() => {
    loadFeedback();
  }, [dept]);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-forestGreen flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Star className="w-7 h-7 text-pendingAmber fill-pendingAmber" />
            Patient Feedback Dashboard
          </h1>
          <p className="text-xs text-textLight/70">
            Ratings and comments collected after completed follow-up visits and chatbot sessions
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-panelBg p-4 rounded-xl border border-forestGreen">
        <Filter className="w-4 h-4 text-textLight/50" />
        <span className="text-xs text-textLight/70 font-semibold">Filter by Department:</span>
        <select
          value={dept}
          onChange={e => setDept(e.target.value)}
          className="bg-darkBg border border-forestGreen rounded-lg px-3 py-1.5 text-xs text-white"
        >
          <option value="All">All Departments</option>
          <option value="Cardiology">Cardiology</option>
          <option value="General Surgery">General Surgery</option>
          <option value="Endocrinology">Endocrinology</option>
          <option value="General">General</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {feedback.map((fb) => (
          <div key={fb.id} className="bg-panelBg border border-forestGreen rounded-xl p-5 shadow space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">{fb.department} Department</span>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < fb.rating ? 'text-pendingAmber fill-pendingAmber' : 'text-textLight/30'}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-textLight/90 italic bg-darkBg/60 p-3 rounded-lg border border-forestGreen/40">
              "{fb.comment || 'No written comment provided.'}"
            </p>
            <div className="flex items-center justify-between text-[10px] text-limeAccent font-mono pt-1">
              <span className="capitalize">Source: {fb.source}</span>
              <span>{new Date(fb.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
