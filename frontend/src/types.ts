export interface Token {
  access_token: string;
  token_type: string;
  role: 'hospital_staff' | 'hospital_reviewer' | 'patient';
  name: string;
  email: string;
  user_id: number;
  user_code: string;
  hospital_id?: string;
  patient_id?: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'hospital_staff' | 'hospital_reviewer' | 'patient';
  user_code: string;
  hospital_id?: string;
  patient_id?: number;
  language_preference: string;
}

export interface Provider {
  provider_id: string;
  name: string;
  facility_type: string;
  ownership: string;
  systems_of_medicine: string;
  specialties: string;
  address: string;
  district: string;
  state: string;
  pincode: string;
  phone: string;
  public_email: string;
  website: string;
  latitude?: number;
  longitude?: number;
  coord_source: string;
  distance_km?: number;
}

export interface Patient {
  id: number;
  patient_code: string;
  name: string;
  age: number;
  gender: string;
  email: string;
  phone: string;
  district: string;
  pincode: string;
  hospital_id?: string;
  language_preference: string;
  created_at: string;
}

export interface PatientSearchResult {
  id: number;
  patient_code: string;
  name: string;
  masked_email: string;
  district: string;
  connection_status: 'not_connected' | 'pending' | 'accepted' | 'declined' | 'revoked';
  connection_id?: number;
}

export interface ConnectionOut {
  id: number;
  hospital_id: string;
  hospital_name?: string;
  patient_id: number;
  patient_name?: string;
  patient_code?: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  message: string;
  requested_at: string;
  responded_at?: string;
}

export interface Task {
  id: number;
  chart_id: number;
  patient_id: number;
  hospital_id: string;
  title: string;
  category: 'appointment' | 'test' | 'scan' | 'referral' | 'medicine' | 'care_instruction' | 'warning_sign' | 'other';
  instruction_text: string;
  simple_text: string;
  simple_ta?: string;
  simple_hi?: string;
  evidence_sentence?: string;
  evidence_field?: string;
  confidence_score: number;
  due_date?: string;
  status: 'Pending' | 'Needs Review' | 'Scheduled' | 'Completed' | 'Declined';
  scheduled_hospital_id?: string;
  scheduled_doctor_id?: number;
  scheduled_slot_id?: number;
  reviewer_id?: number;
  reviewer_notes?: string;
  needs_review?: boolean;
  requires_document?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface FollowupChart {
  id: number;
  patient_id: number;
  hospital_id: string;
  is_published: boolean;
  published_at?: string;
  created_at: string;
  discharge_date?: string;
  status?: string;
  version?: number;
  hospital_name?: string;
  analysis_report?: any;
  tasks: Task[];
}

export interface Doctor {
  id: number;
  hospital_id: string;
  name: string;
  department: string;
  specialty: string;
}

export interface Slot {
  id: number;
  doctor_id: number;
  hospital_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  doctor_name?: string;
  doctor_department?: string;
}

export interface BookingRequest {
  id: number;
  patient_id: number;
  task_id: number;
  hospital_id: string;
  doctor_id: number;
  slot_id: number;
  status: 'Requested' | 'Confirmed' | 'Declined';
  created_at: string;
  hospital_name?: string;
  doctor_name?: string;
  slot_date?: string;
  slot_time?: string;
}

export interface DocumentItem {
  id: number;
  patient_id: number;
  hospital_id: string;
  chart_id?: number;
  step_id?: number;
  task_id?: number;
  file_name: string;
  file_url: string;
  download_url?: string;
  document_type: string;
  mime_type?: string;
  file_size?: number;
  uploaded_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface PatientDocumentSummary {
  patient_id: number;
  patient_code: string;
  name: string;
  chart_status: string;
  total_required: number;
  uploaded_count: number;
  last_upload_date?: string;
}

export interface FeedbackItem {
  id: number;
  patient_id: number;
  hospital_id: string;
  doctor_id?: number;
  department: string;
  rating: number;
  comment: string;
  source: string;
  created_at: string;
}

export interface EmailLogItem {
  id: number;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  email_type: string;
  status: string;
  error_message?: string;
  created_at: string;
}

export interface EmailActionDetails {
  token: string;
  action_type: string;
  is_used: boolean;
  is_expired: boolean;
  patient_name: string;
  patient_code: string;
  hospital_name: string;
  hospital_district: string;
  doctor_name?: string;
  department?: string;
  date_slot?: string;
  time_slot?: string;
  status: string;
}

export interface PatientQueryItem {
  id: number;
  patient_id: number;
  patient_name?: string;
  patient_code?: string;
  task_id?: number;
  question_text: string;
  status: string;
  hospital_reply?: string;
  replied_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: string;
  timestamp: string;
}

export interface CitationItem {
  source_type: string;
  title: string;
  snippet: string;
  url_or_path?: string;
}

export interface ChatResponse {
  query: string;
  answer: string;
  citations: CitationItem[];
  requires_human_review: boolean;
  suggested_actions?: string[];
  offline_fallback?: boolean;
  chat_history_id?: number;
  detected_language?: string;
  classified_category?: string;
}

export interface SecondBrainNode {
  id: number;
  path: string;
  title: string;
  category: string;
  content: string;
  wikilinks: string[];
  hospital_id?: string;
  patient_id?: number;
  visibility: string;
  created_at: string;
}

export interface EmailLog {
  id: number;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  email_type: string;
  status: string;
  error_message?: string;
  created_at: string;
}
