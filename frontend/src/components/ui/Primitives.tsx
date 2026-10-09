import React, { useState, useEffect } from 'react';
import { 
  Clock, Calendar, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, 
  Search, Command, X, ChevronRight, FileText, UserPlus, Activity, HeartPulse
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// 1. STATUS CHIP (Icon + Text Label + Color Token)
export type StatusType = 'pending' | 'scheduled' | 'completed' | 'needs_review' | 'declined' | 'in_progress' | 'cancelled';

interface StatusChipProps {
  status: StatusType | string;
  size?: 'sm' | 'md' | 'lg';
  customLabel?: string;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'sm', customLabel, className = '' }) => {
  const normalized = (status || '').toLowerCase().replace('-', '_');

  let config = {
    bg: 'bg-pendingAmber/15 border-pendingAmber/40 text-pendingAmber',
    icon: <Clock className="w-3.5 h-3.5" />,
    label: customLabel || 'Pending'
  };

  switch (normalized) {
    case 'scheduled':
      config = {
        bg: 'bg-scheduledBlue/15 border-scheduledBlue/40 text-scheduledBlue',
        icon: <Calendar className="w-3.5 h-3.5" />,
        label: customLabel || 'Scheduled'
      };
      break;
    case 'completed':
    case 'confirmed':
    case 'accepted':
    case 'done':
      config = {
        bg: 'bg-completedGreen/15 border-completedGreen/40 text-completedGreen',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        label: customLabel || 'Completed'
      };
      break;
    case 'needs_review':
    case 'flagged':
    case 'review':
      config = {
        bg: 'bg-reviewOrange/15 border-reviewOrange/40 text-reviewOrange animate-pulse',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        label: customLabel || 'Needs Review'
      };
      break;
    case 'declined':
    case 'cancelled':
    case 'rejected':
      config = {
        bg: 'bg-declinedRed/15 border-declinedRed/40 text-declinedRed',
        icon: <XCircle className="w-3.5 h-3.5" />,
        label: customLabel || 'Declined'
      };
      break;
    case 'in_progress':
      config = {
        bg: 'bg-mintGlow/15 border-mintGlow/40 text-mintGlow',
        icon: <Activity className="w-3.5 h-3.5 animate-spin" />,
        label: customLabel || 'In Progress'
      };
      break;
  }

  const sizeClasses = size === 'sm' 
    ? 'px-2.5 py-0.5 text-[11px] gap-1.5' 
    : size === 'lg' 
    ? 'px-4 py-1.5 text-sm gap-2' 
    : 'px-3 py-1 text-xs gap-1.5';

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${sizeClasses} ${className}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

// 2. SKELETON SHIMMER LOADER
export const Skeleton: React.FC<{ className?: string; height?: string; width?: string }> = ({ 
  className = '', 
  height, 
  width 
}) => {
  return (
    <div 
      className={`skeleton-box ${className}`} 
      style={{ height: height || '100%', width: width || '100%' }}
    />
  );
};

// 3. PERSISTENT AI TRUST BADGE
export const TrustBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className={`inline-flex items-center gap-2 bg-surface/80 border border-mintGlow/20 rounded-full px-3.5 py-1 text-xs text-mutedText ${compact ? 'text-[10px] px-2.5 py-0.5' : ''}`}>
      <ShieldCheck className="w-3.5 h-3.5 text-mintGlow shrink-0" />
      <span>AI organizes tasks; clinical staff confirm all care decisions. Never diagnoses.</span>
    </div>
  );
};

// 4. GLOBAL COMMAND PALETTE (Ctrl+K)
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { title: 'Hospital Dashboard', icon: <Activity className="w-4 h-4 text-primaryGreen" />, route: '/hospital/dashboard', category: 'Navigation' },
    { title: 'Find & Connect Patients', icon: <UserPlus className="w-4 h-4 text-limeAccent" />, route: '/hospital/find-patients', category: 'Navigation' },
    { title: 'Discharge Patient & Run 5-Agent Suite', icon: <FileText className="w-4 h-4 text-mintGlow" />, route: '/discharge', category: 'Quick Action' },
    { title: 'Patient Document Repository', icon: <FileText className="w-4 h-4 text-scheduledBlue" />, route: '/patients/documents', category: 'Navigation' },
    { title: 'My Care Plan (Patient Portal)', icon: <HeartPulse className="w-4 h-4 text-pendingAmber" />, route: '/patient-portal', category: 'Patient Portal' },
    { title: 'My Account Settings', icon: <Command className="w-4 h-4 text-mutedText" />, route: '/account', category: 'Settings' },
  ];

  const filtered = actions.filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (route: string) => {
    navigate(route);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-ink/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl glass-card border-mintGlow/30 overflow-hidden shadow-2xl rounded-2xl">
        <div className="flex items-center gap-3 p-4 border-b border-mintGlow/15">
          <Search className="w-5 h-5 text-mintGlow shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search patients (Ctrl+K)..."
            className="w-full bg-transparent text-sm text-textLight placeholder-mutedText focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-forest/50 text-mutedText hover:text-textLight">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-mutedText italic">No matching commands found</div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(item.route)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest/40 text-left transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-surface border border-mintGlow/10 group-hover:border-mintGlow/30">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-textLight group-hover:text-mintGlow">{item.title}</div>
                    <div className="text-[10px] text-mutedText">{item.category}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-mutedText opacity-0 group-hover:opacity-100 transition" />
              </button>
            ))
          )}
        </div>

        <div className="bg-surface/80 p-3 border-t border-mintGlow/10 flex items-center justify-between text-[10px] text-mutedText">
          <span>Navigate with mouse or keyboard</span>
          <span className="font-mono bg-elevated px-2 py-0.5 rounded border border-mintGlow/10">ESC to exit</span>
        </div>
      </div>
    </div>
  );
};
