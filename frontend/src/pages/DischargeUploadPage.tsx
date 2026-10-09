import React, { useState, useEffect } from 'react';
import { patientApi, dischargeApi, chartApi } from '../services/api';
import { Patient, FollowupChart, Task } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { PatientDischargeReportCard } from '../components/PatientDischargeReportCard';
import {
  FileText, UserPlus, Sparkles, CheckCircle2, ArrowRight, AlertCircle,
  ShieldCheck, Copy, Download, Globe, Edit3, Save, Check, Clock, Stethoscope,
  Activity, Layers, HeartPulse
} from 'lucide-react';
import { StatusChip, Skeleton } from '../components/ui/Primitives';

export const DischargeUploadPage: React.FC = () => {
  const navigate = useNavigate();

  const [connectedPatients, setConnectedPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wizard Stepper State: 1 Select Patient, 2 Summary Text, 3 AI Analysis, 4 Edit Chart, 5 Published
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Preset Selection state
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number>(0);

  // Agent Pipeline Execution state
  const [loading, setLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [createdChart, setCreatedChart] = useState<FollowupChart | null>(null);

  // Analysis Report Display state
  const [reportLang, setReportLang] = useState<'en' | 'ta' | 'hi'>('en');
  const [copiedReport, setCopiedReport] = useState(false);

  // Chart Builder Editing state
  const [editingChart, setEditingChart] = useState<FollowupChart | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);
  const [savingChart, setSavingChart] = useState(false);

  useEffect(() => {
    patientApi.getConnectedPatients().then(res => {
      setConnectedPatients(res);
      if (res.length > 0) setSelectedPatientId(res[0].id);
      setLoadingPatients(false);
    }).catch(err => {
      console.error(err);
      setLoadingPatients(false);
    });
  }, []);

  const samplePresets = [
    {
      title: "Cardiac Post-PCI Case",
      text: `PATIENT DISCHARGE SUMMARY - CARDIOLOGY
Diagnosis: Acute Anterior Wall Myocardial Infarction s/p Primary PCI to LAD.

DISCHARGE MEDICATIONS:
1. Tab Aspirin 75mg once daily after breakfast.
2. Tab Clopidogrel 75mg once daily.
3. Tab Atorvastatin 40mg once daily at bedtime.
4. Tab Metoprolol 25mg twice daily - titrate as needed depending on pulse.

FOLLOW-UP PLAN & DIAGNOSTICS:
- Return to Cardiology OPD in 7 days for clinical review and wound inspection.
- Repeat Echocardiogram (ECHO) and 12-lead ECG in 5 days prior to OPD visit.
- Fasting lipid profile and serum creatinine lab test in 2 weeks.

HOME CARE & DIET:
- Strict salt restriction (<2g/day). Fluid intake restricted to 1.5L daily.
- Daily weight monitoring. Wound care for femoral access site - keep dry and clean.

EMERGENCY WARNING SIGNS:
- Immediate emergency return if patient experiences recurring chest pain, severe breathlessness, fever >101F, or sudden dizziness.`
    },
    {
      title: "Laparoscopic Surgery (Ambiguous)",
      text: `PATIENT DISCHARGE SUMMARY - SURGICAL WARD
Procedure: Laparoscopic Cholecystectomy.
Instructions:
- Wound dressing change after 3 days.
- Tab Amoxicillin-Clavulanate 625mg twice daily for 5 days.
- Follow-up with General Surgery team in 10-14 days or as needed.`
    },
    {
      title: "Diabetes Management Case",
      text: `PATIENT DISCHARGE SUMMARY - ENDOCRINOLOGY
Diagnosis: Type 2 Diabetes Mellitus.
Instructions:
- Inj Insulin Glargine 14 units SubQ at bedtime.
- Repeat HbA1c test in 10 days.
- Follow-up appointment in Diabetology OPD in 2 weeks.`
    }
  ];

  const pipelineStepsList = [
    { agent: "Extractor", text: "Extracting clinical diagnosis, discharge medicines, follow-up timeline, and red flags..." },
    { agent: "Task Planner", text: "Scheduling target due dates and assigning priorities..." },
    { agent: "Patient-Friendly Simplifier", text: "Generating plain-language explanations in English, Tamil, and Hindi..." },
    { agent: "Provider Matcher", text: "Scoring nearby directory hospitals and slots..." },
    { agent: "Safety Reviewer", text: "Auditing dosages and flagging ambiguous items for Reviewer Queue..." }
  ];

  const handleProcess = async () => {
    if (!selectedPatientId) {
      setError("Please select a connected patient.");
      return;
    }

    const selPat = connectedPatients.find(p => p.id === selectedPatientId);
    const presetObj = samplePresets[selectedPresetIdx];
    const formattedText = selPat
      ? `PATIENT DISCHARGE SUMMARY
Patient Name: ${selPat.name} | Age: ${selPat.age} | Gender: ${selPat.gender}
${presetObj.text}`
      : presetObj.text;

    setError(null);
    setLoading(true);
    setCurrentStep(3); // AI Processing step
    setPipelineStep(0);
    setPublishError(null);
    setPublishSuccess(false);

    try {
      for (let i = 0; i < pipelineStepsList.length; i++) {
        setPipelineStep(i);
        await new Promise(r => setTimeout(r, 450));
      }

      const chartRes = await dischargeApi.process(selectedPatientId, formattedText, true);
      setCreatedChart(chartRes);
      setEditingChart(chartRes);
      setCurrentStep(4); // Chart builder step
    } catch (err: any) {
      console.error("Discharge processing error:", err);
      setError(err.response?.data?.detail || "Discharge processing failed. Ensure patient connection is accepted.");
      setCurrentStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!editingChart?.analysis_report) return;
    const r = editingChart.analysis_report;
    const text = JSON.stringify(r, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  const handleDownloadPdf = async () => {
    if (!editingChart) return;
    try {
      await dischargeApi.downloadReportPdf(editingChart.id);
    } catch (err: any) {
      console.error(err);
      setError("Failed to download Analysis Report PDF.");
    }
  };

  const handleConfirmStep = async (taskId: number) => {
    try {
      const updatedTask = await chartApi.confirmStep(taskId);
      if (editingChart) {
        const updatedTasks = editingChart.tasks.map(t => t.id === taskId ? updatedTask : t);
        setEditingChart({ ...editingChart, tasks: updatedTasks });
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to confirm step.");
    }
  };

  const handleSaveDraft = async () => {
    if (!editingChart) return;
    setSavingChart(true);
    setError(null);
    try {
      const stepsPayload = editingChart.tasks.map(t => ({
        title: t.title,
        category: t.category,
        instruction_text: t.instruction_text,
        simple_text: t.simple_text,
        due_date: t.due_date,
        needs_review: t.needs_review
      }));
      const res = await chartApi.updateChart(editingChart.id, { steps: stepsPayload });
      setEditingChart(res);
      alert("Draft chart saved successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save draft chart.");
    } finally {
      setSavingChart(false);
    }
  };

  const handlePublishChart = async () => {
    if (!editingChart) return;
    setPublishError(null);

    const flagged = editingChart.tasks.filter(t => t.needs_review || t.status === 'Needs Review');
    if (flagged.length > 0) {
      setPublishError(`Cannot publish chart: ${flagged.length} step(s) require human review and confirmation.`);
      return;
    }

    try {
      const res = await chartApi.publishChart(editingChart.id);
      setEditingChart(res);
      setPublishSuccess(true);
      setCurrentStep(5);
    } catch (err: any) {
      console.error(err);
      setPublishError(err.response?.data?.detail || "Failed to publish chart to patient portal.");
    }
  };

  const selectedPatientObj = connectedPatients.find(p => p.id === selectedPatientId);

  const wizardSteps = [
    { num: 1, label: 'Select Patient' },
    { num: 2, label: 'Clinical Summary' },
    { num: 3, label: '5-Agent Pipeline' },
    { num: 4, label: 'Edit Chart' },
    { num: 5, label: 'Published' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl border-mintGlow/25">
        <h1 className="font-heading text-2xl font-bold text-textLight flex items-center gap-2">
          <FileText className="w-7 h-7 text-mintGlow" />
          Run 5-Agent Extraction & Discharge Chart Builder
        </h1>
        <p className="text-xs text-mutedText mt-1">
          Select a connected patient to trigger the 5-Agent extraction workflow and review human-confirmed chart steps.
        </p>

        {/* WIZARD STEPPER PROGRESS LINE */}
        <div className="mt-6 pt-5 border-t border-mintGlow/15 flex items-center justify-between relative">
          <div className="absolute top-8 left-6 right-6 h-0.5 bg-surface -z-0" />
          <div 
            className="absolute top-8 left-6 h-0.5 bg-gradient-to-r from-primaryGreen to-mintGlow transition-all duration-500 -z-0" 
            style={{ width: `${((currentStep - 1) / (wizardSteps.length - 1)) * 90}%` }}
          />

          {wizardSteps.map(step => {
            const isDone = currentStep > step.num;
            const isCurrent = currentStep === step.num;
            return (
              <div key={step.num} className="flex flex-col items-center gap-1.5 z-10">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-all ${
                  isDone ? 'bg-primaryGreen text-ink shadow-glow-primary' :
                  isCurrent ? 'bg-mintGlow text-ink ring-4 ring-mintGlow/20 scale-110 shadow-glow-mint' :
                  'bg-surface text-mutedText border border-mintGlow/10'
                }`}>
                  {isDone ? <Check className="w-4 h-4" /> : step.num}
                </div>
                <span className={`text-[10px] font-medium transition ${isCurrent ? 'text-mintGlow font-bold' : 'text-mutedText'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="glass-card border-declinedRed/50 p-4 rounded-2xl text-xs text-declinedRed flex items-start gap-2.5 shadow">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {!editingChart ? (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border-mintGlow/20 space-y-6">
            <h3 className="font-heading font-bold text-textLight text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-mintGlow" />
              1. Select Connected Patient (Consent Verified)
            </h3>

            {loadingPatients ? (
              <Skeleton height="60px" className="rounded-xl" />
            ) : connectedPatients.length > 0 ? (
              <div className="space-y-5">
                <select
                  value={selectedPatientId || ''}
                  onChange={e => setSelectedPatientId(parseInt(e.target.value))}
                  className="w-full bg-slate-900 border-2 border-mintGlow/40 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-mintGlow font-bold shadow-md cursor-pointer"
                >
                  {connectedPatients.map(p => (
                    <option
                      key={p.id}
                      value={p.id}
                      style={{ color: '#000000', backgroundColor: '#FFFFFF', fontWeight: 'bold' }}
                      className="bg-white text-black font-bold p-2"
                    >
                      {p.name} ({p.patient_code}) - {p.age}y/{p.gender} [{p.district}] (Connected)
                    </option>
                  ))}
                </select>

                {/* Preset Clinical Profile Pills */}
                <div className="space-y-2">
                  <span className="text-xs text-mutedText font-medium">Select Clinical Profile Case:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {samplePresets.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPresetIdx(idx)}
                        className={`text-xs px-3.5 py-2 rounded-xl transition border cursor-pointer ${
                          selectedPresetIdx === idx
                            ? 'bg-gradient-to-r from-primaryGreen to-limeAccent text-ink font-bold shadow-glow-primary'
                            : 'glass-panel text-mutedText hover:text-textLight hover:bg-forest/40'
                        }`}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ANIMATED AGENT PIPELINE NODE SEQUENCE */}
                {loading && (
                  <div className="glass-card p-5 rounded-2xl border-mintGlow/40 space-y-4 shadow-inner animate-in fade-in">
                    <div className="text-xs font-bold text-mintGlow flex items-center gap-2">
                      <Sparkles className="w-4 h-4 animate-spin text-mintGlow" />
                      5-Agent Extraction Pipeline Executing:
                    </div>

                    {/* Node Sequence Lighting Up */}
                    <div className="grid grid-cols-5 gap-2">
                      {pipelineStepsList.map((stepItem, idx) => {
                        const isNodeActive = pipelineStep >= idx;
                        const isNodeCurrent = pipelineStep === idx;
                        return (
                          <div 
                            key={idx} 
                            className={`p-2 rounded-xl text-center border transition-all duration-300 ${
                              isNodeCurrent ? 'bg-mintGlow text-ink font-bold border-mintGlow scale-105 shadow-glow-mint' :
                              isNodeActive ? 'bg-primaryGreen/25 text-mintGlow border-mintGlow/40' :
                              'glass-panel text-mutedText border-mintGlow/10 opacity-50'
                            }`}
                          >
                            <div className="text-[10px] font-mono leading-tight">{stepItem.agent}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-xs text-textLight font-medium">
                      {pipelineStepsList[pipelineStep].agent}: {pipelineStepsList[pipelineStep].text}
                    </div>

                    <div className="w-full bg-surface h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primaryGreen to-mintGlow h-full transition-all duration-300"
                        style={{ width: `${((pipelineStep + 1) / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleProcess}
                  disabled={loading || !selectedPatientId}
                  className="w-full bg-gradient-to-r from-primaryGreen to-mintGlow hover:opacity-95 text-ink font-bold text-sm py-4 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-glow-primary transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                  Run 5-Agent Extraction & Generate Chart
                </button>
              </div>
            ) : (
              <div className="glass-panel p-6 rounded-2xl text-xs space-y-3 text-center">
                <span className="text-pendingAmber font-bold text-sm block">No Connected Patients Found</span>
                <p className="text-mutedText">
                  You must send a follow request to a patient from the Find Patients page before creating a follow-up chart.
                </p>
                <Link
                  to="/hospital/find-patients"
                  className="inline-block bg-primaryGreen text-ink font-bold text-xs py-2.5 px-4 rounded-xl shadow"
                >
                  Go to Find Patients Page
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* DISCHARGE ANALYSIS REPORT & EDITABLE CHART BUILDER SCREEN */
        <div className="space-y-8">
          {/* SINGLE PATIENT DISCHARGE REPORT CARD */}
          {editingChart.analysis_report && (
            <PatientDischargeReportCard
              reportData={editingChart.analysis_report}
              tasks={editingChart.tasks}
              hospitalName={selectedPatientObj?.hospital_id}
              onCopy={handleCopyReport}
              onDownloadPdf={handleDownloadPdf}
              reportLang={reportLang}
              onLangChange={setReportLang}
              copiedReport={copiedReport}
            />
          )}

          {/* EDITABLE CHART BUILDER */}
          <div className="glass-card p-6 rounded-2xl border-mintGlow/25 space-y-6">
            <div className="flex flex-wrap items-center justify-between pb-4 border-b border-mintGlow/15 gap-4">
              <div>
                <h3 className="font-heading font-bold text-textLight text-lg">Editable Follow-up Chart Builder</h3>
                <p className="text-xs text-mutedText">Review, edit, and confirm each step before publishing to the patient portal.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={savingChart}
                  className="glass-panel hover:bg-forest/60 text-textLight font-bold text-xs py-2.5 px-4 rounded-xl border border-mintGlow/20 flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Save className="w-4 h-4 text-mintGlow" />
                  {savingChart ? "Saving..." : "Save Draft"}
                </button>

                <button
                  onClick={handlePublishChart}
                  className="bg-gradient-to-r from-primaryGreen to-limeAccent text-ink font-bold text-xs py-2.5 px-5 rounded-xl shadow-glow-primary hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Publish to Patient
                </button>
              </div>
            </div>

            {publishError && (
              <div className="glass-card border-declinedRed/80 p-4 rounded-2xl text-xs text-declinedRed flex items-start gap-2.5 shadow-xl">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Publishing Blocked!</strong>
                  <p>{publishError}</p>
                </div>
              </div>
            )}

            {publishSuccess && (
              <div className="glass-card border-completedGreen/80 p-4 rounded-2xl text-xs text-completedGreen flex items-center gap-2.5 shadow-xl">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <strong>Success! Chart Published to Patient.</strong> The patient can now view their plain-language care plan in their portal.
                </div>
              </div>
            )}

            {/* DRAGGABLE VERTICAL TIMELINE FOR CHART STEPS */}
            <div className="space-y-4 relative pl-4 border-l-2 border-mintGlow/20 ml-2">
              {editingChart.tasks?.map((t, idx) => {
                const needsRev = t.needs_review || t.status === 'Needs Review';
                return (
                  <div
                    key={t.id}
                    className={`glass-card p-5 rounded-2xl border-2 transition-all space-y-3 relative ${
                      needsRev ? 'border-reviewOrange/70 shadow-glow-primary' : 'border-mintGlow/20'
                    }`}
                  >
                    {/* Step Icon Node on Timeline */}
                    <div className={`absolute -left-7 top-5 w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold border ${
                      needsRev ? 'bg-reviewOrange text-white border-reviewOrange' : 'bg-primaryGreen text-ink border-mintGlow'
                    }`}>
                      {idx + 1}
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-sm text-textLight">{t.title}</span>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface text-mintGlow border border-mintGlow/20">
                            {t.category}
                          </span>
                        </div>
                        <div className="text-xs text-mutedText">{t.instruction_text}</div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusChip status={needsRev ? 'needs_review' : 'completed'} />
                        {needsRev && (
                          <button
                            onClick={() => handleConfirmStep(t.id)}
                            className="bg-limeAccent hover:bg-limeAccent/90 text-ink font-bold text-xs py-1.5 px-3 rounded-xl shadow flex items-center gap-1 transition cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Confirm Step
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-mintGlow/10 text-xs">
                      <div className="md:col-span-2">
                        <span className="text-mutedText block mb-1">Plain-Language Patient Guide:</span>
                        <input
                          type="text"
                          value={t.simple_text}
                          onChange={e => {
                            const newTasks = editingChart.tasks.map(item => item.id === t.id ? { ...item, simple_text: e.target.value } : item);
                            setEditingChart({ ...editingChart, tasks: newTasks });
                          }}
                          className="w-full bg-surface border border-mintGlow/20 rounded-xl p-2.5 text-xs text-textLight focus:outline-none focus:border-mintGlow"
                        />
                      </div>
                      <div>
                        <span className="text-mutedText block mb-1">Target Due Date:</span>
                        <input
                          type="date"
                          value={t.due_date || ''}
                          onChange={e => {
                            const newTasks = editingChart.tasks.map(item => item.id === t.id ? { ...item, due_date: e.target.value } : item);
                            setEditingChart({ ...editingChart, tasks: newTasks });
                          }}
                          className="w-full bg-surface border border-mintGlow/20 rounded-xl p-2.5 text-xs text-textLight focus:outline-none focus:border-mintGlow font-mono"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
