
"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '../ui/input';
import { Search, PlusCircle, Loader2, MoreVertical, Edit, Trash2, AlertTriangle, Bold, Italic, Link as LinkIcon, List, ListOrdered, Code, Quote } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types';
import { getFaqs, type Faq } from '@/lib/faq-service';
import { addFaqAction, updateFaqAction, deleteFaqAction } from '@/app/(app)/faq/actions';
import { Skeleton } from '../ui/skeleton';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Separator } from '../ui/separator';
import { DR_ROLES } from '@/lib/roles';

interface FaqDialogProps {
  children: React.ReactNode;
}

const ALL_USER_ROLES: UserRole[] = ["CR", ...DR_ROLES, "LR"];

function AddEditFaqDialog({ 
    isOpen, 
    onOpenChange, 
    onFaqSaved, 
    faqToEdit 
}: { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void; 
    onFaqSaved: () => void;
    faqToEdit: Faq | null;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'ALL'>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const answerTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const isEditMode = !!faqToEdit;

  useEffect(() => {
    if (isOpen) {
        if (isEditMode && faqToEdit) {
            setQuestion(faqToEdit.question);
            setAnswer(faqToEdit.answer);
            setSelectedRole(faqToEdit.role);
        } else {
            setQuestion('');
            setAnswer('');
            setSelectedRole('ALL');
        }
    }
  }, [isOpen, faqToEdit, isEditMode]);

  const insertMarkdown = (syntax: { prefix: string; suffix?: string, placeholder: string }) => {
    const textarea = answerTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = answer.substring(start, end);
    const placeholder = selectedText || syntax.placeholder;

    const newText = 
      answer.substring(0, start) +
      syntax.prefix +
      placeholder +
      (syntax.suffix || '') +
      answer.substring(end);

    setAnswer(newText);

    // Focus and select the placeholder text
    setTimeout(() => {
      textarea.focus();
      const newStart = start + syntax.prefix.length;
      const newEnd = newStart + placeholder.length;
      textarea.setSelectionRange(newStart, newEnd);
    }, 0);
  };
  
  const markdownToolbarActions = [
    { icon: Bold, onClick: () => insertMarkdown({ prefix: '**', suffix: '**', placeholder: 'Bold Text' }), label: 'Bold' },
    { icon: Italic, onClick: () => insertMarkdown({ prefix: '_', suffix: '_', placeholder: 'Italic Text' }), label: 'Italic' },
    { icon: LinkIcon, onClick: () => insertMarkdown({ prefix: '[', suffix: '](https://)', placeholder: 'Link Text' }), label: 'Link' },
    { icon: List, onClick: () => insertMarkdown({ prefix: '\n- ', placeholder: 'List Item' }), label: 'Unordered List' },
    { icon: ListOrdered, onClick: () => insertMarkdown({ prefix: '\n1. ', placeholder: 'List Item' }), label: 'Ordered List' },
    { icon: Code, onClick: () => insertMarkdown({ prefix: '`', suffix: '`', placeholder: 'Code' }), label: 'Code' },
    { icon: Quote, onClick: () => insertMarkdown({ prefix: '> ', placeholder: 'Quote' }), label: 'Blockquote' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast({ title: "Validation Error", description: "Question and Answer fields are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    let result;
    if (isEditMode && faqToEdit) {
        result = await updateFaqAction(faqToEdit.id, question, answer, selectedRole);
    } else {
        result = await addFaqAction(question, answer, selectedRole);
    }

    if (result.success) {
      toast({ title: "Success", description: `FAQ has been ${isEditMode ? 'updated' : 'added'}.` });
      setIsSubmitting(false);
      onFaqSaved();
      onOpenChange(false);
    } else {
      toast({ title: "Error", description: result.error || `Could not ${isEditMode ? 'update' : 'add'} FAQ.`, variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} FAQ</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update this question and answer.' : 'Create a new question and answer pair.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="faq-question">Question</Label>
            <Input id="faq-question" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Enter the question" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="faq-answer">Answer</Label>
            <div className="border rounded-md">
                <div className="p-1 border-b bg-muted/50 flex items-center gap-1">
                   {markdownToolbarActions.map((action, index) => (
                       <Button key={index} type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={action.onClick} title={action.label}>
                         <action.icon className="h-4 w-4" />
                       </Button>
                   ))}
                </div>
                <Textarea 
                  id="faq-answer" 
                  ref={answerTextareaRef}
                  value={answer} 
                  onChange={e => setAnswer(e.target.value)} 
                  placeholder="Provide the answer. Markdown is supported." 
                  required 
                  className="min-h-[150px] border-0 rounded-t-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
            </div>
            <p className="text-xs text-muted-foreground">Markdown is supported for formatting.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="faq-role">Visible To</Label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole | 'ALL')}>
              <SelectTrigger id="faq-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                 <SelectGroup>
                    <SelectItem value="ALL">All Roles</SelectItem>
                    {ALL_USER_ROLES.map(role => (
                      <SelectItem key={role} value={role}>{role.replace(/_/g, ' ')}</SelectItem>
                    ))}
                 </SelectGroup>
              </SelectContent>
            </Select>
          </div>
           <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>{isEditMode ? 'Saving...' : 'Adding...'}</> : (isEditMode ? 'Save Changes' : 'Add FAQ')}
              </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export function FaqDialog({ children }: FaqDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [allFaqs, setAllFaqs] = useState<Faq[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { currentUser } = useAuth();
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [faqToEdit, setFaqToEdit] = useState<Faq | null>(null);
  const [faqToDelete, setFaqToDelete] = useState<Faq | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  const fetchFaqs = useCallback(async () => {
    setIsLoading(true);
    try {
      const faqs = await getFaqs();
      setAllFaqs(faqs);
    } catch (error) {
      toast({ title: "Error", description: "Could not load FAQs.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  const handleDialogOpen = (open: boolean) => {
    if (open && allFaqs.length === 0) {
      fetchFaqs();
    }
  }

  const filteredFaqs = useMemo(() => {
    const roleFiltered = allFaqs.filter(faq => {
      if (faq.role === 'ALL') return true;
      if (currentUser?.role && faq.role === currentUser.role) return true;
      if (currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN') return true;
      return false;
    });

    if (!searchTerm) {
      return roleFiltered;
    }
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return roleFiltered.filter(
      faq =>
        faq.question.toLowerCase().includes(lowercasedSearchTerm) ||
        faq.answer.toLowerCase().includes(lowercasedSearchTerm)
    );
  }, [searchTerm, allFaqs, currentUser]);
  
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';
  
  const handleOpenAddDialog = () => {
    setFaqToEdit(null);
    setIsAddEditDialogOpen(true);
  };
  
  const handleOpenEditDialog = (faq: Faq) => {
    setFaqToEdit(faq);
    setIsAddEditDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!faqToDelete) return;
    setIsDeleting(true);
    const result = await deleteFaqAction(faqToDelete.id);
    if (result.success) {
      toast({ title: "FAQ Deleted", description: "The FAQ has been removed." });
      fetchFaqs();
    } else {
      toast({ title: "Error", description: result.error || "Could not delete FAQ.", variant: "destructive" });
    }
    setIsDeleting(false);
    setFaqToDelete(null);
  };

  return (
    <>
      <Dialog onOpenChange={handleDialogOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 bg-gray-50 dark:bg-gray-900">
          <DialogHeader className="p-6 pb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <DialogTitle className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                Dialogue
              </DialogTitle>
              <div className="flex w-full sm:w-auto items-center gap-2">
                  <div className="relative flex-grow sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                          placeholder="Search questions..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="pl-10 h-10 rounded-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      />
                  </div>
                  {isAdmin && (
                      <Button variant="outline" size="sm" className="h-10 rounded-full shrink-0" onClick={handleOpenAddDialog}>
                          <PlusCircle className="h-4 w-4 mr-1 sm:mr-2"/>
                          <span className="hidden sm:inline">Add New</span>
                      </Button>
                  )}
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="p-6 pt-0">
              {isLoading ? (
                 <div className="w-full space-y-3">
                   {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                 </div>
              ) : filteredFaqs.length > 0 ? (
                <Accordion type="single" collapsible className="w-full space-y-3">
                  {filteredFaqs.map((faq, index) => (
                    <div key={faq.id} className="group relative bg-white dark:bg-gray-800/50 rounded-lg shadow-sm border border-gray-200/80 dark:border-gray-700/50">
                        <AccordionItem value={`item-${index}`} className="border-b-0">
                            <AccordionTrigger className="px-6 py-4 text-left font-semibold text-gray-700 dark:text-gray-200 hover:no-underline [&>svg]:text-primary">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="px-6 text-gray-600 dark:text-gray-300">
                              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{faq.answer}</ReactMarkdown>
                              </div>
                            </AccordionContent>
                        </AccordionItem>
                        {isAdmin && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => handleOpenEditDialog(faq)} className="cursor-pointer">
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setFaqToDelete(faq)} className="cursor-pointer text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                               </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                    </div>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <p className="font-semibold">No questions found.</p>
                  <p className="text-sm">Try adjusting your search term or check back later.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <AddEditFaqDialog isOpen={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen} onFaqSaved={fetchFaqs} faqToEdit={faqToEdit} />
      {faqToDelete && (
        <AlertDialog open={!!faqToDelete} onOpenChange={() => setFaqToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" /> Are you sure?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action will permanently delete the FAQ: "<span className="font-semibold">{faqToDelete.question}</span>". This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting} onClick={() => setFaqToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Deleting...</> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
