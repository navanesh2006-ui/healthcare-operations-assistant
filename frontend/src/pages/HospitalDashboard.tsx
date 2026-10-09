import React, { useState, useEffect } from 'react';
import { analyticsApi, feedbackApi } from '../services/api';
import { FeedbackItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { 
  Users, FileText, AlertTriangle, CheckCircle2, Star, ArrowRight, Activity, 
  PlusCircle, ShieldAlert, RefreshCw, Calendar, TrendingUp, Filter, Sparkles, UserPlus
} from 'lucide-react';
import { StatusChip, Skeleton, StatusType } from '../components/ui/Primitives';

export const HospitalDashboard: React.FC = () => {
  const { t } = useLanguage();
  const { user, authLoading, token, switchRole, logout } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchDashboardData = (isSilent = false) => {
    if (!isSilent && !data) setLoading(true);
    if (!isSilent) setError(null);

    Promise.all([
      analyticsApi.getDashboard(),
      feedbackApi.list()
    ]).then(([dashData, fbData]) => {
      setData(dashData);
      setRecentFeedback(fbData);
      if (isSilent) setError(null);
    }).catch(err => {
      console.error("Dashboard data load error:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Hospital authentication required. Please sign in with a hospital staff account.");
      } else if (!isSilent) {
        setError(err.response?.data?.detail || "Failed loading hospital portal analytics.");
      }
    }).finally(() => {
      if (!isSilent) setLoading(false);
    });
  };

  useEffect(() => {
    if (authLoading) return;
    fetchDashboardData(false);
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [authLoading, token]);

  const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getFormattedDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading || authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton height="140px" className="rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height="110px" className="rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton height="300px" className="rounded-2xl" />
          <Skeleton height="300px" className="rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card border-declinedRed/40 rounded-2xl p-8 max-w-xl mx-auto my-12 text-center space-y-4 shadow-xl">
        <AlertTriangle className="w-12 h-12 text-declinedRed mx-auto" />
        <h2 className="font-heading text-lg font-bold text-textLight">Unable to Load Hospital Dashboard</h2>
        <p className="text-xs text-mutedText">{error || "Could not retrieve hospital metrics."}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-3">
          <button
            onClick={() => fetchDashboardData(false)}
            className="bg-primaryGreen hover:bg-primaryGreen/90 text-ink font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          <button
            onClick={async () => {
              await switchRole('hospital_staff');
              fetchDashboardData(false);
            }}
            className="bg-limeAccent hover:bg-limeAccent/90 text-ink font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow"
          >
            ⚡ 1-Click Hospital Staff Login
          </button>
        </div>
      </div>
    );
  }

  const CHART_COLORS = ['#4CAF50', '#8BC34A', '#F5B942', '#FF8A3D', '#3DD6C6'];

  const activityTimeline = [
    { id: 1, text: 'Discharge summary parsed for PAT-000101', time: '12m ago', type: 'summary' },
    { id: 2, text: 'Day 7 Cardiology Check-up step confirmed', time: '45m ago', type: 'confirm' },
    { id: 3, text: 'Patient uploaded lab report PDF', time: '2h ago', type: 'doc' },
    { id: 4, text: 'Booking slot requested for Dr. Rajesh', time: '3h ago', type: 'booking' },
  ];

  const filteredTasks = statusFilter 
    ? data.task_status_breakdown.filter((t: any) => t.name.toLowerCase() === statusFilter.toLowerCase())
    : data.task_status_breakdown;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Greeting & Quick Action Strip */}
      <div className="glass-card p-6 md:p-8 rounded-2xl border-mintGlow/25 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 ecg-line opacity-30 pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-mintGlow mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{getFormattedDate()}</span>
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-textLight tracking-tight">
              {getTimeOfDayGreeting()}, <span className="text-mintGlow">{user?.name || 'Doctor'}</span>
            </h1>
            <p className="text-xs text-mutedText mt-1">
              Agentic CareBridge Clinical Command Center & District Hospital Network
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/discharge"
              className="bg-gradient-to-r from-primaryGreen to-limeAccent hover:opacity-90 text-ink font-bold text-xs py-3 px-5 rounded-xl flex items-center gap-2 transition shadow-glow-primary"
            >
              <PlusCircle className="w-4 h-4" />
              Discharge Patient
            </Link>
            <Link
              to="/hospital/find-patients"
              className="glass-panel hover:bg-forest/60 text-mintGlow border border-mintGlow/30 font-bold text-xs py-3 px-5 rounded-xl flex items-center gap-2 transition"
            >
              <UserPlus className="w-4 h-4" />
              Find Patients
            </Link>
          </div>
        </div>

        {/* TODAY'S FOCUS STRIP */}
        <div className="mt-6 pt-5 border-t border-mintGlow/15 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] text-mutedText font-medium">Steps Needing Review</div>
              <div className="text-lg font-bold text-reviewOrange font-mono">{data.needs_review_count} items</div>
            </div>
            <StatusChip status="needs_review" size="sm" />
          </div>

          <div className="glass-panel p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] text-mutedText font-medium">Active Discharged Patients</div>
              <div className="text-lg font-bold text-textLight font-mono">{data.discharged_patients_count} patients</div>
            </div>
            <StatusChip status="scheduled" size="sm" />
          </div>

          <div className="glass-panel p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] text-mutedText font-medium">Follow-up Completion Rate</div>
              <div className="text-lg font-bold text-completedGreen font-mono">{data.completion_rate_percent}%</div>
            </div>
            <StatusChip status="completed" size="sm" />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card glass-card-hover p-5 rounded-2xl border-mintGlow/20">
          <div className="flex items-center justify-between text-xs text-mutedText font-medium">
            <span>{t('dischargedPatients')}</span>
            <Users className="w-5 h-5 text-mintGlow" />
          </div>
          <div className="text-3xl font-heading font-bold text-textLight mt-2 font-mono">
            {data.discharged_patients_count}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-mintGlow font-mono mt-1">
            <TrendingUp className="w-3 h-3" /> +12% this month
          </div>
        </div>

        <div className="glass-card glass-card-hover p-5 rounded-2xl border-reviewOrange/30">
          <div className="flex items-center justify-between text-xs text-mutedText font-medium">
            <span>{t('needsReview')}</span>
            <AlertTriangle className="w-5 h-5 text-reviewOrange" />
          </div>
          <div className="text-3xl font-heading font-bold text-reviewOrange mt-2 font-mono">
            {data.needs_review_count}
          </div>
          <div className="text-[11px] text-reviewOrange/80 font-mono mt-1">
            Human clinical confirmation pending
          </div>
        </div>

        <div className="glass-card glass-card-hover p-5 rounded-2xl border-completedGreen/30">
          <div className="flex items-center justify-between text-xs text-mutedText font-medium">
            <span>{t('completionRate')}</span>
            <CheckCircle2 className="w-5 h-5 text-completedGreen" />
          </div>
          <div className="text-3xl font-heading font-bold text-completedGreen mt-2 font-mono">
            {data.completion_rate_percent}%
          </div>
          <div className="text-[11px] text-mutedText font-mono mt-1">
            Verified step confirmations
          </div>
        </div>

        <div className="glass-card glass-card-hover p-5 rounded-2xl border-pendingAmber/30">
          <div className="flex items-center justify-between text-xs text-mutedText font-medium">
            <span>Avg Patient Rating</span>
            <Star className="w-5 h-5 text-pendingAmber fill-pendingAmber" />
          </div>
          <div className="text-3xl font-heading font-bold text-textLight mt-2 font-mono">
            {recentFeedback.length > 0 ? `${data.average_feedback_rating} / 5` : 'N/A'}
          </div>
          <div className="text-[11px] text-mutedText font-mono mt-1">
            {recentFeedback.length > 0 ? `${recentFeedback.length} verified responses` : 'No feedback yet'}
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Age Distribution Bar Chart */}
        <div className="glass-card p-6 rounded-2xl border-mintGlow/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-textLight text-base">Patient Age Demographics</h3>
              <p className="text-[11px] text-mutedText">Age distribution of connected discharged patients</p>
            </div>
            <span className="text-[10px] font-mono bg-elevated px-2 py-0.5 rounded text-mintGlow border border-mintGlow/10">
              Integer Axis
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.age_bands}>
                <XAxis dataKey="name" stroke="#8FB3A0" fontSize={11} tickLine={false} />
                <YAxis stroke="#8FB3A0" fontSize={11} allowDecimals={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#102A2A', 
                    borderColor: 'rgba(124, 242, 176, 0.3)', 
                    color: '#E9F6EC',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }} 
                />
                <Bar dataKey="value" fill="#4CAF50" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Status Donut Chart with External Legend */}
        <div className="glass-card p-6 rounded-2xl border-mintGlow/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-textLight text-base">Follow-up Task Breakdown</h3>
              <p className="text-[11px] text-mutedText">Click a slice or legend item to filter tasks</p>
            </div>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter(null)}
                className="text-[10px] font-mono text-mintGlow hover:underline flex items-center gap-1"
              >
                <Filter className="w-3 h-3" /> Clear Filter
              </button>
            )}
          </div>

          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.task_status_breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={6}
                  dataKey="value"
                  onClick={(entry) => setStatusFilter(entry.name)}
                  className="cursor-pointer"
                >
                  {data.task_status_breakdown.map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CHART_COLORS[index % CHART_COLORS.length]} 
                      stroke="rgba(124, 242, 176, 0.2)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#102A2A', 
                    borderColor: 'rgba(124, 242, 176, 0.3)', 
                    color: '#E9F6EC',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }} 
                />
                <Legend 
                  layout="vertical" 
                  align="right" 
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: '11px', color: '#E9F6EC' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity Feed & Recent Feedback Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Activity Feed Timeline */}
        <div className="glass-card p-6 rounded-2xl border-mintGlow/20">
          <h3 className="font-heading font-bold text-textLight text-base mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-mintGlow" />
            Live Hospital Event Feed
          </h3>
          <div className="space-y-4">
            {activityTimeline.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl glass-panel hover:border-mintGlow/30 transition text-xs">
                <div className="w-2 h-2 rounded-full bg-mintGlow mt-1.5 shrink-0 animate-ping" />
                <div className="flex-1">
                  <p className="text-textLight font-medium">{item.text}</p>
                  <span className="text-[10px] text-mutedText font-mono">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Feedback List */}
        <div className="glass-card p-6 rounded-2xl border-mintGlow/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-textLight text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-pendingAmber" />
              Recent Patient Feedback
            </h3>
            <Link to="/feedback" className="text-xs text-mintGlow hover:underline flex items-center gap-1 font-semibold">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentFeedback.length === 0 ? (
              <div className="p-8 text-center text-xs text-mutedText italic glass-panel">
                No patient feedback submitted yet.
              </div>
            ) : (
              recentFeedback.slice(0, 4).map((fb) => (
                <div key={fb.id} className="p-3.5 rounded-xl glass-panel flex items-start justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-textLight">{fb.department} Dept</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < fb.rating ? 'text-pendingAmber fill-pendingAmber' : 'text-mutedText/30'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-mutedText italic text-[11px]">"{fb.comment}"</p>
                  </div>
                  <span className="text-[10px] text-mutedText font-mono shrink-0 ml-2">
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
