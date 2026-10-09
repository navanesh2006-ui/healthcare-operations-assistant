import React, { useState, useEffect } from 'react';
import { chartApi } from '../services/api';
import { Patient, FollowupChart } from '../types';
import {
  X, Plus, Sparkles, CheckCircle2, Clock, ShieldAlert, ArrowRight,
  Trash2, Copy, Edit3, MoveUp, MoveDown, Layers, FileText, AlertTriangle,
  Calendar, Check, Send, Save, BookmarkPlus, RefreshCw, AlertCircle, Activity
} from 'lucide-react';

interface ChartBuilderModalProps {
  patient: Patient;
  existingChart?: FollowupChart | null;
  onClose: () => void;
  onSaved: () => void;
}

export interface StepItem {
  id?: string | number;
  title: string;
  category: string; // appointment, scan, test, referral, medicine, care_instruction, warning_sign, other
  type?: string;
  instruction_text: string;
  simple_text?: string;
  due_date: string;
  relative_days?: number;
  depends_on_step_id?: number | string | null;
  depends_on_title?: string;
  time_window?: string;
  department?: string;
  notes?: string;
  order_index: number;
  source: string; // manual, template, ai
  template_name?: string;
  needs_review: boolean;
}

export const getCategoryPriorityRank = (category: string = '', title: string = '', type: string = ''): number => {
  const cat = (category || type || '').toLowerCase();
  const t = (title || '').toLowerCase();
  if (cat.includes('warning') || t.includes('warning') || t.includes('emergency') || t.includes('red flag')) return 1;
  if (cat.includes('medicine') || cat.includes('therapy') || t.includes('therapy') || t.includes('antimicrobial') || t.includes('antibiotic') || t.includes('medication')) return 2;
  if (cat.includes('test') || cat.includes('lab') || t.includes('blood') || t.includes('pathology')) return 3;
  if (cat.includes('scan') || cat.includes('imaging') || t.includes('x-ray') || t.includes('ultrasound')) return 4;
  if (cat.includes('appointment') || cat.includes('checkup') || cat.includes('consultation')) return 5;
  if (cat.includes('care') || t.includes('hydration') || t.includes('rest') || t.includes('wound')) return 6;
  return 7;
};

export const sortStepsByPriority = <T extends { due_date?: string; relative_days?: number; category?: string; type?: string; title?: string }>(stepsArray: T[]): T[] => {
  return [...stepsArray].sort((a, b) => {
    const relA = a.relative_days ?? 999;
    const relB = b.relative_days ?? 999;
    if (relA !== relB) return relA - relB;

    const dateA = a.due_date || '9999-99-99';
    const dateB = b.due_date || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const rankA = getCategoryPriorityRank(a.category || '', a.title || '', a.type || '');
    const rankB = getCategoryPriorityRank(b.category || '', b.title || '', b.type || '');
    if (rankA !== rankB) return rankA - rankB;

    return (a.title || '').localeCompare(b.title || '');
  }).map((s, idx) => ({ ...s, order_index: idx }));
};

export const autoStaggerDates = <T extends { due_date?: string; relative_days?: number; category?: string; type?: string; title?: string }>(
  stepsArray: T[],
  baseDateStr: string
): T[] => {
  const sorted = sortStepsByPriority(stepsArray);
  const seenDates = new Set<string>();

  return sorted.map((s) => {
    let currentDays = s.relative_days ?? 1;
    let currentDueDate = s.due_date || calculateDateFromRelativeHelper(currentDays, baseDateStr);

    const cat = (s.category || s.type || '').toLowerCase();
    const isWarning = cat.includes('warning') || (s.title || '').toLowerCase().includes('warning') || (s.title || '').toLowerCase().includes('emergency');

    if (!isWarning) {
      while (seenDates.has(currentDueDate)) {
        currentDays += 1;
        currentDueDate = calculateDateFromRelativeHelper(currentDays, baseDateStr);
      }
    }
    seenDates.add(currentDueDate);

    return {
      ...s,
      relative_days: currentDays,
      due_date: currentDueDate
    };
  });
};

