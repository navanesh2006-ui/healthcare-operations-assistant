import React, { useState, useEffect } from 'react';
import { documentApi } from '../services/api';
import { PatientDocumentSummary, DocumentItem } from '../types';
import {
  FileText, Search, Download, Eye, Bell, CheckCircle2, Clock,
  AlertCircle, ArrowLeft, Filter, RefreshCw, UserCheck, ShieldCheck, X, ZoomIn, ZoomOut
} from 'lucide-react';
import { StatusChip, Skeleton } from '../components/ui/Primitives';

export const PatientDocumentsPage: React.FC = () => {
  const [summaries, setSummaries] = useState<PatientDocumentSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed'>('all');

  // Page 2 State: Selected Patient Details
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientDetails, setPatientDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal Preview state
  const [previewDoc, setPreviewDoc] = useState<{ id: number; file_name: string; mime_type?: string } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    loadSummaries();
  }, []);

  useEffect(() => {
    if (!previewDoc) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      setPreviewError(null);
      setZoomLevel(100);
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

  const loadSummaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await documentApi.getSummary();
      setSummaries(data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || "Failed loading connected patient documents summary.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = async (patientId: number) => {
    setSelectedPatientId(patientId);
    setLoadingDetails(true);
    try {
      const details = await documentApi.getPatientDetails(patientId);
      setPatientDetails(details);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || err.message || "Failed loading patient document details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRemindPatient = async (patientId: number, stepId: number, stepTitle: string) => {
    try {
      await documentApi.remindPatient(patientId, stepId);
      setToastMsg(`Reminder email and notification sent for '${stepTitle}'.`);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Failed sending reminder email.");
    }
  };

  const handleMarkReviewed = async (docId: number) => {
    try {
      await documentApi.markReviewed(docId);
      setToastMsg("Document marked as reviewed by hospital staff.");
      setTimeout(() => setToastMsg(null), 4000);
      if (selectedPatientId) {
        handleSelectPatient(selectedPatientId);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Failed marking document reviewed.");
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    try {
      await documentApi.downloadDocument(doc.id, doc.file_name);
    } catch (err: any) {
      alert(err.message || "Failed downloading document.");
    }
  };

  const handleDownloadZip = async (details: any) => {
    try {
      await documentApi.downloadZip(details.patient_id, details.patient_code);
    } catch (err: any) {
      alert(err.message || "Failed downloading ZIP package.");
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredSummaries = summaries.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.patient_code.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'pending') {
      return s.uploaded_count < s.total_required;
    }
    if (filterTab === 'completed') {
      return s.total_required > 0 && s.uploaded_count >= s.total_required;
    }
    return true;
  });

  return (
    <div className="space-y-6 text-xs animate-in fade-in duration-300">
      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed top-20 right-8 z-50 glass-card bg-forest border-mintGlow text-mintGlow px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-mintGlow shrink-0" />
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}

      {selectedPatientId === null ? (
        /* OVERVIEW PAGE */
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border-mintGlow/25 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-forest text-mintGlow flex items-center justify-center font-bold text-xl shadow border border-mintGlow/30">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold text-textLight">Connected Patient Documents</h1>
                <p className="text-mutedText text-xs mt-0.5">
                  Review medical scans, lab test PDFs, and diagnostic files uploaded by connected patients.
                </p>
              </div>
            </div>

            <button
              onClick={loadSummaries}
              className="glass-panel hover:bg-forest/60 text-mintGlow border border-mintGlow/30 font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 shadow transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Registry
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-mutedText" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search patient by name or Patient ID..."
                className="w-full bg-surface border border-mintGlow/20 rounded-xl pl-10 pr-4 py-2.5 text-textLight placeholder-mutedText focus:outline-none focus:border-mintGlow"
              />
            </div>

            <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-mintGlow/20">
              {(['all', 'pending', 'completed'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-3.5 py-1.5 rounded-lg font-bold capitalize transition ${
                    filterTab === tab ? 'bg-primaryGreen text-ink shadow' : 'text-mutedText hover:text-textLight'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} height="160px" className="rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="glass-card border-declinedRed/50 rounded-2xl p-6 text-declinedRed">
              {error}
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-mutedText">
              No connected patients match your search filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSummaries.map(s => {
                const percent = s.total_required > 0 ? Math.round((s.uploaded_count / s.total_required) * 100) : 100;
                return (
                  <div
                    key={s.patient_id}
                    onClick={() => handleSelectPatient(s.patient_id)}
                    className="glass-card glass-card-hover p-5 rounded-2xl border-mintGlow/20 cursor-pointer transition flex flex-col justify-between space-y-4 group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-heading font-bold text-textLight text-sm group-hover:text-mintGlow transition">
                          {s.name}
                        </h3>
                        <span className="font-mono text-[11px] text-mintGlow font-bold">
                          {s.patient_code}
                        </span>
                      </div>
                      <StatusChip status={s.chart_status === 'Published' ? 'completed' : 'pending'} customLabel={s.chart_status} />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-mutedText">Upload Progress:</span>
                        <span className="font-bold text-textLight font-mono">
                          {s.uploaded_count} of {s.total_required} docs ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-mintGlow/10">
                        <div
                          className={`h-full transition-all duration-500 ${
                            percent === 100 ? 'bg-completedGreen' : 'bg-gradient-to-r from-primaryGreen to-mintGlow'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-mintGlow/10 flex items-center justify-between text-[11px] text-mutedText">
                      <span>Last: {s.last_upload_date ? new Date(s.last_upload_date).toLocaleDateString() : 'No uploads'}</span>
                      <span className="text-mintGlow font-bold group-hover:translate-x-1 transition">
                        View Documents →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* PATIENT DETAILS INSPECTOR */
        <div className="space-y-6">
          <div className="glass-card p-5 rounded-2xl border-mintGlow/25 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedPatientId(null);
                  setPatientDetails(null);
                }}
                className="glass-panel hover:bg-forest/60 text-mintGlow border border-mintGlow/30 font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Overview
              </button>

              {patientDetails && (
                <div>
                  <h1 className="font-heading text-lg font-bold text-textLight flex items-center gap-2">
                    {patientDetails.name}
                    <span className="text-mintGlow font-mono text-xs">{patientDetails.patient_code}</span>
                  </h1>
                  <p className="text-mutedText text-xs">
                    Patient Document Repository ({patientDetails.steps?.length || 0} steps)
                  </p>
                </div>
              )}
            </div>

            {patientDetails && (
              <button
                onClick={() => handleDownloadZip(patientDetails)}
                className="bg-gradient-to-r from-primaryGreen to-limeAccent text-ink font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-glow-primary transition"
              >
                <Download className="w-4 h-4" /> Download All as ZIP
              </button>
            )}
          </div>

          {loadingDetails ? (
            <Skeleton height="300px" className="rounded-2xl" />
          ) : !patientDetails ? (
            <div className="glass-card p-6 text-declinedRed">Failed loading patient details.</div>
          ) : (
            <div className="space-y-4">
              {patientDetails.steps.map((st: any, idx: number) => {
                const isUploaded = st.documents && st.documents.length > 0;
                return (
                  <div key={st.id} className="glass-card p-5 rounded-2xl border-mintGlow/20 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-mintGlow/10">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-surface text-mintGlow font-mono font-bold px-2.5 py-0.5 rounded-lg text-xs border border-mintGlow/20">
                          Step #{idx + 1}
                        </span>
                        <h3 className="font-heading font-bold text-textLight text-sm">{st.title}</h3>
                        <span className="bg-surface text-mutedText px-2.5 py-0.5 rounded-full text-[10px] font-mono">
                          {st.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-mutedText font-mono">Due: <strong className="text-textLight">{st.due_date || 'N/A'}</strong></span>
                        <StatusChip status={st.status === 'Completed' ? 'completed' : 'pending'} customLabel={st.status} />
                      </div>
                    </div>

                    <div>
                      {!isUploaded ? (
                        <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 border-pendingAmber/40">
                          <div className="flex items-center gap-2 text-pendingAmber font-semibold">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>Waiting for patient to upload required document</span>
                          </div>

                          <button
                            onClick={() => handleRemindPatient(patientDetails.patient_id, st.id, st.title)}
                            className="bg-pendingAmber hover:opacity-90 text-ink font-bold py-1.5 px-4 rounded-xl flex items-center gap-1.5 shadow transition"
                          >
                            <Bell className="w-3.5 h-3.5" /> Remind Patient
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-2">
                            {st.documents.map((doc: any) => (
                              <div key={doc.id} className="glass-panel p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 border-mintGlow/20">
                                <div>
                                  <div className="font-bold text-textLight text-xs flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-mintGlow" />
                                    {doc.file_name}
                                    <span className="text-[10px] text-mutedText font-mono">
                                      ({formatFileSize(doc.file_size)})
                                    </span>
                                  </div>
                                  {doc.reviewed_by && (
                                    <div className="text-[10px] text-mintGlow font-mono mt-0.5">
                                      ✓ Reviewed by {doc.reviewed_by}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setPreviewDoc({ id: doc.id, file_name: doc.file_name, mime_type: doc.mime_type })}
                                    className="glass-panel hover:bg-forest/60 text-mintGlow font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View Modal
                                  </button>

                                  <button
                                    onClick={() => handleDownloadDocument(doc)}
                                    className="glass-panel hover:bg-forest/60 text-textLight font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Download
                                  </button>

                                  {!doc.reviewed_by && (
                                    <button
                                      onClick={() => handleMarkReviewed(doc.id)}
                                      className="bg-primaryGreen text-ink font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition shadow"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" /> Mark Reviewed
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL WITH ZOOM */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-ink/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border-mintGlow/30 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-mintGlow/15 flex items-center justify-between bg-surface">
              <h3 className="font-heading font-bold text-textLight text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-mintGlow" /> Preview: {previewDoc.file_name}
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-elevated px-2 py-1 rounded-lg text-xs font-mono">
                  <button onClick={() => setZoomLevel(prev => Math.max(50, prev - 25))} className="p-0.5 text-mutedText hover:text-white">
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-mintGlow">{zoomLevel}%</span>
                  <button onClick={() => setZoomLevel(prev => Math.min(200, prev + 25))} className="p-0.5 text-mutedText hover:text-white">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button onClick={() => setPreviewDoc(null)} className="p-1 text-mutedText hover:text-textLight">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 bg-deep overflow-auto min-h-[450px] flex items-center justify-center">
              {previewLoading ? (
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 border-4 border-mintGlow border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-mintGlow font-mono text-xs">Loading blob preview...</p>
                </div>
              ) : previewError ? (
                <div className="glass-card border-declinedRed p-6 max-w-md text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-declinedRed mx-auto" />
                  <p className="text-xs text-textLight">{previewError}</p>
                </div>
              ) : previewBlobUrl ? (
                previewDoc.mime_type?.includes('image') || previewDoc.file_name.match(/\.(jpg|jpeg|png)$/i) ? (
                  <img
                    src={previewBlobUrl}
                    alt={previewDoc.file_name}
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center' }}
                    className="max-w-full max-h-[65vh] mx-auto rounded-xl object-contain transition-transform duration-200"
                  />
                ) : (
                  <iframe
                    src={previewBlobUrl}
                    title={previewDoc.file_name}
                    className="w-full h-[65vh] rounded-xl border border-mintGlow/20"
                  />
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDocumentsPage;
