import axios from 'axios';
import {
  Token, User, Patient, FollowupChart, Task, Provider, Doctor, Slot,
  BookingRequest, DocumentItem, FeedbackItem, EmailLogItem, EmailActionDetails, PatientQueryItem, AuditLog,
  ChatResponse, SecondBrainNode, PatientSearchResult, ConnectionOut
} from '../types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const tabRole = typeof window !== 'undefined' ? sessionStorage.getItem('carebridge_tab_role') : null;
  let token: string | null = null;

  if (path.startsWith('/hospital') || path.startsWith('/reviewer') || path.startsWith('/discharge') || path.startsWith('/patients') || tabRole === 'hospital') {
    token = localStorage.getItem('carebridge_hospital_token');
  } else if (path.startsWith('/patient') || path.startsWith('/my-') || tabRole === 'patient') {
    token = localStorage.getItem('carebridge_patient_token');
  } else {
    token = localStorage.getItem('carebridge_hospital_token') || localStorage.getItem('carebridge_patient_token');
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  patientLogin: async (email: string, password: string): Promise<Token> => {
    const res = await api.post('/auth/patient/login', { email, password });
    return res.data;
  },
  hospitalLogin: async (email: string, password: string): Promise<Token> => {
    const res = await api.post('/auth/hospital/login', { email, password });
    return res.data;
  },
  loginUniversal: async (email: string, password: string): Promise<Token> => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  patientRegister: async (data: any): Promise<Token> => {
    const res = await api.post('/auth/patient/register', data);
    return res.data;
  },
  hospitalRegister: async (data: any): Promise<Token> => {
    const res = await api.post('/auth/hospital/register', data);
    return res.data;
  },
  addReviewer: async (name: string, email: string, password: string): Promise<User> => {
    const res = await api.post('/auth/hospital/add-reviewer', { name, email, password });
    return res.data;
  },
  forgotPassword: async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },
  resetPassword: async (token: string, new_password: string) => {
    const res = await api.post('/auth/reset-password', { token, new_password });
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  changePassword: async (old_password: string, new_password: string) => {
    const res = await api.post('/auth/change-password', { old_password, new_password });
    return res.data;
  },
};

export const connectionApi = {
  findPatients: async (q?: string, page: number = 1): Promise<PatientSearchResult[]> => {
    const res = await api.get('/connections/find-patients', { params: { q, page } });
    return res.data;
  },
  sendRequest: async (patient_id: number, message?: string): Promise<ConnectionOut> => {
    const res = await api.post('/connections/request', { patient_id, message });
    return res.data;
  },
  action: async (connection_id: number, action: 'accept' | 'decline' | 'revoke' | 'cancel'): Promise<ConnectionOut> => {
    const res = await api.post(`/connections/${connection_id}/action`, { action });
    return res.data;
  },
  getMyConnections: async (): Promise<ConnectionOut[]> => {
    const res = await api.get('/connections/my-connections');
    return res.data;
  },
};

export const hospitalApi = {
  search: async (params?: { q?: string; district?: string; facility_type?: string; ownership?: string; patient_district?: string }): Promise<Provider[]> => {
    const res = await api.get('/hospitals/search', { params });
    return res.data;
  },
  getDetails: async (provider_id: string): Promise<Provider> => {
    const res = await api.get(`/hospitals/${provider_id}`);
    return res.data;
  },
  getDoctors: async (provider_id: string): Promise<Doctor[]> => {
    const res = await api.get(`/hospitals/${provider_id}/doctors`);
    return res.data;
  },
  getSlots: async (provider_id: string, doctor_id?: number): Promise<Slot[]> => {
    const res = await api.get(`/hospitals/${provider_id}/slots`, { params: { doctor_id } });
    return res.data;
  },
};

export const patientApi = {
  getConnectedPatients: async (): Promise<Patient[]> => {
    const res = await api.get('/patients/connected');
    return res.data;
  },
  list: async (params?: { q?: string; district?: string }): Promise<Patient[]> => {
    const res = await api.get('/patients/', { params });
    return res.data;
  },
  getPatient: async (patient_id: number): Promise<Patient> => {
    const res = await api.get(`/patients/${patient_id}`);
    return res.data;
  },
  getCharts: async (patient_id: number): Promise<FollowupChart[]> => {
    const res = await api.get(`/patients/${patient_id}/charts`);
    return res.data;
  },
  getChart: async (patient_id: number): Promise<FollowupChart> => {
    const res = await api.get(`/patients/${patient_id}/chart`);
    return res.data;
  },
  downloadPdf: async (patient_id: number, patient_code: string = 'CarePlan') => {
    await downloadAuthenticatedFile(`/patients/${patient_id}/download-pdf`, `CareBridge_Discharge_${patient_code}.pdf`);
  },
};

