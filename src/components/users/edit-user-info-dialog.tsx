

"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import type { User, VendorCategory } from "@/types";
import { useToast } from '@/hooks/use-toast';
import { updateUserInfoAction, previewEmployeeIdAction } from '@/app/(app)/users/actions';
import { Edit3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { isDrRole } from '@/lib/roles';
import { getArtistCategories } from '@/lib/user-service';

interface EditUserInfoDialogProps {
  user: User;
  onUserInfoUpdated: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  availableCategories?: VendorCategory[];
}

export function EditUserInfoDialog({ user, onUserInfoUpdated, isOpen, onOpenChange, availableCategories = [] }: EditUserInfoDialogProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [companyName, setCompanyName] = useState(user.companyName || 'Seven Solution');
  const [phone, setPhone] = useState(user.phone || '');
  const [address, setAddress] = useState(user.address || ''); // New state for address
  const [category, setCategory] = useState(user.category || '');
  const [isLeader, setIsLeader] = useState(user.isLeader || false);
  const [joinDate, setJoinDate] = useState(user.joinDate || '');
  const [employeeId, setEmployeeId] = useState(user.employeeId || '');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isVendor = user.role === 'VENDOR';
  const isArtist = user.role === 'ARTIST';
  const isCrmOrDrOrLr = user.role === 'CR' || isDrRole(user.role) || user.role === 'LR';
  const [artistCategories, setArtistCategories] = useState<string[]>([]);
  const [isAddingNewArtistCategory, setIsAddingNewArtistCategory] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name);
      setEmail(user.email);
      setCompanyName(user.companyName || 'Seven Solution');
      setPhone(user.phone || '');
      setAddress(user.address || ''); // Set address state
      setCategory(user.category || '');
      setIsLeader(user.isLeader || false);
      setJoinDate(user.joinDate || '');
      setEmployeeId(user.employeeId || '');
      setIsAddingNewArtistCategory(false);
      if (user.role === 'ARTIST') {
        getArtistCategories().then(cats => setArtistCategories(cats)).catch(() => {});
      }
    }
  }, [isOpen, user]);

  // New join date -> show the Employee ID that will be issued for that day; back to the original date -> original ID.
  const handleJoinDateChange = async (value: string) => {
    setJoinDate(value);
    if ((value || '') === (user.joinDate || '')) {
      setEmployeeId(user.employeeId || '');
      return;
    }
    try {
      setEmployeeId(await previewEmployeeIdAction(value || null));
    } catch {
      /* keep the current value, the server re-checks on save */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and Email are required.",
        variant: "destructive",
      });
      return;
    }
    
    if (!isVendor && phone.trim() && !/^0\d{10}$/.test(phone.trim())) {
        toast({ title: "Validation Error", description: "Phone number must be 11 digits and start with 0.", variant: "destructive" });
        return;
    }

    if (isVendor) {
        if (!companyName.trim()) {
            toast({ title: "Validation Error", description: "Business Name is required for vendors.", variant: "destructive" });
            return;
        }
        if (!phone.trim() || !/^0\d{10}$/.test(phone.trim())) {
            toast({ title: "Validation Error", description: "A valid 11-digit phone number is required for vendors.", variant: "destructive" });
            return;
        }
        if (!address.trim()) {
            toast({ title: "Validation Error", description: "Address is required for vendors.", variant: "destructive" });
            return;
        }
        if (!category || category === 'none') {
             toast({ title: "Validation Error", description: "Category is required for vendors.", variant: "destructive" });
            return;
        }
    }

    setIsLoading(true);
    const updates: Partial<Pick<User, 'name' | 'email' | 'companyName' | 'phone' | 'address' | 'category' | 'isLeader' | 'joinDate'>> = {
      name: name.trim(),
      joinDate: joinDate || null,
      phone: phone.trim() || null,
      email: email.trim(),
      companyName: companyName.trim() || null,
      isLeader: isCrmOrDrOrLr ? isLeader : undefined,
    };
    
    if (isVendor || isArtist) {
        updates.address = address.trim() || null;
        updates.category = category === 'none' ? null : category.trim() || null;
    }

    const result = await updateUserInfoAction(user.id, updates);
    setIsLoading(false);

    if (result.success) {
      onUserInfoUpdated();
    } else {
      toast({
        title: "Update Failed",
        description: result.error || "Could not update user information. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Edit3 className="mr-2 h-5 w-5 text-primary" /> Edit User Information
          </DialogTitle>
          <DialogDescription>
            Update details for {user?.name} ({user?.email}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-1">
              <Label htmlFor="userName-edit">Name</Label>
              <Input
                id="userName-edit"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="userEmail-edit">Email</Label>
              <Input
                id="userEmail-edit"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="userCompany-edit">{isVendor ? 'Business Name' : 'Company Name (Optional)'}</Label>
              <Input
                id="userCompany-edit"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isLoading}
                required={isVendor}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="employeeId-edit">Employee ID</Label>
              <Input id="employeeId-edit" value={employeeId} readOnly disabled className="bg-muted/50 font-mono" />
              <p className="text-[11px] text-muted-foreground">Updates automatically when the Join Date changes.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="userPhone-edit">Phone{isVendor ? ' *' : ''}</Label>
              <Input
                id="userPhone-edit"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                disabled={isLoading}
                required={isVendor}
                pattern="^0\d{10}$"
                title="Phone number must be 11 digits and start with 0."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-joinDate">Join Date</Label>
              <Input id="edit-joinDate" type="date" value={joinDate} onChange={(e) => handleJoinDateChange(e.target.value)} disabled={isLoading} />
            </div>

            {isCrmOrDrOrLr && (
              <div className="flex items-center justify-between space-x-2 rounded-lg border p-3 shadow-sm bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="leader-switch-edit">Team Leader Status</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable if this user is a team leader.
                  </p>
                </div>
                <Switch
                  id="leader-switch-edit"
                  checked={isLeader}
                  onCheckedChange={setIsLeader}
                  disabled={isLoading}
                />
              </div>
            )}
            
            {isArtist && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="artistAddress-edit">Address</Label>
                  <Input
                    id="artistAddress-edit"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isLoading}
                    placeholder="Artist's address"
                    maxLength={1000}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="artistCategory-edit">Category</Label>
                  <Select
                    value={isAddingNewArtistCategory ? 'new' : category ? `category:${category}` : 'none'}
                    onValueChange={(val) => {
                      if (val === 'new') {
                        setIsAddingNewArtistCategory(true);
                        setCategory('');
                      } else {
                        setIsAddingNewArtistCategory(false);
                        setCategory(val.startsWith('category:') ? val.slice(9) : '');
                      }
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="artistCategory-edit">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {artistCategories.map((name) => (
                        <SelectItem key={name} value={`category:${name}`}>
                          {name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">Add new category...</SelectItem>
                    </SelectContent>
                  </Select>
                  {isAddingNewArtistCategory && (
                    <Input
                      placeholder="New category name"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      maxLength={100}
                      disabled={isLoading}
                      className="mt-2"
                    />
                  )}
                </div>
              </>
            )}

            {isVendor && (
              <>
                <div className="space-y-1">
                   <Label htmlFor="userAddress-edit">Address</Label>
                   <Textarea
                     id="userAddress-edit"
                     value={address}
                     onChange={(e) => setAddress(e.target.value)}
                     disabled={isLoading}
                     required={isVendor}
                     placeholder="Enter vendor's full address"
                   />
                 </div>
                <div className="space-y-1">
                  <Label htmlFor="userCategory-edit">Category</Label>
                   <Select value={category || 'none'} onValueChange={setCategory} disabled={isLoading} required={isVendor}>
                    <SelectTrigger id="userCategory-edit">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a category</SelectItem>
                      {availableCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
