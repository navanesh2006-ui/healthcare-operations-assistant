import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Building2, ShieldCheck, HeartPulse, ArrowRight, Activity, Brain } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { token, role } = useAuth();

  return (
    <div className="max-w-5xl mx-auto py-12 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-forestGreen/40 text-limeAccent border border-primaryGreen/30 px-3 py-1 rounded-full text-xs font-semibold">
          <HeartPulse className="w-4 h-4 text-primaryGreen" />
          Agentic Healthcare Follow-up & Consent Coordinator
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
          CareBridge Platform
        </h1>
        <p className="text-base text-textLight/80 leading-relaxed">
          Connecting patients and discharging hospitals through database-backed consent, agentic discharge coordination, and a Second Brain knowledge vault.
        </p>
      </div>

      {/* Two Login Cards: I'm a Patient vs I'm a Hospital */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Patient Portal Card */}
        <div className="bg-panelBg border-2 border-forestGreen/80 hover:border-limeAccent rounded-2xl p-8 shadow-xl flex flex-col justify-between transition group">
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-forestGreen text-limeAccent flex items-center justify-center group-hover:scale-110 transition shadow-md">
              <User className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">I'm a Patient</h2>
            <p className="text-xs text-textLight/70 leading-relaxed">
              Access your interactive follow-up care schedule, accept hospital connection requests, book doctor appointment slots, upload post-visit lab reports, and ask your RAG care assistant.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <Link
              to="/patient/login"
              className="w-full bg-limeAccent hover:bg-limeAccent/90 text-darkBg font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow"
            >
              Patient Sign In <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/patient/register"
              className="w-full bg-darkBg hover:bg-forestGreen/40 text-textLight font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center border border-forestGreen transition"
            >
              Create New Patient Account
            </Link>
          </div>
        </div>

        {/* Hospital Portal Card */}
        <div className="bg-panelBg border-2 border-forestGreen/80 hover:border-primaryGreen rounded-2xl p-8 shadow-xl flex flex-col justify-between transition group">
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-forestGreen text-primaryGreen flex items-center justify-center group-hover:scale-110 transition shadow-md">
              <Building2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">I'm a Hospital / Staff</h2>
            <p className="text-xs text-textLight/70 leading-relaxed">
              Search registered patients, send follow-up consent requests, run the 5-agent discharge extraction pipeline, review ambiguous instructions, and manage doctor availability slots.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <Link
              to="/hospital/login"
              className="w-full bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow"
            >
              Hospital Portal Sign In <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/hospital/register"
              className="w-full bg-darkBg hover:bg-forestGreen/40 text-textLight font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center border border-forestGreen transition"
            >
              Register Hospital Facility
            </Link>
          </div>
        </div>
      </div>

      {/* Security & Data Consent Guarantee */}
      <div className="bg-darkBg/80 border border-forestGreen/60 rounded-xl p-6 text-xs text-textLight/70 space-y-2">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <ShieldCheck className="w-5 h-5 text-limeAccent" />
          Database-Backed Privacy & Consent Guarantee
        </div>
        <p>
          Hospitals cannot create follow-up charts or view patient medical records without an explicit <strong>accepted connection</strong>. Non-connected patient records display masked emails and hidden clinical data.
        </p>
      </div>
    </div>
  );
};
