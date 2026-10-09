import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { 
  HeartPulse, Globe, ShieldCheck, FileText, Activity, UserPlus, LogOut, Sun, Moon, 
  Bell, Search, ChevronLeft, ChevronRight, Users, CheckCircle2, AlertCircle, Clock,
  Home, Calendar, MessageSquare, BookOpen, Settings
} from 'lucide-react';
import { CommandPalette, TrustBadge } from './ui/Primitives';

export const Navbar: React.FC = () => {
  const { user, role, token, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItemsHospital = [
    { label: 'Dashboard', path: '/hospital/dashboard', icon: <Activity className="w-5 h-5" /> },
    { label: 'Find Patients', path: '/hospital/find-patients', icon: <UserPlus className="w-5 h-5" /> },
    { label: 'Discharge Patient', path: '/discharge', icon: <FileText className="w-5 h-5" /> },
    { label: 'Patient Documents', path: '/patients/documents', icon: <BookOpen className="w-5 h-5" /> },
    { label: 'Audit Logs', path: '/audit', icon: <ShieldCheck className="w-5 h-5" /> },
  ];

  const navItemsPatient = [
    { label: 'Home / My Plan', path: '/patient-portal', icon: <Home className="w-5 h-5" /> },
    { label: 'Connections & Requests', path: '/patient/requests', icon: <Users className="w-5 h-5" /> },
    { label: 'Account Settings', path: '/account', icon: <Settings className="w-5 h-5" /> },
  ];

  const mockNotifications = [
    { id: 1, title: 'Discharge summary parsed', desc: '5-Agent extraction finished for Patient PAT-000101', time: '10m ago', group: 'Today' },
    { id: 2, title: 'New follow-up request', desc: 'Patient requested cardiology connection', time: '1h ago', group: 'Today' },
    { id: 3, title: 'Document uploaded', desc: 'Lab test PDF submitted by PAT-000102', time: 'Yesterday', group: 'Earlier' },
  ];

  return (
    <>
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

      {/* NOTIFICATION SLIDE-OVER DRAWER */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm glass-card rounded-none rounded-l-2xl p-5 flex flex-col justify-between border-l border-mintGlow/20 shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-mintGlow/15 mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-mintGlow" />
                  <h3 className="font-heading font-bold text-textLight text-base">Notifications</h3>
                </div>
                <button 
                  onClick={() => setIsNotificationsOpen(false)}
                  className="p-1 rounded-lg text-mutedText hover:text-textLight hover:bg-forest/40"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                {['Today', 'Earlier'].map((group) => {
                  const groupItems = mockNotifications.filter(n => n.group === group);
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={group} className="space-y-2">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-mutedText px-1">{group}</div>
                      {groupItems.map(n => (
                        <div key={n.id} className="p-3 rounded-xl glass-panel hover:border-mintGlow/30 transition text-xs space-y-1">
                          <div className="flex items-center justify-between font-semibold text-textLight">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-mutedText font-mono">{n.time}</span>
                          </div>
                          <p className="text-mutedText text-[11px] leading-relaxed">{n.desc}</p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-mintGlow/15 text-center">
              <button 
                onClick={() => setIsNotificationsOpen(false)}
                className="w-full py-2 text-xs font-semibold text-mintGlow hover:underline"
              >
                Mark all as read
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOSPITAL DESKTOP FLOATING GLASS SIDEBAR */}
      {token && role !== 'patient' && (
        <aside 
          className={`hidden md:flex flex-col fixed left-4 top-4 bottom-4 z-40 glass-card transition-all duration-300 ${
            isSidebarCollapsed ? 'w-20' : 'w-64'
          } p-4 shadow-2xl justify-between border-mintGlow/20`}
        >
          <div className="space-y-6">
            {/* Header Brand & Collapse Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-mintGlow/15">
              <Link to="/" className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primaryGreen to-mintGlow flex items-center justify-center shrink-0 shadow-lg shadow-primaryGreen/20">
                  <HeartPulse className="w-6 h-6 text-ink" />
                </div>
                {!isSidebarCollapsed && (
                  <div>
                    <h1 className="font-heading font-bold text-textLight text-base leading-none tracking-tight">CareBridge</h1>
                    <span className="text-[10px] font-mono text-mintGlow">Clinical AI Platform</span>
                  </div>
                )}
              </Link>

              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-lg glass-panel hover:bg-forest/60 text-mutedText hover:text-textLight transition"
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            {/* Command Palette Search Trigger Button */}
            <button
              onClick={() => setIsCommandOpen(true)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl glass-panel hover:border-mintGlow/40 text-mutedText hover:text-textLight transition text-xs ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-mintGlow" />
                {!isSidebarCollapsed && <span>Quick Search...</span>}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[10px] font-mono bg-elevated px-1.5 py-0.5 rounded border border-mintGlow/10">Ctrl+K</span>
              )}
            </button>

            {/* Navigation Links */}
            <nav className="space-y-1.5">
              {navItemsHospital.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition relative group ${
                      active 
                        ? 'bg-gradient-to-r from-primaryGreen/25 to-forest/40 text-white border border-mintGlow/40 shadow-glow-mint' 
                        : 'text-mutedText hover:text-textLight hover:bg-forest/30'
                    } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                  >
                    <div className={`${active ? 'text-mintGlow' : 'group-hover:text-mintGlow'}`}>
                      {item.icon}
                    </div>
                    {!isSidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                    {active && (
                      <div className="absolute left-0 w-1.5 h-6 bg-mintGlow rounded-r-full shadow-glow-mint" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Controls & User Chip */}
          <div className="space-y-3 pt-3 border-t border-mintGlow/15">
            {/* Language & Theme Controls */}
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl glass-panel">
                {/* Language Segmented Control */}
                <div className="flex items-center gap-1 bg-ink/60 p-1 rounded-lg text-[10px] font-mono">
                  {(['en', 'ta', 'hi'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`px-1.5 py-0.5 rounded uppercase font-bold transition ${
                        language === lang ? 'bg-primaryGreen text-white' : 'text-mutedText hover:text-white'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                {/* Dark/Light Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg hover:bg-forest/50 text-mintGlow transition"
                  title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-primaryGreen" />}
                </button>
              </div>
            )}

            {/* Notification & User Profile Badge */}
            <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'flex-col' : 'justify-between'}`}>
              <button
                onClick={() => setIsNotificationsOpen(true)}
                className="p-2 rounded-xl glass-panel hover:bg-forest/50 text-mutedText hover:text-mintGlow transition relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-pendingAmber rounded-full animate-ping" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-pendingAmber rounded-full" />
              </button>

              <Link
                to="/account"
                className={`flex items-center gap-2 p-1.5 rounded-xl glass-panel hover:border-mintGlow/30 transition flex-1 ${
                  isSidebarCollapsed ? 'justify-center' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-forest text-mintGlow font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-mintGlow/20">
                  {user?.name ? user.name[0] : 'U'}
                </div>
                {!isSidebarCollapsed && (
                  <div className="truncate text-left">
                    <div className="text-xs font-semibold text-textLight truncate">{user?.name}</div>
                    <div className="text-[10px] text-mintGlow font-mono truncate">{user?.user_code || role}</div>
                  </div>
                )}
              </Link>

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl glass-panel hover:bg-declinedRed/20 text-mutedText hover:text-declinedRed transition"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar Trust Badge */}
            {!isSidebarCollapsed && (
              <div className="pt-2 border-t border-mintGlow/10 text-[10px] text-mutedText flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-mintGlow shrink-0" />
                <span className="leading-tight">AI organizes tasks; staff confirm decisions.</span>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* MOBILE & PATIENT PORTAL TOP NAVBAR */}
      <header className={`sticky top-0 z-30 backdrop-blur-md glass-card rounded-none border-b border-mintGlow/15 ${token && role !== 'patient' ? 'md:hidden' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primaryGreen to-mintGlow flex items-center justify-center shadow-md">
              <HeartPulse className="w-5 h-5 text-ink" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-textLight text-sm">CareBridge</h1>
              <p className="text-[10px] text-mintGlow font-mono">
                {role === 'patient' ? 'Patient Recovery Portal' : 'Clinical AI'}
              </p>
            </div>
          </Link>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {/* Command Search Trigger */}
            <button
              onClick={() => setIsCommandOpen(true)}
              className="p-2 rounded-xl glass-panel text-mutedText hover:text-mintGlow transition"
              title="Search commands (Ctrl+K)"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Language Switcher */}
            <div className="flex items-center bg-surface/80 border border-mintGlow/20 rounded-xl px-2 py-1 text-xs">
              <Globe className="w-3.5 h-3.5 text-mutedText mr-1" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-textLight focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-deep text-textLight">EN</option>
                <option value="ta" className="bg-deep text-textLight">தமிழ்</option>
                <option value="hi" className="bg-deep text-textLight">हिंदी</option>
              </select>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl glass-panel text-mintGlow hover:bg-forest/50 transition"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-primaryGreen" />}
            </button>

            {token && (
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl glass-panel hover:bg-declinedRed/20 text-mutedText hover:text-declinedRed transition"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION TAB BAR */}
      {token && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass-card rounded-none border-t border-mintGlow/20 p-2 shadow-2xl">
          <div className="flex items-center justify-around">
            {(role === 'patient' ? navItemsPatient : navItemsHospital).map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition ${
                    active ? 'text-mintGlow font-bold scale-105' : 'text-mutedText hover:text-textLight'
                  }`}
                >
                  {item.icon}
                  <span className="text-[10px] truncate">{item.label.split(' ')[0]}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
};
