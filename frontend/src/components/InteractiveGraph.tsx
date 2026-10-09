import React, { useState } from 'react';
import { Task, DocumentItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { sortStepsByPriority } from './ChartBuilderModal';
import { 
  Calendar, CheckCircle2, AlertTriangle, Clock, ShieldCheck, 
  AlertCircle, Filter, ChevronRight, Activity, FileText, Stethoscope, Pill
} from 'lucide-react';
import { StatusChip } from './ui/Primitives';

interface InteractiveGraphProps {
  tasks: Task[];
  documents?: DocumentItem[];
  onSelectTask: (task: Task) => void;
  onBookTask?: (task: Task) => void;
  onAttendTask?: (task: Task) => void;
  onShowEvidence?: (task: Task) => void;
  onUploadDocument?: (task: Task) => void;
}

export const InteractiveGraph: React.FC<InteractiveGraphProps> = ({
  tasks,
  documents = [],
  onSelectTask,
  onBookTask,
  onAttendTask,
  onShowEvidence,
  onUploadDocument,
}) => {
  const { language, t } = useLanguage();
  const sortedTasks = sortStepsByPriority(tasks);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(sortedTasks[0]?.id || null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const selectedTask = sortedTasks.find((t) => t.id === selectedTaskId) || sortedTasks[0];
  const docExpectingCategories = ['scan', 'test', 'medicine', 'appointment', 'referral'];

  const filteredTasks = sortedTasks.filter(t => {
    if (filterCategory === 'all') return true;
    if (filterCategory === 'appointments') return t.category === 'appointment';
    if (filterCategory === 'tests') return t.category === 'test' || t.category === 'scan';
    if (filterCategory === 'medicines') return t.category === 'medicine';
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'appointment': return <Stethoscope className="w-4 h-4 text-mintGlow" />;
      case 'test': return <Activity className="w-4 h-4 text-scheduledBlue" />;
      case 'medicine': return <Pill className="w-4 h-4 text-limeAccent" />;
      case 'warning_sign': return <AlertTriangle className="w-4 h-4 text-declinedRed" />;
      default: return <FileText className="w-4 h-4 text-pendingAmber" />;
    }
  };

  const getLocalizedText = (task: Task) => {
    if (language === 'ta' && task.simple_ta) return task.simple_ta;
    if (language === 'hi' && task.simple_hi) return task.simple_hi;
    return task.simple_text;
  };

  return (
    <div className="glass-card rounded-2xl border-mintGlow/25 p-6 shadow-2xl space-y-6">
      {/* Header & Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-mintGlow/15">
        <div>
          <h2 className="font-heading text-xl font-bold text-textLight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-mintGlow" />
            Interactive Recovery Path & Timeline
          </h2>
          <p className="text-xs text-mutedText mt-0.5">
            Tap any node on your glowing path to inspect details, book visits, or upload reports.
          </p>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-mintGlow/20">
          {[
            { id: 'all', label: 'All Steps' },
            { id: 'appointments', label: 'Appointments' },
            { id: 'tests', label: 'Tests & Scans' },
            { id: 'medicines', label: 'Medicines' },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setFilterCategory(chip.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterCategory === chip.id ? 'bg-primaryGreen text-ink shadow' : 'text-mutedText hover:text-textLight'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Glowing Path Timeline Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-1 before:bg-gradient-to-b before:from-primaryGreen before:via-mintGlow before:to-forest">
            {filteredTasks.map((task, index) => {
              const isSelected = selectedTaskId === task.id;
              const isCompleted = task.status === 'Completed';
              const requiresDoc = task.requires_document || docExpectingCategories.includes(task.category);
              const attachedDoc = documents.find(d => d.step_id === task.id || d.task_id === task.id);

              return (
                <div
                  key={task.id}
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    onSelectTask(task);
                  }}
                  className={`relative cursor-pointer transition-all duration-300 p-4 rounded-2xl glass-card ${
                    isSelected
                      ? 'border-mintGlow ring-2 ring-mintGlow/30 shadow-glow-mint scale-[1.02]'
                      : 'border-mintGlow/15 hover:border-mintGlow/40 hover:bg-forest/20'
                  }`}
                >
                  {/* Glowing Node Circle Pin */}
                  <div
                    className={`absolute -left-[35px] top-4 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono shadow-lg transition-transform ${
                      isCompleted 
                        ? 'bg-completedGreen text-ink border-2 border-mintGlow scale-105 shadow-glow-primary' 
                        : 'bg-surface text-mintGlow border-2 border-mintGlow animate-pulse-glow'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4 text-ink" /> : index + 1}
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(task.category)}
                        <h3 className="font-heading font-bold text-textLight text-sm">{task.title}</h3>
                      </div>
                      <p className="text-xs text-mutedText leading-relaxed line-clamp-2">
                        {getLocalizedText(task)}
                      </p>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <StatusChip status={task.status} />
                      {task.due_date && (
                        <div className="text-[10px] text-mintGlow font-mono flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          {task.due_date}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Document Upload Button inside card */}
                  {requiresDoc && (
                    <div className="mt-3 pt-2 border-t border-mintGlow/10 flex items-center justify-between text-xs">
                      {attachedDoc ? (
                        <span className="text-completedGreen font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primaryGreen" /> Report Uploaded
                        </span>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-pendingAmber text-[11px] flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Upload report required
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUploadDocument && onUploadDocument(task);
                            }}
                            className="bg-surface hover:bg-forest/60 text-mintGlow font-bold text-[11px] px-3 py-1 rounded-xl border border-mintGlow/20 transition"
                          >
                            Upload File
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Node Side Inspector Sheet */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl flex flex-col justify-between border-mintGlow/20 shadow-inner">
          {selectedTask ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-mintGlow/15">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(selectedTask.category)}
                  <span className="font-heading font-bold text-textLight text-base">{selectedTask.title}</span>
                </div>
                <StatusChip status={selectedTask.status} />
              </div>

              <div className="bg-surface/80 p-4 rounded-xl border border-mintGlow/15 space-y-1">
                <div className="text-[10px] text-mintGlow font-mono uppercase font-bold tracking-wider">
                  Plain-Language Guide ({language.toUpperCase()})
                </div>
                <p className="text-xs text-textLight leading-relaxed">
                  {getLocalizedText(selectedTask)}
                </p>
              </div>

              {/* Source Sentence Evidence */}
              <div className="space-y-1.5">
                <button
                  onClick={() => onShowEvidence && onShowEvidence(selectedTask)}
                  className="text-xs text-mintGlow hover:underline font-medium flex items-center gap-1"
                >
                  <ShieldCheck className="w-4 h-4 text-primaryGreen" />
                  {t('whyAmISeeingThis')} (Confidence: {(selectedTask.confidence_score * 100).toFixed(0)}%)
                </button>
                {selectedTask.evidence_sentence && (
                  <div className="text-[11px] bg-surface p-3 rounded-xl border border-mintGlow/10 text-mutedText italic leading-relaxed">
                    "{selectedTask.evidence_sentence}"
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-mintGlow/15">
                {selectedTask.status !== 'Completed' && (
                  <button
                    onClick={() => onBookTask && onBookTask(selectedTask)}
                    className="w-full bg-gradient-to-r from-primaryGreen to-limeAccent hover:opacity-95 text-ink font-bold text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-glow-primary cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" />
                    {selectedTask.status === 'Scheduled' ? 'Rebook Hospital Slot' : t('bookAppointment')}
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </button>
                )}

                {selectedTask.status !== 'Completed' && (
                  <button
                    onClick={() => onAttendTask && onAttendTask(selectedTask)}
                    className="w-full glass-panel hover:bg-forest/60 text-textLight font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-mintGlow/20 transition"
                  >
                    <CheckCircle2 className="w-4 h-4 text-completedGreen" />
                    {t('attendedVisit')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-mutedText text-xs italic">
              Click any schedule node on the path to inspect details and actions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
