"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { PinInput } from '@/components/ui/pin-input';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

export default function AttendanceLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2FA states
  const [show2FAScreen, setShow2FAScreen] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isUsingBackupCode, setIsUsingBackupCode] = useState(false);

  const { toast } = useToast();
  const { login, complete2FALogin, currentUser, isLoading: isAuthLoading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!isAuthLoading && currentUser && !currentUser.isBanned && !isSubmitting) {
      window.location.replace('/attendance');
    }
  }, [currentUser, isAuthLoading, isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      toast({
        title: "Login Error",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(cleanEmail, password, '/attendance');
      if (res.require2FA && res.pendingUser) {
        setPendingUser(res.pendingUser);
        setShow2FAScreen(true);
        setIsSubmitting(false);
        return;
      }
      if (res.success) {
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
      } else {
        setIsSubmitting(false);
      }
    } catch (err: any) {
      console.error("Login submission error:", err);
      toast({
        title: "Login Error",
        description: err?.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = async (code: string) => {
    if (!pendingUser || !code.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const success = await complete2FALogin(pendingUser, code.trim(), '/attendance');
      if (!success) {
        setIsSubmitting(false);
        setTwoFactorCode('');
      }
    } catch {
      setIsSubmitting(false);
      setTwoFactorCode('');
    }
  };

  const handle2FASubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingUser || !twoFactorCode.trim() || isSubmitting) return;
    handleAutoSubmit(twoFactorCode);
  };

  if (!isAuthLoading && currentUser && !currentUser.isBanned && !show2FAScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-[#5ea3ff] via-[#8fc1fd] to-[#dbeafd]">
        <Loader2 className="h-10 w-10 animate-spin text-white drop-shadow-md" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-[#5ea3ff] via-[#8fc1fd] to-[#dbeafd] sm:p-6 overflow-x-hidden selection:bg-[#2b87f5]/20 selection:text-[#2b87f5]">
      {/* Decorative ambient background for desktop backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden hidden sm:block">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-white/30 blur-3xl" />
      </div>

      {/* Main Mobile Screen Container */}
      <div
        className="w-full sm:max-w-[390px] min-h-screen sm:min-h-[760px] sm:max-h-[92vh] sm:rounded-[44px] sm:shadow-[0_25px_60px_-15px_rgba(20,50,110,0.3)] sm:border-[7px] sm:border-white/50 overflow-hidden relative flex flex-col justify-center items-center p-6 sm:p-7 bg-[url('/attendance-bg.jpg')] bg-cover bg-top bg-no-repeat bg-[#dbeafc]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(35, 78, 142, 0.25)',
        }}
      >
        {/* Subtle top phone notch */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 bg-black/90 rounded-b-xl z-20" />

        {/* 2FA Form Screen */}
        {show2FAScreen && pendingUser ? (
          <div className="relative z-10 w-full max-w-[340px] mx-auto font-outfit py-8 my-auto">
            <div className="rounded-3xl bg-white/80 backdrop-blur-lg border border-white/70 shadow-lg p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Image
                  src="/gp.webp"
                  alt="Authenticator"
                  width={28}
                  height={28}
                  priority
                  className="object-contain drop-shadow-sm"
                />
                <h2 className="text-lg font-bold text-slate-800">Two-Factor Authentication</h2>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {isUsingBackupCode
                  ? "Enter one of your 8-character backup codes."
                  : "Enter the 6-digit code from your Authenticator app."}
              </p>

              <form onSubmit={handle2FASubmit} className="space-y-4">
                {isUsingBackupCode ? (
                  <Input
                    type="text"
                    placeholder="e.g. 3F65-1BDE"
                    value={twoFactorCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setTwoFactorCode(val);
                      if (val.replace(/[^A-Z0-9]/g, '').length === 8) {
                        handleAutoSubmit(val);
                      }
                    }}
                    autoFocus
                    disabled={isSubmitting}
                    className="h-11 text-center text-base font-mono font-bold tracking-widest uppercase bg-white/90 border-slate-200 rounded-full shadow-sm"
                  />
                ) : (
                  <div className="flex justify-center py-1">
                    <PinInput
                      value={twoFactorCode}
                      onChange={(val) => {
                        setTwoFactorCode(val);
                        if (val.length === 6) {
                          handleAutoSubmit(val);
                        }
                      }}
                      length={6}
                      mask={false}
                      size="sm"
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[48px] rounded-full bg-[#2b87f5] hover:bg-[#1e7be9] active:scale-[0.99] text-white font-medium text-[15px] shadow-[0_6px_20px_rgba(43,135,245,0.38)] transition-all flex items-center justify-center cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <span>Verify Code</span>
                  )}
                </button>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="text-xs text-[#2b87f5] hover:underline"
                    onClick={() => {
                      setIsUsingBackupCode(!isUsingBackupCode);
                      setTwoFactorCode('');
                    }}
                  >
                    {isUsingBackupCode
                      ? "Switch to 6-digit Authenticator code"
                      : "Use a backup recovery code instead"}
                  </button>

                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 mt-1"
                    onClick={() => {
                      setShow2FAScreen(false);
                      setPendingUser(null);
                      setTwoFactorCode('');
                      setIsUsingBackupCode(false);
                    }}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Main Attendance Login Screen */
          <div className="relative z-10 w-full max-w-[340px] mx-auto font-outfit my-auto py-6">
            {/* Logo */}
            <div className="flex justify-center mb-4 sm:mb-5">
              <Image
                src="/logo-trim.png"
                alt="Seven Solution"
                width={1200}
                height={429}
                priority
                className="h-11 sm:h-12 w-auto max-w-[210px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
              />
            </div>

            {/* Title */}
            <h1 className="text-[26px] sm:text-[30px] font-bold text-white tracking-tight text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)] mb-6">
              Welcome back!
            </h1>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-3.5">
              {/* Email Input */}
              <div className="relative w-full h-[48px] sm:h-[50px]">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 flex items-center z-10 text-[#8fa2b8]">
                  <Mail className="w-[19px] h-[19px] stroke-[1.8]" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-full rounded-full bg-white/75 hover:bg-white/85 focus:bg-white/95 focus:ring-2 focus:ring-sky-400/50 backdrop-blur-md border border-white/70 shadow-[0_2px_12px_rgba(0,0,0,0.03)] outline-none text-[#2d3748] placeholder:text-[#9aa9bc] text-[14.5px] font-normal pl-11 pr-4 transition-all"
                />
              </div>

              {/* Password Input */}
              <div className="relative w-full h-[48px] sm:h-[50px]">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 flex items-center z-10 text-[#8fa2b8]">
                  <Lock className="w-[19px] h-[19px] stroke-[1.8]" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-full rounded-full bg-white/75 hover:bg-white/85 focus:bg-white/95 focus:ring-2 focus:ring-sky-400/50 backdrop-blur-md border border-white/70 shadow-[0_2px_12px_rgba(0,0,0,0.03)] outline-none text-[#2d3748] placeholder:text-[#9aa9bc] text-[14.5px] font-normal pl-11 pr-12 transition-all"
                />
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword((prev) => !prev);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 items-center justify-center rounded-full text-[#8fa2b8] hover:text-[#52637a] active:scale-90 transition cursor-pointer select-none"
                >
                  {showPassword ? (
                    <Eye className="w-[19px] h-[19px] stroke-[1.8]" />
                  ) : (
                    <EyeOff className="w-[19px] h-[19px] stroke-[1.8]" />
                  )}
                </button>
              </div>

              {/* Login Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[48px] sm:h-[50px] rounded-full bg-[#2b87f5] hover:bg-[#1e7be9] active:scale-[0.99] disabled:opacity-85 text-white font-medium text-[15.5px] shadow-[0_6px_20px_rgba(43,135,245,0.38)] transition-all flex items-center justify-center tracking-wide cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <span>Login</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
