"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, ArrowRight, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { getLicenseInfoAction, activateLicenseAction, LicenseInfoResponse } from './actions';

/* --- Google Gemini-Style Rainbow Badges --- */

function GeminiQuestionBadge({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="geminiRainbow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EA4335" />
          <stop offset="25%" stopColor="#FBBC05" />
          <stop offset="50%" stopColor="#34A853" />
          <stop offset="75%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
        <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#8AB4F8" />
        </linearGradient>
      </defs>
      {/* Outer Rainbow Ring */}
      <circle cx="25" cy="28" r="16.5" stroke="url(#geminiRainbow)" strokeWidth="3" fill="#FFFFFF" />
      {/* Question mark vector path */}
      <path
        d="M22.2 22.8c.4-2.8 2.5-4.8 5.8-4.8 3.5 0 5.8 2.1 5.8 4.9 0 2-1.2 3.3-3.3 4.7-2.3 1.5-3 2.6-3 5v.4h-3.6v-.6c0-3 1.1-4.6 3.8-6.3 1.8-1.2 2.4-2 2.4-3.2 0-1.5-1-2.5-2.6-2.5-1.7 0-2.7 1-2.9 2.4h-2.4zm3.6 12.2c-1.3 0-2.2.9-2.2 2.2 0 1.2.9 2.2 2.2 2.2 1.3 0 2.2-1 2.2-2.2 0-1.3-.9-2.2-2.2-2.2z"
        fill="#1A73E8"
      />
      {/* 4-point Sparkle */}
      <path
        d="M39 8.5c0 3.2-2.6 5.8-5.8 5.8 3.2 0 5.8 2.6 5.8 5.8 0-3.2 2.6-5.8 5.8-5.8-3.2 0-5.8-2.6-5.8-5.8z"
        fill="url(#sparkleGrad)"
      />
    </svg>
  );
}

function GeminiCheckBadge({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="checkRainbow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34A853" />
          <stop offset="35%" stopColor="#4285F4" />
          <stop offset="70%" stopColor="#FBBC05" />
          <stop offset="100%" stopColor="#34A853" />
        </linearGradient>
        <linearGradient id="checkSparkle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34A853" />
          <stop offset="100%" stopColor="#81C995" />
        </linearGradient>
      </defs>
      {/* Outer Rainbow Ring */}
      <circle cx="25" cy="28" r="16.5" stroke="url(#checkRainbow)" strokeWidth="3" fill="#FFFFFF" />
      {/* Checkmark */}
      <path
        d="M19 28.5l4.5 4.5 9.5-9.5"
        stroke="#1E8E3E"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 4-point Sparkle */}
      <path
        d="M39 8.5c0 3.2-2.6 5.8-5.8 5.8 3.2 0 5.8 2.6 5.8 5.8 0-3.2 2.6-5.8 5.8-5.8-3.2 0-5.8-2.6-5.8-5.8z"
        fill="url(#checkSparkle)"
      />
    </svg>
  );
}

export default function LicenseActivationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfoResponse | null>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [showInputOverride, setShowInputOverride] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadInfo();
  }, []);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const info = await getLicenseInfoAction();
      setLicenseInfo(info);
    } catch (err: any) {
      console.error('Failed to load license info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!licenseKeyInput.trim() || submitting) return;

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await activateLicenseAction(licenseKeyInput.trim());
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        setLicenseKeyInput('');
        setShowInputOverride(false);
        await loadInfo();
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Activation failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleActivate();
    }
  };

  const isActivated = licenseInfo?.isActivated && !showInputOverride;

  return (
    <div className="min-h-screen w-full bg-[#f0f4f9] text-slate-800 flex flex-col justify-center items-center px-4 py-12 relative font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      <div className="w-full max-w-xl mx-auto flex flex-col items-center">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-medium">Checking license status...</p>
          </div>
        ) : isActivated ? (
          /* --- Activated State (Minimalist Gemini-Inspired) --- */
          <div className="w-full flex flex-col items-center text-center animate-in fade-in duration-300">
            <div className="mb-2">
              <GeminiCheckBadge className="w-12 h-12" />
            </div>

            <span className="text-xs uppercase tracking-wider font-medium text-slate-500 mt-2">
              Licensed System
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-1 tracking-tight">
              Software Successfully Activated
            </h1>

            {/* Clean White Card */}
            <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-7 mt-7 text-left space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Authorized Domain</div>
                    <div className="text-sm font-semibold text-slate-800 font-mono">
                      {licenseInfo?.host || 'localhost'}
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block mb-0.5">Licensed To</span>
                  <span className="font-semibold text-slate-800">{licenseInfo?.client || 'Commercial Client'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Expiration</span>
                  <span className="font-semibold text-slate-800">{licenseInfo?.expiresAt || 'Lifetime'}</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="w-full sm:flex-1 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full sm:w-auto px-6 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition cursor-pointer"
                >
                  Log In
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowInputOverride(true);
                setStatusMessage(null);
              }}
              className="mt-6 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Enter a different license key</span>
            </button>
          </div>
        ) : (
          /* --- Unactivated State (Exact match to reference screenshot) --- */
          <div className="w-full flex flex-col items-center text-center animate-in fade-in duration-300">
            {/* Top Gemini Question Badge */}
            <div className="mb-2">
              <GeminiQuestionBadge className="w-12 h-12" />
            </div>

            {/* Subtitle & Title */}
            <span className="text-sm font-normal text-slate-500 mt-1">
              activation required
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-1.5 tracking-tight">
              Enter the activation license key
            </h1>

            {/* Main Rounded Input Box */}
            <form onSubmit={handleActivate} className="w-full mt-7">
              <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200/90 p-4 sm:p-5 transition-all focus-within:shadow-md focus-within:border-blue-400 text-left relative">
                <textarea
                  rows={3}
                  required
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="enter the activation key"
                  className="w-full bg-transparent resize-none outline-none text-sm text-slate-800 placeholder:text-slate-400 font-sans leading-relaxed"
                />

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Host:</span>
                    <span className="font-mono font-medium text-slate-600">
                      {licenseInfo?.host || 'localhost'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !licenseKeyInput.trim()}
                    aria-label="Submit activation key"
                    className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Error or Status message banner */}
            {statusMessage && (
              <div
                className={`mt-4 w-full p-3.5 rounded-2xl text-xs flex items-center gap-2.5 text-left animate-in fade-in duration-200 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {showInputOverride && licenseInfo?.isActivated && (
              <button
                type="button"
                onClick={() => {
                  setShowInputOverride(false);
                  setStatusMessage(null);
                }}
                className="mt-4 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Cancel and return to active status
              </button>
            )}
          </div>
        )}

        {/* Minimal Footer */}
        <p className="text-xs text-slate-400 mt-12 text-center">
          Seven Solution &copy; {new Date().getFullYear()} • License Activation
        </p>
      </div>
    </div>
  );
}
