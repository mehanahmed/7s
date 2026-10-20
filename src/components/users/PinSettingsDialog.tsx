"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Loader2, Trash2, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { serverUpdateUserPinCode, serverVerifyUserPinCode } from '@/app/actions/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { PinInput } from '@/components/ui/pin-input';

interface PinSettingsDialogProps {
  children: React.ReactNode;
}

export function PinSettingsDialog({ children }: PinSettingsDialogProps) {
  const { currentUser, refreshCurrentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const hasPin = Boolean(currentUser?.hasPinCode);
  const totalSteps = hasPin ? 3 : 2;

  const resetForm = () => {
    setStep(1);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleNextStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (hasPin) {
      if (!currentPin.trim()) {
        toast({
          title: "Current PIN Required",
          description: "Please enter your current PIN code.",
          variant: "destructive",
        });
        return;
      }
      setIsLoading(true);
      try {
        const isValid = await serverVerifyUserPinCode(currentUser.id, currentPin.trim());
        if (!isValid) {
          toast({
            title: "Incorrect PIN",
            description: "The current PIN code you entered is incorrect.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        setStep(2);
      } catch (err) {
        toast({
          title: "Verification Error",
          description: "Could not verify current PIN code.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!/^\d{4,6}$/.test(newPin.trim())) {
        toast({
          title: "Invalid PIN",
          description: "PIN must be 4 to 6 numeric digits (0-9).",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    }
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(newPin.trim())) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be 4 to 6 numeric digits (0-9).",
        variant: "destructive",
      });
      return;
    }
    setStep(3);
  };

  const handleFinalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (newPin.trim() !== confirmPin.trim()) {
      toast({
        title: "PIN Mismatch",
        description: "New PIN and Confirm PIN do not match.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const success = await serverUpdateUserPinCode(currentUser.id, newPin.trim());

      if (success) {
        sessionStorage.setItem(`colorhut-pin-unlocked-${currentUser.id}`, 'true');
        await refreshCurrentUser();
        toast({
          title: "PIN Code Saved",
          description: "Your Security PIN code has been configured successfully.",
        });
        setIsOpen(false);
        resetForm();
      } else {
        throw new Error("Failed to save PIN code in database.");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update Security PIN.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePin = async () => {
    if (!currentUser || !hasPin) return;
    if (!currentPin.trim()) {
      toast({
        title: "Current PIN Required",
        description: "Please enter your Current PIN code to disable PIN security.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const isValid = await serverVerifyUserPinCode(currentUser.id, currentPin.trim());
      if (!isValid) {
        toast({
          title: "Incorrect Current PIN",
          description: "Current PIN code is incorrect.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const success = await serverUpdateUserPinCode(currentUser.id, null);
      if (success) {
        sessionStorage.removeItem(`colorhut-pin-unlocked-${currentUser.id}`);
        await refreshCurrentUser();
        toast({
          title: "Security PIN Removed",
          description: "PIN protection has been disabled for your account.",
        });
        setIsOpen(false);
        resetForm();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove Security PIN.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm rounded-2xl p-6">
        <DialogHeader className="pb-2 border-b flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            {hasPin ? "Manage PIN" : "Security PIN"}
          </DialogTitle>
          <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {step}/{totalSteps}
          </span>
        </DialogHeader>

        <div className="pt-4">
          <AnimatePresence mode="wait">
            {/* STEP 1 FOR HAS_PIN: Verify Current PIN */}
            {hasPin && step === 1 && (
              <motion.form
                key="step-haspin-1"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleNextStep1}
                className="space-y-5"
              >
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">Current PIN Code</p>
                  <PinInput
                    value={currentPin}
                    onChange={setCurrentPin}
                    length={6}
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemovePin}
                    disabled={isLoading || !currentPin}
                    className="text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>

                  <Button type="submit" size="sm" disabled={isLoading || currentPin.length < 4} className="px-5">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="ml-1 h-4 w-4" /></>}
                  </Button>
                </div>
              </motion.form>
            )}

            {/* STEP 1 FOR NO_PIN OR STEP 2 FOR HAS_PIN: Create New PIN */}
            {((!hasPin && step === 1) || (hasPin && step === 2)) && (
              <motion.form
                key="step-create"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                onSubmit={hasPin ? handleNextStep2 : handleNextStep1}
                className="space-y-5"
              >
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {hasPin ? "New PIN Code" : "Enter PIN Code"}
                  </p>
                  <PinInput
                    value={newPin}
                    onChange={setNewPin}
                    length={6}
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {hasPin ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
                      <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                      Cancel
                    </Button>
                  )}

                  <Button type="submit" size="sm" disabled={!/^\d{4,6}$/.test(newPin)} className="px-5">
                    Next <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </motion.form>
            )}

            {/* STEP 2 FOR NO_PIN OR STEP 3 FOR HAS_PIN: Confirm PIN */}
            {((!hasPin && step === 2) || (hasPin && step === 3)) && (
              <motion.form
                key="step-confirm"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleFinalSave}
                className="space-y-5"
              >
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">Confirm PIN Code</p>
                  <PinInput
                    value={confirmPin}
                    onChange={setConfirmPin}
                    length={6}
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setStep(hasPin ? 2 : 1)} disabled={isLoading}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back
                  </Button>

                  <Button type="submit" size="sm" disabled={isLoading || confirmPin.length < 4} className="px-5">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-1.5 h-4 w-4" /> Save PIN
                      </>
                    )}
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