function calculateDateFromRelativeHelper(days: number, baseDateStr: string): string {
  try {
    const parts = baseDateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      d.setDate(d.getDate() + days);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date(baseDateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

export const ChartBuilderModal: React.FC<ChartBuilderModalProps> = ({
  patient,
  existingChart,
  onClose,
  onSaved
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');
  const [dischargeDate, setDischargeDate] = useState<string>(
    existingChart?.discharge_date || new Date().toISOString().split('T')[0]
  );
  const [chartStatus, setChartStatus] = useState<string>(existingChart?.status || 'Draft');
  const [chartVersion, setChartVersion] = useState<number>(existingChart?.version || 1);
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateNames, setSelectedTemplateNames] = useState<string[]>([]);
  const [customProblem, setCustomProblem] = useState<string>('');
  const [dischargeSummaryText, setDischargeSummaryText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active step editing state
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepForm, setStepForm] = useState<StepItem>({
    title: '',
    category: 'appointment',
    instruction_text: '',
    due_date: new Date().toISOString().split('T')[0],
    relative_days: 7,
    order_index: 0,
    source: 'manual',
    needs_review: false,
    notes: '',
    department: '',
    time_window: ''
  });

  // Template saving modal state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Load existing chart steps or templates on mount
  useEffect(() => {
    loadTemplates();
    if (existingChart && existingChart.tasks && existingChart.tasks.length > 0) {
      const loadedSteps: StepItem[] = existingChart.tasks.map((t: any, idx: number) => ({
        id: t.id,
        title: t.title,
        category: t.category || 'appointment',
        instruction_text: t.instruction_text || t.simple_text,
        simple_text: t.simple_text,
        due_date: t.due_date || new Date().toISOString().split('T')[0],
        relative_days: t.relative_days || 1,
        depends_on_step_id: t.depends_on_step_id,
        time_window: t.time_window || '',
        department: t.department || '',
        notes: t.notes || '',
        order_index: t.order_index ?? idx,
        source: t.source || 'manual',
        needs_review: Boolean(t.needs_review)
      }));
      setSteps(sortStepsByPriority(loadedSteps));
    } else {
      // Default initial step
      setSteps([
        {
          title: 'First Post-Discharge Follow-up Visit',
          category: 'appointment',
          instruction_text: 'Outpatient consultation for overall recovery evaluation and vitals check.',
          due_date: calculateDateFromRelative(7, dischargeDate),
          relative_days: 7,
          order_index: 0,
          source: 'manual',
          needs_review: false,
          department: 'General Medicine'
        }
      ]);
    }
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await chartApi.getTemplates();
      setTemplates(res);
    } catch (err) {
      console.error("Failed loading templates:", err);
    }
  };

  function calculateDateFromRelative(days: number, baseDateStr: string): string {
    try {
      const parts = baseDateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        d.setDate(d.getDate() + days);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      const d = new Date(baseDateStr);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  }

  // Update dates when discharge date changes
  const handleDischargeDateChange = (newDate: string) => {
    setDischargeDate(newDate);
    setSteps(prev => sortStepsByPriority(prev.map(s => ({
      ...s,
      due_date: s.relative_days ? calculateDateFromRelative(s.relative_days, newDate) : s.due_date
    }))));
  };

  // Quick Add Chip Handlers
  const handleQuickAdd = (chipType: 'checkup7' | 'scan14' | 'lab6') => {
    let newStep: StepItem;
    if (chipType === 'checkup7') {
      newStep = {
        title: 'Next Check-up Consultation',
        category: 'appointment',
        instruction_text: 'Routine post-discharge clinical consultation and physical exam.',
        relative_days: 7,
        due_date: calculateDateFromRelative(7, dischargeDate),
        order_index: steps.length,
        source: 'manual',
        needs_review: false,
        department: 'General Medicine'
      };
    } else if (chipType === 'scan14') {
      newStep = {
        title: 'Follow-up Imaging & Diagnostic Scan',
        category: 'scan',
        instruction_text: 'Diagnostic ultrasound or X-ray scan to review anatomical recovery.',
        relative_days: 14,
        due_date: calculateDateFromRelative(14, dischargeDate),
        order_index: steps.length,
        source: 'manual',
        needs_review: false,
        department: 'Radiology'
      };
    } else {
      newStep = {
        title: 'Pre-Visit Blood Test & Pathology Panel',
        category: 'test',
        instruction_text: 'Fasting blood draw for Routine Lab Panel before clinical appointment.',
        relative_days: 6,
        due_date: calculateDateFromRelative(6, dischargeDate),
        order_index: steps.length,
        source: 'manual',
        needs_review: false,
        department: 'Pathology'
      };
    }
    setSteps(prev => sortStepsByPriority([...prev, newStep]));
  };

  // Step Management
  const handleAddOrUpdateStep = () => {
    if (!stepForm.title.trim()) {
      alert("Please provide a step title.");
      return;
    }
    if (!stepForm.instruction_text.trim()) {
      alert("Please provide instruction text.");
      return;
    }

    const calcDue = stepForm.relative_days
      ? calculateDateFromRelative(stepForm.relative_days, dischargeDate)
      : stepForm.due_date;

    const formattedStep: StepItem = {
      ...stepForm,
      due_date: calcDue,
      needs_review: stepForm.category === 'medicine' || stepForm.needs_review
    };

    if (editingStepIndex !== null) {
      const updated = [...steps];
      updated[editingStepIndex] = formattedStep;
      setSteps(sortStepsByPriority(updated));
      setEditingStepIndex(null);
    } else {
      setSteps(prev => sortStepsByPriority([...prev, { ...formattedStep, order_index: prev.length }]));
    }

    // Reset Form
    setStepForm({
      title: '',
      category: 'appointment',
      instruction_text: '',
      due_date: dischargeDate,
      relative_days: 7,
      order_index: steps.length,
      source: 'manual',
      needs_review: false,
      notes: '',
      department: '',
      time_window: ''
    });
  };

  const handleEditStep = (index: number) => {
    setEditingStepIndex(index);
    setStepForm(steps[index]);
  };

  const handleDuplicateStep = (index: number) => {
    const target = steps[index];
    const dup: StepItem = {
      ...target,
      id: undefined,
      title: `${target.title} (Copy)`,
      order_index: steps.length
    };
    setSteps(prev => sortStepsByPriority([...prev, dup]));
  };

  const handleDeleteStep = (index: number) => {
    setSteps(prev => sortStepsByPriority(prev.filter((_, i) => i !== index)));
    if (editingStepIndex === index) {
      setEditingStepIndex(null);
    }
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return;
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    setSteps(newSteps.map((s, idx) => ({ ...s, order_index: idx })));
  };

  // Auto Generate Draft
  const handleAutoGenerate = async () => {
    if (selectedTemplateNames.length === 0 && !customProblem.trim()) {
      alert("Please select at least one problem template or type a custom problem.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await chartApi.autoGenerate({
        patient_id: patient.id,
        problem_tags: selectedTemplateNames,
        custom_problem: customProblem,
        discharge_date: dischargeDate,
        discharge_summary_text: dischargeSummaryText
      });
      if (res.steps && res.steps.length > 0) {
        const genSteps: StepItem[] = res.steps.map((s: any, idx: number) => ({
          title: s.title,
          category: s.category || 'appointment',
          instruction_text: s.instructions || s.instruction_text,
          due_date: s.due_date,
          relative_days: s.relative_days || 1,
          department: s.department || '',
          order_index: idx,
          source: s.source || 'template',
          template_name: s.template_name,
          needs_review: Boolean(s.needs_review)
        }));
        setSteps(autoStaggerDates(genSteps, dischargeDate));
        setActiveTab('manual');
        setSuccessMsg(`Auto-generated draft chart with ${genSteps.length} steps from ${res.templates_used.join(', ')}.`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to auto-generate chart draft.");
    } finally {
      setLoading(false);
    }
  };

  // Save Custom Template
  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert("Please provide a template name.");
      return;
    }
    try {
      const templateSteps = steps.map(s => ({
        type: getCategoryLabel(s.category),
        category: s.category,
        title: s.title,
        relative_days: s.relative_days || 1,
        instructions: s.instruction_text,
        department: s.department,
        needs_review: s.needs_review
      }));
      await chartApi.saveTemplate({
        name: newTemplateName.trim(),
        problem_tags: ["Custom", "Hospital Created"],
        steps: templateSteps
      });
      setShowSaveTemplateModal(false);
      setNewTemplateName('');
      await loadTemplates();
      alert("Custom hospital template saved successfully!");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed saving template.");
    }
  };

  // Save / Publish Actions
  const handleSaveChart = async (targetStatus: 'Draft' | 'In Review' | 'Approved' | 'Publish') => {
    if (steps.length === 0) {
      alert("Cannot save an empty chart. Add at least 1 follow-up step.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let savedChart: FollowupChart;

      if (existingChart && existingChart.id) {
        // Update existing chart
        savedChart = await chartApi.updateChart(existingChart.id, {
          discharge_date: dischargeDate,
          steps: steps.map(s => ({
            title: s.title,
            category: s.category,
            instruction_text: s.instruction_text,
            due_date: s.due_date,
            relative_days: s.relative_days,
            depends_on_step_id: s.depends_on_step_id ? Number(s.depends_on_step_id) : undefined,
            time_window: s.time_window,
            department: s.department,
            notes: s.notes,
            source: s.source,
            needs_review: s.needs_review
          }))
        });

        if (targetStatus === 'Publish') {
          savedChart = await chartApi.publishChart(existingChart.id);
          setSuccessMsg("Chart published successfully! Notification and outbox email dispatches complete.");
        } else if (targetStatus !== 'Draft') {
          savedChart = await chartApi.updateReviewStatus(existingChart.id, targetStatus);
          setSuccessMsg(`Chart status updated to ${targetStatus}.`);
        } else {
          setSuccessMsg("Chart draft saved successfully!");
        }
      } else {
        // Create new chart draft
        savedChart = await chartApi.createChart({
          patient_id: patient.id,
          discharge_date: dischargeDate,
          steps: steps.map(s => ({
            title: s.title,
            category: s.category,
            instruction_text: s.instruction_text,
            due_date: s.due_date,
            relative_days: s.relative_days,
            depends_on_step_id: s.depends_on_step_id ? Number(s.depends_on_step_id) : undefined,
            time_window: s.time_window,
            department: s.department,
            notes: s.notes,
            source: s.source,
            needs_review: s.needs_review
          })),
          source: steps.some(s => s.source === 'template') ? 'template' : 'manual'
        });

        if (targetStatus === 'Publish') {
          savedChart = await chartApi.publishChart(savedChart.id);
          setSuccessMsg("Chart created and published successfully! Notification sent to patient.");
        } else if (targetStatus !== 'Draft') {
          savedChart = await chartApi.updateReviewStatus(savedChart.id, targetStatus);
          setSuccessMsg(`Chart created with status: ${targetStatus}.`);
        } else {
          setSuccessMsg("Draft chart created successfully!");
        }
      }

      setChartStatus(savedChart.status);
      setChartVersion(savedChart.version);
      setTimeout(() => {
        onSaved();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed saving chart.");
    } finally {
      setSaving(false);
    }
  };

  // Validation Warnings
  const getValidationWarnings = () => {
    const warnings: string[] = [];
    const dateCounts: Record<string, number> = {};
    
    steps.forEach((s, idx) => {
      if (!s.due_date) {
        warnings.push(`Step #${idx + 1} ("${s.title}") is missing a due date.`);
      } else if (dischargeDate && s.due_date < dischargeDate) {
        warnings.push(`Step #${idx + 1} ("${s.title}") due date (${s.due_date}) is set BEFORE discharge date (${dischargeDate}).`);
      }
      if (!s.instruction_text.trim()) {
        warnings.push(`Step #${idx + 1} ("${s.title}") has empty instruction text.`);
      }
      if (s.due_date) {
        dateCounts[s.due_date] = (dateCounts[s.due_date] || 0) + 1;
      }
    });

    Object.entries(dateCounts).forEach(([dt, count]) => {
      if (count > 2) {
        warnings.push(`Multiple steps (${count}) are scheduled on the exact same date (${dt}).`);
      }
    });

    return warnings;
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'appointment': return 'border-l-4 border-l-emerald-400 border-forestGreen/60 text-emerald-300 bg-emerald-950/20';
      case 'scan': return 'border-l-4 border-l-blue-400 border-forestGreen/60 text-blue-300 bg-blue-950/20';
      case 'test': return 'border-l-4 border-l-purple-400 border-forestGreen/60 text-purple-300 bg-purple-950/20';
      case 'referral': return 'border-l-4 border-l-teal-400 border-forestGreen/60 text-teal-300 bg-teal-950/20';
      case 'medicine': return 'border-l-4 border-l-amber-400 border-forestGreen/60 text-amber-300 bg-amber-950/20';
      case 'care_instruction': return 'border-l-4 border-l-lime-400 border-forestGreen/60 text-lime-300 bg-lime-950/20';
      case 'warning_sign': return 'border-l-4 border-l-red-500 border-red-500/40 text-red-200 bg-red-950/30';
      default: return 'border-l-4 border-l-forestGreen border-forestGreen/60 text-textLight bg-forestGreen/20';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'appointment': return <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'scan': return <Activity className="w-4 h-4 text-blue-400 shrink-0" />;
      case 'test': return <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'referral': return <ArrowRight className="w-4 h-4 text-teal-400 shrink-0" />;
      case 'medicine': return <Clock className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'care_instruction': return <ShieldAlert className="w-4 h-4 text-limeAccent shrink-0" />;
      case 'warning_sign': return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
      default: return <Layers className="w-4 h-4 text-mintGlow shrink-0" />;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'appointment': return 'Check-up / Appointment';
      case 'scan': return 'Scan or Imaging';
      case 'test': return 'Lab Test';
      case 'referral': return 'Referral';
      case 'medicine': return 'Medicine instruction';
      case 'care_instruction': return 'Care instruction';
      case 'warning_sign': return 'Warning signs';
      default: return 'Other';
    }
  };

  const warningsList = getValidationWarnings();

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-panelBg border-2 border-forestGreen rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        
        {/* Header Bar */}
        <div className="bg-darkBg p-5 border-b border-forestGreen flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-forestGreen text-limeAccent flex items-center justify-center font-bold text-lg shadow">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Follow-up Chart Builder</h2>
                <span className="bg-forestGreen/80 text-limeAccent px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  v{chartVersion}
                </span>
              </div>
              <p className="text-xs text-textLight/70">
                Patient: <strong className="text-white">{patient.name}</strong> (<span className="text-limeAccent font-mono">{patient.patient_code}</span>, {patient.age}y / {patient.gender}, {patient.district})
              </p>
            </div>
          </div>

          {/* Discharge Date & Status Stepper */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-panelBg border border-forestGreen px-3 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-limeAccent" />
              <span className="text-[11px] text-textLight/70">Discharge Date:</span>
              <input
                type="date"
                value={dischargeDate}
                onChange={e => handleDischargeDateChange(e.target.value)}
                className="bg-darkBg text-white border border-forestGreen rounded px-2 py-1 focus:outline-none focus:border-limeAccent"
              />
            </div>

            {/* Status Stepper */}
            <div className="flex items-center gap-1.5 bg-darkBg/80 p-1.5 rounded-2xl border border-forestGreen">
              {['Draft', 'In Review', 'Approved', 'Published'].map((st, idx) => {
                const isActive = chartStatus === st;
                const isPast = ['Draft', 'In Review', 'Approved', 'Published'].indexOf(chartStatus) > idx;
                return (
                  <div
                    key={st}
                    className={`px-3 py-1 rounded-xl text-[10px] font-bold transition flex items-center gap-1 ${
                      isActive
                        ? st === 'Published'
                          ? 'bg-completedGreen text-white shadow'
                          : 'bg-primaryGreen text-darkBg shadow'
                        : isPast
                        ? 'bg-forestGreen text-limeAccent'
                        : 'text-textLight/40'
                    }`}
                  >
                    {isPast && <Check className="w-3 h-3" />}
                    {st}
                  </div>
                );
              })}
            </div>

            <button onClick={onClose} className="p-2 rounded-xl text-textLight hover:bg-forestGreen/40">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="bg-amber-950/40 border-b border-amber-500/40 text-amber-200 px-5 py-2.5 text-[11px] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Clinical Safety Disclaimer:</strong> This tool organizes follow-up tasks and schedule templates. It does not diagnose or recommend medical treatment. Clinical staff must verify and confirm all content before publishing.
          </span>
        </div>

        {/* Alerts & Feedback */}
        {error && (
          <div className="bg-red-950/80 border-b border-red-500 text-red-200 px-5 py-2.5 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-400" /> {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {successMsg && (
          <div className="bg-forestGreen/70 border-b border-primaryGreen text-limeAccent px-5 py-2.5 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primaryGreen" /> {successMsg}</span>
            <button onClick={() => setSuccessMsg(null)}>✕</button>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="bg-darkBg px-5 pt-3 border-b border-forestGreen flex items-center gap-4">
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
              activeTab === 'manual'
                ? 'border-primaryGreen text-limeAccent font-bold'
                : 'border-transparent text-textLight/60 hover:text-white'
            }`}
          >
            <Edit3 className="w-4 h-4" /> Tab A: Step-by-Step Editor ({steps.length} steps)
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={`pb-3 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
              activeTab === 'auto'
                ? 'border-primaryGreen text-limeAccent font-bold'
                : 'border-transparent text-textLight/60 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-limeAccent" /> Tab B: Auto-Generate from Problem Templates
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'auto' ? (
            /* TAB B: AUTO-GENERATE FROM TEMPLATES */
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-darkBg/60 border border-forestGreen p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-limeAccent font-bold text-sm">
                  <Sparkles className="w-5 h-5" />
                  Select Patient Condition & Follow-up Problem Templates
                </div>
                <p className="text-xs text-textLight/70">
                  Select one or more administrative templates to generate a draft follow-up schedule with relative day offsets calculated from the discharge date.
                </p>

                {/* Templates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                  {templates.map(t => {
                    const isSelected = selectedTemplateNames.includes(t.name);
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTemplateNames(prev => prev.filter(n => n !== t.name));
                          } else {
                            setSelectedTemplateNames(prev => [...prev, t.name]);
                          }
                        }}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between space-y-2 ${
                          isSelected
                            ? 'border-limeAccent bg-forestGreen/40 shadow-lg'
                            : 'border-forestGreen/70 bg-panelBg hover:border-forestGreen'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-bold text-white text-xs">{t.name}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-limeAccent shrink-0" />}
                        </div>
                        <div className="text-[10px] text-textLight/60 font-mono">
                          {t.steps?.length || 0} steps | {t.is_sample ? 'Sample' : 'Hospital Custom'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Problem Input */}
                <div className="pt-3 border-t border-forestGreen/60 space-y-2">
                  <label className="block text-xs font-semibold text-textLight/80">
                    Or Type a Custom Patient Problem / Diagnosis:
                  </label>
                  <input
                    type="text"
                    value={customProblem}
                    onChange={e => setCustomProblem(e.target.value)}
                    placeholder="e.g. Complex Knee Arthroplasty Recovery, Severe Dengue Recovery..."
                    className="w-full bg-white border-2 border-forestGreen/40 rounded-xl p-3 text-black font-bold placeholder-slate-600 focus:outline-none focus:border-primaryGreen shadow-sm"
                  />
                </div>

                {/* Generate Action */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleAutoGenerate}
                    disabled={loading}
                    className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2 text-xs transition disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Draft Chart Schedule
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAB A: MANUAL STEP BUILDER & TIMELINE PREVIEW */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Step Editor Form */}
              <div className="lg:col-span-5 space-y-5">
                
                {/* Quick Add Chips */}
                <div className="bg-darkBg p-4 rounded-2xl border border-forestGreen space-y-2">
                  <span className="text-[11px] font-bold text-limeAccent block">⚡ Quick-Add Common Steps:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleQuickAdd('checkup7')}
                      className="bg-forestGreen/60 hover:bg-forestGreen text-limeAccent border border-forestGreen px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                    >
                      + Check-up in 7 days
                    </button>
                    <button
                      onClick={() => handleQuickAdd('scan14')}
                      className="bg-forestGreen/60 hover:bg-forestGreen text-blue-300 border border-forestGreen px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                    >
                      + Scan after check-up
                    </button>
                    <button
                      onClick={() => handleQuickAdd('lab6')}
                      className="bg-forestGreen/60 hover:bg-forestGreen text-purple-300 border border-forestGreen px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                    >
                      + Blood test before visit
                    </button>
                  </div>
                </div>

                {/* Step Add/Edit Card */}
                <div className="bg-darkBg/90 p-5 rounded-2xl border-2 border-forestGreen space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-forestGreen">
                    <h3 className="font-bold text-white text-xs flex items-center gap-2">
                      <Plus className="w-4 h-4 text-limeAccent" />
                      {editingStepIndex !== null ? `Edit Step #${editingStepIndex + 1}` : 'Add New Follow-Up Step'}
                    </h3>
                    {editingStepIndex !== null && (
                      <button
                        onClick={() => {
                          setEditingStepIndex(null);
                          setStepForm({
                            title: '',
                            category: 'appointment',
                            instruction_text: '',
                            due_date: dischargeDate,
                            relative_days: 7,
                            order_index: steps.length,
                            source: 'manual',
                            needs_review: false,
                            notes: '',
                            department: '',
                            time_window: ''
                          });
                        }}
                        className="text-[10px] text-textLight/60 hover:underline"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-textLight/80 mb-1">Step Type / Category:</label>
                      <select
                        value={stepForm.category}
                        onChange={e => setStepForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full bg-slate-900 border border-forestGreen rounded-xl px-3 py-2 text-white focus:outline-none focus:border-limeAccent font-bold"
                      >
                        <option value="appointment" style={{ color: '#000000', backgroundColor: '#FFFFFF', fontWeight: 'bold' }}>Check-up / Appointment</option>
                        <option value="scan" style={{ color: '#000000', backgroundColor: '#FFFFFF', fontWeight: 'bold' }}>Scan or Imaging</option>
                        <option value="test" style={{ color: '#000000', backgroundColor: '#FFFFFF', fontWeight: 'bold' }}>Lab Test</option>
                        <option value="referral" style={{ color: '#000000', backgroundColor: '#FFFFFF', fontWeight: 'bold' }}>Referral</option>
                        <option value="medicine" style={{ color: '#000000', backgroundColor: '#FFFFFF', fontWeight: 'bold' }}>Medicine instruction</option>
                        <option value="care_instruction" style={{ color: '#000000', backgroundColor: '#FFFFFF', fontWeight: 'bold' }}>Care instruction (wound care, diet, rehab)</option>
                        <option value="warning_sign" style={{ color: '#000000', backgroundColor: '#FFFFFF', fontWeight: 'bold' }}>Warning signs</option>
                        <option value="other" style={{ color: '#000000', backgroundColor: '#FFFFFF', fontWeight: 'bold' }}>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-textLight mb-1">Step Title:</label>
                      <input
                        type="text"
                        value={stepForm.title}
                        onChange={e => setStepForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g. Sternal Wound Inspection, Fasting Blood Glucose..."
                        className="w-full bg-white border-2 border-forestGreen/40 rounded-xl px-3 py-2 text-black font-bold placeholder-slate-600 focus:outline-none focus:border-primaryGreen shadow-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-textLight mb-1">Days Post-Discharge:</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={stepForm.relative_days || 1}
                          onChange={e => {
                            const rd = parseInt(e.target.value) || 1;
                            const calcD = calculateDateFromRelative(rd, dischargeDate);
                            setStepForm(prev => ({ ...prev, relative_days: rd, due_date: calcD }));
                          }}
                          className="w-full bg-white border-2 border-forestGreen/40 rounded-xl px-3 py-2 text-black font-bold font-mono focus:outline-none focus:border-primaryGreen shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-textLight mb-1">Calculated Due Date:</label>
                        <input
                          type="date"
                          value={stepForm.due_date}
                          onChange={e => setStepForm(prev => ({ ...prev, due_date: e.target.value }))}
                          className="w-full bg-white border-2 border-forestGreen/40 rounded-xl px-3 py-2 text-black font-bold focus:outline-none focus:border-primaryGreen shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-textLight mb-1">Department / Specialty:</label>
                        <input
                          type="text"
                          value={stepForm.department || ''}
                          onChange={e => setStepForm(prev => ({ ...prev, department: e.target.value }))}
                          placeholder="e.g. Cardiology, Pathology"
                          className="w-full bg-white border-2 border-forestGreen/40 rounded-xl px-3 py-2 text-black font-bold placeholder-slate-600 focus:outline-none focus:border-primaryGreen shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-textLight mb-1">Time Window (Optional):</label>
                        <input
                          type="text"
                          value={stepForm.time_window || ''}
                          onChange={e => setStepForm(prev => ({ ...prev, time_window: e.target.value }))}
                          placeholder="e.g. Morning 9-11 AM"
                          className="w-full bg-white border-2 border-forestGreen/40 rounded-xl px-3 py-2 text-black font-bold placeholder-slate-600 focus:outline-none focus:border-primaryGreen shadow-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-textLight mb-1">Instructions (Plain Text for Patient):</label>
                      <textarea
                        rows={3}
                        value={stepForm.instruction_text}
                        onChange={e => setStepForm(prev => ({ ...prev, instruction_text: e.target.value }))}
                        placeholder="Detailed instructions for the patient..."
                        className="w-full bg-white border-2 border-forestGreen/40 rounded-xl p-3 text-black font-bold placeholder-slate-600 focus:outline-none focus:border-primaryGreen shadow-sm"
                      />
                    </div>

                    {/* Dependency Selector */}
                    <div>
                      <label className="block text-[10px] font-bold text-textLight mb-1">Dependency (Do this after step):</label>
                      <select
                        value={stepForm.depends_on_step_id || ''}
                        onChange={e => setStepForm(prev => ({ ...prev, depends_on_step_id: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full bg-white border-2 border-forestGreen/40 rounded-xl px-3 py-2 text-black font-bold focus:outline-none focus:border-primaryGreen shadow-sm"
                      >
                        <option value="">No Dependency (Independent Step)</option>
                        {steps.map((st, i) => (
                          <option key={i} value={st.id || i + 1}>
                            Step #{i + 1}: {st.title} ({st.due_date})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="needs_review_check"
                        checked={stepForm.needs_review}
                        onChange={e => setStepForm(prev => ({ ...prev, needs_review: e.target.checked }))}
                        className="accent-limeAccent"
                      />
                      <label htmlFor="needs_review_check" className="text-[11px] text-textLight/90">
                        Mark as "Needs Clinical Review" before publishing
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddOrUpdateStep}
                      className="w-full bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold py-2.5 rounded-xl shadow flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus className="w-4 h-4" />
                      {editingStepIndex !== null ? 'Update Step' : '+ Add Step to Timeline'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Timeline Preview */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-forestGreen">
                  <h3 className="font-bold text-white text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-limeAccent" />
                    Interactive Chart Timeline Preview ({steps.length} steps)
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSteps(prev => autoStaggerDates(prev, dischargeDate))}
                      className="bg-forestGreen/60 hover:bg-forestGreen text-limeAccent border border-forestGreen font-bold text-[10px] py-1 px-3 rounded-lg flex items-center gap-1 shadow"
                      title="Auto-stagger dates (+1d, +2d, +3d...) so no steps fall on the exact same date"
                    >
                      <Calendar className="w-3.5 h-3.5" /> Auto-Stagger Dates
                    </button>
                    <button
                      onClick={() => setSteps(prev => sortStepsByPriority(prev))}
                      className="bg-forestGreen/40 hover:bg-forestGreen text-white border border-forestGreen font-bold text-[10px] py-1 px-3 rounded-lg flex items-center gap-1"
                      title="Sort steps by earliest deadline (+1d, +7d...) and category priority rank"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Auto-Sort
                    </button>
                    <button
                      onClick={() => setShowSaveTemplateModal(true)}
                      className="bg-darkBg hover:bg-forestGreen/40 text-limeAccent border border-forestGreen font-bold text-[10px] py-1 px-3 rounded-lg flex items-center gap-1"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" /> Save as Template
                    </button>
                  </div>
                </div>

                {/* Validation Warnings Box */}
                {warningsList.length > 0 && (
                  <div className="bg-amber-950/70 border-2 border-amber-500/70 rounded-xl p-3.5 text-[11px] text-amber-200 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="font-bold flex items-center gap-1.5 text-amber-300">
                        <AlertTriangle className="w-4 h-4" /> Validation Warnings ({warningsList.length}):
                      </div>
                      {warningsList.some(w => w.includes('Multiple steps')) && (
                        <button
                          onClick={() => setSteps(prev => autoStaggerDates(prev, dischargeDate))}
                          className="bg-amber-500 hover:bg-amber-400 text-darkBg font-bold text-[10px] px-2.5 py-1 rounded-lg shadow transition flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> ⚡ Auto-Fix: Stagger Step Dates
                        </button>
                      )}
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[10px] text-amber-200/90">
                      {warningsList.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                  {/* Timeline Steps List */}
                <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
                  {steps.length === 0 ? (
                    <div className="bg-darkBg border border-forestGreen rounded-2xl p-12 text-center text-textLight/50 text-xs">
                      No follow-up steps added yet. Add steps manually or generate from templates above.
                    </div>
                  ) : (
                    steps.map((st, idx) => {
                      const colorClasses = getCategoryColor(st.category);
                      return (
                        <div
                          key={idx}
                          className={`bg-darkBg/95 dark:bg-darkBg/95 light:bg-white rounded-2xl p-4 shadow-lg space-y-2.5 transition-all duration-200 hover:shadow-xl ${colorClasses}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-panelBg text-limeAccent border border-forestGreen/60">
                                Step #{idx + 1}
                              </span>
                              <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                                {getCategoryIcon(st.category)}
                                <span>{st.title}</span>
                              </div>
                              {st.needs_review ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                    Needs Review
                                  </span>
                                  <button
                                    onClick={async () => {
                                      if (st.id) {
                                        try {
                                          await chartApi.confirmStep(Number(st.id));
                                          setSteps(prev => prev.map((item, i) => i === idx ? { ...item, needs_review: false } : item));
                                          setSuccessMsg(`Step #${idx + 1} confirmed by staff. Audit log updated.`);
                                        } catch (err: any) {
                                          alert(err.response?.data?.detail || "Failed confirming step.");
                                        }
                                      } else {
                                        setSteps(prev => prev.map((item, i) => i === idx ? { ...item, needs_review: false } : item));
                                      }
                                    }}
                                    className="bg-amber-500 hover:bg-amber-400 text-darkBg text-[10px] font-bold px-2.5 py-0.5 rounded-lg shadow transition transform active:scale-95 cursor-pointer"
                                  >
                                    Confirm Step
                                  </button>
                                </div>
                              ) : (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  Confirmed
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] font-bold text-limeAccent bg-panelBg px-2.5 py-0.5 rounded-lg border border-forestGreen/40 flex items-center gap-1 shrink-0">
                              <Calendar className="w-3.5 h-3.5 text-limeAccent" />
                              {st.due_date} ({st.relative_days ? `+${st.relative_days}d` : 'Day offset'})
                            </span>
                          </div>

                          <p className="text-textLight/90 text-[11px] bg-panelBg/80 p-2.5 rounded-xl border border-forestGreen/60">
                            {st.instruction_text}
                          </p>

                          {st.template_name && (
                            <div className="text-[10px] text-limeAccent font-mono flex items-center gap-1">
                              <span>Auto-generated from template: <strong>{st.template_name}</strong>. Confirm before publishing.</span>
                            </div>
                          )}

                          {st.depends_on_step_id && (
                            <div className="text-[10px] text-blue-300 font-mono flex items-center gap-1 bg-blue-950/40 p-1.5 rounded-lg border border-blue-500/30">
                              <ArrowRight className="w-3 h-3" /> Depends on Step #{st.depends_on_step_id}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 text-[10px]">
                            <span className="text-textLight/60 font-mono">
                              Type: {getCategoryLabel(st.category)} {st.department ? `| Dept: ${st.department}` : ''}
                            </span>
                            
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleMoveStep(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 hover:bg-forestGreen/40 rounded text-textLight disabled:opacity-30"
                              >
                                <MoveUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveStep(idx, 'down')}
                                disabled={idx === steps.length - 1}
                                className="p-1 hover:bg-forestGreen/40 rounded text-textLight disabled:opacity-30"
                              >
                                <MoveDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleEditStep(idx)}
                                className="p-1 hover:bg-forestGreen/40 rounded text-limeAccent"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDuplicateStep(idx)}
                                className="p-1 hover:bg-forestGreen/40 rounded text-blue-300"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStep(idx)}
                                className="p-1 hover:bg-red-950/60 rounded text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-darkBg p-4 border-t border-forestGreen flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-textLight/60 text-[11px]">
            <span>Status: <strong className="text-white">{chartStatus}</strong> | Version: <strong className="text-limeAccent font-mono">v{chartVersion}</strong></span>
            {steps.some(s => s.needs_review) && (
              <span className="text-amber-400 font-bold text-[11px] flex items-center gap-1 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/40">
                <AlertTriangle className="w-3.5 h-3.5" />
                {steps.filter(s => s.needs_review).length} step(s) pending review. Confirm each to enable Publish.
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSaveChart('Draft')}
              disabled={saving}
              className="bg-darkBg hover:bg-forestGreen/40 text-white border border-forestGreen font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-limeAccent" /> Save Draft
            </button>

            {chartStatus === 'Draft' && (
              <button
                onClick={() => handleSaveChart('In Review')}
                disabled={saving}
                className="bg-pendingAmber/90 hover:bg-pendingAmber text-darkBg font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow disabled:opacity-50"
              >
                <Clock className="w-4 h-4" /> Submit for Review
              </button>
            )}

            {(chartStatus === 'Draft' || chartStatus === 'In Review') && (
              <button
                onClick={() => handleSaveChart('Approved')}
                disabled={saving}
                className="bg-forestGreen hover:bg-forestGreen/80 text-limeAccent font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 border border-forestGreen disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Approve Chart
              </button>
            )}

            <button
              onClick={() => handleSaveChart('Publish')}
              disabled={saving || steps.some(s => s.needs_review)}
              title={steps.some(s => s.needs_review) ? "Confirm all flagged steps before publishing" : "Publish chart to patient"}
              className="bg-completedGreen hover:bg-completedGreen/90 text-white font-bold py-2 px-6 rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Publishing...' : 'Publish to Patient'}
            </button>
          </div>
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-panelBg border border-forestGreen rounded-2xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <h3 className="font-bold text-white text-sm">Save Current Timeline as Hospital Template</h3>
            <div>
              <label className="block text-textLight/80 font-semibold mb-1">Template Name:</label>
              <input
                type="text"
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="e.g. My Hospital Cardiac Care Protocol"
                className="w-full bg-darkBg border border-forestGreen rounded-xl p-3 text-white focus:outline-none focus:border-limeAccent"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowSaveTemplateModal(false)} className="px-4 py-2 rounded-xl bg-darkBg text-textLight">
                Cancel
              </button>
              <button onClick={handleSaveAsTemplate} className="px-5 py-2 rounded-xl bg-primaryGreen text-darkBg font-bold">
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
