
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Info, RefreshCw, XCircle, User, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TrashDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  items?: any[];
  isLoading?: boolean;
  onRestore?: (id: string) => Promise<void>;
  onDeletePermanently?: (id: string) => Promise<void>;
}

export function TrashDialog({
  isOpen,
  onOpenChange,
  title = "Trash Bin",
  items = [],
  isLoading = false,
  onRestore,
  onDeletePermanently
}: TrashDialogProps) {
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl bg-background/95 backdrop-blur-md">
        <div className="bg-destructive/10 p-6 border-b border-destructive/20 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                <Trash2 className="h-24 w-24" />
             </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-3">
                <div className="bg-destructive/20 p-2 rounded-full">
                    <Trash2 className="h-6 w-6 text-destructive" />
                </div>
                <div>
                   <DialogTitle className="text-2xl font-bold tracking-tight">{title}</DialogTitle>
                   <DialogDescription className="text-muted-foreground/80 mt-1">
                      View and manage items that have been moved to the trash.
                   </DialogDescription>
                </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6">
          <ScrollArea className="h-[450px] pr-4 -mr-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground font-medium italic">Scanning for deleted records... </p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 space-y-4 text-center">
                 <div className="bg-muted p-4 rounded-full">
                    <XCircle className="h-10 w-10 text-muted-foreground opacity-40" />
                 </div>
                <div className="space-y-1">
                    <p className="text-lg font-semibold text-foreground/80">Trash is Empty</p>
                    <p className="text-sm text-muted-foreground max-w-[280px]">
                      No deleted items were found in the database. Permanently deleted records cannot be recovered.
                    </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pb-2">
                {items.map((item, index) => (
                  <Card key={index} className="p-4 flex items-center justify-between border-border/40 bg-card/50 hover:border-primary/30 hover:bg-muted/40 transition-all duration-200 shadow-sm first:mt-1 last:mb-1">
                      <div className="space-y-2 flex-grow">
                         <div className="flex items-center gap-2">
                           <p className="font-bold text-base text-foreground leading-none">{item.id}</p>
                           <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase font-medium tracking-wider">
                             Soft Deleted
                           </span>
                         </div>
                         <p className="text-sm text-foreground/80 font-medium line-clamp-1">{item.companyName || 'No Name'}</p>
                         <div className="flex flex-wrap items-center gap-3 mt-1">
                             {item.deletedByName && (
                               <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-secondary/40 pr-3 pl-1 py-1 rounded-full border border-border/40 shadow-sm transition-colors hover:bg-secondary/60">
                                  <Avatar className="h-5 w-5 border border-background shadow-xs">
                                     <AvatarImage src={item.deletedByAvatarUrl || undefined} />
                                     <AvatarFallback className="bg-primary/20 text-[8px] text-primary font-bold">
                                        {item.deletedByName?.charAt(0).toUpperCase() || <User className="h-2 w-2" />}
                                     </AvatarFallback>
                                  </Avatar>
                                  <span>Deleted by <span className="font-semibold text-foreground/90">{item.deletedByName}</span></span>
                               </div>
                             )}
                            {item.deletedAt && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-full">
                                 <Calendar className="h-3 w-3" />
                                 <span>On: <span className="font-medium text-foreground/70">
                                   {(() => {
                                     try {
                                       const date = typeof item.deletedAt === 'string' ? parseISO(item.deletedAt) : item.deletedAt;
                                       return format(date, "MMM dd, yyyy • hh:mm a");
                                     } catch (e) {
                                       return 'Unknown date';
                                     }
                                   })()}
                                 </span></span>
                              </div>
                            )}
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="h-8 text-xs font-semibold"
                           disabled={!!processingId}
                           onClick={async () => {
                             if (onRestore) {
                               setProcessingId(item.id);
                               await onRestore(item.id);
                               setProcessingId(null);
                             }
                           }}
                         >
                           {processingId === item.id ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                           Restore
                         </Button>
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                disabled={!!processingId}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                           </AlertDialogTrigger>
                           <AlertDialogContent>
                             <AlertDialogHeader>
                               <AlertDialogTitle>Permanently delete this item?</AlertDialogTitle>
                               <AlertDialogDescription>
                                 This action cannot be undone. This item will be permanently removed from the database.
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                               <AlertDialogCancel disabled={!!processingId}>Cancel</AlertDialogCancel>
                               <AlertDialogAction 
                                 className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                 disabled={!!processingId}
                                 onClick={async () => {
                                   if (onDeletePermanently) {
                                     setProcessingId(item.id);
                                     await onDeletePermanently(item.id);
                                     setProcessingId(null);
                                   }
                                 }}
                               >
                                 Delete Permanently
                               </AlertDialogAction>
                             </AlertDialogFooter>
                           </AlertDialogContent>
                         </AlertDialog>
                      </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
             <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>Trash is cleared automatically after 30 days.</span>
             </div>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onOpenChange(false)}
                className="font-medium"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
