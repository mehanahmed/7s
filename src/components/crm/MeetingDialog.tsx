"use client";

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarIcon, Video, MapPin, PhoneCall, Link2, User as UserIcon, Building2, Globe, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { addMeeting, updateMeeting } from '@/lib/meeting-service';
import type { Meeting, MeetingInput, MeetingStatus, MeetingType, User } from '@/types';

interface MeetingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  meeting?: Meeting | null;
  currentUser: User;
  onSaved: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const nextHour = () => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};
const parseLocal = (iso?: string | null): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : nextHour();
};

export function MeetingDialog({ isOpen, onOpenChange, meeting, currentUser, onSaved }: MeetingDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(nextHour());
  const [meetingTime, setMeetingTime] = useState(`${pad(nextHour().getHours())}:00`);
  const [dateOpen, setDateOpen] = useState(false);
  const [durationMin, setDurationMin] = useState('30');
  const [type, setType] = useState<MeetingType>('Online');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<MeetingStatus>('Scheduled');
  const [notes, setNotes] = useState('');
  const [clientWebsite, setClientWebsite] = useState('');
  const [serviceRequirement, setServiceRequirement] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(meeting?.title ?? '');
    setContactName(meeting?.contactName ?? '');
    setCompanyName(meeting?.companyName ?? '');
    setPhone(meeting?.phone ?? '');
    const when = parseLocal(meeting?.meetingAt);
    setMeetingDate(when);
    setMeetingTime(`${pad(when.getHours())}:${pad(when.getMinutes())}`);
    setDurationMin(String(meeting?.durationMin ?? 30));
    setType((meeting?.type as MeetingType) ?? 'Online');
    setLocation(meeting?.location ?? '');
    setStatus((meeting?.status as MeetingStatus) ?? 'Scheduled');
    setNotes(meeting?.notes ?? '');
    setClientWebsite(meeting?.clientWebsite ?? '');
    setServiceRequirement(meeting?.serviceRequirement ?? '');
  }, [isOpen, meeting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !meetingDate || !meetingTime) {
      toast({ title: "Validation Error", description: "Title and date/time are required.", variant: "destructive" });
      return;
    }
    if (phone.trim() && !/^0\d{10}$/.test(phone.trim())) {
      toast({ title: "Validation Error", description: "Phone number must be 11 digits and start with 0.", variant: "destructive" });
      return;
    }
    const meetingAt = `${format(meetingDate, 'yyyy-MM-dd')}T${meetingTime}`;
    const input: MeetingInput = {
      title, contactName, companyName, phone, meetingAt,
      durationMin: Number(durationMin) || 30, type, location, status, notes,
      clientWebsite: clientWebsite.trim() || undefined,
      serviceRequirement: serviceRequirement.trim() || undefined,
    };
    setIsSaving(true);
    try {
      if (meeting) await updateMeeting(meeting.id, input);
      else await addMeeting(input);
      toast({ title: meeting ? "Meeting updated" : "Meeting added", description: title.trim() });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not save the meeting.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const locationLabel = type === 'Online' ? 'Meeting link' : type === 'In-person' ? 'Address / place' : 'Phone / dial-in';

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!isSaving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b pb-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400 text-white shadow-md shadow-primary/30"><CalendarIcon className="h-5 w-5" aria-hidden /></span>
          <div>
            <DialogTitle className="text-lg">{meeting ? 'Edit Meeting' : 'Add Meeting'}</DialogTitle>
            <DialogDescription>Schedule a client meeting and keep notes in one place.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[78vh] flex-col gap-5 overflow-y-auto py-1 pr-1 custom-scrollbar">
          <Input
            id="m-title"
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title *"
            required
            disabled={isSaving}
            className="h-12 rounded-none border-0 border-b-2 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:border-primary focus-visible:ring-0"
          />

          {/* type as segmented buttons */}
          <div role="radiogroup" aria-label="Meeting type" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {([['Online', Video], ['In-person', MapPin], ['Phone', PhoneCall]] as const).map(([t, Icon]) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                disabled={isSaving}
                onClick={() => setType(t)}
                className={cn(
                  'flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  type === t ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden /> {t}
              </button>
            ))}
          </div>

          {/* when */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Date *</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-left font-normal" disabled={isSaving}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {meetingDate ? format(meetingDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={meetingDate} onSelect={(d) => { setMeetingDate(d); if (d) setDateOpen(false); }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-time">Time *</Label>
              <Input id="m-time" type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} required disabled={isSaving} />
            </div>
            <div className="space-y-1">
              <Label>Duration</Label>
              <div className="flex gap-1">
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={isSaving}
                    onClick={() => setDurationMin(String(m))}
                    aria-pressed={durationMin === String(m)}
                    className={cn(
                      'h-10 flex-1 cursor-pointer rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      durationMin === String(m) ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* where */}
          <div className="relative">
            <Label htmlFor="m-location" className="sr-only">{locationLabel}</Label>
            {type === 'Online' ? <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden /> : type === 'In-person' ? <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden /> : <PhoneCall className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden />}
            <Input id="m-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={type === 'Online' ? 'Meeting link, e.g. https://meet.google.com/...' : locationLabel} disabled={isSaving} className="pl-10" />
          </div>

          {/* Client Website / Page URL & Service Requirement */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <Label htmlFor="m-website" className="sr-only">Client Website / Page</Label>
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="m-website"
                type="text"
                value={clientWebsite}
                onChange={(e) => setClientWebsite(e.target.value)}
                placeholder="Client Website / Facebook Page URL"
                disabled={isSaving}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Label htmlFor="m-service" className="sr-only">Service Requirement</Label>
              <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="m-service"
                type="text"
                value={serviceRequirement}
                onChange={(e) => setServiceRequirement(e.target.value)}
                placeholder="Service Requirement / Note"
                disabled={isSaving}
                className="pl-10"
              />
            </div>
          </div>

          {/* who */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {([
              ['m-contact', UserIcon, 'Contact person', contactName, setContactName, 'text'],
              ['m-company', Building2, 'Company', companyName, setCompanyName, 'text'],
              ['m-phone', PhoneCall, 'Phone 01XXXXXXXXX', phone, setPhone, 'tel'],
            ] as const).map(([id, Icon, ph, val, set, tp]) => (
              <div key={id} className="relative">
                <Label htmlFor={id} className="sr-only">{ph}</Label>
                <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id={id} type={tp} value={val} onChange={(e) => set(e.target.value)} placeholder={ph} disabled={isSaving} className="pl-10" />
              </div>
            ))}
          </div>

          {meeting && (
            <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 gap-2">
              {([['Scheduled', 'border-primary bg-primary/10 text-primary'], ['Completed', 'border-green-500 bg-green-50 text-green-700'], ['Cancelled', 'border-red-500 bg-red-50 text-red-600']] as const).map(([st, on]) => (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={status === st}
                  disabled={isSaving}
                  onClick={() => setStatus(st)}
                  className={cn(
                    'h-10 cursor-pointer rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    status === st ? on : 'border-input bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          )}

          <Textarea aria-label="Notes / agenda" placeholder="Notes / agenda" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={isSaving} />

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="min-w-32">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (meeting ? 'Save Changes' : 'Add Meeting')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
