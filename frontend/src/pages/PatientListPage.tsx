import React, { useState, useEffect } from 'react';
import { patientApi, documentApi } from '../services/api';
import { Patient, FollowupChart, DocumentItem } from '../types';
import { Users, Search, Download, FileText, ChevronRight, MapPin, FilePlus, Edit3, Upload, ExternalLink } from 'lucide-react';
import { ChartBuilderModal } from '../components/ChartBuilderModal';

export const PatientListPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('All');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientChart, setPatientChart] = useState<FollowupChart | null>(null);
  const [patientDocs, setPatientDocs] = useState<DocumentItem[]>([]);

  // Chart Builder modal state
  const [builderPatient, setBuilderPatient] = useState<Patient | null>(null);
  const [builderChart, setBuilderChart] = useState<FollowupChart | null>(null);

  const loadPatients = async () => {
    try {
      const res = await patientApi.list({ q: query, district });
      setPatients(res);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshSelectedPatientData = async (p: Patient) => {
    try {
      const chart = await patientApi.getChart(p.id);
      setPatientChart(chart);
    } catch (e) {
      setPatientChart(null);
    }
    try {
      const docs = await documentApi.list(p.id);
      setPatientDocs(docs);
    } catch (e) {
      setPatientDocs([]);
    }
  };

  useEffect(() => {
    loadPatients();
    const interval = setInterval(() => {
      loadPatients();
      if (selectedPatient) {
        refreshSelectedPatientData(selectedPatient);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [query, district, selectedPatient?.id]);

  const handleSelectPatient = async (p: Patient) => {
    setSelectedPatient(p);
    await refreshSelectedPatientData(p);
  };

  const handleOpenChartBuilder = async (p: Patient) => {
    try {
      const chart = await patientApi.getChart(p.id);
      setBuilderChart(chart);
      setBuilderPatient(p);
    } catch (e) {
      setBuilderChart(null);
      setBuilderPatient(p);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-forestGreen flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-primaryGreen" />
            Patient Database & Discharged Case Records
          </h1>
          <p className="text-xs text-textLight/70">
            Searchable connected patient registry across Tamil Nadu districts
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-panelBg p-4 rounded-xl border border-forestGreen">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-textLight/50 absolute left-3 top-3" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search patient name or ID..."
            className="w-full bg-darkBg border border-forestGreen rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-textLight/40 focus:outline-none focus:border-primaryGreen"
          />
        </div>

        <select
          value={district}
          onChange={e => setDistrict(e.target.value)}
          className="bg-darkBg border border-forestGreen rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="All">All Districts</option>
          <option value="Chennai">Chennai</option>
          <option value="Kanchipuram">Kanchipuram</option>
          <option value="Coimbatore">Coimbatore</option>
          <option value="Madurai">Madurai</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table Column */}
        <div className="lg:col-span-7 bg-panelBg border border-forestGreen rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-forestGreen/60 text-limeAccent uppercase font-mono border-b border-forestGreen">
                <tr>
                  <th className="p-3">Patient Code</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Age/Gender</th>
                  <th className="p-3">District</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forestGreen/40 text-textLight">
                {patients.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    className={`hover:bg-forestGreen/30 cursor-pointer transition ${
                      selectedPatient?.id === p.id ? 'bg-forestGreen/50 font-semibold' : ''
                    }`}
                  >
                    <td className="p-3 font-mono text-limeAccent">{p.patient_code}</td>
                    <td className="p-3 font-bold text-white">{p.name}</td>
                    <td className="p-3">{p.age} y / {p.gender}</td>
                    <td className="p-3">{p.district}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenChartBuilder(p);
                        }}
                        className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-[11px] py-1 px-2.5 rounded-lg shadow transition inline-flex items-center gap-1"
                      >
                        <FilePlus className="w-3.5 h-3.5" /> Create / Edit Chart
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Patient Detail Inspector */}
        <div className="lg:col-span-5 bg-panelBg border border-forestGreen rounded-xl p-6 shadow-xl flex flex-col justify-between">
          {selectedPatient ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-forestGreen gap-2">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedPatient.name}</h3>
                  <span className="text-xs text-limeAccent font-mono">{selectedPatient.patient_code}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenChartBuilder(selectedPatient)}
                    className="bg-limeAccent hover:bg-limeAccent/90 text-darkBg font-bold text-xs py-2 px-3 rounded-lg flex items-center gap-1 shadow"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Chart Builder
                  </button>
                  <button
                    onClick={() => patientApi.downloadPdf(selectedPatient.id, selectedPatient.patient_code)}
                    className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-xs py-2 px-3 rounded-lg flex items-center gap-1 shadow"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF Plan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-darkBg/60 p-3 rounded-lg border border-forestGreen/60">
                <div><span className="text-textLight/60 block">Age & Gender:</span> <strong className="text-white">{selectedPatient.age}y / {selectedPatient.gender}</strong></div>
                <div><span className="text-textLight/60 block">District:</span> <strong className="text-white">{selectedPatient.district} ({selectedPatient.pincode})</strong></div>
                <div><span className="text-textLight/60 block">Email:</span> <strong className="text-white">{selectedPatient.email}</strong></div>
                <div><span className="text-textLight/60 block">Language:</span> <strong className="text-limeAccent uppercase">{selectedPatient.language_preference}</strong></div>
              </div>

              {/* Patient Uploaded Reports & Clinical PDFs */}
              <div>
                <h4 className="font-bold text-xs text-white mb-2 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-primaryGreen" /> Uploaded Clinical Reports & Prescriptions ({patientDocs.length}):
                </h4>
                {patientDocs.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {patientDocs.map(doc => (
                      <div key={doc.id} className="bg-darkBg p-2.5 rounded-lg border border-primaryGreen/40 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white">{doc.file_name}</div>
                          <span className="text-[10px] text-limeAccent font-mono">{doc.document_type}</span>
                        </div>
                        <button
                          onClick={() => documentApi.downloadDocument(doc.id, doc.file_name)}
                          className="bg-forestGreen/60 hover:bg-forestGreen text-limeAccent border border-primaryGreen/40 text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1 transition"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-textLight/50 italic py-2">No post-visit reports uploaded by patient yet.</div>
                )}
              </div>

              {/* Tasks List in Chart */}
              <div>
                <h4 className="font-bold text-xs text-white mb-2 flex items-center gap-1">
                  <FileText className="w-4 h-4 text-limeAccent" /> Follow-up Coordinator Tasks:
                </h4>
                {patientChart?.tasks && patientChart.tasks.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {patientChart.tasks.map(t => (
                      <div key={t.id} className="bg-darkBg p-2.5 rounded-lg border border-forestGreen text-xs space-y-1">
                        <div className="flex justify-between font-semibold text-white">
                          <span>{t.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            t.status === 'Completed' ? 'bg-completedGreen text-white' : t.status === 'Scheduled' ? 'bg-scheduledBlue text-white' : 'bg-pendingAmber text-darkBg'
                          }`}>{t.status}</span>
                        </div>
                        <p className="text-[11px] text-textLight/80">{t.simple_text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-textLight/50 italic py-4">No published tasks in chart yet. Click "Chart Builder" to create one.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-textLight/50 text-sm">
              Select a patient from the database table to view details, active chart, and launch the Chart Builder.
            </div>
          )}
        </div>
      </div>

      {/* Chart Builder Modal */}
      {builderPatient && (
        <ChartBuilderModal
          patient={builderPatient}
          existingChart={builderChart}
          onClose={() => setBuilderPatient(null)}
          onSaved={() => {
            setBuilderPatient(null);
            loadPatients();
            if (selectedPatient) handleSelectPatient(selectedPatient);
          }}
        />
      )}
    </div>
  );
};
