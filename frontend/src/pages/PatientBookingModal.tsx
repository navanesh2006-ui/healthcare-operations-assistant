import React, { useState, useEffect } from 'react';
import { hospitalApi, bookingApi } from '../services/api';
import { Provider, Doctor, Slot, Task } from '../types';
import { HospitalMap } from '../components/HospitalMap';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, Search, MapPin, Clock, X, CheckCircle2, AlertCircle, ChevronRight, User, Stethoscope
} from 'lucide-react';
import { StatusChip, Skeleton } from '../components/ui/Primitives';

interface PatientBookingModalProps {
  task: Task | null;
  patientDistrict: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PatientBookingModal: React.FC<PatientBookingModalProps> = ({
  task,
  patientDistrict,
  onClose,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hospitals, setHospitals] = useState<Provider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<Provider | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [loading, setLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    hospitalApi.search({ q: searchQuery, patient_district: patientDistrict }).then(res => {
      setHospitals(res);
      if (res.length > 0 && !selectedHospital) setSelectedHospital(res[0]);
    });
  }, [searchQuery, patientDistrict]);

  const handleSelectHospital = async (h: Provider) => {
    setSelectedHospital(h);
    const docs = await hospitalApi.getDoctors(h.provider_id);
    setDoctors(docs);
    if (docs.length > 0) {
      setSelectedDoctor(docs[0]);
      const s = await hospitalApi.getSlots(h.provider_id, docs[0].id);
      setSlots(s);
    }
    setStep(2);
  };

  const handleSelectDoctor = async (d: Doctor) => {
    setSelectedDoctor(d);
    if (selectedHospital) {
      const s = await hospitalApi.getSlots(selectedHospital.provider_id, d.id);
      setSlots(s);
    }
  };

