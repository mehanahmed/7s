"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getUsers } from '@/lib/user-service';
import { assignStageRoleAction } from '@/app/(app)/projects/actions';
import { STAGE_ASSIGN_ROLE } from '@/lib/project-stages';
import type { Project, ProjectStatusType, User } from '@/types';

interface AssignStageRoleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  newStatus: ProjectStatusType;
  currentUser: User;
  /** Extra move note forwarded to the stage change (e.g. the uploaded proof). */
  notes?: string;
  onAssigned: () => void;
}

const initials = (name: string) => {
  const parts = name.trim().split(' ');
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : '');
};

/** Shown when a project is moved into On Script / Artist Booked / Cinematographer / On Editor: pick the person for that role. */
export function AssignStageRoleDialog({ isOpen, onOpenChange, project, newStatus, currentUser, notes, onAssigned }: AssignStageRoleDialogProps) {
  const cfg = STAGE_ASSIGN_ROLE[newStatus];
  const { toast } = useToast();
  const [people, setPeople] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen || !cfg) return;
    setSelectedId(project.stageAssignees?.[cfg.role]?.id ?? '');
    setSearch('');
    setIsLoading(true);
    getUsers()
      .then((all) => setPeople(all.filter((u) => (cfg.roles ?? [cfg.role]).includes(u.role) && !u.isBanned)))
      .catch(() => {
        setPeople([]);
        toast({ title: "Error", description: `Could not load ${cfg.label} users.`, variant: "destructive" });
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, cfg, project, toast]);

  const filtered = useMemo(() => people.filter((u) => u.name.toLowerCase().includes(search.toLowerCase())), [people, search]);
  if (!cfg) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setIsSubmitting(true);
    const result = await assignStageRoleAction(project.id, newStatus, selectedId, currentUser, notes);
    setIsSubmitting(false);
    if (!result.success) {
      toast({ title: "Assignment Failed", description: result.error, variant: "destructive" });
      return;
    }
    const person = people.find((u) => u.id === selectedId);
    toast({ title: "Project Updated", description: `${project.name} moved to ${newStatus}. ${cfg.label}: ${person?.name ?? ''}` });
    onAssigned();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign {cfg.label}</DialogTitle>
          <DialogDescription>
            Moving <span className="font-semibold">{project.name}</span> to <span className="font-semibold">{newStatus}</span>.
            Pick the {cfg.label} for this project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label>{cfg.label}</Label>
              {isLoading ? (
                <div className="flex h-10 items-center justify-center rounded-md border bg-muted/50">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={popoverOpen} className="w-full justify-between" disabled={people.length === 0}>
                      <span className="truncate">
                        {selectedId ? people.find((u) => u.id === selectedId)?.name : people.length === 0 ? `No ${cfg.label} users` : `Select ${cfg.label}...`}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder={`Search ${cfg.label}...`} value={search} onValueChange={setSearch} />
                      <CommandList>
                        <CommandEmpty>No {cfg.label} found.</CommandEmpty>
                        <CommandGroup>
                          {filtered.map((u) => (
                            <CommandItem
                              key={u.id}
                              value={u.name}
                              onSelect={() => { setSelectedId(u.id); setPopoverOpen(false); }}
                              className="flex items-center gap-2"
                            >
                              <Check className={cn("h-4 w-4", selectedId === u.id ? "opacity-100" : "opacity-0")} />
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={u.avatarUrl || undefined} alt={u.name} />
                                <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                              </Avatar>
                              <span>{u.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || isLoading || !selectedId}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</> : `Assign ${cfg.label}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