export const fetchAuthenticatedBlob = async (url: string): Promise<Blob> => {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    return res.data;
  } catch (err: any) {
    if (err.response && err.response.status === 401) {
      throw new Error("Session expired, please log in again.");
    }
    if (err.response && err.response.status === 403) {
      throw new Error("Forbidden: You do not have permission to access this file.");
    }
    if (err.response && err.response.status === 404) {
      throw new Error("File not found on server.");
    }
    throw new Error(err.response?.data?.detail || err.message || "Failed to fetch file.");
  }
};

export const downloadAuthenticatedFile = async (url: string, defaultFilename: string) => {
  const blob = await fetchAuthenticatedBlob(url);
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
};

export const chartApi = {
  getTemplates: async (): Promise<any[]> => {
    const res = await api.get('/charts/templates');
    return res.data;
  },
  saveTemplate: async (data: { name: string; problem_tags: string[]; steps: any[] }): Promise<any> => {
    const res = await api.post('/charts/templates', data);
    return res.data;
  },
  autoGenerate: async (data: { patient_id: number; problem_tags: string[]; custom_problem?: string; discharge_date?: string; discharge_summary_text?: string }): Promise<any> => {
    const res = await api.post('/charts/auto-generate', data);
    return res.data;
  },
  createChart: async (data: { patient_id: number; discharge_date?: string; steps: any[]; source?: string; template_name?: string }): Promise<FollowupChart> => {
    const res = await api.post('/charts/create', data);
    return res.data;
  },
  getChart: async (chart_id: number): Promise<FollowupChart> => {
    const res = await api.get(`/charts/${chart_id}`);
    return res.data;
  },
  updateChart: async (chart_id: number, data: { discharge_date?: string; steps: any[] }): Promise<FollowupChart> => {
    const res = await api.put(`/charts/${chart_id}`, data);
    return res.data;
  },
  updateReviewStatus: async (chart_id: number, statusStr: string): Promise<FollowupChart> => {
    const res = await api.post(`/charts/${chart_id}/review-status`, { status: statusStr });
    return res.data;
  },
  publishChart: async (chart_id: number): Promise<FollowupChart> => {
    const res = await api.post(`/charts/${chart_id}/publish`);
    return res.data;
  },
  confirmStep: async (task_id: number, data?: { simple_text?: string; due_date?: string; reviewer_notes?: string }): Promise<Task> => {
    const res = await api.post(`/charts/steps/${task_id}/confirm`, data || {});
    return res.data;
  },
};

export const dischargeApi = {
  process: async (patient_id: number, raw_text: string, confirm_mismatch: boolean = false): Promise<FollowupChart> => {
    const res = await api.post('/discharge/process', { patient_id, raw_text, confirm_mismatch });
    return res.data;
  },
  downloadReportPdf: async (chart_id: number) => {
    await downloadAuthenticatedFile(`/discharge/report-pdf/${chart_id}`, `Discharge_Analysis_Report_Chart_${chart_id}.pdf`);
  },
};

export const taskApi = {
  getReviewerQueue: async (): Promise<Task[]> => {
    const res = await api.get('/tasks/reviewer-queue');
    return res.data;
  },
  reviewTask: async (task_id: number, action: 'approve' | 'edit' | 'reject', simple_text?: string, due_date?: string, reviewer_notes?: string): Promise<Task> => {
    const res = await api.post(`/tasks/${task_id}/review`, { action, simple_text, due_date, reviewer_notes });
    return res.data;
  },
  publishChart: async (chart_id: number): Promise<FollowupChart> => {
    const res = await api.post(`/tasks/charts/${chart_id}/publish`);
    return res.data;
  },
  updateStatus: async (task_id: number, status_str: string) => {
    const res = await api.patch(`/tasks/${task_id}/status?status_str=${status_str}`);
    return res.data;
  },
};

export const bookingApi = {
  request: async (task_id: number, hospital_id: string, doctor_id: number, slot_id: number): Promise<BookingRequest> => {
    const res = await api.post('/bookings/request', { task_id, hospital_id, doctor_id, slot_id });
    return res.data;
  },
  getMyBookings: async (): Promise<BookingRequest[]> => {
    const res = await api.get('/bookings/my-bookings');
    return res.data;
  },
};

