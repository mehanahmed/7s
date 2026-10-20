
"use client";

import React, { useState, useEffect, useRef } from 'react';
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
import type { User } from "@/types";
import { UserCog, UploadCloud, XCircle, Trash2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { uploadOptimizedAvatarAction } from '@/app/(app)/users/upload-actions';

interface SetUserAvatarDialogProps {
  user: User;
  onAvatarChanged: (userId: string, avatarUrl: string | null) => Promise<boolean>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetUserAvatarDialog({ user, onAvatarChanged, isOpen, onOpenChange }: SetUserAvatarDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Toast is handled by UsersPage

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setPreviewUrl(user.avatarUrl || null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen, user.avatarUrl]);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (selectedFile) {
      objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
    }
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File too large. Please select an image smaller than 2MB.");
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert("Invalid file type. Please select an image file (e.g., JPG, PNG, GIF).");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemovePreview = () => {
    setSelectedFile(null);
    setPreviewUrl(user.avatarUrl || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setIsLoading(true);
    await onAvatarChanged(user.id, null); // Parent (UsersPage) handles outcome & toast
    setIsLoading(false);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (selectedFile) {
      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const result = await uploadOptimizedAvatarAction(formData);

        if (result.success && result.file_url) {
          await onAvatarChanged(user.id, result.file_url);
        } else {
          throw new Error(result.error || "Failed to upload and optimize avatar.");
        }
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "An unknown error occurred during upload.";
        alert(`Could not upload new avatar: ${message}`);
      }
    } else if (previewUrl === null && user.avatarUrl !== null) {
      await onAvatarChanged(user.id, null);
    } else {
      onOpenChange(false);
    }

    setIsLoading(false);
  };

  const noChangeMade = !selectedFile && previewUrl === (user.avatarUrl || null);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UserCog className="mr-2 h-5 w-5 text-primary" /> Set Avatar for {user.name}
          </DialogTitle>
          <DialogDescription>
            Manage the profile picture for {user.email}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="avatarFileAdmin-set" className="text-sm font-medium">
                Profile Picture
              </Label>
              <div className="flex items-center gap-4">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Avatar preview"
                    width={80}
                    height={80}
                    unoptimized
                    className="rounded-full object-cover border border-muted"
                    data-ai-hint="user avatar"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border border-dashed">
                    <UserCog className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    disabled={isLoading}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" /> {selectedFile ? "Change Image" : "Upload Image"}
                  </Button>
                  <Input
                    id="avatarFileAdmin-set"
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isLoading}
                  />
                  {selectedFile && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemovePreview} className="text-xs text-muted-foreground hover:text-destructive" disabled={isLoading}>
                      <XCircle className="mr-1 h-3 w-3" /> Cancel Selection
                    </Button>
                  )}
                </div>
              </div>
              {user.avatarUrl && previewUrl && !selectedFile && (
                <Button type="button" variant="link" size="sm" onClick={() => setPreviewUrl(null)} className="text-destructive hover:text-destructive/80 px-0 mt-2 flex items-center" disabled={isLoading}>
                  <Trash2 className="mr-1 h-4 w-4" /> Remove Current Avatar
                </Button>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                Upload an image (JPG, PNG, GIF). Max 2MB.
                {selectedFile && <span className="block mt-1">Selected: {selectedFile.name}</span>}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || noChangeMade}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
