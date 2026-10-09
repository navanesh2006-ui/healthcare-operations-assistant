import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: 'hospital_staff' | 'hospital_reviewer' | 'patient' | null;
  token: string | null;
  authLoading: boolean;
  loginPatient: (email: string, password: string) => Promise<void>;
  loginHospital: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: 'hospital_staff' | 'hospital_reviewer' | 'patient') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getActiveToken = () => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const tabRole = sessionStorage.getItem('carebridge_tab_role');

  if (path.startsWith('/hospital') || path.startsWith('/reviewer') || path.startsWith('/discharge') || path.startsWith('/patients') || tabRole === 'hospital') {
    return localStorage.getItem('carebridge_hospital_token');
  }

  if (path.startsWith('/patient') || path.startsWith('/my-') || tabRole === 'patient') {
    return localStorage.getItem('carebridge_patient_token');
  }

  return localStorage.getItem('carebridge_hospital_token') || localStorage.getItem('carebridge_patient_token');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'hospital_staff' | 'hospital_reviewer' | 'patient' | null>(null);
  const [token, setToken] = useState<string | null>(getActiveToken());
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const syncAuth = async () => {
    const activeToken = getActiveToken();
    if (activeToken) {
      try {
        const me = await authApi.getMe();
        setUser(me);
        setRole(me.role as any);
        setToken(activeToken);
      } catch (err: any) {
        console.error("syncAuth error:", err);
        // ONLY clear local token if server explicitly returned 401 Unauthorized.
        // Do NOT clear token on network hiccups, uvicorn reloads, or 500 errors.
        if (err.response?.status === 401) {
          const path = typeof window !== 'undefined' ? window.location.pathname : '';
          const tabRole = typeof window !== 'undefined' ? sessionStorage.getItem('carebridge_tab_role') : null;
          if (tabRole === 'hospital' || path.startsWith('/hospital')) {
            localStorage.removeItem('carebridge_hospital_token');
          } else if (tabRole === 'patient' || path.startsWith('/patient')) {
            localStorage.removeItem('carebridge_patient_token');
          }
          setUser(null);
          setRole(null);
          setToken(null);
        }
      }
    } else {
      setUser(null);
      setRole(null);
      setToken(null);
    }
    setAuthLoading(false);
  };

  const loginPatient = async (email: string, password: string) => {
    const res = await authApi.patientLogin(email, password);
    localStorage.setItem('carebridge_patient_token', res.access_token);
    sessionStorage.setItem('carebridge_tab_role', 'patient');
    setToken(res.access_token);
    setRole(res.role as any);
    setUser({
      id: res.user_id,
      email: res.email,
      name: res.name,
      role: res.role,
      user_code: res.user_code,
      patient_id: res.patient_id,
      hospital_id: res.hospital_id
    } as any);
    // Background sync user profile without delaying redirect
    authApi.getMe().then(me => setUser(me)).catch(() => {});
  };

  const loginHospital = async (email: string, password: string) => {
    const res = await authApi.hospitalLogin(email, password);
    localStorage.setItem('carebridge_hospital_token', res.access_token);
    sessionStorage.setItem('carebridge_tab_role', 'hospital');
    setToken(res.access_token);
    setRole(res.role as any);
    setUser({
      id: res.user_id,
      email: res.email,
      name: res.name,
      role: res.role,
      user_code: res.user_code,
      patient_id: res.patient_id,
      hospital_id: res.hospital_id
    } as any);
    // Background sync user profile without delaying redirect
    authApi.getMe().then(me => setUser(me)).catch(() => {});
  };

  const switchRole = async (targetRole: 'hospital_staff' | 'hospital_reviewer' | 'patient') => {
    setAuthLoading(true);
    let email = "staff@hospital-a.demo";
    let pass = "Staff@123";

    if (targetRole === "hospital_reviewer") {
      email = "reviewer@hospital-a.demo";
      pass = "Review@123";
    } else if (targetRole === "patient") {
      email = "patient1@demo.com";
      pass = "Patient@123";
    }

    try {
      const res = await authApi.loginUniversal(email, pass);
      if (targetRole === "patient") {
        localStorage.setItem('carebridge_patient_token', res.access_token);
        sessionStorage.setItem('carebridge_tab_role', 'patient');
      } else {
        localStorage.setItem('carebridge_hospital_token', res.access_token);
        sessionStorage.setItem('carebridge_tab_role', 'hospital');
      }
      setToken(res.access_token);
      setRole(res.role as any);
      const me = await authApi.getMe();
      setUser(me);
    } catch (err) {
      console.error("Switch role error:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    const tabRole = sessionStorage.getItem('carebridge_tab_role');
    const path = typeof window !== 'undefined' ? window.location.pathname : '';

    if (tabRole === 'hospital' || path.startsWith('/hospital') || path.startsWith('/reviewer') || path.startsWith('/discharge') || path.startsWith('/patients')) {
      localStorage.removeItem('carebridge_hospital_token');
    } else if (tabRole === 'patient' || path.startsWith('/patient') || path.startsWith('/my-')) {
      localStorage.removeItem('carebridge_patient_token');
    } else {
      localStorage.removeItem('carebridge_hospital_token');
      localStorage.removeItem('carebridge_patient_token');
    }
    sessionStorage.removeItem('carebridge_tab_role');
    setToken(null);
    setUser(null);
    setRole(null);
  };

  useEffect(() => {
    syncAuth();

    const handleStorageChange = (e: StorageEvent) => {
      const tabRole = sessionStorage.getItem('carebridge_tab_role');
      const path = typeof window !== 'undefined' ? window.location.pathname : '';

      const isHospitalTab = tabRole === 'hospital' || path.startsWith('/hospital') || path.startsWith('/reviewer') || path.startsWith('/discharge') || path.startsWith('/patients');
      const isPatientTab = tabRole === 'patient' || path.startsWith('/patient') || path.startsWith('/my-');

      if (isHospitalTab && e.key === 'carebridge_hospital_token') {
        syncAuth();
      } else if (isPatientTab && e.key === 'carebridge_patient_token') {
        syncAuth();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, token, authLoading, loginPatient, loginHospital, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