export const documentApi = {
  upload: async (file: File, document_type: string = 'Lab Report', task_id?: number, chart_id?: number, patient_id?: number): Promise<DocumentItem> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', document_type);
    if (task_id) formData.append('task_id', task_id.toString());
    if (chart_id) formData.append('chart_id', chart_id.toString());
    if (patient_id) formData.append('patient_id', patient_id.toString());
    const res = await api.post('/documents/upload', formData);
    return res.data;
  },
  list: async (patient_id?: number): Promise<DocumentItem[]> => {
    const res = await api.get('/documents/', { params: { patient_id } });
    return res.data;
  },
  getSummary: async (): Promise<any[]> => {
    const res = await api.get('/documents/summary');
    return res.data;
  },
  getPatientDetails: async (patient_id: number): Promise<any> => {
    const res = await api.get(`/documents/patient/${patient_id}/details`);
    return res.data;
  },
  remindPatient: async (patient_id: number, step_id: number): Promise<any> => {
    const formData = new FormData();
    formData.append('patient_id', patient_id.toString());
    formData.append('step_id', step_id.toString());
    const res = await api.post('/documents/remind', formData);
    return res.data;
  },
  markReviewed: async (document_id: number): Promise<DocumentItem> => {
    const res = await api.post(`/documents/${document_id}/mark-reviewed`);
    return res.data;
  },
  downloadZip: async (patient_id: number, patient_code: string = 'Documents') => {
    await downloadAuthenticatedFile(`/documents/patient/${patient_id}/download-zip`, `Patient_${patient_code}_documents.zip`);
  },
  downloadDocument: async (document_id: number, filename: string = 'document.pdf') => {
    await downloadAuthenticatedFile(`/documents/${document_id}/download`, filename);
  },
  viewDocumentBlob: async (document_id: number): Promise<Blob> => {
    return await fetchAuthenticatedBlob(`/documents/${document_id}/view`);
  },
};

export const chatbotApi = {
  query: async (queryText: string, language: string = 'en'): Promise<ChatResponse> => {
    const res = await api.post('/chatbot/query', { query: queryText, language });
    return res.data;
  },
  getHistory: async (): Promise<any[]> => {
    const res = await api.get('/chatbot/history');
    return res.data;
  },
  submitFeedback: async (chat_history_id: number, feedback: 'thumbs_up' | 'thumbs_down'): Promise<any> => {
    const res = await api.post('/chatbot/feedback', { chat_history_id, feedback });
    return res.data;
  },
  escalate: async (question: string, step_id?: number): Promise<any> => {
    const res = await api.post('/chatbot/escalate', { question, step_id });
    return res.data;
  },
  clearHistory: async (): Promise<any> => {
    const res = await api.delete('/chatbot/clear');
    return res.data;
  },
  getStatus: async (): Promise<{ status: string; model: string; error?: string }> => {
    const res = await api.get('/chatbot/status');
    return res.data;
  },
};

export const secondBrainApi = {
  getNodes: async (category?: string): Promise<SecondBrainNode[]> => {
    const res = await api.get('/second-brain/nodes', { params: { category } });
    return res.data;
  },
  resync: async () => {
    const res = await api.post('/second-brain/resync');
    return res.data;
  },
};

export const feedbackApi = {
  submit: async (rating: number, comment: string, task_id?: number, doctor_id?: number, department?: string): Promise<FeedbackItem> => {
    const res = await api.post('/feedback/', { rating, comment, task_id, doctor_id, department });
    return res.data;
  },
  list: async (department?: string): Promise<FeedbackItem[]> => {
    const res = await api.get('/feedback/', { params: { department } });
    return res.data;
  },
};

export const analyticsApi = {
  getDashboard: async () => {
    const res = await api.get('/analytics/dashboard');
    return res.data;
  },
};

export const adminApi = {
  getEmailLogs: async (limit: number = 10): Promise<EmailLogItem[]> => {
    const res = await api.get('/admin/email-logs', { params: { limit } });
    return res.data;
  },
  sendTestEmail: async (recipient_email: string) => {
    const res = await api.post('/admin/send-test-email', { recipient_email });
    return res.data;
  },
};

export const emailActionApi = {
  getDetails: async (token: string): Promise<EmailActionDetails> => {
    const res = await api.get(`/bookings/action-token/${token}`);
    return res.data;
  },
  submitAction: async (token: string, action: 'accept' | 'decline') => {
    const res = await api.post(`/bookings/action-token/${token}`, { action });
    return res.data;
  },
};

export const queryApi = {
  contactHospital: async (question_text: string, task_id?: number): Promise<PatientQueryItem> => {
    const res = await api.post('/queries/contact-hospital', { question_text, task_id });
    return res.data;
  },
  getMyQueries: async (): Promise<PatientQueryItem[]> => {
    const res = await api.get('/queries/my-queries');
    return res.data;
  },
  getHospitalQueries: async (): Promise<PatientQueryItem[]> => {
    const res = await api.get('/queries/hospital-queries');
    return res.data;
  },
  replyQuery: async (query_id: number, reply_text: string): Promise<PatientQueryItem> => {
    const res = await api.post(`/queries/${query_id}/reply`, { reply_text });
    return res.data;
  },
};

export const auditApi = {
  list: async (): Promise<AuditLog[]> => {
    const res = await api.get('/audit/');
    return res.data;
  },
};
