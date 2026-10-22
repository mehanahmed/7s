"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import type { User, UserRole, UserRoleDefinition } from "@/types";
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { UserCircle, XCircle, Eye, EyeOff, Fingerprint, Camera } from 'lucide-react';
import { addUserAction } from '@/app/(app)/users/actions';
import { uploadOptimizedAvatarAction } from '@/app/(app)/users/upload-actions';
import { getRoles } from '@/lib/user-role-service';
import { Switch } from '@/components/ui/switch'; 
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getArtistCategories } from '@/lib/user-service';


interface AddUserDialogProps {
  onUserAdded: () => void;
  currentUser: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  defaultRole?: UserRole;
}

export function AddUserDialog({ onUserAdded, currentUser, isOpen, onOpenChange, children, defaultRole }: AddUserDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [idMode, setIdMode] = useState<'auto' | 'manual'>('auto');
  const [manualId, setManualId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole | undefined>(defaultRole);
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [joinDate, setJoinDate] = useState(todayStr());
  const [availableRoles, setAvailableRoles] = useState<UserRoleDefinition[]>([]);
  const [showIdMode, setShowIdMode] = useState(false);
  const clickCountRef = useRef(0);
  const lastClickRef = useRef(0);
  
  const { toast } = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setName('');
    setEmail('');
    setIdMode('auto');
    setManualId('');
    setCompanyName('');
    setAddress('');
    setPhone('');
    setRole(defaultRole);
    setPassword('password');
    setShowPassword(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCategory('');
    setIsAddingCategory(false);
    setJoinDate(todayStr());
    setShowIdMode(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [defaultRole]); 

  useEffect(() => {
    if (isOpen) {
      const fetchRoles = async () => {
        const roles = await getRoles();
        setAvailableRoles(roles);
      };
      fetchRoles();
      if (!isSubmitting) {
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
      }
    } else {
      resetForm();
    }
  }, [isOpen, resetForm, defaultRole, isSubmitting]);

  useEffect(() => {
    if (!isOpen || role !== 'ARTIST') return;
    let active = true;
    getArtistCategories().then(categories => {
      if (active) setAvailableCategories(categories);
    }).catch(() => {
      if (active) toast({ title: 'Error', description: 'Could not load artist categories.', variant: 'destructive' });
    });
    return () => { active = false; };
  }, [isOpen, role, toast]);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (selectedFile) {
      objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedFile]);

  const assignableRoles = useMemo(() => {
    if (currentUser.role === 'SYSTEM_ADMIN') {
      return availableRoles;
    }
    if (currentUser.role === 'ADMIN') {
      return availableRoles.filter(r => r.id !== 'SYSTEM_ADMIN'); 
    }
    return []; 
  }, [availableRoles, currentUser.role]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: "File too large",
          description: "Please select an image smaller than 2MB.",
          variant: "destructive",
        });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file (e.g., JPG, PNG, GIF).",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemovePreview = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTitleClick = () => {
    const now = Date.now();
    if (now - lastClickRef.current < 500) {
      clickCountRef.current += 1;
    } else {
      clickCountRef.current = 1;
    }
    lastClickRef.current = now;

    if (clickCountRef.current === 3) {
      setShowIdMode(true);
      clickCountRef.current = 0;
      toast({
        title: "Manual ID Mode Enabled",
        description: "You can now enter a custom User ID.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !role || !password) {
      toast({
        title: "Validation Error",
        description: "Name, email, role, and password are required.",
        variant: "destructive",
      });
      return;
    }
    if (idMode === 'manual' && !manualId.trim()) {
      toast({
        title: "Validation Error",
        description: "User ID is required when manual mode is selected.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (role === 'VENDOR') {
        if (!companyName.trim()) {
            toast({ title: "Validation Error", description: "Business Name is required for vendors.", variant: "destructive" });
            return;
        }
        if (!phone.trim() || !/^0\d{10}$/.test(phone)) {
            toast({ title: "Validation Error", description: "A valid 11-digit phone number is required for vendors.", variant: "destructive" });
            return;
        }
        if (!address.trim()) {
            toast({ title: "Validation Error", description: "Address is required for vendors.", variant: "destructive" });
            return;
        }
    }

    setIsSubmitting(true);
    let avatarFileUrl: string | undefined = undefined;

    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadResult = await uploadOptimizedAvatarAction(formData);

        if (uploadResult.success && uploadResult.file_url) {
          avatarFileUrl = uploadResult.file_url;
        } else {
          toast({
            title: "Avatar Upload Error",
            description: uploadResult.error || "Could not save avatar file to disk folder.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      } catch (error) {
        toast({
          title: "Avatar Upload Error",
          description: "Could not process and save the avatar image. Please try again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    if (role !== 'VENDOR' && phone.trim() && !/^0\d{10}$/.test(phone.trim())) {
      toast({ title: "Validation Error", description: "Phone number must be 11 digits and start with 0.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const newUserFirestoreData: Omit<User, 'id'> & { id?: string, password?: string } = { 
      name,
      email,
      role,
      password, 
      id: idMode === 'manual' ? manualId.trim() : undefined,
      companyName: companyName || undefined,
      phone: phone.trim() || undefined,
      address: role === 'ARTIST' || role === 'VENDOR' ? address.trim() || undefined : undefined,
      category: role === 'ARTIST' ? category.trim() || null : undefined,
      avatarUrl: avatarFileUrl,
      monthlyOrderTarget: 0, 
      weeklyOrderTarget: 0,  
      isBanned: false, 
      fcmToken: null, 
      isLeader: false,
      joinDate: joinDate || null,
    };

    try {
      const result = await addUserAction(newUserFirestoreData);
      setIsSubmitting(false);

      if (result.success && result.user) {
          toast({ title: "Success", description: `User ${result.user.name} added successfully.` });
          onUserAdded();
          onOpenChange(false);
      } else {
         toast({ title: "Error", description: result.error || "Could not add user.", variant: "destructive"});
      }
    } catch (error: any) {
      setIsSubmitting(false);
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive"});
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 rounded-2xl p-0 sm:p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl overflow-visible">
        {/* Profile photo: sits on the top edge of the dialog; click to add or change */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-50 to-sky-100 ring-4 ring-white transition hover:scale-105"
            aria-label={selectedFile ? "Change profile photo" : "Add profile photo"}
          >
            {previewUrl ? (
              <Image src={previewUrl} alt="Avatar preview" width={96} height={96} unoptimized className="h-full w-full object-cover" data-ai-hint="user avatar" />
            ) : (
              <UserCircle className="h-14 w-14 text-blue-300" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/45 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-6 w-6 text-white" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-white transition hover:scale-110"
            aria-label={selectedFile ? "Change photo" : "Add photo"}
          >
            <Camera className="h-4 w-4" />
          </button>
          {selectedFile && (
            <button
              type="button"
              onClick={handleRemovePreview}
              disabled={isSubmitting}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground ring-2 ring-white transition hover:scale-110"
              aria-label="Remove photo"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
          <input id="avatarFile-add" type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isSubmitting} />
        </div>

        <DialogHeader className="space-y-1 px-8 pb-5 pt-16 text-center sm:text-center">
          <DialogTitle 
            onClick={handleTitleClick} 
            className="cursor-default select-none hover:text-primary transition-colors"
          >
            Add New User
          </DialogTitle>
          <DialogDescription>Fill in the details for the new user.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid max-h-[62vh] grid-cols-1 gap-x-5 gap-y-5 overflow-y-auto border-t px-8 py-6 sm:grid-cols-2 custom-scrollbar">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-[13px] font-semibold text-foreground/80">Name</Label>
            <Input className="h-11 rounded-lg" placeholder="Full name" id="name" ref={nameInputRef} value={name ?? ''} onChange={e => setName(e.target.value)} required disabled={isSubmitting} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-[13px] font-semibold text-foreground/80">Email</Label>
            <Input className="h-11 rounded-lg" placeholder="name@company.com" id="email" type="email" value={email ?? ''} onChange={e => setEmail(e.target.value)} required disabled={isSubmitting} />
          </div>

          {showIdMode && (
            <div className="sm:col-span-2 space-y-3 p-3 rounded-lg border border-zinc-300 bg-card animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <Label htmlFor="id-mode" className="flex items-center gap-2 cursor-pointer">
                  <Fingerprint className="h-4 w-4 text-muted-foreground" />
                  User ID Generation
                </Label>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs", idMode === 'auto' ? "text-primary font-bold" : "text-muted-foreground")}>Auto</span>
                  <Switch
                    id="id-mode"
                    checked={idMode === 'manual'}
                    onCheckedChange={(checked) => setIdMode(checked ? 'manual' : 'auto')}
                    disabled={isSubmitting}
                  />
                  <span className={cn("text-xs", idMode === 'manual' ? "text-primary font-bold" : "text-muted-foreground")}>Manual</span>
                </div>
              </div>
              {idMode === 'manual' && (
                <div className="space-y-1 pt-2">
                  <Label htmlFor="manualId">Manual User ID *</Label>
                  <Input
                    id="manualId"
                    value={manualId ?? ''}
                    onChange={e => setManualId(e.target.value)}
                    placeholder="e.g., CUSTOM-001"
                    required={idMode === 'manual'}
                    disabled={isSubmitting}
                  />
                  <p className="text-[10px] text-muted-foreground">Must be unique and not match system patterns.</p>
                </div>
              )}
            </div>
          )}

           <div className="space-y-1">
            <Label htmlFor="password-add" className="text-[13px] font-semibold text-foreground/80">Password</Label>
              <div className="relative">
                <Input 
                  id="password-add" 
                  type={showPassword ? "text" : "password"} 
                  value={password ?? ''} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="h-11 rounded-lg pr-11" 
                  required 
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
           <div className="space-y-1">
              <Label htmlFor="role-add" className="text-[13px] font-semibold text-foreground/80">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)} required>
                <SelectTrigger id="role-add" className="h-11 rounded-lg">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="phone-add" className="text-[13px] font-semibold text-foreground/80">Phone{role === 'VENDOR' ? ' *' : ''}</Label>
              <Input
                id="phone-add"
                className="h-11 rounded-lg"
                type="tel"
                inputMode="tel"
                value={phone ?? ''}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                pattern="^0\d{10}$"
                title="Phone number must be 11 digits and start with 0."
                required={role === 'VENDOR'}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="joinDate-add" className="text-[13px] font-semibold text-foreground/80">Join Date</Label>
              <Input className="h-11 rounded-lg" id="joinDate-add" type="date" value={joinDate ?? ''} onChange={(e) => setJoinDate(e.target.value)} disabled={isSubmitting} />
            </div>

            {role === 'ARTIST' && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="artist-address-add" className="text-[13px] font-semibold text-foreground/80">Address</Label>
                  <Input id="artist-address-add" className="h-11 rounded-lg" value={address} onChange={e => setAddress(e.target.value)} placeholder="Artist's address" maxLength={1000} disabled={isSubmitting} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="artist-category-add" className="text-[13px] font-semibold text-foreground/80">Category</Label>
                  <Select value={isAddingCategory ? 'new' : category ? `category:${category}` : 'none'} onValueChange={value => {
                    setIsAddingCategory(value === 'new');
                    setCategory(value.startsWith('category:') ? value.slice(9) : '');
                  }} disabled={isSubmitting}>
                    <SelectTrigger id="artist-category-add" className="h-11 rounded-lg"><SelectValue placeholder="Select a category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {availableCategories.map(name => <SelectItem key={name} value={`category:${name}`}>{name}</SelectItem>)}
                      <SelectItem value="new">Add new category...</SelectItem>
                    </SelectContent>
                  </Select>
                  {isAddingCategory && <Input aria-label="New artist category" className="h-11 rounded-lg" value={category} onChange={e => setCategory(e.target.value)} placeholder="New category name" maxLength={100} required disabled={isSubmitting} />}
                </div>
              </>
            )}

            {role === 'VENDOR' && (
              <>
                 <div className="space-y-1">
                  <Label htmlFor="companyName-add">Business Name</Label>
                  <Input id="companyName-add" value={companyName ?? ''} onChange={(e) => setCompanyName(e.target.value)} placeholder="Vendor's Business Name" required/>
                </div>
                <div className="space-y-1 sm:col-span-2">
                   <Label htmlFor="address-add">Address</Label>
                   <Textarea id="address-add" value={address ?? ''} onChange={(e) => setAddress(e.target.value)} placeholder="Vendor's Address" required/>
                </div>
              </>
            )}

           <DialogFooter className="-mx-8 -mb-6 mt-1 gap-2 rounded-b-2xl border-t bg-muted/40 px-8 py-4 sm:col-span-2">
            <Button type="button" variant="outline" className="h-10 px-5" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="h-10 min-w-[110px] bg-primary px-6 font-semibold text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</> : "Add User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
