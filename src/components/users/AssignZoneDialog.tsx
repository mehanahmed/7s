"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, CheckSquare, Square, Layers, Loader2 } from 'lucide-react';
import type { User } from "@/types";
import { divisions as bangladeshDivisions } from "@/lib/district-data";

interface AssignZoneDialogProps {
  user: User;
  onZonesAssigned: (userId: string, divisions: string[]) => Promise<boolean>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignZoneDialog({
  user,
  onZonesAssigned,
  isOpen,
  onOpenChange,
}: AssignZoneDialogProps) {
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize selected divisions from user data when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      setSelectedDivisions(user.assignedDivisions ? [...user.assignedDivisions] : []);
    }
  }, [isOpen, user?.id]);

  const allDivisionNames = bangladeshDivisions.map((d) => d.division);

  const toggleDivision = (divisionName: string) => {
    setSelectedDivisions((prev) => {
      const exists = prev.some((d) => d.toLowerCase() === divisionName.toLowerCase());
      if (exists) {
        return prev.filter((d) => d.toLowerCase() !== divisionName.toLowerCase());
      } else {
        return [...prev, divisionName];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedDivisions([...allDivisionNames]);
  };

  const handleClearAll = () => {
    setSelectedDivisions([]);
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const success = await onZonesAssigned(user.id, selectedDivisions);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5 text-blue-500" />
            Zone Assign for {user.name}
          </DialogTitle>
          <DialogDescription>
            Select divisions for <span className="font-semibold text-foreground">{user.email}</span>. When this CR user visits the All Districts Data page, they will directly see data for these assigned divisions without needing to search.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="py-3 space-y-4 flex-1 overflow-y-auto pr-1">
            {/* Action Bar: Select All / Clear All & Counter */}
            <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-lg border text-xs">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={isSaving || selectedDivisions.length === allDivisionNames.length}
                  className="h-7 text-xs px-2.5"
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1" />
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={isSaving || selectedDivisions.length === 0}
                  className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Square className="w-3.5 h-3.5 mr-1" />
                  Clear All
                </Button>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {selectedDivisions.length} of {allDivisionNames.length} selected
              </Badge>
            </div>

            {/* Division Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {bangladeshDivisions.map((div) => {
                const isSelected = selectedDivisions.some(
                  (d) => d.toLowerCase() === div.division.toLowerCase()
                );

                return (
                  <div
                    key={div.division}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => !isSaving && toggleDivision(div.division)}
                    onKeyDown={(e) => {
                      if ((e.key === ' ' || e.key === 'Enter') && !isSaving) {
                        e.preventDefault();
                        toggleDivision(div.division);
                      }
                    }}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none
                      ${isSelected 
                        ? 'border-blue-500/60 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs ring-1 ring-blue-500/30' 
                        : 'border-border/70 hover:bg-muted/40'
                      }
                      ${isSaving ? 'opacity-60 cursor-not-allowed' : ''}
                    `}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isSaving}
                      className="mt-0.5 pointer-events-none data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium leading-none text-foreground block">
                        {div.division}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-muted-foreground/60" />
                        {div.districts.length} districts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedDivisions.length === 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                Notice: With no divisions assigned, this CR will see an empty zone placeholder when accessing the All Districts Data page until divisions are assigned.
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 pt-3 border-t gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving Zones...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 mr-2" />
                  Save Assigned Zones
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
