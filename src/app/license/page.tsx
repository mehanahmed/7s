"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ShieldAlert, KeyRound, Globe, ArrowRight, Loader2, CheckCircle2, Lock } from 'lucide-react';
import { getLicenseInfoAction, activateLicenseAction, LicenseInfoResponse } from './actions';
import Image from 'next/image';

export default function LicenseActivationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfoResponse | null>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
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

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim() || submitting) return;

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await activateLicenseAction(licenseKeyInput.trim());
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        setLicenseKeyInput('');
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-xl z-10">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-xl mb-3">
            <Lock className="w-7 h-7 text-sky-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Seven Solution ERP</h1>
          <p className="text-slate-400 text-sm mt-1">Domain License & Cryptographic Activation</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-3" />
              <p className="text-sm">Verifying system license status...</p>
            </div>
          ) : (
            <div>
              {/* Domain & Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Detected Host</div>
                    <div className="text-sm font-semibold text-white font-mono">{licenseInfo?.host || 'localhost'}</div>
                  </div>
                </div>

                <div>
                  {licenseInfo?.isActivated ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <ShieldCheck className="w-4 h-4" />
                      Active License
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <ShieldAlert className="w-4 h-4" />
                      Unlicensed
                    </span>
                  )}
                </div>
              </div>

              {/* Activated View */}
              {licenseInfo?.isActivated ? (
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/25">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-emerald-300">Software Successfully Activated</h3>
                        <p className="text-xs text-slate-300 mt-1">
                          This copy of Seven Solution is cryptographically licensed for{' '}
                          <strong className="text-white font-mono">{licenseInfo.host}</strong>.
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-4 text-xs pt-3 border-t border-emerald-500/20">
                          <div>
                            <span className="text-slate-400 block">Licensed To:</span>
                            <span className="font-medium text-white">{licenseInfo.client || 'Commercial Client'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Expiration:</span>
                            <span className="font-medium text-white">{licenseInfo.expiresAt || 'Never'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard')}
                      className="flex-1 h-12 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-[0.99] font-medium text-white shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Continue to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/login')}
                      className="h-12 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-sm font-medium transition cursor-pointer"
                    >
                      Login
                    </button>
                  </div>
                </div>
              ) : (
                /* Unlicensed Activation View */
                <form onSubmit={handleActivate} className="space-y-5">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                    <strong>Activation Required:</strong> This installation is locked to authorized domains. Please enter your cryptographically signed license key to activate Seven Solution on <strong>{licenseInfo?.host}</strong>.
                  </div>

                  {statusMessage && (
                    <div
                      className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                        statusMessage.type === 'success'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <span>{statusMessage.text}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                      License Key (7SLIC-...)
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={licenseKeyInput}
                      onChange={(e) => setLicenseKeyInput(e.target.value)}
                      placeholder="Paste your signed license key here..."
                      className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 font-mono transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !licenseKeyInput.trim()}
                    className="w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 active:scale-[0.99] font-medium text-white shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Cryptographic Signature...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Activate Software</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Seven Solution Digital Rights Protection System &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
