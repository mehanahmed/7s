

"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paperclip, Reply, Send, X, Loader2, BookText, Trash2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { useAuth } from '@/contexts/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNowStrict, format, parseISO } from 'date-fns';
import type { CaseStudyMessage, User, UserRole } from '@/types';
import { getMessagesAction, addMessageAction, deleteMessageAction } from '@/app/(app)/casestudy/actions';
import { getUsers } from '@/lib/user-service';
import { Skeleton } from '../ui/skeleton';
import NextImage from 'next/image';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { isDrRole } from '@/lib/roles';


type TeamType = 'CR' | 'DR' | 'LR';

interface CaseStudyDialogProps {
  children: React.ReactNode;
}

const getInitials = (name: string | undefined): string => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};

const renderTextWithMentions = (text: string, isCurrentUserMessage: boolean, currentUserName: string | undefined) => {
  if (!text) return '';

  const regex = /(^|\s)(@([a-zA-Z0-9_]+))/g;

  let parts = text.split(regex);

  let renderedParts = [];
  for (let i = 0; i < parts.length;) {
    if (i % 4 === 0) {
      renderedParts.push(parts[i]);
      i++;
    } else {
      const whitespace = parts[i];
      const fullMention = parts[i + 1];
      const mentionName = parts[i + 2];

      const isCurrentUserMention = currentUserName && (mentionName.toLowerCase() === currentUserName.toLowerCase() || mentionName.toLowerCase() === currentUserName.replace(/\s+/g, '_').toLowerCase());

      let mentionClass = "text-blue-600 font-semibold";
      if (isCurrentUserMention && isCurrentUserMessage) {
        mentionClass = "text-white font-semibold";
      }

      renderedParts.push(
        <React.Fragment key={`mention-${i}`}>
          {whitespace}
          <strong className={mentionClass}>{fullMention}</strong>
        </React.Fragment>
      );
      i += 3;
    }
  }

  return renderedParts;
};


