"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Lock, Delete, KeyRound, ShieldAlert, LogOut, Loader2, CheckCircle2, ShieldX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { serverVerifyUserPinCodeWithLock, serverLockUserAccount72h } from '@/app/actions/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export function PinLockDialog() {
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  const pathname = usePathname();
  const [pinInput, setPinInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isAccountLocked72h, setIsAccountLocked72h] = useState(false);
  const [lockedUntilTime, setLockedUntilTime] = useState<string | null>(null);

  const isInvoiceDetailsPage = Boolean(
    pathname && pathname.startsWith('/invoice/')
  );

  const checkPinLockState = useCallback(() => {
    if (!currentUser || !currentUser.hasPinCode || isInvoiceDetailsPage) {
      setIsUnlocked(true);
      return;
    }

    const sessionUnlocked = sessionStorage.getItem(`colorhut-pin-unlocked-${currentUser.id}`) === 'true';
    if (sessionUnlocked) {
      setIsUnlocked(true);
    } else {
      setIsUnlocked(false);
    }
  }, [currentUser, isInvoiceDetailsPage]);

  useEffect(() => {
    checkPinLockState();
  }, [checkPinLockState]);

  const handleVerifyPin = useCallback(async (pinToVerify: string) => {
    if (!currentUser) return;
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const result = await serverVerifyUserPinCodeWithLock(currentUser.id, pinToVerify);
      
      if (result.isLocked) {
        setIsAccountLocked72h(true);
        setLockedUntilTime(result.lockedUntil || null);
        setErrorMsg(result.message || "Account locked for 72 hours due to 3 consecutive wrong PIN attempts.");
      } else if (result.success) {
        sessionStorage.setItem(`colorhut-pin-unlocked-${currentUser.id}`, 'true');
        setIsUnlocked(true);
        setPinInput('');
        setFailedAttempts(0);
        toast({
          title: "Unlocked",
          description: `Welcome back, ${currentUser.name}!`,
        });
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        setShake(true);

        if (nextAttempts >= 3) {
          // 3 failed attempts reached in current session -> Lock for 72 hours
          const lockRes = await serverLockUserAccount72h(currentUser.id);
          setIsAccountLocked72h(true);
          setLockedUntilTime(lockRes.lockedUntil);
          setErrorMsg("3 wrong PIN attempts! Your account has been locked for 72 hours.");
        } else {
          const remaining = 3 - nextAttempts;
          setErrorMsg(`Incorrect PIN code. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining before 72-hour lock.`);
        }

        setTimeout(() => setShake(false), 500);
        setPinInput('');
      }
    } catch (err) {
      console.error("Error verifying PIN:", err);
      setErrorMsg("Verification error. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  }, [currentUser, failedAttempts, toast]);

  const handleKeyPress = useCallback((val: string) => {
    if (isVerifying || isAccountLocked72h) return;
    setErrorMsg('');
    if (val === 'BACK') {
      setPinInput(prev => prev.slice(0, -1));
    } else if (val === 'CLEAR') {
      setPinInput('');
    } else {
      if (pinInput.length < 6) {
        const nextPin = pinInput + val;
        setPinInput(nextPin);
      }
    }
  }, [pinInput, isVerifying, isAccountLocked72h]);

  useEffect(() => {
    if (isUnlocked || isAccountLocked72h) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACK');
      } else if (e.key === 'Enter') {
        if (pinInput.length >= 4) {
          handleVerifyPin(pinInput);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlocked, isAccountLocked72h, handleKeyPress, pinInput, handleVerifyPin]);

  if (!currentUser || !currentUser.hasPinCode || isUnlocked || isInvoiceDetailsPage) {
    return null;
  }

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-background/95 backdrop-blur-xl p-4 select-none"
      >
        <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="flex flex-col items-center space-y-3"
          >
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-primary shadow-2xl">
                <AvatarImage src={currentUser.avatarUrl || undefined} alt={currentUser.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {getInitials(currentUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-full shadow-lg ${isAccountLocked72h ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>
                {isAccountLocked72h ? <ShieldX className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-foreground">{currentUser.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{currentUser.email}</p>
            </div>
          </motion.div>

          <div className="w-full bg-card/80 border shadow-2xl rounded-2xl p-6 flex flex-col items-center space-y-5 backdrop-blur-md">
            {isAccountLocked72h ? (
              /* 72-HOUR ACCOUNT LOCK STATE */
              <div className="w-full flex flex-col items-center space-y-4 py-2">
                <div className="h-14 w-14 rounded-full bg-destructive/15 flex items-center justify-center text-destructive">
                  <ShieldX className="h-8 w-8" />
                </div>

                <div className="space-y-1 text-center">
                  <h3 className="text-lg font-bold text-destructive">Account Locked (72 Hours)</h3>
                  <p className="text-xs text-muted-foreground px-2">
                    Your account has been locked for security after 3 failed PIN attempts.
                  </p>
                </div>

                {lockedUntilTime && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 w-full text-center">
                    <p className="text-[11px] font-medium text-destructive">Locked Until:</p>
                    <p className="text-sm font-bold text-destructive font-mono mt-0.5">
                      {format(new Date(lockedUntilTime), 'PPpp')}
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  onClick={logout}
                  className="w-full h-11 font-semibold mt-2"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Log Out
                </Button>
              </div>
            ) : (
              /* NORMAL UNLOCK STATE */
              <>
                <div className="flex items-center gap-2 text-foreground text-sm font-semibold">
                  <KeyRound className="h-4 w-4" />
                  <span>Enter Security PIN</span>
                </div>

                {/* PIN Dots Indicator */}
                <motion.div 
                  animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className="flex justify-center gap-3 py-2"
                >
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const filled = idx < pinInput.length;
                    return (
                      <div
                        key={idx}
                        className={`h-4 w-4 rounded-full transition-all duration-200 border-2 ${
                          filled 
                            ? 'bg-primary border-primary scale-110 shadow-[0_0_10px_rgba(var(--primary-hsl),0.5)]' 
                            : 'border-muted-foreground/30 bg-muted/20'
                        }`}
                      />
                    );
                  })}
                </motion.div>

                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 text-xs text-destructive font-medium bg-destructive/10 px-3 py-1.5 rounded-md text-center"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </motion.div>
                )}

                {/* Onscreen Keypad */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <Button
                      key={num}
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => handleKeyPress(num)}
                      disabled={isVerifying}
                      className="h-14 text-xl font-mono font-semibold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-150 active:scale-95"
                    >
                      {num}
                    </Button>
                  ))}

                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={() => handleKeyPress('CLEAR')}
                    disabled={isVerifying || pinInput.length === 0}
                    className="h-14 text-xs font-semibold text-muted-foreground rounded-xl"
                  >
                    Clear
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => handleKeyPress('0')}
                    disabled={isVerifying}
                    className="h-14 text-xl font-mono font-semibold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-150 active:scale-95"
                  >
                    0
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={() => handleKeyPress('BACK')}
                    disabled={isVerifying || pinInput.length === 0}
                    className="h-14 rounded-xl text-muted-foreground hover:text-destructive"
                  >
                    <Delete className="h-5 w-5" />
                  </Button>
                </div>

                <div className="w-full flex items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="mr-1.5 h-3.5 w-3.5" /> Log Out
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleVerifyPin(pinInput)}
                    disabled={isVerifying || pinInput.length < 4}
                    className="px-5 font-semibold"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Unlock
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
