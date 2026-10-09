import React from 'react';
import { Task } from '../types';
import { ShieldCheck, X, FileText, CheckCircle } from 'lucide-react';

interface EvidenceModalProps {
  task: Task | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ task, onClose }) => {
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panelBg border border-forestGreen rounded-2xl max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-textLight/60 hover:text-white p-1 rounded-lg hover:bg-forestGreen"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-forestGreen">
          <div className="w-10 h-10 rounded-xl bg-forestGreen flex items-center justify-center text-limeAccent">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Why am I seeing this?</h3>
            <p className="text-xs text-textLight/70">Clinical Extraction & Evidence Verification Trace</p>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <span className="text-xs text-limeAccent font-bold uppercase tracking-wider block mb-1">Extracted Task Title</span>
            <div className="font-bold text-white text-base">{task.title}</div>
          </div>

          <div className="bg-darkBg/80 p-3.5 rounded-xl border border-forestGreen">
            <span className="text-xs text-textLight/60 font-semibold block mb-1">
              Source Clinical Sentence (Highlighted Match):
            </span>
            <p className="text-white font-mono bg-forestGreen/40 p-2.5 rounded border border-primaryGreen/40 text-xs leading-relaxed">
              <mark className="bg-limeAccent/30 text-limeAccent font-bold px-1 rounded">
                "{task.evidence_sentence || task.instruction_text}"
              </mark>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-darkBg p-3 rounded-lg border border-forestGreen/60">
              <span className="text-textLight/60 block">Extraction Field:</span>
              <span className="font-semibold text-white">{task.evidence_field || 'Discharge Plan'}</span>
            </div>
            <div className="bg-darkBg p-3 rounded-lg border border-forestGreen/60">
              <span className="text-textLight/60 block">Agent Confidence:</span>
              <span className="font-bold text-limeAccent flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-primaryGreen" />
                {(task.confidence_score * 100).toFixed(0)}% Confidence
              </span>
            </div>
          </div>

          <div className="text-[11px] text-textLight/60 italic bg-forestGreen/20 p-3 rounded-lg border border-forestGreen/30">
            CareBridge AI Extractor highlights the exact sentence from the discharging physician's summary. If instructions are ambiguous or confidence is below 70%, items are routed to the Human Reviewer Queue.
          </div>
        </div>
      </div>
    </div>
  );
};
