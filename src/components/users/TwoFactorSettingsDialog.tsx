"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PinInput } from '@/components/ui/pin-input';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Download,
  KeyRound,
  QrCode,
  Smartphone,
  AlertTriangle,
} from 'lucide-react';
import {
  serverSetupTwoFactor,
  serverEnableTwoFactor,
  serverDisableTwoFactor,
  serverGetUserBackupCodes,
} from '@/app/actions/auth';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { SetupTwoFactorResult } from '@/lib/user-service';

interface TwoFactorSettingsDialogProps {
  children?: React.ReactNode;
}

export function TwoFactorSettingsDialog({ children }: TwoFactorSettingsDialogProps) {
  const { currentUser, refreshCurrentUser } = useAuth();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'OVERVIEW' | 'SETUP_QR' | 'BACKUP_CODES' | 'ENABLED_VIEW'>('OVERVIEW');
  const [isLoading, setIsLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupTwoFactorResult | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isCopiedSecret, setIsCopiedSecret] = useState(false);
  const [isCopiedBackup, setIsCopiedBackup] = useState(false);
  const [existingBackupCodes, setExistingBackupCodes] = useState<string[]>([]);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setStep('OVERVIEW');
      setSetupData(null);
      setVerificationCode('');
      setShowBackupCodesModal(false);
    }
  };

  const startSetup = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const data = await serverSetupTwoFactor(currentUser.id);
      if (data) {
        setSetupData(data);
        setStep('SETUP_QR');
      } else {
        toast({ title: 'Setup Error', description: 'Could not generate 2FA setup details.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to start 2FA setup.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmEnable = async () => {
    if (!currentUser || !setupData || verificationCode.length !== 6) return;
    setIsLoading(true);
    try {
      const res = await serverEnableTwoFactor(currentUser.id, verificationCode, setupData.secret, setupData.backupCodes);
      if (res.success) {
        toast({ title: '2FA Enabled!', description: 'Two-Factor Authentication is now active on your account.' });
        await refreshCurrentUser();
        setStep('BACKUP_CODES');
      } else {
        toast({ title: 'Verification Failed', description: res.message || 'Invalid code.', variant: 'destructive' });
        setVerificationCode('');
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to verify 2FA code.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const res = await serverDisableTwoFactor(currentUser.id);
      if (res.success) {
        toast({ title: '2FA Disabled', description: 'Two-Factor Authentication has been turned off.' });
        await refreshCurrentUser();
        setStep('OVERVIEW');
      } else {
        toast({ title: 'Error', description: res.message || 'Failed to disable 2FA.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to disable 2FA.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBackupCodes = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const codes = await serverGetUserBackupCodes(currentUser.id);
      setExistingBackupCodes(codes);
      setShowBackupCodesModal(true);
    } catch (e) {
      toast({ title: 'Error', description: 'Could not load backup codes.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.secret);
    setIsCopiedSecret(true);
    setTimeout(() => setIsCopiedSecret(false), 2000);
    toast({ title: 'Copied!', description: 'Secret key copied to clipboard.' });
  };

  const copyBackupCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join('\n'));
    setIsCopiedBackup(true);
    setTimeout(() => setIsCopiedBackup(false), 2000);
    toast({ title: 'Copied!', description: 'Backup codes copied to clipboard.' });
  };

  const downloadBackupCodes = (codes: string[]) => {
    const text = `Seven Solution 2FA Backup Codes\nAccount: ${currentUser?.email}\nDate: ${new Date().toLocaleDateString()}\n\nCodes:\n${codes.join('\n')}\n\nKeep these single-use recovery codes in a safe place.`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `2fa_backup_codes_${currentUser?.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const is2FAEnabled = Boolean(currentUser?.hasTwoFactor);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl rounded-xl">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Two-Factor Authentication (2FA)</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Secure your account with an Authenticator App (Google Authenticator, Authy, etc.)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* --- STATE 1: ENABLED VIEW --- */}
        {is2FAEnabled && step === 'OVERVIEW' && (
          <div className="space-y-6 py-2">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">2FA Protection is Active</h4>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Your account is secured with authenticator verification.</p>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 dark:text-emerald-300">Enabled</Badge>
            </div>

            {showBackupCodesModal ? (
              <div className="space-y-4 p-4 rounded-lg bg-muted/40 border">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" /> Remaining Backup Codes
                  </h4>
                  <Badge variant="secondary">{existingBackupCodes.length} remaining</Badge>
                </div>
                {existingBackupCodes.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs text-center">
                    {existingBackupCodes.map((code, idx) => (
                      <div key={idx} className="p-2 rounded bg-background border font-semibold">
                        {code}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-2">No remaining backup codes.</p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => copyBackupCodes(existingBackupCodes)}>
                    {isCopiedBackup ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    Copy Codes
                  </Button>
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => downloadBackupCodes(existingBackupCodes)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-11 text-sm font-medium"
                onClick={fetchBackupCodes}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 text-primary" />}
                View Recovery Backup Codes
              </Button>

              <Button
                variant="destructive"
                className="w-full justify-start gap-2 h-11 text-sm font-medium"
                onClick={handleDisable2FA}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                Disable Two-Factor Authentication
              </Button>
            </div>
          </div>
        )}

        {/* --- STATE 2: DISABLED OVERVIEW --- */}
        {!is2FAEnabled && step === 'OVERVIEW' && (
          <div className="space-y-6 py-2">
            <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">How standard 2FA works</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Whenever you log in, you will be prompted to enter a 6-digit code generated by your Authenticator app (Google Authenticator, Authy, or Microsoft Authenticator).
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={startSetup} className="w-full h-11 font-semibold text-sm" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              Setup 2FA Authenticator App
            </Button>
          </div>
        )}

        {/* --- STATE 3: SETUP QR & VERIFICATION --- */}
        {step === 'SETUP_QR' && setupData && (
          <div className="space-y-5 py-1">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-2 bg-white rounded-xl shadow-md border inline-block">
                <Image
                  src={setupData.qrCodeUrl}
                  alt="2FA QR Code"
                  width={180}
                  height={180}
                  className="rounded-lg"
                  priority
                />
              </div>

              <div className="w-full space-y-1">
                <p className="text-xs text-muted-foreground">Scan QR code in your Authenticator App, or enter key manually:</p>
                <div className="flex items-center gap-2 bg-muted/60 p-2 rounded-lg border font-mono text-xs justify-center font-bold tracking-wider">
                  <span>{setupData.secret}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copySecret}>
                    {isCopiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-center pt-2">
              <label className="text-xs font-semibold text-foreground">Enter 6-digit code from your app:</label>
              <div className="flex justify-center">
                <PinInput
                  value={verificationCode}
                  onChange={setVerificationCode}
                  length={6}
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setStep('OVERVIEW')} className="w-full sm:w-1/2">
                Cancel
              </Button>
              <Button
                onClick={handleConfirmEnable}
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full sm:w-1/2 font-semibold"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & Enable 2FA
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* --- STATE 4: BACKUP CODES DISPLAY AFTER SETUP --- */}
        {step === 'BACKUP_CODES' && setupData && (
          <div className="space-y-5 py-1">
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="text-xs leading-relaxed">
                <strong className="font-semibold block text-sm">Save your Backup Codes!</strong>
                If you lose access to your authenticator app, these single-use codes can be used to log into your account.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs text-center">
              {setupData.backupCodes.map((code, idx) => (
                <div key={idx} className="p-2 rounded bg-muted/70 border font-semibold">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => copyBackupCodes(setupData.backupCodes)}>
                {isCopiedBackup ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                Copy All Codes
              </Button>
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => downloadBackupCodes(setupData.backupCodes)}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download TXT
              </Button>
            </div>

            <DialogFooter className="pt-2">
              <Button onClick={() => handleOpenChange(false)} className="w-full font-semibold">
                Done & Finish
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