const ChatMessage = ({ msg, isCurrentUser, currentUser, onReply, onDelete, canDelete }: { msg: CaseStudyMessage, isCurrentUser: boolean, currentUser: User | null, onReply: () => void, onDelete: () => void, canDelete: boolean }) => {
  const isAdminMessage = msg.userRole === 'ADMIN' || msg.userRole === 'SYSTEM_ADMIN';

  const renderReplyHeader = () => {
    if (!msg.replyingTo) {
      if (isCurrentUser && msg.userName === currentUser?.name) return null;
      return (
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">{msg.userName}</p>
          {isAdminMessage && <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-blue-500"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>}
        </div>
      );
    }

    let replierName = <span className="font-semibold">{msg.userName}</span>;
    if (isCurrentUser) {
      replierName = <span className="font-semibold">You</span>;
    }

    const targetIsCurrentUser = currentUser?.name === msg.replyingTo.name;
    const targetName = targetIsCurrentUser ? 'You' : msg.replyingTo.name;

    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Reply className="h-3 w-3" />
        <div className="flex items-center gap-1.5">
          {replierName}
          {isAdminMessage && <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-blue-500"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>}
        </div>
        {' replied to '}
        <span className="font-semibold">{targetName}</span>
      </div>
    );
  };

  return (
    <div className={`group flex items-start gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
      <Avatar className="h-8 w-8 border">
        <AvatarImage src={msg.userAvatarUrl || undefined} alt={msg.userName} />
        <AvatarFallback>{getInitials(msg.userName)}</AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-2 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
          <div className={`flex flex-col gap-1.5 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
            {renderReplyHeader()}

            {msg.replyingTo && (
              <div className="max-w-xs rounded-2xl p-3 bg-muted/60 rounded-bl-none rounded-br-none relative opacity-80">
                <p className="text-xs italic truncate">"{msg.replyingTo.message}"</p>
              </div>
            )}

            {msg.imageUrl && (
              <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
                <div className="w-[250px] h-[250px] rounded-lg overflow-hidden border hover:border-primary transition-all">
                  <NextImage
                    src={msg.imageUrl}
                    alt="Uploaded image"
                    width={250}
                    height={250}
                    unoptimized={true}
                    className="object-cover w-full h-full"
                  />
                </div>
              </a>
            )}
            {msg.message && (
              <div className={`max-w-xs rounded-2xl p-3 ${isCurrentUser ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'} ${msg.replyingTo ? (isCurrentUser ? '!rounded-tr-md' : '!rounded-tl-md') : ''}`}>
                <p className="text-sm">{renderTextWithMentions(msg.message, isCurrentUser, currentUser?.name)}</p>
              </div>
            )}
            <span className="text-xs text-muted-foreground -mt-1">{format(parseISO(msg.timestamp), "h:mm a")}</span>
          </div>

          <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onReply}>
              <Reply className="h-4 w-4 text-muted-foreground" />
            </Button>
            {canDelete && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
};

export function CaseStudyDialog({ children }: CaseStudyDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CaseStudyMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ name: string; message: string } | null>(null);
  const { currentUser } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<'CR' | 'DR' | 'LR' | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageTextareaRef = useRef<HTMLInputElement>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeMentionStartIndex, setActiveMentionStartIndex] = useState<number | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<Array<User>>([]);

  const [messageToDelete, setMessageToDelete] = useState<CaseStudyMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    if (!currentUser) return;
    if (isAdmin) {
      if (!selectedTeam) setSelectedTeam('CR'); // Default for admin
    } else {
      const userRole = currentUser.role;
      if (userRole === 'CR') setSelectedTeam('CR');
      else if (isDrRole(userRole)) setSelectedTeam('DR');
      else if (userRole === 'LR') setSelectedTeam('LR');
      else setSelectedTeam(null); // No chat for other roles
    }
  }, [currentUser, isAdmin, selectedTeam]);

  const fetchMessagesAndUsers = useCallback(async (isAutoUpdate = false) => {
    if (!isOpen || !selectedTeam) return;
    if (!isAutoUpdate) setIsLoading(true);
    try {
      const [fetchedMessages, fetchedUsers] = await Promise.all([
        getMessagesAction(selectedTeam),
        getUsers()
      ]);
      setMessages(fetchedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      setAllUsers(fetchedUsers);
    } catch (error) {
      if (!isAutoUpdate) {
        toast({ title: "Error", description: "Could not load case study messages or user data.", variant: "destructive" });
      }
      console.error("Failed to fetch case study data:", error);
    } finally {
      if (!isAutoUpdate) setIsLoading(false);
    }
  }, [isOpen, selectedTeam, toast]);


  useEffect(() => {
    if (isOpen && selectedTeam) {
      fetchMessagesAndUsers();
    }
  }, [isOpen, selectedTeam, fetchMessagesAndUsers]);

  useEffect(() => {
    if (isOpen && selectedTeam) {
      const intervalId = setInterval(() => {
        fetchMessagesAndUsers(true);
      }, 15000); // 15 seconds

      return () => clearInterval(intervalId);
    }
  }, [isOpen, selectedTeam, fetchMessagesAndUsers]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleImageSelect = (file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Image too large", description: "Please select an image smaller than 5MB.", variant: "destructive" });
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !currentUser || !selectedTeam) return;
    setIsSending(true);

    let imageUrl: string | null = null;
    if (selectedImage) {
      const formData = new FormData();
      formData.append('file', selectedImage);
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (response.ok && result.success && result.file_url) {
          imageUrl = result.file_url;
        } else {
          throw new Error(result.message || 'Image upload failed');
        }
      } catch (error) {
        toast({ title: "Error uploading image", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
        setIsSending(false);
        return;
      }
    }

    const result = await addMessageAction(selectedTeam, newMessage, imageUrl, replyingTo, currentUser);

    if (result.success && result.message) {
      setMessages(prev => [...prev, result.message!].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      setNewMessage('');
      setReplyingTo(null);
      handleImageSelect(null);
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setIsSending(false);
  };

  const handleTextChangeForMention = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setNewMessage(text);
    const cursorPosition = e.target.selectionStart;
    if (cursorPosition === null) {
      setMentionQuery(null); setActiveMentionStartIndex(null); setMentionSuggestions([]); return;
    }
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtSymbolIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtSymbolIndex !== -1) {
      const textAfterAt = text.substring(lastAtSymbolIndex + 1, cursorPosition);
      const isAtStartOfWord = lastAtSymbolIndex === 0 || (lastAtSymbolIndex > 0 && /\s/.test(textBeforeCursor[lastAtSymbolIndex - 1]));
      if (isAtStartOfWord && /^[a-zA-Z0-9_]*$/.test(textAfterAt)) {
        setMentionQuery(textAfterAt); setActiveMentionStartIndex(lastAtSymbolIndex);

        const teamRoleMapping: Record<TeamType, UserRole> = {
          CR: 'CR',
          DR: 'DR_TEAM',
          LR: 'LR'
        };

        const relevantRole = teamRoleMapping[selectedTeam!];

        const usersToSearchFromProp = (Array.isArray(allUsers) ? allUsers : [])
          .filter(user =>
            user.id !== currentUser?.id && // Exclude current user
            (user.role === relevantRole ||
              user.role === 'ADMIN' ||
              user.role === 'SYSTEM_ADMIN')
          );

        const filtered = usersToSearchFromProp.filter(user => user.name.toLowerCase().includes(textAfterAt.toLowerCase())).slice(0, 5);
        setMentionSuggestions(filtered); return;
      }
    }
    setMentionQuery(null); setActiveMentionStartIndex(null); setMentionSuggestions([]);
  };

  const handleMentionSelect = (userNameToInsert: string) => {
    if (activeMentionStartIndex === null || !messageTextareaRef.current) return;
    const text = newMessage;
    const mentionTag = userNameToInsert.replace(/\s+/g, '_');
    const queryLength = mentionQuery?.length || 0;
    const textBeforeAt = text.substring(0, activeMentionStartIndex);
    const textAfterMentionQuery = text.substring(activeMentionStartIndex + 1 + queryLength);
    const newText = `${textBeforeAt}@${mentionTag} ${textAfterMentionQuery.trimStart()}`;
    setNewMessage(newText);
    const newCursorPosition = activeMentionStartIndex + 1 + mentionTag.length + 1;
    setTimeout(() => {
      if (messageTextareaRef.current) {
        messageTextareaRef.current.focus();
        messageTextareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
    setMentionQuery(null); setActiveMentionStartIndex(null); setMentionSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && mentionSuggestions.length === 0) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfirmDelete = async () => {
    if (!messageToDelete || !selectedTeam) return;
    setIsDeleting(true);
    const result = await deleteMessageAction(selectedTeam, messageToDelete.id);
    if (result.success) {
      toast({ title: "Message Deleted" });
      setMessages(prev => prev.filter(m => m.id !== messageToDelete.id));
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setIsDeleting(false);
    setMessageToDelete(null);
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Case Study Discussion</DialogTitle>
          <div className="flex items-center justify-between">
            <DialogDescription>
              A group chat about a recent successful project.
            </DialogDescription>
            {isAdmin && selectedTeam && (
              <Select value={selectedTeam} onValueChange={(value) => setSelectedTeam(value as 'CR' | 'DR' | 'LR')}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Select Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CR">CR Team</SelectItem>
                  <SelectItem value="DR">DR Team</SelectItem>
                  <SelectItem value="LR">LR Team</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </DialogHeader>
        <div className="flex flex-col h-[60vh]">
          <ScrollArea className="flex-1" ref={scrollAreaRef}>
            <div className="p-4 pt-0">
              {isLoading ? (
                <div className="space-y-6 pt-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`flex items-start gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex flex-col gap-1 w-2/3">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedTeam && messages.length > 0 ? (
                <div className="space-y-6 pt-4">
                  {messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      msg={msg}
                      isCurrentUser={msg.userId === currentUser?.id}
                      currentUser={currentUser}
                      onReply={() => setReplyingTo({ name: msg.userName, message: msg.message || 'Image' })}
                      onDelete={() => setMessageToDelete(msg)}
                      canDelete={isAdmin}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground pt-4">
                  <BookText className="h-16 w-16 opacity-30 mb-4" />
                  <p className="font-medium">No Discussions Yet</p>
                  <p className="text-sm">
                    {selectedTeam ? `Be the first to start a conversation for the ${selectedTeam} team.` : "No chat available for your role."}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
          {selectedTeam && (
            <>
              <Separator />
              <div className="p-4 bg-background">
                {replyingTo && (
                  <div className="bg-muted p-2 rounded-t-lg border-b border-border/50 text-xs text-muted-foreground relative">
                    <div className="flex items-center">
                      <Reply className="h-3 w-3 mr-2" />
                      <p>Replying to <span className="font-semibold text-foreground">{replyingTo.name}</span></p>
                    </div>
                    <p className="pl-5 truncate italic">"{replyingTo.message}"</p>
                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setReplyingTo(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {imagePreview && (
                  <div className="relative mb-2 p-2 border bg-muted rounded-t-lg">
                    <NextImage
                      src={imagePreview}
                      alt="Image preview"
                      width={80}
                      height={80}
                      unoptimized={true}
                      className="object-cover w-20 h-20"
                    />
                    <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6 bg-black/50 text-white hover:bg-black/70" onClick={() => handleImageSelect(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="relative flex items-center gap-2">
                  <Avatar className="h-9 w-9 border flex-shrink-0">
                    <AvatarImage src={currentUser?.avatarUrl || undefined} alt={currentUser?.name} />
                    <AvatarFallback>{getInitials(currentUser?.name)}</AvatarFallback>
                  </Avatar>
                  <Popover open={mentionQuery !== null && mentionSuggestions.length > 0} onOpenChange={(open) => { if (!open) { setMentionQuery(null); setActiveMentionStartIndex(null); setMentionSuggestions([]); } }}>
                    <PopoverAnchor asChild>
                      <div className="relative flex-1">
                        <Input
                          ref={messageTextareaRef}
                          placeholder="Type a message..."
                          className={`pr-20 ${replyingTo ? 'rounded-t-none' : ''}`}
                          value={newMessage}
                          onChange={handleTextChangeForMention}
                          onKeyDown={handleKeyDown}
                          disabled={isSending}
                          maxLength={2000}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center">
                          <Button variant="ghost" size="icon" disabled={isSending} onClick={() => fileInputRef.current?.click()}>
                            <Paperclip className="h-5 w-5" />
                          </Button>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e.target.files?.[0] || null)} />
                          <Button variant="ghost" size="icon" className="text-primary hover:text-primary/90" onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !selectedImage)}>
                            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                          </Button>
                        </div>
                      </div>
                    </PopoverAnchor>
                    {mentionQuery !== null && mentionSuggestions.length > 0 && (
                      <PopoverContent className="w-[250px] p-0" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                        <Command>
                          <CommandList>
                            {mentionSuggestions.map((user) => (
                              <CommandItem key={user.id} value={user.name} onSelect={() => handleMentionSelect(user.name)} className="cursor-pointer flex items-center gap-2">
                                <Avatar className="h-6 w-6 text-xs"><AvatarImage src={user.avatarUrl || undefined} /><AvatarFallback className="bg-muted text-xs">{getInitials(user.name)}</AvatarFallback></Avatar>
                                <span className="text-xs font-medium">{user.name}</span>
                                {(user.role === 'ADMIN' || user.role === 'SYSTEM_ADMIN') && (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-blue-500"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>
                                )}
                              </CommandItem>
                            ))}
                          </CommandList>
                          {mentionSuggestions.length === 0 && mentionQuery && (
                            <CommandEmpty>No users found matching "@{mentionQuery}"</CommandEmpty>
                          )}
                        </Command>
                      </PopoverContent>
                    )}
                  </Popover>
                </div>
              </div>
            </>
          )}
        </div>
        {messageToDelete && (
          <AlertDialog open={!!messageToDelete} onOpenChange={() => setMessageToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Delete Message?</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete this message? This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="p-4 bg-muted rounded-md border text-sm text-muted-foreground italic">"{messageToDelete.message}"</div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setMessageToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
                  {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...</> : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