  const handleSubmitBooking = async () => {
    if (!task || !selectedHospital || !selectedDoctor || !selectedSlot) return;
    setLoading(true);
    setBookingError(null);

    try {
      await bookingApi.request(
        task.id,
        selectedHospital.provider_id,
        selectedDoctor.id,
        selectedSlot.id
      );
      setRequestSent(true);
      onSuccess();
    } catch (err: any) {
      console.error("Booking submit error:", err);
      const msg = err.response?.data?.detail || err.message || "Failed to process booking request email.";
      setBookingError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="glass-card max-w-3xl w-full p-6 border-mintGlow/30 shadow-2xl relative max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl space-y-6">
        <button onClick={onClose} className="absolute top-5 right-5 text-mutedText hover:text-textLight p-1">
          <X className="w-6 h-6" />
        </button>

        {/* Header Progress Stepper */}
        <div className="flex flex-wrap items-center justify-between pb-4 border-b border-mintGlow/15 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest text-mintGlow font-mono font-bold text-lg flex items-center justify-center border border-mintGlow/30 shadow">
              {step}
            </div>
            <div>
              <h3 className="font-heading font-bold text-textLight text-lg">Book Follow-up Appointment</h3>
              <p className="text-xs text-mintGlow font-medium">Task: {task.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`px-2.5 py-1 rounded-lg ${step === 1 ? 'bg-primaryGreen text-ink font-bold' : 'bg-surface text-mutedText'}`}>1. Provider</span>
            <span className={`px-2.5 py-1 rounded-lg ${step === 2 ? 'bg-primaryGreen text-ink font-bold' : 'bg-surface text-mutedText'}`}>2. Doctor & Slot</span>
            <span className={`px-2.5 py-1 rounded-lg ${step === 3 ? 'bg-primaryGreen text-ink font-bold' : 'bg-surface text-mutedText'}`}>3. Confirm</span>
          </div>
        </div>

        {!requestSent ? (
          <div>
            {/* Step 1: Select Hospital */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-mutedText absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search hospital name or district..."
                    className="w-full bg-surface border border-mintGlow/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-textLight placeholder-mutedText focus:outline-none focus:border-mintGlow"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Hospital List */}
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {hospitals.map(h => (
                      <div
                        key={h.provider_id}
                        onClick={() => handleSelectHospital(h)}
                        className={`p-4 rounded-2xl glass-card cursor-pointer transition ${
                          selectedHospital?.provider_id === h.provider_id
                            ? 'border-mintGlow ring-2 ring-mintGlow/30 shadow-glow-mint'
                            : 'border-mintGlow/15 hover:border-mintGlow/40'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-heading font-bold text-xs text-textLight">{h.name}</h4>
                          <span className="text-[10px] bg-surface text-mintGlow border border-mintGlow/20 px-2 py-0.5 rounded font-mono">
                            {h.facility_type}
                          </span>
                        </div>
                        <p className="text-[11px] text-mutedText mt-1">{h.address || h.district}, {h.district}</p>
                        <div className="flex items-center justify-between text-[10px] text-mintGlow mt-2 font-mono">
                          <span>{h.ownership}</span>
                          <span>Distance: ~{h.distance_km || 5} km</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Map Preview Component */}
                  {selectedHospital && <HospitalMap hospital={selectedHospital} />}
                </div>
              </div>
            )}

            {/* Step 2: Select Doctor & Slot */}
            {step === 2 && selectedHospital && (
              <div className="space-y-6">
                <button onClick={() => setStep(1)} className="text-xs text-mintGlow hover:underline font-semibold">
                  ← Back to Hospital Selection ({selectedHospital.name})
                </button>

                <div>
                  <h4 className="font-heading text-xs font-bold text-textLight mb-2 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-mintGlow" /> Choose Specialist Doctor:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {doctors.map(d => (
                      <div
                        key={d.id}
                        onClick={() => handleSelectDoctor(d)}
                        className={`p-3.5 rounded-xl glass-card cursor-pointer text-xs transition ${
                          selectedDoctor?.id === d.id
                            ? 'border-mintGlow ring-2 ring-mintGlow/30 shadow-glow-mint'
                            : 'border-mintGlow/15 hover:border-mintGlow/30'
                        }`}
                      >
                        <div className="font-heading font-bold text-textLight">{d.name}</div>
                        <div className="text-[11px] text-mintGlow">{d.department} - {d.specialty}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-heading text-xs font-bold text-textLight mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primaryGreen" /> Available Slots:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {slots.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedSlot(s);
                          setStep(3);
                        }}
                        className={`p-3 rounded-xl border text-center transition font-mono ${
                          selectedSlot?.id === s.id
                            ? 'bg-primaryGreen text-ink font-bold shadow-glow-primary'
                            : 'bg-surface text-textLight border-mintGlow/20 hover:border-mintGlow'
                        }`}
                      >
                        <div className="text-xs font-bold">{s.date}</div>
                        <div className="text-[10px] text-mutedText mt-0.5">{s.start_time} - {s.end_time}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Send */}
            {step === 3 && selectedHospital && selectedDoctor && selectedSlot && (
              <div className="space-y-6">
                <button onClick={() => setStep(2)} className="text-xs text-mintGlow hover:underline font-semibold">
                  ← Back to Slot Picker
                </button>

                <div className="glass-panel p-5 rounded-2xl space-y-3 text-xs border-mintGlow/20">
                  <h4 className="font-heading font-bold text-textLight text-sm pb-2 border-b border-mintGlow/15">
                    Booking Request Summary Review
                  </h4>
                  <div><span className="text-mutedText">Task:</span> <strong className="text-textLight">{task.title}</strong></div>
                  <div><span className="text-mutedText">Hospital:</span> <strong className="text-textLight">{selectedHospital.name} ({selectedHospital.district})</strong></div>
                  <div><span className="text-mutedText">Doctor:</span> <strong className="text-textLight">{selectedDoctor.name} ({selectedDoctor.department})</strong></div>
                  <div><span className="text-mutedText">Time Slot:</span> <strong className="text-mintGlow font-mono">{selectedSlot.date} at {selectedSlot.start_time} - {selectedSlot.end_time}</strong></div>
                </div>

                {bookingError && (
                  <div className="glass-card border-declinedRed p-4 rounded-xl text-xs text-declinedRed flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-declinedRed shrink-0 mt-0.5" />
                    <div>{bookingError}</div>
                  </div>
                )}

                <button
                  onClick={handleSubmitBooking}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primaryGreen to-limeAccent hover:opacity-95 text-ink font-bold text-sm py-4 px-6 rounded-2xl shadow-glow-primary transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Submitting Request...' : 'Confirm & Send Booking Request'}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Success Screen */
          <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-completedGreen text-ink rounded-full flex items-center justify-center mx-auto font-bold text-3xl shadow-glow-primary">
              ✓
            </div>
            <div>
              <h3 className="font-heading text-2xl font-bold text-textLight">Booking Request Transmitted!</h3>
              <p className="text-xs text-mintGlow font-mono mt-1">
                Real emails dispatched to hospital & patient inboxes
              </p>
            </div>

            <button
              onClick={onClose}
              className="bg-primaryGreen hover:bg-primaryGreen/90 text-ink font-bold text-xs py-3 px-8 rounded-xl shadow-lg transition"
            >
              Return to Care Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
