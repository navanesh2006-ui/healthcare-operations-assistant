import React, { useState, useEffect } from 'react';
import { HelpCircle, Sparkles, X, ArrowRight, CheckCircle2 } from 'lucide-react';

export const GuidedTourModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem('carebridge_tour_seen');
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, []);

  const tourSteps = [
    {
      title: "Welcome to CareBridge! 🏥",
      content: "CareBridge is an Agentic Hospital Discharge & Follow-up Coordinator built for the Build to Care code-a-thon. Every button works and every flow runs end-to-end!",
      badge: "Overview"
    },
    {
      title: "1. 5-Agent Extraction & Simplification ⚡",
      content: "Hospital staff paste synthetic discharge summaries. The 5-agent pipeline (Extractor -> Planner -> Simplifier -> Matcher -> Safety Reviewer) extracts tasks and generates plain-language guides in English, Tamil, and Hindi.",
      badge: "Hospital Staff"
    },
    {
      title: "2. Human Reviewer Queue & Second Brain ⚖️",
      content: "Ambiguous doses or dates are flagged as 'Needs Review'. Clinical Reviewers approve or edit instructions. Every reviewer edit writes a new markdown note directly to the Second Brain vault!",
      badge: "Clinical Reviewer"
    },
    {
      title: "3. Interactive Graph & Email Booking 📅",
      content: "Patients view their color-coded follow-up graph, click nodes to view evidence, and book appointments in 3 clicks. Tokenized email confirmation links let judges test 'Accept Slot' and 'Decline' buttons live!",
      badge: "Patient Portal"
    }
  ];

  const handleNext = () => {
    if (step < tourSteps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('carebridge_tour_seen', 'true');
      setIsOpen(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('carebridge_tour_seen', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const current = tourSteps[step];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panelBg border-2 border-primaryGreen rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button onClick={handleSkip} className="absolute top-4 right-4 text-textLight/60 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <span className="bg-limeAccent text-darkBg text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            {current.badge}
          </span>
          <span className="text-xs text-textLight/60">Step {step + 1} of {tourSteps.length}</span>
        </div>

        <h3 className="text-xl font-bold text-white mb-2">{current.title}</h3>
        <p className="text-sm text-textLight/90 leading-relaxed mb-6 bg-darkBg/60 p-4 rounded-xl border border-forestGreen">
          {current.content}
        </p>

        <div className="flex items-center justify-between pt-2">
          <button onClick={handleSkip} className="text-xs text-textLight/60 hover:text-white underline">
            Skip Tour
          </button>
          <button
            onClick={handleNext}
            className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow transition"
          >
            {step === tourSteps.length - 1 ? 'Start App Demo' : 'Next Step'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
