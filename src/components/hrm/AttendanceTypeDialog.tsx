
"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type AttendanceType = 'location' | 'remote' | 'wifi' | 'iot';

interface AttendanceTypeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AttendanceTypeDialog({ isOpen, onOpenChange }: AttendanceTypeDialogProps) {
  const [activeTypes, setActiveTypes] = useState<AttendanceType[]>(['location']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    setIsSubmitting(true);
    // Here you would typically call a server action to save the setting
    console.log("Saving active attendance types:", activeTypes);
    
    // Simulate API call
    setTimeout(() => {
        toast({
            title: "Settings Saved",
            description: `Active attendance types have been updated.`
        });
        setIsSubmitting(false);
        onOpenChange(false);
    }, 1000);
  };
  
  const handleCheckboxChange = (type: AttendanceType) => {
    setActiveTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attendance Type</DialogTitle>
          <DialogDescription>
            Select active attendance tracking methods for employees.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                
                                <TableHead>Location Based</TableHead>
                                <TableHead>Remote</TableHead>
                                <TableHead>Wifi Based</TableHead>
                                <TableHead>IOT Based</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                
                                <TableCell>
                                    <Checkbox 
                                        checked={activeTypes.includes('location')}
                                        onCheckedChange={() => handleCheckboxChange('location')}
                                    />
                                </TableCell>
                                 <TableCell>
                                    <Checkbox 
                                        checked={activeTypes.includes('remote')}
                                        onCheckedChange={() => handleCheckboxChange('remote')}
                                    />
                                </TableCell>
                                 <TableCell>
                                    <Checkbox 
                                        checked={activeTypes.includes('wifi')}
                                        onCheckedChange={() => handleCheckboxChange('wifi')}
                                    />
                                </TableCell>
                                 <TableCell>
                                    <Checkbox 
                                        checked={activeTypes.includes('iot')}
                                        onCheckedChange={() => handleCheckboxChange('iot')}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
                                        {isSubmitting ? 'Saving...' : 'save'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AttendanceTypeDialog;
