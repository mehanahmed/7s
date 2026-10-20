
"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, ShieldCheck, Eye, EyeOff, Mail, Lock, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { PinInput } from '@/components/ui/pin-input';
import type { User } from '@/types';


export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 2FA state
  const [show2FAScreen, setShow2FAScreen] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isUsingBackupCode, setIsUsingBackupCode] = useState(false);

  const { login, complete2FALogin } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Login Error",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    const res = await login(email, password);
    if (res.require2FA && res.pendingUser) {
      setPendingUser(res.pendingUser);
      setShow2FAScreen(true);
      setIsLoading(false);
      return;
    }
    if (!res.success) {
      setIsLoading(false);
    }
  };

  const handleAutoSubmit = async (code: string) => {
    if (!pendingUser || !code.trim() || isLoading) return;
    setIsLoading(true);
    const success = await complete2FALogin(pendingUser, code.trim());
    if (!success) {
      setIsLoading(false);
      setTwoFactorCode('');
    }
  };

  const handle2FASubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingUser || !twoFactorCode.trim() || isLoading) return;
    handleAutoSubmit(twoFactorCode);
  };

  if (show2FAScreen && pendingUser) {
    return (
      <Card className="w-full max-w-[380px] shadow-2xl bg-card/95 backdrop-blur-md border-border/30 dark:border-border/50 rounded-xl transform hover:scale-[1.01] transition-transform duration-300">
        <CardHeader className="text-center pt-5 pb-1 px-6">
          <div className="flex items-center justify-center gap-2 mb-0.5">
            <Image
              src="/gp.webp"
              alt="Authenticator"
              width={26}
              height={26}
              priority
              className="object-contain drop-shadow-sm"
            />
            <CardTitle className="text-lg font-medium tracking-tight text-foreground">
              Authenticator
            </CardTitle>
          </div>
          <CardDescription className="text-[11px] text-muted-foreground">
            {isUsingBackupCode
              ? "Enter one of your 8-character recovery backup codes."
              : "Enter the 6-digit verification code from your Authenticator app."}
          </CardDescription>
        </CardHeader>

        <CardContent className="py-2.5 px-6">
          <form onSubmit={handle2FASubmit} className="space-y-4">
            <div className="space-y-1.5 text-center">
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
                  disabled={isLoading}
                  className="h-10 text-center text-base font-mono font-bold tracking-widest uppercase bg-background/80 border-border/50 rounded-lg shadow-sm"
                />
              ) : (
                <div className="flex justify-center">
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
                    disabled={isLoading}
                    autoFocus
                    className="py-0.5"
                  />
                </div>
              )}

              {isLoading && (
                <div className="flex items-center justify-center py-1 text-muted-foreground gap-1.5 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Verifying...</span>
                </div>
              )}
              
              <div className="pt-0.5">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  disabled={isLoading}
                  className="text-[11px] text-primary hover:underline h-auto p-0"
                  onClick={() => {
                    setIsUsingBackupCode(!isUsingBackupCode);
                    setTwoFactorCode('');
                  }}
                >
                  {isUsingBackupCode
                    ? "Switch to 6-digit Authenticator code"
                    : "Use a single-use backup recovery code instead"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center py-2 px-6 bg-secondary/50 dark:bg-card-foreground/5 rounded-b-xl border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] h-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setShow2FAScreen(false);
              setPendingUser(null);
              setTwoFactorCode('');
              setIsUsingBackupCode(false);
            }}
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Back to Login
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="relative z-10 w-full max-w-[460px] animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500">
      <div className="overflow-hidden rounded-[32px] border border-white/80 bg-gradient-to-b from-cyan-100/80 via-white/90 to-white/95 p-10 pt-12 shadow-[0_30px_80px_-20px_rgba(37,99,235,0.35),0_8px_24px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-trim.png" alt="Seven Solution" className="mx-auto mb-6 h-11 w-auto object-contain drop-shadow-sm" />

        <div className="mb-8 text-center">
          <h2 className="text-[28px] font-semibold tracking-tight text-slate-900">Sign in with email</h2>
          <p className="mx-auto mt-2 max-w-[320px] text-[15px] leading-snug text-slate-500">
            Sign in to your workspace to manage orders, projects and teams together.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[52px] w-full rounded-xl border border-transparent bg-slate-100/90 pl-11 pr-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-[52px] w-full rounded-xl border border-transparent bg-slate-100/90 pl-11 pr-12 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800"
            >
              {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-3 flex h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-b from-slate-700 to-slate-950 text-base font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_18px_-6px_rgba(15,23,42,0.6)] transition hover:from-slate-600 hover:to-slate-900 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Get Started'}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-1.5 border-t border-dotted border-slate-300 pt-5 text-[13px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-600" /> All connections are secure and encrypted.
        </div>
      </div>
    </div>
  );
}
