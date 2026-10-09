import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { patientApi, taskApi, documentApi, connectionApi } from '../services/api';
import { Patient, FollowupChart, Task, DocumentItem, ConnectionOut } from '../types';
import { InteractiveGraph } from '../components/InteractiveGraph';
import { EvidenceModal } from '../components/EvidenceModal';
import { PatientBookingModal } from './PatientBookingModal';
import { ContactHospitalModal } from '../components/ContactHospitalModal';
import { ChatbotWidget } from '../components/ChatbotWidget';
import { PatientDischargeReportCard } from '../components/PatientDischargeReportCard';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, Download, Upload, CheckSquare, HeartPulse, MessageSquare, X, FileText, 
  AlertCircle, Calendar, Pill, CheckCircle2, ChevronRight, Activity, Sparkles, Building2
} from 'lucide-react';
import { StatusChip, Skeleton, TrustBadge } from '../components/ui/Primitives';

export const PatientDashboard: React.FC = () => {
  const { user, authLoading, token } = useAuth();
  const { t, language } = useLanguage();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [chart, setChart] = useState<FollowupChart | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [pendingConns, setPendingConns] = useState<ConnectionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Connection action states
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [connSuccessMsg, setConnSuccessMsg] = useState<string | null>(null);
  const [connError, setConnError] = useState<string | null>(null);

  // Modals state
  const [showContactModal, setShowContactModal] = useState(false);
  const [bookingTask, setBookingTask] = useState<Task | null>(null);
  const [evidenceTask, setEvidenceTask] = useState<Task | null>(null);
  const [uploadModalTask, setUploadModalTask] = useState<Task | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<{ id: number; file_name: string; mime_type?: string } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewDoc) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      setPreviewError(null);
      return;
    }

    let isMounted = true;
    setPreviewLoading(true);
    setPreviewError(null);

    documentApi.viewDocumentBlob(previewDoc.id)
      .then(blob => {
        if (!isMounted) return;
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
      })
      .catch(err => {
        if (!isMounted) return;
        setPreviewError(err.message || "Failed loading document preview.");
      })
      .finally(() => {
        if (isMounted) setPreviewLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [previewDoc]);

  const loadData = async (isSilent = false) => {
    if (authLoading) return;
    if (!isSilent && !patient) setLoading(true);
    setError(null);
    try {
      const pList = await patientApi.list();
      if (pList.length > 0) {
        const p = pList[0];
        setPatient(p);
        const c = await patientApi.getChart(p.id);
        setChart(c);
        const docs = await documentApi.list(p.id);
        setDocuments(docs);
      } else {
        if (!isSilent) setError("No patient profile found for this account.");
      }

      try {
        const conns = await connectionApi.getMyConnections();
        setPendingConns(conns.filter((c: ConnectionOut) => c.status === 'pending'));
      } catch (cErr) {
        console.warn("Connections fetch warning:", cErr);
      }
    } catch (err: any) {
      console.error("Patient dashboard load error:", err);
      if (!isSilent) setError(err.response?.data?.detail || "Failed loading patient portal care plan.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleAcceptConnection = async (connId: number) => {
    setActionLoadingId(connId);
    setConnError(null);
    setConnSuccessMsg(null);
    try {
      await connectionApi.action(connId, 'accept');
      setConnSuccessMsg("Connection accepted! Hospital facility can now coordinate your post-discharge follow-up care.");
      await loadData(true);
      setTimeout(() => setConnSuccessMsg(null), 6000);
    } catch (err: any) {
      setConnError(err.response?.data?.detail || "Failed accepting connection request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineConnection = async (connId: number) => {
    setActionLoadingId(connId);
    setConnError(null);
    setConnSuccessMsg(null);
    try {
      await connectionApi.action(connId, 'decline');
      await loadData(true);
    } catch (err: any) {
      setConnError(err.response?.data?.detail || "Failed declining connection request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    loadData(false);
    const interval = setInterval(() => {
      loadData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [authLoading, token]);

  const handleAttendTask = async (task: Task) => {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    setChart(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
    } : prev);
    try {
      await taskApi.updateStatus(task.id, newStatus);
      await loadData(true);
    } catch (err) {
      console.error("Attend task error:", err);
    }
  };

  const handleFileSelection = (file: File | null) => {
    setUploadError(null);
    if (!file) {
      setUploadFile(null);
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError("File size exceeds 10 MB limit.");
      setUploadFile(null);
      return;
    }

    setUploadFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      await documentApi.upload(uploadFile, 'Lab Report', uploadModalTask?.id);
      if (uploadModalTask) {
        await taskApi.updateStatus(uploadModalTask.id, 'Completed');
        setChart(prev => prev ? {
          ...prev,
          tasks: prev.tasks.map(t => t.id === uploadModalTask.id ? { ...t, status: 'Completed' } : t)
        } : prev);
      }
      setUploadSuccessMsg(`Document "${uploadFile.name}" uploaded successfully! Real notification sent to hospital.`);
      setUploadFile(null);
      setUploadModalTask(null);
      await loadData(true);
      setTimeout(() => setUploadSuccessMsg(null), 8000);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.response?.data?.detail || "Failed to upload document.");
    } finally {
      setUploading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton height="180px" className="rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton height="120px" className="rounded-2xl" />
          <Skeleton height="120px" className="rounded-2xl" />
          <Skeleton height="120px" className="rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="glass-card border-declinedRed/40 rounded-2xl p-8 max-w-xl mx-auto my-12 text-center space-y-4 shadow-xl">
        <HeartPulse className="w-12 h-12 text-declinedRed mx-auto" />
        <h2 className="font-heading text-lg font-bold text-textLight">Unable to Load Patient Portal</h2>
        <p className="text-xs text-mutedText">{error || "Could not retrieve patient records."}</p>
        <button
          onClick={() => loadData(false)}
          className="bg-primaryGreen text-ink font-bold text-xs px-4 py-2.5 rounded-xl shadow"
        >
          Retry
        </button>
      </div>
    );
  }

  const tasks = chart?.tasks || [];
  const medicines = tasks.filter(t => t.category === 'medicine');
  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const nextTask = tasks.find(t => t.status !== 'Completed') || tasks[0];

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Incoming Connection Request Notification Banner */}
      {pendingConns.length > 0 && (
        <div className="glass-card border-2 border-amber-500/80 bg-amber-950/40 p-5 rounded-2xl shadow-2xl space-y-4 animate-in fade-in duration-300">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold border border-amber-500/40 shadow">
                <Bell className="w-5 h-5 text-amber-300 animate-bounce" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-white text-sm flex items-center gap-2">
                  Incoming Follow-up Connection Request from Hospital
                  <span className="bg-amber-500 text-darkBg text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                    {pendingConns.length} Pending
                  </span>
                </h3>
                <p className="text-xs text-amber-200/90 mt-0.5">
                  A hospital facility has requested connection to coordinate your post-discharge follow-up care plan.
                </p>
              </div>
            </div>
            <Link
              to="/patient/requests"
              className="text-xs font-bold text-limeAccent hover:underline flex items-center gap-1 shrink-0"
            >
              View Requests Page <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3 pt-1 border-t border-amber-500/30">
            {pendingConns.map(conn => (
              <div key={conn.id} className="bg-darkBg/90 p-4 rounded-xl border border-amber-500/40 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-limeAccent" />
                    <strong className="text-white font-bold text-xs">{conn.hospital_name || conn.hospital_id}</strong>
                    <span className="text-[10px] text-textLight/60 font-mono">
                      Requested: {conn.requested_at ? new Date(conn.requested_at).toLocaleDateString() : 'Recently'}
                    </span>
                  </div>
                  {conn.message && (
                    <p className="text-xs text-textLight/90 italic bg-panelBg/80 p-2 rounded-lg border border-forestGreen/40">
                      "{conn.message}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptConnection(conn.id)}
                    disabled={actionLoadingId === conn.id}
                    className="bg-gradient-to-r from-emerald-500 to-lime-500 hover:opacity-95 text-ink font-bold text-xs py-2 px-4 rounded-xl shadow-glow-primary transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {actionLoadingId === conn.id ? 'Accepting...' : 'Accept Connection'}
                  </button>
                  <button
                    onClick={() => handleDeclineConnection(conn.id)}
                    disabled={actionLoadingId === conn.id}
                    className="bg-declinedRed/15 hover:bg-declinedRed/30 text-declinedRed border border-declinedRed/40 font-bold text-xs py-2 px-3.5 rounded-xl transition flex items-center gap-1 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Toast Notifications */}
      {connSuccessMsg && (
        <div className="glass-card bg-forestGreen border-primaryGreen p-4 rounded-2xl flex items-center justify-between text-xs text-limeAccent shadow-2xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primaryGreen shrink-0" />
            <span className="font-bold text-white text-xs">{connSuccessMsg}</span>
          </div>
          <button onClick={() => setConnSuccessMsg(null)} className="text-white hover:text-limeAccent font-bold">✕</button>
        </div>
      )}

      {connError && (
        <div className="glass-card bg-red-950/80 border-declinedRed p-4 rounded-2xl flex items-center justify-between text-xs text-red-200 shadow-2xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="font-bold text-red-200 text-xs">{connError}</span>
          </div>
          <button onClick={() => setConnError(null)} className="text-red-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Toast Alert */}
      {uploadSuccessMsg && (
        <div className="glass-card bg-forest border-mintGlow p-4 rounded-2xl flex items-center justify-between text-xs text-mintGlow shadow-2xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-mintGlow shrink-0" />
            <span className="font-bold text-textLight text-sm">{uploadSuccessMsg}</span>
          </div>
          <button onClick={() => setUploadSuccessMsg(null)} className="text-textLight hover:text-mintGlow">✕</button>
        </div>
      )}

      {/* HERO RECOVERY DASHBOARD HEADER */}
      <div className="glass-card p-6 md:p-8 rounded-2xl border-mintGlow/25 flex flex-wrap items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-mintGlow bg-surface px-2.5 py-0.5 rounded-full border border-mintGlow/20">
              {patient.patient_code}
            </span>
            <span className="text-xs text-mutedText font-medium">District: {patient.district}</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-textLight">
            Welcome back, <span className="text-mintGlow">{patient.name}</span>
          </h1>
          <p className="text-xs text-mutedText max-w-lg leading-relaxed">
            Your personalized post-discharge recovery coordinator plan. Follow the steps below and stay connected with your clinical team.
          </p>
        </div>

        {/* RECOVERY JOURNEY PROGRESS RADIAL RING */}
        <div className="flex items-center gap-5 glass-panel p-4 rounded-2xl border-mintGlow/20 shrink-0 z-10">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-surface"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-mintGlow transition-all duration-1000"
                strokeDasharray={`${progressPercent}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute font-mono font-bold text-sm text-textLight">{progressPercent}%</span>
          </div>
          <div>
            <div className="font-heading font-bold text-textLight text-sm">Recovery Progress</div>
            <div className="text-xs text-mutedText font-mono mt-0.5">{completedCount} of {tasks.length} steps completed</div>
          </div>
        </div>
      </div>

      {/* NEXT STEP HERO CARD & QUICK TILES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Next Step Hero Card */}
        {nextTask && (
          <div className="lg:col-span-7 glass-card p-6 rounded-2xl border-mintGlow/30 flex flex-col justify-between space-y-4 shadow-glow-mint">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-mintGlow tracking-wider">
                  ⚡ Next Upcoming Recovery Step
                </span>
                <StatusChip status={nextTask.status} />
              </div>
              <h2 className="font-heading font-bold text-lg text-textLight">{nextTask.title}</h2>
              <p className="text-xs text-mutedText leading-relaxed">
                {language === 'ta' && nextTask.simple_ta ? nextTask.simple_ta : nextTask.simple_text}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-mintGlow/15">
              <div className="text-xs text-mutedText font-mono">
                Target Date: <strong className="text-textLight">{nextTask.due_date || 'As recommended'}</strong>
              </div>
              <button
                onClick={() => setBookingTask(nextTask)}
                className="bg-gradient-to-r from-primaryGreen to-limeAccent hover:opacity-95 text-ink font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <Calendar className="w-4 h-4" /> Book Appointment / Action
              </button>
            </div>
          </div>
        )}

        {/* Quick Action Tiles */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div 
            onClick={() => setShowContactModal(true)}
            className="glass-card glass-card-hover p-4 rounded-2xl border-mintGlow/20 cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="w-9 h-9 rounded-xl bg-forest text-mintGlow flex items-center justify-center border border-mintGlow/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-textLight text-xs">Ask Assistant</h3>
              <p className="text-[11px] text-mutedText mt-0.5">Contact hospital or chatbot</p>
            </div>
          </div>

          <div 
            onClick={() => patientApi.downloadPdf(patient.id, patient.patient_code)}
            className="glass-card glass-card-hover p-4 rounded-2xl border-mintGlow/20 cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="w-9 h-9 rounded-xl bg-forest text-mintGlow flex items-center justify-center border border-mintGlow/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-textLight text-xs">Download PDF</h3>
              <p className="text-[11px] text-mutedText mt-0.5">Full discharge care plan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Discharge Report Card */}
      {chart?.analysis_report && (
        <PatientDischargeReportCard
          reportData={chart.analysis_report}
          tasks={tasks}
          hospitalName={patient.hospital_id}
          onDownloadPdf={() => patientApi.downloadPdf(patient.id, patient.patient_code)}
          reportLang={language}
          onLangChange={() => {}}
        />
      )}

      {/* Core Interactive Follow-up Path Graph */}
      {tasks.length > 0 ? (
        <InteractiveGraph
          tasks={tasks}
          documents={documents}
          onSelectTask={() => {}}
          onBookTask={(t) => setBookingTask(t)}
          onAttendTask={handleAttendTask}
          onShowEvidence={(t) => setEvidenceTask(t)}
          onUploadDocument={(t) => setUploadModalTask(t)}
        />
      ) : (
        <div className="glass-card p-8 rounded-2xl text-center text-mutedText">
          No active follow-up tasks published yet.
        </div>
      )}

      {/* Prescribed Medicines Checklist & Uploaded Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border-mintGlow/20 space-y-4">
          <h3 className="font-heading font-bold text-textLight text-sm flex items-center gap-2">
            <Pill className="w-4 h-4 text-limeAccent" />
            Prescribed Medication & Daily Care Checklist
          </h3>
          <div className="space-y-2.5">
            {medicines.map((m) => (
              <div key={m.id} className="p-3.5 rounded-xl glass-panel flex items-start gap-3 border-mintGlow/10">
                <input
                  type="checkbox"
                  checked={m.status === 'Completed'}
                  onChange={() => handleAttendTask(m)}
                  className="mt-1 accent-primaryGreen w-4 h-4 rounded cursor-pointer"
                />
                <div>
                  <div className="font-bold text-xs text-textLight">{m.title}</div>
                  <p className="text-xs text-mintGlow mt-0.5">{m.simple_text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border-mintGlow/20 space-y-4">
          <h3 className="font-heading font-bold text-textLight text-sm flex items-center gap-2">
            <Upload className="w-4 h-4 text-mintGlow" />
            Uploaded Lab Reports & Files ({documents.length})
          </h3>
          {documents.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {documents.map((doc) => (
                <div key={doc.id} className="p-3 rounded-xl glass-panel flex items-center justify-between text-xs border-mintGlow/10">
                  <div>
                    <div className="font-bold text-textLight">{doc.file_name}</div>
                    <span className="text-[10px] text-mintGlow">{doc.document_type}</span>
                  </div>
                  <button
                    onClick={() => documentApi.downloadDocument(doc.id, doc.file_name)}
                    className="text-mintGlow hover:underline font-bold"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-mutedText italic py-6 text-center">
              No reports uploaded yet. Click "Upload File" on any task node above to attach PDF or JPG scans.
            </div>
          )}
        </div>
      </div>

      {/* Floating RAG Chatbot */}
      <ChatbotWidget />

      {/* Booking Modal */}
      {bookingTask && (
        <PatientBookingModal
          task={bookingTask}
          patientDistrict={patient.district}
          onClose={() => setBookingTask(null)}
          onSuccess={async () => {
            setUploadSuccessMsg(`Follow-up appointment for '${bookingTask?.title}' requested!`);
            await loadData(true);
            setTimeout(() => setUploadSuccessMsg(null), 8000);
          }}
        />
      )}

      {/* Evidence Modal */}
      {evidenceTask && (
        <EvidenceModal task={evidenceTask} onClose={() => setEvidenceTask(null)} />
      )}

      {/* Upload Modal */}
      {uploadModalTask && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border-mintGlow/30 shadow-2xl space-y-4 text-xs">
            <h3 className="font-heading font-bold text-textLight text-base">Upload Document for: {uploadModalTask.title}</h3>
            {uploadError && (
              <div className="bg-declinedRed/20 border border-declinedRed text-declinedRed p-2.5 rounded-xl font-medium">
                {uploadError}
              </div>
            )}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
              className="w-full bg-surface text-textLight p-2.5 rounded-xl border border-mintGlow/20"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setUploadModalTask(null)} className="px-4 py-2 rounded-xl glass-panel text-mutedText">Cancel</button>
              <button
                onClick={handleUploadSubmit}
                disabled={!uploadFile || uploading}
                className="px-5 py-2 rounded-xl font-bold bg-primaryGreen text-ink shadow disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Hospital Modal */}
      <ContactHospitalModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
    </div>
  );
};
