import React, { useState } from 'react';
import { Task } from '../types';
import {
  FileText, HeartPulse, Calendar, Activity, Pill, CheckSquare,
  AlertTriangle, Copy, Download, Globe, ShieldCheck, Info, Check, HelpCircle
} from 'lucide-react';

interface PatientDischargeReportCardProps {
  reportData: any;
  tasks?: Task[];
  hospitalName?: string;
  onCopy?: () => void;
  onDownloadPdf?: () => void;
  reportLang: 'en' | 'ta' | 'hi';
  onLangChange: (lang: 'en' | 'ta' | 'hi') => void;
  copiedReport?: boolean;
}

export const PatientDischargeReportCard: React.FC<PatientDischargeReportCardProps> = ({
  reportData,
  tasks = [],
  hospitalName = 'CareBridge Hospital',
  onCopy,
  onDownloadPdf,
  reportLang,
  onLangChange,
  copiedReport = false,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  if (!reportData) return null;

  const secA = reportData.section_a || {};
  const secB = reportData.section_b || {};
  const secC = reportData.section_c || {};
  const secD = reportData.section_d || {};
  const secE = reportData.section_e || {};
  const secF = reportData.section_f || {};
  const missingItems = reportData.not_found_in_summary || [];

  // Filter tasks from current chart state if provided, otherwise fallback to report JSON
  const appointmentTasks = tasks.length > 0
    ? tasks.filter(t => t.category === 'appointment')
    : (secE.steps || []).filter((s: any) => s.category === 'appointment' || s.type === 'appointment');

  const testTasks = tasks.length > 0
    ? tasks.filter(t => t.category === 'test' || t.category === 'scan')
    : (secE.steps || []).filter((s: any) => s.category === 'test' || s.category === 'scan' || s.type === 'test');

  const medicineTasks = tasks.length > 0
    ? tasks.filter(t => t.category === 'medicine')
    : (secD.medicines || []);

  const careTasks = tasks.length > 0
    ? tasks.filter(t => t.category === 'care_instruction')
    : (secE.steps || []).filter((s: any) => s.category === 'care_instruction' || s.type === 'care_instruction');

  const warningTasks = tasks.length > 0
    ? tasks.filter(t => t.category === 'warning_sign')
    : (secE.steps || []).filter((s: any) => s.category === 'warning_sign' || s.type === 'warning_sign');

  const getLocalizedDiagExplanation = () => {
    if (reportLang === 'ta' && secB.explanation_ta) return secB.explanation_ta;
    if (reportLang === 'hi' && secB.explanation_hi) return secB.explanation_hi;
    return secB.explanation_en || secB.diagnosis_verbatim;
  };

  const getLocalizedReason = () => {
    if (reportLang === 'ta' && secC.reason_summary_ta) return secC.reason_summary_ta;
    if (reportLang === 'hi' && secC.reason_summary_hi) return secC.reason_summary_hi;
    return secC.reason_summary_en || 'Patient was admitted for hospital treatment and stabilization.';
  };

  const getLocalizedWarning = () => {
    if (reportLang === 'ta' && secF.warning_text_ta) return secF.warning_text_ta;
    if (reportLang === 'hi' && secF.warning_text_hi) return secF.warning_text_hi;
    return secF.warning_text_en || 'If you experience severe shortness of breath, chest pain, fever, or bleeding, contact emergency medical services immediately.';
  };

  const renderSourceTooltip = (sentence: string | undefined, id: string) => {
    if (!sentence) return null;
    const isShowing = activeTooltip === id;
    return (
      <div className="relative inline-block ml-1">
        <button
          type="button"
          onClick={() => setActiveTooltip(isShowing ? null : id)}
          onMouseEnter={() => setActiveTooltip(id)}
          onMouseLeave={() => setActiveTooltip(null)}
          className="text-limeAccent hover:text-white p-1 rounded transition"
          title="Click or hover to view exact source sentence from summary text"
        >
          <HelpCircle className="w-3.5 h-3.5 inline shrink-0" />
        </button>

        {isShowing && (
          <div className="absolute right-0 bottom-full mb-1 z-30 w-64 bg-darkBg border border-limeAccent p-2.5 rounded-lg shadow-2xl text-[10px] text-limeAccent font-mono leading-relaxed">
            <strong className="block text-white mb-0.5 border-b border-forestGreen/60 pb-0.5">Source Sentence:</strong>
            "{sentence}"
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-6 shadow-2xl space-y-6">
      {/* 1. CARD HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-forestGreen">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forestGreen border border-primaryGreen/50 flex items-center justify-center text-limeAccent font-bold text-lg shadow">
            📋
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Patient Discharge Report</h2>
            <p className="text-xs text-textLight/70">
              Discharging Facility: <strong className="text-limeAccent">{secA.hospital_name || hospitalName}</strong> | Report Date: <span className="font-mono text-white">{secA.discharge_date}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language Toggle */}
          <div className="flex items-center gap-1 bg-darkBg p-1 rounded-lg border border-forestGreen">
            <Globe className="w-3.5 h-3.5 text-limeAccent ml-1.5 shrink-0" />
            <button
              type="button"
              onClick={() => onLangChange('en')}
              className={`text-xs px-2.5 py-1 rounded font-bold transition ${reportLang === 'en' ? 'bg-primaryGreen text-darkBg' : 'text-textLight hover:text-white'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onLangChange('ta')}
              className={`text-xs px-2.5 py-1 rounded font-bold transition ${reportLang === 'ta' ? 'bg-primaryGreen text-darkBg' : 'text-textLight hover:text-white'}`}
            >
              தமிழ்
            </button>
            <button
              type="button"
              onClick={() => onLangChange('hi')}
              className={`text-xs px-2.5 py-1 rounded font-bold transition ${reportLang === 'hi' ? 'bg-primaryGreen text-darkBg' : 'text-textLight hover:text-white'}`}
            >
              हिंदी
            </button>
          </div>

          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              className="bg-darkBg hover:bg-forestGreen/60 text-white font-bold text-xs py-2 px-3 rounded-lg border border-forestGreen flex items-center gap-1.5 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-limeAccent" />
              {copiedReport ? 'Copied!' : 'Copy'}
            </button>
          )}

          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              className="bg-forestGreen hover:bg-primaryGreen text-white hover:text-darkBg font-bold text-xs py-2 px-3 rounded-lg border border-primaryGreen/50 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          )}
        </div>
      </div>

      {/* 2. TOP BLOCK: 2-COLUMN ALIGNED GRID */}
      <div className="bg-darkBg/90 p-4 rounded-xl border border-forestGreen/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex justify-between sm:flex-col sm:justify-start">
            <span className="text-textLight/60">Patient Name:</span>
            <span className="font-bold text-white text-sm">{secA.patient_name || 'Connected Patient'}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:justify-start">
            <span className="text-textLight/60">Patient ID:</span>
            <span className="font-bold text-limeAccent font-mono">{secA.patient_id || 'PAT-0001'}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:justify-start">
            <span className="text-textLight/60">Age / Gender:</span>
            <span className="font-bold text-white">{secA.age} yrs / {secA.gender}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:justify-start">
            <span className="text-textLight/60">Hospital Facility:</span>
            <span className="font-bold text-white">{secA.hospital_name || hospitalName}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:justify-start">
            <span className="text-textLight/60">Admission Date:</span>
            <span className="font-semibold text-textLight">{secA.admission_date || 'Not mentioned in summary'}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:justify-start">
            <span className="text-textLight/60">Discharge Date:</span>
            <span className="font-semibold text-textLight">{secA.discharge_date}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:justify-start sm:col-span-2">
            <span className="text-textLight/60">Treating Department / Doctor:</span>
            <span className="font-semibold text-textLight">{secA.treating_doctor_dept || 'Not mentioned in summary'}</span>
          </div>
        </div>
      </div>

      {/* 3. SECTION 1: DISEASE / DIAGNOSIS */}
      <div className="space-y-2 pt-2 border-t border-forestGreen/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-limeAccent flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-limeAccent" />
          1. Disease / Diagnosis (As Written in Summary)
        </h3>
        <div className="bg-darkBg p-3.5 rounded-xl border border-forestGreen/60 text-xs space-y-2">
          <div className="font-bold text-white text-sm flex items-center justify-between gap-2">
            <span>{secB.diagnosis_verbatim || 'Clinical Evaluation'}</span>
            {renderSourceTooltip(secB.evidence_sentence, 'diag')}
          </div>
          <p className="text-limeAccent bg-forestGreen/20 p-2.5 rounded-lg border border-primaryGreen/30 leading-relaxed">
            <strong>Plain-Language Explanation:</strong> {getLocalizedDiagExplanation()}
          </p>
        </div>
      </div>

      {/* 4. SECTION 2: REASON FOR ADMISSION & TREATMENT */}
      <div className="space-y-2 pt-2 border-t border-forestGreen/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-limeAccent flex items-center gap-2">
          <FileText className="w-4 h-4 text-limeAccent" />
          2. Reason for Admission & Hospital Treatment
        </h3>
        <div className="bg-darkBg p-3.5 rounded-xl border border-forestGreen/60 text-xs text-textLight flex items-start justify-between gap-2">
          <p className="leading-relaxed">{getLocalizedReason()}</p>
          {renderSourceTooltip(secC.evidence_sentence, 'reason')}
        </div>
      </div>

      {/* 5. SECTION 3: FOLLOW-UP APPOINTMENTS TABLE */}
      <div className="space-y-2 pt-2 border-t border-forestGreen/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-limeAccent flex items-center gap-2">
          <Calendar className="w-4 h-4 text-limeAccent" />
          3. Follow-up Appointments
        </h3>
        {appointmentTasks.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-forestGreen/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-darkBg text-limeAccent font-bold border-b border-forestGreen/60">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Visit / Department</th>
                  <th className="p-2.5">What to Do</th>
                  <th className="p-2.5 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forestGreen/30 bg-darkBg/60">
                {appointmentTasks.map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-forestGreen/20 transition">
                    <td className="p-2.5 font-mono text-limeAccent font-bold shrink-0">{a.due_date || 'TBD'}</td>
                    <td className="p-2.5 font-semibold text-white">{a.title}</td>
                    <td className="p-2.5 text-textLight">{a.simple_text || a.instruction_text}</td>
                    <td className="p-2.5 text-right">{renderSourceTooltip(a.instruction_text || a.evidence_sentence, `app_${i}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-textLight/50 italic bg-darkBg/40 p-3 rounded-lg border border-forestGreen/30">Not mentioned in summary</p>
        )}
      </div>

      {/* 6. SECTION 4: TESTS AND SCANS TABLE */}
      <div className="space-y-2 pt-2 border-t border-forestGreen/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-limeAccent flex items-center gap-2">
          <Activity className="w-4 h-4 text-limeAccent" />
          4. Tests & Scans to Take
        </h3>
        {testTasks.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-forestGreen/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-darkBg text-limeAccent font-bold border-b border-forestGreen/60">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Test / Scan</th>
                  <th className="p-2.5">Instructions</th>
                  <th className="p-2.5 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forestGreen/30 bg-darkBg/60">
                {testTasks.map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-forestGreen/20 transition">
                    <td className="p-2.5 font-mono text-limeAccent font-bold shrink-0">{t.due_date || 'TBD'}</td>
                    <td className="p-2.5 font-semibold text-white">{t.title}</td>
                    <td className="p-2.5 text-textLight">{t.simple_text || t.instruction_text}</td>
                    <td className="p-2.5 text-right">{renderSourceTooltip(t.instruction_text || t.evidence_sentence, `test_${i}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-textLight/50 italic bg-darkBg/40 p-3 rounded-lg border border-forestGreen/30">Not mentioned in summary</p>
        )}
      </div>

      {/* 7. SECTION 5: MEDICATIONS TABLE */}
      <div className="space-y-2 pt-2 border-t border-forestGreen/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-limeAccent flex items-center gap-2">
          <Pill className="w-4 h-4 text-limeAccent" />
          5. Medications to Continue
        </h3>
        {medicineTasks.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-forestGreen/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-darkBg text-limeAccent font-bold border-b border-forestGreen/60">
                <tr>
                  <th className="p-2.5">Medicine</th>
                  <th className="p-2.5">Instruction / Timing</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forestGreen/30 bg-darkBg/60">
                {medicineTasks.map((m: any, i: number) => {
                  const isNeedsRev = m.needs_review || m.status === 'Needs Review';
                  return (
                    <tr key={i} className="hover:bg-forestGreen/20 transition">
                      <td className="p-2.5 font-bold text-white">{m.title || `Medicine ${i + 1}`}</td>
                      <td className="p-2.5 text-textLight">
                        {m.instruction_text}
                        {m.reviewer_notes && <span className="block text-[10px] text-reviewOrange font-mono mt-0.5">⚠️ {m.reviewer_notes}</span>}
                      </td>
                      <td className="p-2.5">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow ${isNeedsRev ? 'bg-reviewOrange text-white' : 'bg-completedGreen text-white'}`}>
                          {isNeedsRev ? 'Needs Review' : 'Auto-extracted'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">{renderSourceTooltip(m.instruction_text || m.evidence_sentence, `med_${i}`)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-textLight/50 italic bg-darkBg/40 p-3 rounded-lg border border-forestGreen/30">Not mentioned in summary</p>
        )}
      </div>

      {/* 8. SECTION 6: CARE INSTRUCTIONS LIST */}
      <div className="space-y-2 pt-2 border-t border-forestGreen/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-limeAccent flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-limeAccent" />
          6. Care Instructions (Diet, Wound Care, Rehab, Activity)
        </h3>
        {careTasks.length > 0 ? (
          <ul className="bg-darkBg p-3.5 rounded-xl border border-forestGreen/60 text-xs text-textLight space-y-2 list-disc list-inside">
            {careTasks.map((c: any, i: number) => (
              <li key={i} className="flex items-start justify-between gap-2">
                <span><strong>{c.title}:</strong> {c.instruction_text || c.simple_text}</span>
                {renderSourceTooltip(c.instruction_text || c.evidence_sentence, `care_${i}`)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-textLight/50 italic bg-darkBg/40 p-3 rounded-lg border border-forestGreen/30">Not mentioned in summary</p>
        )}
      </div>

      {/* 9. SECTION 7: EMERGENCY WARNING SIGNS (AMBER BOX) */}
      <div className="space-y-2 pt-2 border-t border-forestGreen/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          7. Emergency Warning Signs & Contact Instructions
        </h3>
        <div className="bg-amber-950/80 border border-amber-500/60 p-4 rounded-xl text-xs text-amber-200 leading-relaxed font-semibold flex items-start justify-between gap-2 shadow">
          <div>
            <p className="text-amber-300 font-bold mb-1">Contact your doctor or emergency services if you notice:</p>
            <p>{getLocalizedWarning()}</p>
          </div>
          {renderSourceTooltip(secF.evidence_sentence, 'warn')}
        </div>
      </div>

      {/* NOT MENTIONED IN SUMMARY BOX */}
      {missingItems.length > 0 && (
        <div className="bg-darkBg/60 border border-forestGreen/40 p-3.5 rounded-xl text-xs space-y-1.5">
          <span className="text-textLight/70 font-bold block flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-textLight/60" /> Not Mentioned in Discharge Summary (Not Guessed):
          </span>
          <ul className="list-disc list-inside text-textLight/60 space-y-0.5">
            {missingItems.map((m: any, idx: number) => (
              <li key={idx}><strong>{m.field}:</strong> {m.reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* CARD FOOTER: DISCLAIMER */}
      <div className="bg-forestGreen/40 border border-primaryGreen/40 p-3 rounded-xl text-xs text-textLight/80 flex items-center gap-2 text-[11px]">
        <ShieldCheck className="w-4 h-4 text-limeAccent shrink-0" />
        <span><strong>Disclaimer:</strong> This report organizes what is written in the discharge summary. It does not diagnose or recommend treatment. Clinical staff must confirm all content.</span>
      </div>
    </div>
  );
};
