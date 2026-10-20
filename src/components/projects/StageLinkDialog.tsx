"use client";

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2 } from 'lucide-react';

interface StageLinkDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  /** Called with the submitted URL. */
  onConfirm: (url: string) => void;
}

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** A link is mandatory before a project can enter certain stages (Script Done, CG Complete, Project Complete). */
export function StageLinkDialog({ isOpen, onOpenChange, title, description, label, placeholder, onConfirm }: StageLinkDialogProps) {
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isOpen) { setUrl(''); setTouched(false); }
  }, [isOpen]);

  const value = url.trim();
  const valid = isHttpUrl(value);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onConfirm(value);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /> {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="stage-link">{label} *</Label>
            <Input
              id="stage-link"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={placeholder}
              autoFocus
              aria-invalid={touched && !valid}
            />
            {touched && !valid && <p className="text-xs font-medium text-destructive">Enter a valid link starting with http:// or https://</p>}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!value}>Submit &amp; Move</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
