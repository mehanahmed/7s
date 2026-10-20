
"use client";

import React, { useState, useEffect, useCallback, FormEvent, useRef, useMemo } from 'react';
import Image from 'next/image';
import Lottie from 'lottie-react';
import infoAnimation from '../../../../public/info-animation.json';
import courierAnimation from '../../../../public/courier.json';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send, Package, CalendarDays, Clock, CheckCircle, Copy, Info, Phone, Building, MapPin, Layers, Heart, ChevronDown, ChevronUp, MessageCircle, UserCheck, Landmark, Loader2, AlertTriangle, StickyNote, Percent, ReceiptText, Truck, Trash2, Paperclip, FileImage, FileText, X, ArrowLeft, CreditCard, Wallet, Check, UploadCloud, Gift } from "lucide-react";
import JsBarcode from 'jsbarcode';
import type { Comment, CustomStatus, TrackingLink, User, UserRole, OrderItem, AdvancePaymentRecord } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { getStatusById } from '@/lib/status-service';
import { getContrastTextColor } from '@/lib/color-utils';
import { submitCommentAction, submitClientReplyAction, toggleOrderCommentReactionAction, submitReplyAction, getPackzyDeliveryStatusAction, deleteCommentAction, approveOrderAction, submitPaymentProofAction, removeOrderApprovalAction, hasPendingClientPaymentAction, getOrderByIdAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { v4 as uuidv4 } from 'uuid';
import { motion } from 'framer-motion';
import { formatDistanceToNowStrict, parseISO, format as formatDateFns } from 'date-fns';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import NextLink from 'next/link';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ClientInvoicePDF } from '@/components/invoices/ClientInvoicePDF';
import { TornPaperTerms } from '@/components/invoices/TornPaperTerms';
import { PaymentProofCell } from '@/components/common/PaymentProofCell';
import { isDrRole, DR_ROLES } from '@/lib/roles';


const CLIENT_AVATAR_URL = 'https://i.ibb.co/7dphf0LX/avatar-with-a-young-face-pictures-of-men-vector-46356734.jpg';

const getInitials = (name: string | undefined): string => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BDT' }).format(value);
};

const formatDate = (dateString: string | undefined, relative: boolean = false, includeTime: boolean = true) => {
  if (!dateString) return "Loading date...";
  try {
    const date = parseISO(dateString);
    if (relative) {
      return formatDistanceToNowStrict(date, { addSuffix: true });
    }
    // Using a consistent format string avoids locale-based hydration mismatches
    const formatStr = includeTime ? "d MMM yyyy, h:mm a" : "d MMM yyyy";
    return formatDateFns(parseISO(dateString), formatStr);
  } catch (e) {
    return "Invalid Date";
  }
};

const DESIGN_W = 794; // A4 at 96dpi: the page is drawn at this width and scaled down on small screens
const BLUE = '#4b5fa5';

const formatShortDate = (dateString: string | undefined) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}, ${d.getFullYear()}`;
  } catch { return ''; }
};

const numberOnly = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};
const tk = (n: number | string | null | undefined) => `TK ${numberOnly(Number(n) || 0)}`;

/** Grey hairline with a short blue segment on the left. */
function Rule() {
  return (
    <div className="relative h-[3px] w-full bg-[#c8c8cc]">
      <span className="absolute left-0 top-0 h-full w-[84px]" style={{ background: BLUE }} />
    </div>
  );
}

function TotalRow({ label, value, blue }: { label: string; value: string; blue?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 text-[12px] font-bold" style={{ lineHeight: '33px' }}>
      <span style={blue ? { color: BLUE } : undefined}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

const MAX_INITIAL_REPLIES_TO_SHOW = 1;

interface OrderDetailsClientProps {
  order: TrackingLink;
  allStatuses: CustomStatus[];
  allUsersForMentions?: User[];
  areCommentsVisible: boolean;
  rolesAllowedToViewFinancials: UserRole[]; // New prop
  initialCurrentUser: User | null; // New prop for server-passed user
  hideStatusHeader?: boolean;
  designApprovalStatusIds?: string[];
  docsApprovalStatusIds?: string[];
  isOnlinePaymentEnabled?: boolean;
}

export function OrderDetailsClient({
  order: initialOrder,
  allStatuses,
  allUsersForMentions = [],
  areCommentsVisible,
  rolesAllowedToViewFinancials,
  initialCurrentUser,
  hideStatusHeader = false,
  designApprovalStatusIds = [],
  docsApprovalStatusIds = [],
  isOnlinePaymentEnabled = false
}: OrderDetailsClientProps) {
  const { currentUser: authContextUser } = useAuth();
  const { socket } = useSocket();
  const [order, setOrder] = useState(initialOrder);
  const [isClient, setIsClient] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<'summary' | 'payment-methods' | 'payment-proof' | 'terms'>('summary');
  const [proofFileUrl, setProofFileUrl] = useState<string | null>(null);
  const [isUploadingProofFile, setIsUploadingProofFile] = useState(false);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'wallets' | 'banks'>('wallets');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const { toast } = useToast();
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(id);
      toast({ title: "Copied!", description: `Number ${text} copied to clipboard.` });
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const [replyingTo, setReplyingTo] = useState<{ parentId: string; targetName: string; formUnderId: string } | null>(null);
  const [currentReplyText, setCurrentReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const [clientReactorId, setClientReactorId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeMentionStartIndex, setActiveMentionStartIndex] = useState<number | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<Array<User | { id: string, name: string, role: 'Client' | UserRole }>>([]);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pageHeight, setPageHeight] = useState(1123);

  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / DESIGN_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = invoiceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPageHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [packzyStatus, setPackzyStatus] = useState<string | null>(null);
  const [isLoadingPackzyStatus, setIsLoadingPackzyStatus] = useState(false);

  const [commentToDelete, setCommentToDelete] = useState<{ id: string; isReply: boolean; parentId?: string; text: string; } | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const [showApproveButton, setShowApproveButton] = useState(false);
  const [previewDocumentUrl, setPreviewDocumentUrl] = useState<string | null>(null);

  const [designChecked, setDesignChecked] = useState(false);
  const [paymentChecked, setPaymentChecked] = useState(false);
  const [noModificationChecked, setNoModificationChecked] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [hasPendingClientPayment, setHasPendingClientPayment] = useState(false);

  useEffect(() => {
    if (!socket || !order?.id) return;

    const handleOrderUpdated = async (data: any) => {
      if (data && data.id === order.id) {
        console.log(`Order ${order.id} updated remotely. Refreshing details...`);
        try {
          const freshOrder = await getOrderByIdAction(order.id);
          if (freshOrder) {
            setOrder(freshOrder);
          }
        } catch (error) {
          console.error("Failed to fetch fresh order details on socket update:", error);
        }
      }
    };

    socket.on("order-updated", handleOrderUpdated);

    return () => {
      socket.off("order-updated", handleOrderUpdated);
    };
  }, [socket, order?.id]);

  const getStatusDisplayInfo = useCallback((statusId: string): { name: string; color: string; textColor: string } => {
    const status = allStatuses.find(s => s.id === statusId);
    if (status) {
      return { name: status.name, color: status.color, textColor: getContrastTextColor(status.color) };
    }
    return { name: statusId, color: '#A1A1AA', textColor: '#FFFFFF' };
  }, [allStatuses]);

  const currentStatusInfo = useMemo(() => {
    const info = getStatusDisplayInfo(order.currentStatus);
    const isDocsStatus = docsApprovalStatusIds && docsApprovalStatusIds.length > 0
      ? docsApprovalStatusIds.includes(order.currentStatus)
      : order.currentStatus === 'co-clearance';
    const hasDocsApprovedLog = order.statusHistory && order.statusHistory.some(entry => {
      const entryIsDocs = docsApprovalStatusIds && docsApprovalStatusIds.length > 0
        ? docsApprovalStatusIds.includes(entry.status)
        : entry.status === 'co-clearance';
      return entryIsDocs && entry.notes === 'Terms accepted and documents approved by client.';
    });
    if (isDocsStatus && hasDocsApprovedLog) {
      return { ...info, name: 'Docs Approved' };
    }
    const hasDesignApprovedLog = order.statusHistory && order.statusHistory.some(entry => entry.notes === 'Terms accepted and design approved by client.');
    const isDesignStatus = designApprovalStatusIds && designApprovalStatusIds.length > 0
      ? designApprovalStatusIds.includes(order.currentStatus)
      : (info.name === 'DR Assigned' || info.name === 'On Design' || order.currentStatus === 'ready-for-design' || order.currentStatus.toLowerCase().includes('design') || order.currentStatus === 'on-hold');
    if (hasDesignApprovedLog && isDesignStatus) {
      return { ...info, name: 'Design Approved' };
    }
    return info;
  }, [getStatusDisplayInfo, order.currentStatus, order.statusHistory, docsApprovalStatusIds, designApprovalStatusIds]);

  const isClearance = useMemo(() => {
    if (docsApprovalStatusIds && docsApprovalStatusIds.length > 0) {
      return docsApprovalStatusIds.includes(order.currentStatus);
    }
    const statusName = currentStatusInfo.name.toLowerCase();
    const statusId = order.currentStatus.toLowerCase();
    return statusName.includes("cr clearance") ||
      statusName.includes("co clearance") ||
      statusId.includes("cr_clearance") ||
      statusId.includes("co_clearance") ||
      statusId.includes("cr-clearance") ||
      statusId.includes("co-clearance") ||
      statusId.includes("cr clearance") ||
      statusId.includes("co clearance");
  }, [currentStatusInfo, order.currentStatus, docsApprovalStatusIds]);

  const isCoClearance = useMemo(() => {
    if (docsApprovalStatusIds && docsApprovalStatusIds.length > 0) {
      return docsApprovalStatusIds.includes(order.currentStatus);
    }
    const statusName = currentStatusInfo.name.toLowerCase();
    const statusId = order.currentStatus.toLowerCase();
    return statusName.includes("co clearance") ||
      statusId.includes("co_clearance") ||
      statusId.includes("co-clearance") ||
      statusId.includes("co clearance");
  }, [currentStatusInfo, order.currentStatus, docsApprovalStatusIds]);

  const isDocsApproved = useMemo(() => {
    return order.statusHistory && order.statusHistory.some(entry => entry.changedByUserId === 'client-approved-docs');
  }, [order.statusHistory]);

  const isDesignApproved = useMemo(() => {
    const legacyApprovedStatuses = ['approved-for-production', 'in-production', 'quality-check', 'logistics', 'shipped', 'delivered'];
    return legacyApprovedStatuses.includes(order.currentStatus) ||
      (order.statusHistory && order.statusHistory.some(entry => entry.changedByUserId === 'client-approved-design'));
  }, [order.currentStatus, order.statusHistory]);

  const isApproved = useMemo(() => {
    if (isClearance) {
      return isDocsApproved;
    } else {
      return isDesignApproved;
    }
  }, [isClearance, isDocsApproved, isDesignApproved]);

  const allowsApproval = useMemo(() => {
    if ((docsApprovalStatusIds && docsApprovalStatusIds.length > 0) || (designApprovalStatusIds && designApprovalStatusIds.length > 0)) {
      const docs = docsApprovalStatusIds || [];
      const design = designApprovalStatusIds || [];
      return docs.includes(order.currentStatus) || design.includes(order.currentStatus);
    }
    const statusId = order.currentStatus;
    const statusName = currentStatusInfo.name;
    return statusId === 'co-clearance' || statusName === 'CO Clearance' ||
           statusId === 'ready-for-design' || statusName === 'On Design' ||
           statusId === 'on-hold' || statusName === 'On Hold';
  }, [order.currentStatus, currentStatusInfo.name, docsApprovalStatusIds, designApprovalStatusIds]);

  const handleApproveOrder = async () => {
    if (!hasRequiredPayment && dialogStep !== 'terms') {
      toast({ title: "Insufficient Payment", description: `Required 50% payment for approval. Current payment is ${paymentPercentage.toFixed(1)}%.`, variant: "destructive" });
      return;
    }

    if (!designChecked || !paymentChecked || !noModificationChecked) {
      toast({ title: "Please accept all terms", description: "You must check all options to approve the order.", variant: "destructive" });
      return;
    }

    setIsApproving(true);
    const result = await approveOrderAction(order.id);
    setIsApproving(false);

    if ('error' in result) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      setOrder(result);
      toast({ title: "Order Approved", description: "Thank you! The order has been approved and moved to production." });
      setIsApprovalDialogOpen(false);
    }
  };

  const handleRemoveApprovalClick = async () => {
    if (currentUser?.role !== 'SYSTEM_ADMIN') return;

    if (window.confirm("Are you sure you want to remove the client's approval for this order?")) {
      try {
        const result = await removeOrderApprovalAction(order.id);
        if ('error' in result) {
          toast({ title: 'Failed to remove approval', description: result.error, variant: 'destructive' });
        } else {
          setOrder(result);
          toast({ title: 'Approval Removed', description: "The client's approval has been successfully removed." });
        }
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: "An error occurred while removing approval.", variant: 'destructive' });
      }
    }
  };

  // Combine server-passed user and client-side user for the most up-to-date state
  const currentUser = useMemo(() => authContextUser || initialCurrentUser, [authContextUser, initialCurrentUser]);
  const isClientViewer = !currentUser || currentUser.role === 'Client';

  const shouldShowFinancials = useMemo(() => {
    if (!currentUser || currentUser.role === 'Client') {
      // Clients tracking their order should see financials.
      return true;
    }
    // For logged-in users, check their role against the permission list
    // System Admins always see everything
    if (currentUser.role === 'SYSTEM_ADMIN') return true;
    return rolesAllowedToViewFinancials?.includes(currentUser.role);
  }, [currentUser, rolesAllowedToViewFinancials]);


  useEffect(() => {
    if (barcodeRef.current && order.id) {
      try {
        JsBarcode(barcodeRef.current, order.id, {
          format: "CODE128",
          displayValue: false,
          width: (currentUser || isDesktop) ? 1.4 : 0.7,
          height: (currentUser || isDesktop) ? 30 : 15,
          margin: (currentUser || isDesktop) ? 2 : 1,
        });
      } catch (e) {
        console.error("JsBarcode error:", e);
      }
    }
  }, [order.id, currentUser, isDesktop]);

  useEffect(() => {
    setIsClient(true);
    setOrder(initialOrder);

    const checkViewport = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);

    let storedReactorId = localStorage.getItem('CLIENT_REACTOR_ID_KEY');
    if (!storedReactorId) {
      storedReactorId = uuidv4();
      localStorage.setItem('CLIENT_REACTOR_ID_KEY', storedReactorId);
    }
    setClientReactorId(storedReactorId);

    if (window.location.hash === '#approve') {
      setShowApproveButton(true);
      // Use timeout to ensure the element is rendered before scrolling
      setTimeout(() => {
        const approveSection = document.getElementById('approve');
        if (approveSection) {
          approveSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }

    const fetchPackzyStatus = async () => {
      if (initialOrder.packzyTrackingCode) {
        setIsLoadingPackzyStatus(true);
        const result = await getPackzyDeliveryStatusAction(initialOrder.packzyTrackingCode);
        if ('delivery_status' in result) {
          setPackzyStatus(result.delivery_status);
        } else {
          console.warn("Could not fetch Steadfast status:", result.error);
          setPackzyStatus('unavailable'); // To prevent re-fetching on error
        }
        setIsLoadingPackzyStatus(false);
      }
    };
    fetchPackzyStatus();

    return () => {
      window.removeEventListener('resize', checkViewport);
    };
  }, [initialOrder]);

  useEffect(() => {
    const checkPendingClientPayment = async () => {
      if (order?.id) {
        try {
          const res = await hasPendingClientPaymentAction(order.id);
          setHasPendingClientPayment(res);
        } catch (err) {
          console.error("Failed to check pending client payments:", err);
        }
      }
    };
    checkPendingClientPayment();
  }, [order]);

  useEffect(() => {
    if (!isApprovalDialogOpen) {
      setDialogStep('summary');
      setPaymentTab('wallets');
      setSelectedMethod(null);
    }
  }, [isApprovalDialogOpen]);

  const getReactorId = useCallback(() => {
    return currentUser?.id || clientReactorId;
  }, [currentUser, clientReactorId]);

  // Status display and clearance info are now declared above
  const lastStatusUpdateEntry = order.statusHistory.length > 0 ? order.statusHistory[order.statusHistory.length - 1] : null;
  const lastEditedByEntry = order.updatedAt && order.updatedByUserName ? { timestamp: order.updatedAt, changedByUserName: order.updatedByUserName } : null;

  const getStatusIcon = (statusId: string, sizeClass = "h-6 w-6", forceStatic = false) => {
    const statusInfoToUse = getStatusDisplayInfo(statusId);
    const commonClasses = `${sizeClass} mr-2 flex-shrink-0`;

    const renderInfoLottie = () => {
      if (forceStatic || !isClient) {
        return <Info className={commonClasses} style={{ color: statusInfoToUse.color }} />;
      }
      return (
        <div className={`${sizeClass} mr-2 flex-shrink-0`}>
          <Lottie animationData={infoAnimation} loop={true} />
        </div>
      );
    };

    return renderInfoLottie();
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast({ title: "Cannot submit empty comment", variant: "destructive" });
      return;
    }
    setIsSubmittingComment(true);
    const result = await submitCommentAction(order.id, {
      userName: currentUser ? currentUser.name : (order.companyName || "Client"),
      userRole: currentUser ? currentUser.role : 'Client',
      text: newComment,
      isInternal: false,
      userId: currentUser?.id
    });
    if ('error' in result) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      setOrder(result);
      setNewComment('');
      toast({ title: "Success", description: "Your comment has been submitted." });
    }
    setIsSubmittingComment(false);
  };

  const handleReplySubmit = async () => {
    if (!replyingTo || !currentReplyText.trim()) {
      toast({ title: "Cannot submit empty reply", variant: "destructive" });
      return;
    }
    setIsSubmittingReply(true);
    let result;
    if (currentUser) {
      result = await submitReplyAction(order.id, replyingTo.parentId, currentReplyText, false, currentUser);
    } else {
      result = await submitClientReplyAction(order.id, replyingTo.parentId, currentReplyText);
    }
    setIsSubmittingReply(false);
    if ('error' in result) {
      toast({ title: "Error submitting reply", description: result.error, variant: "destructive" });
    } else {
      setOrder(result);
      setCurrentReplyText('');
      setReplyingTo(null);
      toast({ title: "Reply submitted" });
    }
  };

  const handleToggleLike = async (targetCommentId: string, isReply: boolean, parentCommentIdIfReply?: string) => {
    const currentReactorId = getReactorId();
    if (!currentReactorId) {
      toast({ title: "Error", description: "Could not identify reactor.", variant: "destructive" });
      return;
    }
    const originalOrder = JSON.parse(JSON.stringify(order)) as TrackingLink;
    let newOrderState = JSON.parse(JSON.stringify(order)) as TrackingLink;
    const findAndUpdateComment = (commentsArr: Comment[]): boolean => {
      for (let i = 0; i < commentsArr.length; i++) {
        const currentComment = commentsArr[i];
        if (currentComment.id === (isReply ? parentCommentIdIfReply : targetCommentId)) {
          const targetItem = isReply ? (currentComment.replies || []).find(r => r.id === targetCommentId) : currentComment;
          if (targetItem) {
            targetItem.likes = targetItem.likes || { count: 0, reactedBy: [] };
            const likedIndex = targetItem.likes.reactedBy.indexOf(currentReactorId);
            if (likedIndex > -1) {
              targetItem.likes.reactedBy.splice(likedIndex, 1);
              targetItem.likes.count--;
            } else {
              targetItem.likes.reactedBy.push(currentReactorId);
              targetItem.likes.count++;
            }
            return true;
          }
        }
      }
      return false;
    };
    findAndUpdateComment(newOrderState.comments);
    setOrder(newOrderState);
    const result = await toggleOrderCommentReactionAction(order.id, targetCommentId, isReply, parentCommentIdIfReply, currentReactorId, 'like');
    if ('error' in result) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      setOrder(originalOrder);
    } else {
      setOrder(result);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete) return;

    setIsDeletingComment(true);
    const result = await deleteCommentAction(
      order.id,
      commentToDelete.id,
      commentToDelete.isReply,
      commentToDelete.parentId,
      currentUser
    );
    setIsDeletingComment(false);
    setCommentToDelete(null); // Close the dialog

    if ('error' in result) {
      toast({ title: "Deletion Failed", description: result.error, variant: "destructive" });
    } else {
      setOrder(result);
      toast({ title: "Success", description: "The comment has been deleted." });
    }
  };

  const renderTextWithMentions = (text: string) => {
    if (!text) return '';
    return text.split(/(@[a-zA-Z0-9_]+)/g).map((part, index) => {
      if (index % 2 === 1 && part.startsWith('@')) {
        return <strong key={index} className="text-primary font-semibold">{part.substring(1)}</strong>;
      }
      return part;
    });
  };

  const handleReplyTextChangeForMention = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCurrentReplyText(text);
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
        const clientOption = { id: 'client-mention', name: (order.companyName || "Client"), role: 'Client' as UserRole | 'Client' };
        const usersToSearchFromProp = Array.isArray(allUsersForMentions) ? allUsersForMentions : [];
        const usersToSearch = [clientOption, ...usersToSearchFromProp.map(u => ({ ...u, role: u.role as UserRole | 'Client' }))];
        const filtered = usersToSearch.filter(user => (user.name.toLowerCase().includes(textAfterAt.toLowerCase()) || (user.role && user.role.toLowerCase().replace(/_/g, ' ').includes(textAfterAt.toLowerCase())))).slice(0, 7);
        setMentionSuggestions(filtered); return;
      }
    }
    setMentionQuery(null); setActiveMentionStartIndex(null); setMentionSuggestions([]);
  };

  const handleMentionSelect = (userNameToInsert: string) => {
    if (activeMentionStartIndex === null || !replyTextareaRef.current) return;
    const text = currentReplyText;
    const mentionTag = userNameToInsert.replace(/\s+/g, '');
    const queryLength = mentionQuery?.length || 0;
    const textBeforeAt = text.substring(0, activeMentionStartIndex);
    const textAfterMentionQuery = text.substring(activeMentionStartIndex + 1 + queryLength);
    const newText = `${textBeforeAt}@${mentionTag} ${textAfterMentionQuery.trimStart()}`;
    setCurrentReplyText(newText);
    const newCursorPosition = activeMentionStartIndex + 1 + mentionTag.length + 1;
    setTimeout(() => {
      if (replyTextareaRef.current) {
        replyTextareaRef.current.focus();
        replyTextareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
    setMentionQuery(null); setActiveMentionStartIndex(null); setMentionSuggestions([]);
  };

  const renderComment = (comment: Comment, isReply = false, parentCommentId?: string) => {
    if (comment.isInternal && !currentUser) return null;
    if (comment.isInternal && currentUser && !['ADMIN', 'SYSTEM_ADMIN', 'CR', ...DR_ROLES, 'VENDOR'].includes(currentUser.role)) return null;
    const reactorId = getReactorId();
    const hasLiked = reactorId && comment.likes?.reactedBy.includes(reactorId);
    let avatarSrc: string | undefined = undefined;
    let avatarDataAiHint = "user initials avatar";
    let userToDisplay: User | undefined | null = null;
    if (comment.userRole === 'Client') {
      avatarSrc = CLIENT_AVATAR_URL; avatarDataAiHint = "client avatar";
    } else if (comment.userId && Array.isArray(allUsersForMentions)) {
      userToDisplay = allUsersForMentions.find(u => u.id === comment.userId);
      if (userToDisplay?.avatarUrl) { avatarSrc = userToDisplay.avatarUrl; avatarDataAiHint = "user uploaded avatar"; }
    }
    const avatarFallback = getInitials(comment.userName || "User");
    const visibleReplies = (comment.replies || []).filter(reply => !(reply.isInternal && !currentUser) && !(reply.isInternal && currentUser && !['ADMIN', 'SYSTEM_ADMIN', 'CR', ...DR_ROLES, 'VENDOR'].includes(currentUser.role))).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const isRepliesExpanded = expandedReplies[comment.id] || false;
    const repliesToRender = isRepliesExpanded || visibleReplies.length <= MAX_INITIAL_REPLIES_TO_SHOW ? visibleReplies : visibleReplies.slice(0, MAX_INITIAL_REPLIES_TO_SHOW);
    return (
      <div key={comment.id} className={`flex space-x-2.5 sm:space-x-3 ${isReply ? 'ml-8 sm:ml-10' : ''}`}>
        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-primary/30 shadow-sm flex-shrink-0 mt-0.5">
          <AvatarImage src={avatarSrc} alt={comment.userName} data-ai-hint={avatarDataAiHint} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{avatarFallback}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div onDoubleClick={() => handleToggleLike(comment.id, isReply, parentCommentId)} className="bg-muted dark:bg-muted/60 px-3.5 py-2.5 rounded-xl shadow-sm group transition-colors border border-transparent hover:border-primary/30">
            <div className="flex items-baseline space-x-1.5">
              <p className="text-sm font-semibold text-foreground">{comment.userName}</p>
              {comment.userRole && comment.userRole !== 'Client' && (<span className="text-xs text-muted-foreground">({isDrRole(comment.userRole) ? 'DR' : comment.userRole.replace(/_/g, ' ')})</span>)}
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-0.5">{renderTextWithMentions(comment.text)}</p>
          </div>
          <div className="flex items-center space-x-1 mt-1.5 pl-1 text-xs">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleToggleLike(comment.id, isReply, parentCommentId)} className={`font-medium px-1.5 py-0.5 rounded-sm transition-colors flex items-center gap-1 group/likebtn ${hasLiked ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-muted-foreground hover:bg-muted/50 hover:text-red-500'}`} title={hasLiked ? "Unlike" : "Like"} disabled={!reactorId}>
              <motion.span animate={{ scale: hasLiked && reactorId ? [1, 1.4, 1, 1.2, 1] : 1 }} transition={{ duration: 0.4, ease: "easeInOut" }} key={`${comment.id}-${hasLiked ? 'liked' : 'unliked'}-${comment.likes?.count || 0}`}>
                <Heart className={`h-4 w-4 ${hasLiked ? 'fill-red-500 text-red-500' : 'fill-transparent text-muted-foreground group-hover/likebtn:text-red-500'}`} />
              </motion.span>
              <span className="text-xs">Like</span>
              {comment.likes && comment.likes.count > 0 && (<span className="text-xs ml-0.5">({comment.likes.count})</span>)}
            </motion.button>
            <span className="text-muted-foreground">&middot;</span>
            <button onClick={() => { const isOpeningNewReplyForm = !replyingTo || replyingTo.formUnderId !== comment.id; const targetNameForMention = comment.userName || "User"; const parentIdForReply = isReply ? parentCommentId! : comment.id; setReplyingTo(isOpeningNewReplyForm ? { parentId: parentIdForReply, targetName: targetNameForMention, formUnderId: comment.id } : null); if (isOpeningNewReplyForm) { setCurrentReplyText(`@${targetNameForMention.replace(/\s+/g, '')} `); setTimeout(() => replyTextareaRef.current?.focus(), 0); } else { setCurrentReplyText(''); } }} className="font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 px-1.5 py-0.5 rounded-sm transition-colors">Reply</button>
            <span className="text-muted-foreground">&middot;</span>
            {currentUser?.role === 'SYSTEM_ADMIN' && (
              <>
                <button
                  onClick={() => setCommentToDelete({ id: comment.id, isReply, parentId: parentCommentId, text: comment.text })}
                  className="font-medium text-destructive hover:bg-destructive/10 px-1.5 py-0.5 rounded-sm transition-colors flex items-center gap-1"
                  title="Delete Comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <span className="text-muted-foreground">&middot;</span>
              </>
            )}
            <span className="text-muted-foreground" title={isClient ? formatDate(comment.timestamp) : 'Loading date...'}>{isClient ? formatDate(comment.timestamp, true) : <Skeleton className="h-3 w-10 inline-block" />}</span>
          </div>
          {replyingTo?.formUnderId === comment.id && (
            <Popover open={mentionQuery !== null && mentionSuggestions.length > 0} onOpenChange={(open) => { if (!open) { setMentionQuery(null); setActiveMentionStartIndex(null); setMentionSuggestions([]); } }}>
              <PopoverAnchor asChild>
                <form onSubmit={(e) => { e.preventDefault(); handleReplySubmit(); }} className="mt-2.5 flex items-start space-x-2.5 pl-0 sm:pl-1">
                  <Avatar className="h-7 w-7 border border-border/40 flex-shrink-0 mt-0.5 shadow-sm">
                    <AvatarImage src={currentUser?.avatarUrl || (clientReactorId ? CLIENT_AVATAR_URL : undefined)} alt="Your avatar" data-ai-hint={currentUser?.avatarUrl ? "user uploaded avatar" : (clientReactorId ? "client avatar" : "user initials avatar")} />
                    <AvatarFallback className="bg-muted text-xs font-semibold">{getInitials(currentUser?.name || (clientReactorId ? (order.companyName || "Client") : "U"))}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea ref={replyTextareaRef} placeholder={`Replying to ${replyingTo.targetName}...`} value={currentReplyText} onChange={handleReplyTextChangeForMention} className="min-h-[50px] sm:min-h-[60px] text-sm bg-background/70 border-border/50 focus:border-primary rounded-lg shadow-inner p-2.5" disabled={isSubmittingReply} rows={2} />
                    <div className="flex justify-end items-center mt-1.5">
                      {mentionQuery !== null && mentionSuggestions.length === 0 && activeMentionStartIndex !== null && <span className="text-xs text-muted-foreground mr-auto">No matches found</span>}
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2.5 mr-1.5 text-muted-foreground hover:text-foreground" onClick={() => { setReplyingTo(null); setCurrentReplyText(''); }} disabled={isSubmittingReply}>Cancel</Button>
                      <Button type="submit" size="sm" disabled={isSubmittingReply || !currentReplyText.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-7 px-3 rounded-md">{isSubmittingReply ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Sending...</> : "Send Reply"}</Button>
                    </div>
                  </div>
                </form>
              </PopoverAnchor>
              {mentionQuery !== null && mentionSuggestions.length > 0 && (
                <PopoverContent key={mentionQuery + (activeMentionStartIndex ?? '') + 'popover'} className="w-[250px] p-0" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <Command><CommandList>{mentionSuggestions.map((user) => (<CommandItem key={user.id + (activeMentionStartIndex ?? '')} value={user.name + user.role} onSelect={() => handleMentionSelect(user.name)} className="cursor-pointer flex items-center gap-2">
                    <Avatar className="h-6 w-6 text-xs"><AvatarImage src={user.role === 'Client' ? CLIENT_AVATAR_URL : (Array.isArray(allUsersForMentions) && (allUsersForMentions.find(u => u.id === user.id) as User)?.avatarUrl) || undefined} /><AvatarFallback className="bg-muted text-xs">{getInitials(user.name)}</AvatarFallback></Avatar>
                    <span className="text-xs font-medium">{user.name}</span><span className="text-xs text-muted-foreground">({isDrRole(user.role) ? 'DR' : (typeof user.role === 'string' ? user.role.replace(/_/g, ' ') : 'Client')})</span></CommandItem>))}
                  </CommandList>{mentionSuggestions.length === 0 && mentionQuery && (<CommandEmpty>No users found matching "@{mentionQuery}"</CommandEmpty>)}</Command>
                </PopoverContent>
              )}
            </Popover>
          )}
          {repliesToRender.length > 0 && (<div className="mt-3 space-y-3">{repliesToRender.map(reply => renderComment(reply, true, comment.id))}</div>)}
          {!isReply && visibleReplies.length > MAX_INITIAL_REPLIES_TO_SHOW && (<Button variant="link" size="sm" onClick={() => setExpandedReplies(prev => ({ ...prev, [comment.id]: !isRepliesExpanded }))} className="text-xs font-medium text-primary hover:text-primary/80 mt-2 pl-1">
            {isRepliesExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}{isRepliesExpanded ? 'Hide Replies' : `View ${visibleReplies.length - MAX_INITIAL_REPLIES_TO_SHOW} more ${visibleReplies.length - MAX_INITIAL_REPLIES_TO_SHOW === 1 ? 'reply' : 'replies'}`}</Button>)}
        </div>
      </div>
    );
  };

  const publicCommentsAndRepliesCount = order.comments.reduce((acc, comment) => {
    if (!(comment.isInternal && !currentUser) && !(comment.isInternal && currentUser && !['ADMIN', 'SYSTEM_ADMIN', 'CR', ...DR_ROLES, 'VENDOR'].includes(currentUser.role))) {
      acc++; const visibleReplies = (comment.replies || []).filter(reply => !(reply.isInternal && !currentUser) && !(reply.isInternal && currentUser && !['ADMIN', 'SYSTEM_ADMIN', 'CR', ...DR_ROLES, 'VENDOR'].includes(currentUser.role))); acc += visibleReplies.length;
    } return acc;
  }, 0);

  const orderSubtotal = Array.isArray(order.orderItems)
    ? order.orderItems.reduce((acc, item) => acc + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0)
    : 0;
  const giftTotal = Array.isArray(order.orderItems)
    ? order.orderItems.reduce((acc, item) => acc + (item.isGift ? (Number(item.lineItemTotalPrice) || 0) : 0), 0)
    : 0;
  const effectiveDiscount = Number(order.specialClientDiscount) || 0;
  const netPayable = orderSubtotal - effectiveDiscount;
  const { contactPerson, businessName } = useMemo(() => {
    const parts = (order.companyName || '').split(' • ');
    return parts.length > 1
      ? { contactPerson: parts[0].trim(), businessName: parts.slice(1).join(' • ').trim() }
      : { contactPerson: order.companyName, businessName: '' };
  }, [order.companyName]);

  const allAdvancePaymentRecords = useMemo(() => {
    const records: AdvancePaymentRecord[] = [];
    if (order.advancePayments && order.advancePayments.length > 0) {
      records.push(...order.advancePayments.map(r => ({ ...r, amount: Number(r.amount) })));
    } else if (order.advancePayment && Number(order.advancePayment) > 0) {
      records.push({
        id: 'legacy-advance',
        amount: Number(order.advancePayment),
        date: order.createdAt,
        paymentMethod: order.paymentMethod || "Unknown",
        notes: "Initial advance payment (legacy).",
        recordedByUserId: order.crmUserId,
        recordedByUserName: order.crmUserName,
      });
    }
    return records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [order]);

  const totalAdvancePaid = allAdvancePaymentRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const shippingCharge = Number(order.shippingCharge) || 0;
  const vatPercent = Number(order.vatPercentage) || 0;
  const vatAmount = Math.round(netPayable * vatPercent) / 100;
  const grandTotal = netPayable + vatAmount + shippingCharge;
  const amountDue = grandTotal - totalAdvancePaid;

  const showPaidBadge = grandTotal > 0 && amountDue <= 0.01;
  const paymentPercentage = netPayable > 0 ? (totalAdvancePaid / netPayable) * 100 : 100;
  const hasRequiredPayment = isCoClearance ? true : (paymentPercentage >= 45);
  const remainingForApproval = Math.max(0, (netPayable * 0.5) - totalAdvancePaid);

  const renderStatusHistory = () => {
    if (hideStatusHeader) return null;
    return (
      <Card className="shadow-2xl border border-border/40 bg-card hover:shadow-primary/10 transition-shadow duration-300 rounded-xl">
          <CardHeader className="bg-card p-6 sm:p-8 border-b border-border/40">
            <div className="flex items-center space-x-3 sm:space-x-4"><Info className="h-8 w-8 sm:h-10 sm:w-10 text-primary flex-shrink-0 p-1.5 bg-primary/10 rounded-lg border border-primary/20" /><CardTitle className="text-xl sm:text-2xl font-semibold text-card-foreground">Status History</CardTitle></div>
            <CardDescription className="text-muted-foreground mt-1 ml-[44px] sm:ml-[56px]">Timeline of order progress and updates.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8"><div className="space-y-6 sm:space-y-8 relative pl-5 sm:pl-6 border-l-2 border-zinc-400 dark:border-zinc-600 ml-2 sm:ml-3">
            {order.statusHistory.slice().reverse().map((entry, index) => {
              let entryStatusInfo = getStatusDisplayInfo(entry.status);
              const entryIsDocs = docsApprovalStatusIds && docsApprovalStatusIds.length > 0
                ? docsApprovalStatusIds.includes(entry.status)
                : entry.status === 'co-clearance';
              if (entryIsDocs && entry.notes === 'Terms accepted and documents approved by client.') {
                entryStatusInfo = { ...entryStatusInfo, name: 'Docs Approved' };
              }
              if (entry.notes === 'Terms accepted and design approved by client.') {
                entryStatusInfo = { ...entryStatusInfo, name: 'Design Approved' };
              }
              return (
                <div key={entry.id} className="flex items-start space-x-3 sm:space-x-4 relative group">
                  <div
                    className={`absolute z-10 -left-[2.25rem] sm:-left-[2.625rem] top-1 h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center ring-4 ring-background transition-all duration-200 ${index === 0 ? 'shadow-lg' : 'border-2'}`}
                    style={{
                      backgroundColor: index === 0 ? entryStatusInfo.color : 'hsl(var(--background))',
                      backgroundImage: index === 0 ? 'none' : `linear-gradient(${entryStatusInfo.color}15, ${entryStatusInfo.color}15)`,
                      borderColor: index === 0 ? 'transparent' : `${entryStatusInfo.color}30`
                    }}
                  >
                    {index === 0 ? (
                      <Info className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: entryStatusInfo.textColor }} />
                    ) : (
                      getStatusIcon(entry.status, "h-4 w-4 sm:h-4 sm:w-4 !mr-0", true)
                    )}
                  </div>
                  <div className="flex-1 pt-px ml-2 sm:ml-3">
                    <div className="flex items-center justify-between w-full gap-3">
                      <p className={`font-semibold text-md sm:text-lg ${index === 0 ? 'text-primary' : 'text-foreground group-hover:text-primary/90'}`}>{entryStatusInfo.name}</p>
                      {index === 0 && (
                        !currentUser && !isApproved && allowsApproval ? (
                          <Button
                            onClick={() => setIsApprovalDialogOpen(true)}
                            size="sm"
                            className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-md shadow-md transition-all"
                          >
                            Approve
                          </Button>
                        ) : (
                          hasPendingClientPayment && (
                            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 gap-1 animate-pulse border border-amber-200 dark:border-amber-900/50">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Payment Processing
                            </span>
                          )
                        )
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground flex items-center flex-wrap mt-0.5">
                      <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 opacity-70 flex-shrink-0" />
                      {isClient ? formatDate(entry.timestamp, false) : <div className="h-4 w-48"><Skeleton className="h-full w-full" /></div>}
                      {currentUser && (
                        <>
                          <span className="mx-1.5 hidden sm:inline">&bull;</span>
                          <span className="block sm:inline w-full sm:w-auto mt-0.5 sm:mt-0">{entry.changedByUserName}</span>
                        </>
                      )}
                    </div>
                    {entry.notes ? (
                      (() => {
                        let noteText = entry.notes;
                        if (!currentUser) {
                          if (noteText.includes("Order transferred to SteadFast Courier")) {
                            noteText = "Order transferred to SteadFast Courier.";
                          } else if (noteText.includes("File upload confirmed by")) {
                            const parts = noteText.split(". Confirmation details:");
                            if (parts.length > 0) {
                              noteText = parts[0] + ".";
                            }
                          }
                        }
                        const imgRegex = /(\/uploads\/[^\s\)]+\.(?:png|jpg|jpeg|gif|webp))/i;
                        const match = noteText.match(imgRegex);
                        const imageUrl = match ? match[1] : null;

                        if (imageUrl) {
                          const parts = noteText.split(imageUrl);
                          return (
                            <p className="text-sm sm:text-md mt-2 sm:mt-2.5 bg-muted/50 p-3 sm:p-4 rounded-lg border border-border/40 text-foreground/80 shadow-sm">
                              {parts[0]}
                              <button
                                type="button"
                                onClick={() => setPreviewDocumentUrl(imageUrl)}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors text-xs align-middle mx-1"
                              >
                                <FileImage className="h-3.5 w-3.5" />
                                View Proof Image
                              </button>
                              {parts[1]}
                            </p>
                          );
                        }

                        return (
                          <p className="text-sm sm:text-md mt-2 sm:mt-2.5 bg-muted/50 p-3 sm:p-4 rounded-lg border border-border/40 text-foreground/80 shadow-sm">
                            {noteText}
                          </p>
                        );
                      })()
                    ) : null}
                  </div>
                </div>);
            })}</div>
          </CardContent>
        </Card>
    );
  };

  return (
    <>
      <main className="max-w-[794px] mx-auto space-y-4 sm:space-y-5">
        <div className="space-y-2">
          {!hideStatusHeader && (
            <div className="shadow-2xl overflow-hidden border-border/40 bg-card hover:shadow-primary/10 transition-shadow duration-300 rounded-xl">
              <CardHeader className="bg-card py-2 px-3 sm:py-2.5 sm:px-4 border-b border-border/40">
                {(!packzyStatus || packzyStatus === 'unavailable') && (
                  <div className="mt-2 pt-2 border-t border-border/30 first:mt-0 first:pt-0 first:border-t-0 flex items-start gap-2">
                    {getStatusIcon(order.currentStatus, "h-14 w-14 !mr-0")}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground flex flex-wrap items-center gap-2 leading-tight">
                        <span>Current Status:</span>
                        <span
                          className="inline-flex items-center text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-full border shadow-sm transition-all duration-200"
                          style={{
                            backgroundColor: `${currentStatusInfo.color}15`,
                            color: currentStatusInfo.color,
                            borderColor: `${currentStatusInfo.color}30`
                          }}
                        >
                          {currentStatusInfo.name}
                        </span>
                      </h3>
                      <div className="text-xs text-muted-foreground mt-2">
                        {isClient ? (
                          lastStatusUpdateEntry ? (
                            currentUser ? (
                              `Last status update: ${formatDate(lastStatusUpdateEntry.timestamp, true)} by ${lastStatusUpdateEntry.changedByUserName}`
                            ) : (
                              `Last status update: ${formatDate(lastStatusUpdateEntry.timestamp, true)}`
                            )
                          ) : (
                            "Status pending."
                          )
                        ) : (
                          <div className="h-4 w-48"><Skeleton className="h-full w-full" /></div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {order.packzyTrackingCode && (
                  <div className="mt-2 pt-2 border-t border-border/30 first:mt-0 first:pt-0 first:border-t-0 flex items-center gap-2">
                    <div className="flex-shrink-0">
                      {isClient ? (
                        <div className="h-20 w-20 flex-shrink-0">
                          <Lottie animationData={courierAnimation} loop={true} />
                        </div>
                      ) : (
                        <Truck className="h-20 w-20 text-primary/80 animate-bounce" style={{ animationDuration: '3s' }} />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground flex flex-wrap items-center gap-2 leading-tight">
                        <span>Courier Status:</span>
                        {isLoadingPackzyStatus ? (
                          <Skeleton className="h-7 w-20" />
                        ) : packzyStatus && packzyStatus !== 'unavailable' ? (
                          <span className="inline-flex items-center text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-600 shadow-sm capitalize">
                            {packzyStatus}
                          </span>
                        ) : (
                          <span className="text-sm font-normal text-muted-foreground">Could not retrieve courier status.</span>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2">Tracking Code: {order.packzyTrackingCode}</p>
                    </div>
                  </div>
                )}
              </CardHeader>
            </div>
          )}

          {!currentUser && renderStatusHistory()}
        </div>

        {!hideStatusHeader && (
          (currentUser || isDesktop) ? (
      <div ref={fitRef} className="mx-auto w-full max-w-[794px] print:max-w-none">
        <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-zinc-300/60 print:!h-auto print:overflow-visible print:rounded-none print:shadow-none" style={{ height: pageHeight * scale }}>
          <div
            ref={invoiceRef}
            className="invoice-page absolute left-0 top-0 flex min-h-[1123px] flex-col bg-white text-[#333] print:!static print:!w-full print:!min-h-0 print:![transform:none]"
            style={{ width: DESIGN_W, transform: `scale(${scale})`, transformOrigin: 'top left', padding: '48px 36px 40px 36px' }}
          >
            {/* header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="m-0 text-[45px] font-extrabold leading-none tracking-[0.5px]" style={{ color: BLUE }}>INVOICE.</h1>
                <p className="m-0 mt-[9px] text-[20px] font-bold leading-[26px]">Date: <span>{isClient ? formatShortDate(order.createdAt) : ''}</span></p>
              {order.acceptedDeliveryDate && (
                <p className="m-0 mt-1 text-[11.5px] text-[#555]">Accepted Delivery Date: {isClient ? formatDate(order.acceptedDeliveryDate, false, false) : ''}</p>
              )}
              </div>
              <div className="flex flex-col items-end">
                <Image src="/logo-trim.png" alt="Seven Solution Logo" width={1200} height={429} priority unoptimized className="h-[46px] w-auto object-contain" />
                <svg ref={barcodeRef} className="mt-[10px] h-[30px] max-w-full object-contain" data-ai-hint="barcode scan" />
              </div>
            </div>

            {/* office / client */}
            <div className="mt-[41px] flex text-[11.5px] font-bold leading-[22px]">
              <div className="w-[180px] shrink-0">
                <p className="m-0">Office Address:</p>
                <p className="m-0 mt-1 max-w-[165px] text-[11px] font-normal leading-[16px] text-[#555]">Mirpur, Section - 12, Road - 02 Block - A, House - 133, 1216</p>
              </div>
              <div>
                <p className="m-0">Client: <span className="font-normal">{contactPerson}{businessName ? ` · ${businessName}` : ''}</span></p>
                <p className="m-0">Phone: <span className="font-normal">{order.phoneNumber}</span></p>
                {order.address && <p className="m-0">Address: <span className="font-normal">{order.address}</span></p>}
              </div>
            </div>

            <div className="mt-[34px]"><Rule /></div>

            {/* items */}
            <div className="ml-[64px] mr-[-8px] mt-[26px]">
              <div className="grid h-[34px] grid-cols-[66px_204px_111px_79px_93px] items-center rounded-full text-[13.5px] font-bold leading-none text-white shadow-md shadow-[#4b5fa5]/30 print:shadow-none" style={{ background: BLUE }}>
                <span className="text-center">No</span>
                <span className="pr-[24px] text-center">Service Description</span>
                <span className="pl-0">Unit Price</span>
                <span>QTA</span>
                <span>Total Price</span>
              </div>
              <div className="mt-[25px]">
                {(order.orderItems || []).map((item, index) => (
                  <div key={item.id || index} className="grid min-h-[43px] grid-cols-[66px_204px_111px_79px_93px] items-start border-b border-zinc-100 py-[3px] text-[13.5px] leading-[17px] last:border-b-0">
                    <span className="text-center">{index + 1}</span>
                    <span className="pr-[24px] text-center">
                      <span className="block">{item.unit ? `${item.unit} • ` : ''}{item.model}{item.variation ? ` — ${item.variation}` : ''}</span>
                      {item.lamination && item.lamination !== 'N/A' && <span className="block text-[9px] leading-[12px]">{item.lamination}</span>}
                      {item.isGift && <span className="block text-[9px] font-bold leading-[12px]" style={{ color: BLUE }}>Gift</span>}
                    </span>
                    <span>{tk(item.unitPrice)}</span>
                    <span>{String(item.quantity).padStart(2, '0')}</span>
                    <span style={item.isGift ? { textDecoration: 'line-through', textDecorationColor: '#ef4444', color: '#6b7280' } : undefined}>{tk(item.lineItemTotalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-[20px]"><Rule /></div>

            {/* totals */}
            <div className="relative mt-[26px] flex justify-between">
              <div>
                <p className="m-0 text-[17px] font-bold uppercase leading-[22px]" style={{ color: BLUE }}>Total Due:</p>
                <p className="m-0 flex items-baseline gap-2 leading-none" style={{ color: BLUE }}>
                  <span className="text-[48px] font-extrabold tracking-[-2px]">{numberOnly(Math.max(0, amountDue))}</span>
                  <span className="text-[20px] font-bold">BDT</span>
                </p>
              </div>
              <div className="w-[300px] rounded-2xl bg-slate-50 px-5 py-2 print:bg-transparent print:px-0">
                <TotalRow label="Subtotal:" value={tk(orderSubtotal)} blue />
                {giftTotal > 0 && <TotalRow label="Gift Value:" value={tk(giftTotal)} />}
                {effectiveDiscount > 0 && <TotalRow label="Discount:" value={`- ${tk(effectiveDiscount)}`} />}
                <TotalRow label={`VAT ${vatPercent}%:`} value={`+ ${tk(vatAmount)}`} />
                {shippingCharge > 0 && <TotalRow label="Shipping:" value={`+ ${tk(shippingCharge)}`} />}
                {totalAdvancePaid > 0 && <TotalRow label={showPaidBadge ? 'Total Paid:' : 'Advance Paid:'} value={`- ${tk(totalAdvancePaid)}`} />}
              </div>
              {showPaidBadge && (
                <Image
                  src="/paid-stamp.png"
                  alt="Paid Stamp"
                  width={110}
                  height={110}
                  unoptimized
                  className="pointer-events-none absolute left-[260px] top-[-14px] -rotate-[16deg] opacity-80"
                />
              )}
            </div>

            {/* payments history */}
            {allAdvancePaymentRecords.length > 0 && (
              <div className="mt-[30px]">
                <p className="m-0 mb-2 text-[12px] font-bold">Payments History:</p>
                <div className="overflow-hidden rounded-xl border border-zinc-100 bg-slate-50/70 px-3 print:border-0 print:bg-transparent print:px-0"><table className="w-full text-left text-[10.5px]">
                  <thead>
                    <tr className="border-b border-[#c8c8cc] text-[#666]">
                      <th className="py-1.5 pr-3 font-bold">Date</th>
                      <th className="py-1.5 pr-3 font-bold">Amount</th>
                      <th className="py-1.5 pr-3 font-bold">Method</th>
                      <th className="py-1.5 pr-3 font-bold">Notes</th>
                      <th className="py-1.5 font-bold">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAdvancePaymentRecords.map((record) => (
                      <tr key={record.id} className="border-b border-[#ececf0]">
                        <td className="whitespace-nowrap py-1.5 pr-3 text-[#666]">{isClient ? formatDate(record.date) : ''}</td>
                        <td className="py-1.5 pr-3 font-bold" style={{ color: BLUE }}>{formatCurrency(record.amount)}</td>
                        <td className="py-1.5 pr-3"><PaymentProofCell method={record.paymentMethod} proofUrl={record.documentUrl} amountLabel={formatCurrency(record.amount)} /></td>
                        <td className="py-1.5 pr-3 text-[#666]">{record.notes || 'N/A'}</td>
                        <td className="py-1.5 text-[#666]">{record.recordedByUserName || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}

            {order.orderNotes && (
              <div className="mt-[24px] rounded-xl border-l-4 bg-slate-50 px-4 py-3 print:bg-transparent" style={{ borderColor: BLUE }}>
                <p className="m-0 text-[12px] font-bold">Notes:</p>
                <p className="m-0 mt-1 whitespace-pre-wrap text-[11px] leading-[16px] text-[#555]">{order.orderNotes}</p>
              </div>
            )}

            {/* terms */}
            <div className="mt-[34px]">
              <p className="m-0 text-[13px] font-bold">Terms &amp; Conditions:</p>
              <ul className="m-0 mt-2 max-w-[470px] list-disc space-y-[3px] pl-4 text-[9.5px] leading-[14px] text-[#555]">
                <li><b>Advance Payment:</b> Minimum 50% advance required with official work order.</li>
                <li><b>Delivery Timeline:</b> Maximum delivery time is 1 month from confirmation.</li>
                <li><b>Excluded Charges:</b> Tax, VAT &amp; delivery charges are excluded.</li>
                <li><b>Refund Policy:</b> Advance payment is strictly non-refundable.</li>
              </ul>
            </div>

            {/* footer */}
            <div className="mt-auto flex items-end justify-between pt-[40px]">
              <div className="border-l-4 pl-[11px] leading-[19px]" style={{ borderColor: BLUE }}>
                <p className="m-0 text-[12.5px] font-bold">Questions?</p>
                <p className="m-0 text-[11.5px]">Email us at: savensolution@gmail.com</p>
                <p className="m-0 text-[11.5px]">or call us at: +880 14100-28884</p>
              </div>
              <p className="m-0 pr-[20px] text-[11px] tracking-[0.4px] text-[#6b6b6b]">Account Manager: {order.crmUserName || ''}</p>
            </div>
          </div>
        </div>
      </div>
          ) : (
            <ClientInvoicePDF
              order={order}
              allStatuses={allStatuses}
              designApprovalStatusIds={designApprovalStatusIds}
              docsApprovalStatusIds={docsApprovalStatusIds}
            />
          )
        )}


        {hideStatusHeader && (
          <Card className="shadow-2xl border border-border/40 bg-card hover:shadow-primary/10 transition-shadow duration-300 rounded-xl mt-6 sm:mt-8">
            <CardHeader className="bg-card p-6 sm:p-8 border-b border-border/40">
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4">
                <div className="flex flex-col items-center sm:items-start space-y-1">
                  <Image
                    src="/logo.png"
                    alt="Seven Solution Logo"
                    width={100}
                    height={25}
                    className="h-6 w-auto flex-shrink-0 object-contain"
                  />
                  <CardTitle className="text-lg sm:text-xl font-semibold text-card-foreground">প্রিয় গ্রাহক</CardTitle>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Client</p>
                  <p className="text-base sm:text-lg font-bold text-foreground">
                    {order.companyName.split('•').map((part: string) => part.trim()).slice(-1)[0]}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              {isApproved ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle 
                    className={cn(
                      "h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5",
                      currentUser?.role === 'SYSTEM_ADMIN' && "cursor-pointer hover:scale-110 transition-transform"
                    )}
                    onClick={currentUser?.role === 'SYSTEM_ADMIN' ? handleRemoveApprovalClick : undefined}
                  />
                  <div>
                    <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">
                      {isClearance ? "Documents Already Approved" : "Design Already Approved"}
                    </h4>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                      {isClearance
                        ? "The documents and terms for this order have already been accepted and approved by the client."
                        : "The design and terms for this order have already been accepted and approved by the client."}
                    </p>
                  </div>
                </div>
              ) : !(hasRequiredPayment || hasPendingClientPayment) ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                    <div className="w-full">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-100">Insufficient Payment</h4>
                      <p className="mt-1">A minimum of 50% advance payment is required to approve this order for production. Currently, only {paymentPercentage.toFixed(1)}% has been paid.</p>
                      <div className="mt-3 text-xs space-y-1.5 font-medium max-w-[280px]">
                        <div className="flex justify-between">
                          <span className="opacity-80">Net Payable:</span>
                          <span>{formatCurrency(netPayable)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-80">Required (50%):</span>
                          <span>{formatCurrency(netPayable * 0.5)}</span>
                        </div>
                        <div className="flex justify-between text-green-600 dark:text-green-400 font-semibold">
                          <span className="opacity-80">Total Paid:</span>
                          <span>{formatCurrency(totalAdvancePaid)}</span>
                        </div>
                        <div className="flex justify-between text-red-600 dark:text-red-400 font-semibold">
                          <span className="opacity-80">More Needed:</span>
                          <span>{formatCurrency(remainingForApproval)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {isClearance ? (
                    <>
                      {/* Document Approval Terms and Conditions in Bengali */}
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-4 text-foreground/80">
                        <div className="space-y-3 pl-1">
                          <p className="text-xs sm:text-sm font-bold text-foreground/90 uppercase tracking-wider">আমি নিশ্চিত করছি যে—</p>
                          <ul className="space-y-2.5 text-xs sm:text-sm">
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>মেনুর সকল আইটেম, মূল্য, বানান, অফার ও তথ্য আমি যাচাই করেছি।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>প্রয়োজনীয় সকল ছবি, লোগো, ব্র্যান্ড গাইডলাইন এবং ডকুমেন্ট Seven Solution-কে প্রদান করা হয়েছে।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>পরবর্তীতে আমার পক্ষ থেকে নতুন তথ্য, আইটেম বা বড় ধরনের পরিবর্তন যোগ হলে অতিরিক্ত সময় ও চার্জ প্রযোজ্য হতে পারে।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>প্রদত্ত তথ্য ও ডকুমেন্ট অনুযায়ী ডিজাইন কাজ শুরু করা যাবে।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>ডিজাইন চলাকালীন সম্পূর্ণ নতুন কনসেপ্ট, নতুন মেনু স্ট্রাকচার বা অতিরিক্ত কনটেন্ট যুক্ত করার অনুরোধ করলে কাজের সময়সীমা পরিবর্তিত হতে পারে।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>চূড়ান্ত প্রুফ (Final Proof) অনুমোদনের পর বানান, মূল্য বা তথ্যগত ভুলের দায়ভার আমার থাকবে।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>সকল তথ্য, মূল্য, ছবি, লোগো এবং কনটেন্ট পূর্বেই জমা ও অনুমোদন করা হয়েছে।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>এই পর্যায়ের পর নতুন আইটেম, নতুন পেজ, নতুন ছবি, নতুন ক্যাটাগরি, নতুন মূল্য তালিকা অথবা বড় ধরনের কনটেন্ট পরিবর্তনকে অতিরিক্ত কাজ (Additional Work) হিসেবে গণ্য করা হবে।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>আমার পক্ষ থেকে দেরিতে তথ্য প্রদান, তথ্য পরিবর্তন বা নতুন নির্দেশনার কারণে ডেলিভারি সময় বৃদ্ধি পেতে পারে।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>এই অনুমোদনের পর কাজের পরিধি (Scope of Work) লক করা হয়েছে বলে আমি সম্মতি প্রদান করছি।</span>
                            </li>
                          </ul>
                        </div>

                        <Separator className="bg-zinc-200 dark:bg-zinc-800/80 my-2" />

                        <p className="text-sm font-semibold text-foreground/90 leading-relaxed">
                          আমি উপরোক্ত সকল শর্ত বুঝে ডিজাইন কাজ চালিয়ে যাওয়ার জন্য চূড়ান্ত অনুমোদন প্রদান করছি।
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white dark:bg-zinc-950/40 p-4 rounded-xl border border-zinc-150 dark:border-zinc-850">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                            <span>১–২টি ছোট সংশোধন = <span className="font-semibold text-blue-600 dark:text-blue-400">Free</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-purple-500 flex-shrink-0" />
                            <span>নতুন পেজ যোগ = <span className="font-semibold text-purple-600 dark:text-purple-400">Extra Charge</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                            <span>২০% এর বেশি কনটেন্ট পরিবর্তন = <span className="font-semibold text-amber-600 dark:text-amber-400">New Revision Charge</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                            <span>ডিজাইনার অ্যাসাইনের পর সম্পূর্ণ নতুন মেনু স্ট্রাকচার = <span className="font-semibold text-red-600 dark:text-red-400">New Project Scope</span></span>
                          </div>
                        </div>
                      </div>

                      <label className="flex items-center gap-3.5 cursor-pointer group pt-2 select-none">
                        <input
                          type="checkbox"
                          checked={designChecked && paymentChecked && noModificationChecked}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDesignChecked(val);
                            setPaymentChecked(val);
                            setNoModificationChecked(val);
                          }}
                          className="h-5 w-5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer transition-all duration-200"
                        />
                        <span className="text-sm sm:text-base font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                          অনুমোদন: <span className="text-primary font-bold underline decoration-wavy decoration-primary/45 underline-offset-4">হ্যাঁ, আমি সম্মতি প্রদান করছি।</span>
                        </span>
                      </label>
                    </>
                  ) : (
                    <>
                      {/* Final Design & Print Approval in Bengali */}
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-4 text-foreground/80">
                        <div className="space-y-3 pl-1">
                          <p className="text-xs sm:text-sm font-semibold text-foreground/90">আমি নিশ্চিত করছি যে—</p>
                          <ul className="space-y-2.5 text-xs sm:text-sm">
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>মেনুর সকল আইটেম, মূল্য, বানান, ছবি এবং তথ্য আমি নিজে যাচাই করেছি।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>Final Proof (PDF/JPG) আমি দেখে অনুমোদন প্রদান করেছি।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>মেনুর প্রতিটি পেজে আইটেম সংখ্যা, ফন্ট সাইজ, ছবি এবং ডিজাইন লেআউট সম্পর্কে আমি অবগত আছি।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>আমি বুঝতে পারছি যে একটি কার্যকর Menu Design-এর জন্য প্রতি পেজে সীমিত সংখ্যক আইটেম রাখা, পর্যাপ্ত স্পেস রাখা এবং খাবারের ছবি বড় আকারে প্রদর্শন করা প্রয়োজন।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>আমার অনুরোধে অতিরিক্ত আইটেম, অতিরিক্ত ছবি বা অতিরিক্ত তথ্য যুক্ত করার ফলে ফন্ট ছোট হওয়া, ছবি ছোট হওয়া বা ডিজাইনের ভারসাম্য পরিবর্তিত হতে পারে।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>প্রিন্টিং শুরু হওয়ার পর কোনো মূল্য, বানান, আইটেম, ছবি, ডিজাইন বা তথ্যগত পরিবর্তনের দায় Seven Solution বহন করবে না।</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-1 select-none font-bold text-sm sm:text-base">&bull;</span>
                              <span>প্রিন্টিং সম্পন্ন হওয়ার পর "প্রাইস খেয়াল করিনি", "এই আইটেম বাদ দিতে হবে", "লেখা বড় করতে হবে", "ছবি আরও বড় চাই" ইত্যাদি কারণে রিফান্ড, রিপ্রিন্ট বা ফ্রি রিডিজাইন প্রযোজ্য হবে না।</span>
                            </li>
                          </ul>
                        </div>

                        <Separator className="bg-zinc-200 dark:bg-zinc-800/80 my-2" />

                        <p className="text-sm font-semibold text-foreground/90 leading-relaxed">
                          আমি Final Proof দেখে প্রিন্টের জন্য চূড়ান্ত অনুমোদন প্রদান করছি।
                        </p>

                        <div className="text-xs bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-200">
                          <p className="leading-relaxed">
                            আমাদের অভিজ্ঞতা অনুযায়ী প্রতি পেজে সর্বোচ্চ ১০-১৫টি আইটেম রাখা এবং নির্বাচিত খাবারের ছবি বড় আকারে প্রদর্শন করা বিক্রয় বৃদ্ধিতে সহায়ক। অতিরিক্ত আইটেম বা অতিরিক্ত ছবি যুক্ত করার অনুরোধ গ্রাহকের নিজস্ব সিদ্ধান্ত হিসেবে গণ্য হবে এবং এর ফলে ডিজাইনের পাঠযোগ্যতা বা ভিজ্যুয়াল কার্যকারিতা কমে গেলে Seven Solution দায়ী থাকবে না।
                          </p>
                        </div>
                      </div>

                      <label className="flex items-center gap-3.5 cursor-pointer group pt-2 select-none">
                        <input
                          type="checkbox"
                          checked={designChecked && paymentChecked && noModificationChecked}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDesignChecked(val);
                            setPaymentChecked(val);
                            setNoModificationChecked(val);
                          }}
                          className="h-5 w-5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer transition-all duration-200"
                        />
                        <span className="text-sm sm:text-base font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                          অনুমোদন: <span className="text-primary font-bold underline decoration-wavy decoration-primary/45 underline-offset-4">হ্যাঁ, আমি সম্মতি প্রদান করছি।</span>
                        </span>
                      </label>
                    </>
                  )}

                  <div className="pt-4 flex justify-end">
                    <Button
                      onClick={handleApproveOrder}
                      disabled={isApproving || !designChecked || !paymentChecked || !noModificationChecked}
                      size="lg"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-lg hover:shadow-primary/30 transition-all duration-200"
                    >
                      {isApproving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        "Approve"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showApproveButton && (
          <div id="approve" className="text-center py-8">
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: "mirror",
              }}
            >
              <NextLink href={`/approval/${order.id}`} passHref>
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg py-3 px-8 rounded-lg shadow-lg hover:shadow-primary/40 transition-all duration-300 ease-in-out transform hover:scale-105">
                  Approve Now
                </Button>
              </NextLink>
            </motion.div>
          </div>
        )}

        {currentUser && renderStatusHistory()}

        {areCommentsVisible && (<Card className="shadow-2xl border border-border/40 bg-card hover:shadow-primary/10 transition-shadow duration-300 rounded-xl">
          <CardHeader className="bg-card p-6 sm:p-8 border-b border-border/40">
            <div className="flex items-center space-x-3 sm:space-x-4"><MessageCircle className="h-8 w-8 sm:h-10 sm:w-10 text-primary flex-shrink-0 p-1.5 bg-primary/10 rounded-lg border border-primary/20" /><CardTitle className="text-xl sm:text-2xl font-semibold text-card-foreground">Comments & Updates ({publicCommentsAndRepliesCount})</CardTitle></div>
            <CardDescription className="text-muted-foreground mt-1 ml-[44px] sm:ml-[56px]">Share updates or ask questions about this order.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-5">
            <div className="space-y-4 sm:space-y-5 max-h-[600px] overflow-y-auto pr-2 sm:pr-3 custom-scrollbar">{order.comments.filter(comment => !(comment.isInternal && !currentUser) && !(comment.isInternal && currentUser && !['ADMIN', 'SYSTEM_ADMIN', 'CR', ...DR_ROLES, 'VENDOR'].includes(currentUser.role))).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((comment) => renderComment(comment))}
              {publicCommentsAndRepliesCount === 0 && (<div className="text-center py-8 sm:py-10"><div className="mx-auto h-28 w-36 rounded-lg opacity-50 shadow-sm" data-ai-hint="empty message"><svg viewBox="0 0 150 112" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 0C8.95431 0 0 8.95431 0 20V72C0 83.0457 8.95431 92 20 92H40L48.8889 107.5C49.4817 108.921 51.5183 108.921 52.1111 107.5L61 92H130C141.046 92 150 83.0457 150 72V20C150 8.95431 141.046 0 130 0H20Z" fill="hsl(var(--muted))" /><rect x="20" y="25" width="110" height="8" rx="4" fill="hsl(var(--muted-foreground))" fillOpacity="0.3" /><rect x="20" y="45" width="80" height="8" rx="4" fill="hsl(var(--muted-foreground))" fillOpacity="0.3" /></svg></div>
                <p className="mt-4 sm:mt-5 text-muted-foreground text-md sm:text-lg">No public comments yet.</p><p className="text-xs sm:text-sm text-muted-foreground">Be the first to add one using the form below!</p></div>)}
            </div>
            <Separator className="my-6 sm:my-8 bg-border/30" />
            <form onSubmit={handleCommentSubmit} className="mt-2.5 flex items-start space-x-2.5">
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-primary/30 shadow-sm flex-shrink-0 mt-0.5">
                <AvatarImage src={currentUser?.avatarUrl || (clientReactorId ? CLIENT_AVATAR_URL : undefined)} alt="Your avatar" data-ai-hint={currentUser?.avatarUrl ? "user uploaded avatar" : (clientReactorId ? "client avatar" : "user initials avatar")} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{getInitials(currentUser?.name || (clientReactorId ? (order.companyName || "Client") : "U"))}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea id="comment" placeholder="Write a public comment..." className="min-h-[80px] sm:min-h-[100px] text-sm sm:text-base mb-2.5 p-3 bg-background/70 border-border/70 rounded-lg shadow-inner focus:border-primary focus:ring-1 focus:ring-primary" value={newComment} onChange={(e) => setNewComment(e.target.value)} disabled={isSubmittingComment} rows={3} />
                <div className="flex justify-end"><Button type="submit" size="default" className="shadow-md hover:shadow-primary/30 transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm py-2 px-5 rounded-lg transform hover:scale-[1.02]" disabled={isSubmittingComment || !newComment.trim()}>{isSubmittingComment ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...</>) : (<><Send className="mr-2 h-4 w-4" /> Post Comment</>)}</Button></div>
              </div>
            </form>
          </CardContent>
        </Card>)}
      </main>

      {commentToDelete && (
        <AlertDialog open={!!commentToDelete} onOpenChange={() => setCommentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                Are you sure you want to delete this comment?
              </AlertDialogTitle>
              <div className="pt-2">
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the comment:
                </AlertDialogDescription>
                <blockquote className="mt-2 p-2 border-l-4 border-muted-foreground bg-muted text-muted-foreground italic rounded-r-md text-sm">
                  "{commentToDelete.text.substring(0, 100)}{commentToDelete.text.length > 100 ? '...' : ''}"
                </blockquote>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCommentToDelete(null)} disabled={isDeletingComment}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteComment}
                disabled={isDeletingComment}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isDeletingComment ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : "Yes, delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {previewDocumentUrl && (
        <Dialog open={!!previewDocumentUrl} onOpenChange={(open) => { if (!open) setPreviewDocumentUrl(null); }}>
          <DialogContent className="w-fit max-w-[95vw] p-0 overflow-hidden bg-transparent border-none shadow-none" hideCloseButton={true}>
            <DialogTitle className="sr-only">Document Preview</DialogTitle>
            <DialogDescription className="sr-only">Preview of transaction document attachment</DialogDescription>
            <div className="relative flex items-center justify-center bg-transparent">
              {previewDocumentUrl.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)/) ? (
                <img
                  src={previewDocumentUrl}
                  alt="Document Preview"
                  className="max-h-[80vh] max-w-[90vw] object-contain animate-in fade-in-50 duration-200"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== '/placeholder.svg' && !target.src.endsWith('/placeholder.svg')) {
                      target.src = '/placeholder.svg';
                    }
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground p-12 min-h-[300px] bg-background rounded-lg border shadow-lg w-[400px] max-w-full">
                  <Paperclip className="h-16 w-16 mb-4 opacity-50" />
                  <p className="mb-4">This file cannot be previewed directly.</p>
                  <Button asChild>
                    <a href={previewDocumentUrl} target="_blank" rel="noopener noreferrer">
                      Download File
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isApprovalDialogOpen && (
        <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
          <DialogContent
            className="fixed z-50 grid w-full gap-6 border bg-background py-6 px-3 shadow-lg duration-200 sm:rounded-xl max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:max-w-full max-sm:w-full sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-md max-h-[85vh] overflow-y-auto max-sm:data-[state=open]:slide-in-from-bottom-full max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:slide-out-to-bottom-full max-sm:data-[state=closed]:slide-out-to-left-0 max-sm:data-[state=closed]:zoom-out-100 max-sm:duration-300"
            hideCloseButton={false}
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            {!(hasRequiredPayment || hasPendingClientPayment) && dialogStep !== 'terms' ? (
              dialogStep === 'payment-proof' ? (
                <>
                  <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setDialogStep('payment-methods');
                      }}
                      className="hover:bg-muted p-1.5 rounded-md transition-colors -ml-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    Submit Payment Proof
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground -mt-3">
                    Upload Receipt / Screenshot
                  </DialogDescription>
                  <div className="space-y-4 pt-2">

                    <div className="space-y-3.5">
                      {/* Screenshot File Upload Dropzone */}
                      <div className="space-y-1.5">
                        <div className="w-full">
                          {!proofFileUrl ? (
                            <label className={cn(
                              "flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 select-none",
                              isUploadingProofFile 
                                ? "border-primary/40 bg-primary/5 cursor-not-allowed" 
                                : "border-border hover:border-primary/50 hover:bg-muted/40 bg-muted/20"
                            )}>
                              {isUploadingProofFile ? (
                                <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground p-5">
                                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-1" />
                                  <span className="font-semibold text-foreground">Uploading receipt...</span>
                                  <span>Please wait while the file is being processed.</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground p-5">
                                  <div className="h-14 w-36 flex items-center justify-center mb-1.5 hover:scale-105 transition-transform">
                                    <Image
                                      src={
                                        paymentTab === 'banks'
                                          ? '/pm/ucb.svg'
                                          : selectedMethod === 'bkash_merchant'
                                          ? '/pm/bkash-payment.png'
                                          : selectedMethod === 'bkash_personal'
                                          ? '/pm/bkash.png'
                                          : selectedMethod === 'nagad_personal'
                                          ? '/pm/nagad.png'
                                          : '/pm/bkash.png'
                                      }
                                      alt="Payment Logo"
                                      width={
                                        paymentTab === 'banks'
                                          ? 140
                                          : selectedMethod === 'bkash_merchant'
                                          ? 132
                                          : selectedMethod === 'bkash_personal'
                                          ? 60
                                          : selectedMethod === 'nagad_personal'
                                          ? 72
                                          : 60
                                      }
                                      height={
                                        paymentTab === 'banks'
                                          ? 42
                                          : selectedMethod === 'bkash_merchant'
                                          ? 36
                                          : selectedMethod === 'bkash_personal'
                                          ? 39
                                          : selectedMethod === 'nagad_personal'
                                          ? 30
                                          : 39
                                      }
                                      className="object-contain"
                                      unoptimized
                                    />
                                  </div>
                                  <p className="font-semibold text-foreground text-sm">
                                    Click to upload receipt
                                  </p>
                                  <p className="text-[11px] opacity-80">
                                    Supports JPG, PNG, WEBP, or PDF
                                  </p>
                                </div>
                              )}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                disabled={isUploadingProofFile}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setIsUploadingProofFile(true);
                                  try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    const res = await fetch('/api/upload', {
                                      method: 'POST',
                                      body: formData,
                                    });
                                    const data = await res.json();
                                    if (data.success && data.file_url) {
                                      setProofFileUrl(data.file_url);
                                      toast({ title: 'Success', description: 'File uploaded successfully.' });
                                    } else {
                                      toast({ title: 'Upload failed', description: data.message || 'Unknown error', variant: 'destructive' });
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    toast({ title: 'Upload error', description: 'Failed to upload file.', variant: 'destructive' });
                                  } finally {
                                    setIsUploadingProofFile(false);
                                  }
                                }}
                              />
                            </label>
                          ) : (
                            <div className="relative border-2 border-dashed border-green-500/30 dark:border-green-800/40 rounded-xl overflow-hidden min-h-[180px] bg-muted/10 flex flex-col justify-between">
                              {proofFileUrl.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)/) ? (
                                <div className="w-full flex-1 flex items-center justify-center p-2.5 pb-16">
                                  <img 
                                    src={proofFileUrl} 
                                    alt="Receipt Preview" 
                                    className="max-h-[220px] w-full rounded-lg object-contain bg-background shadow-inner" 
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      target.style.display = 'none';
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 pb-16 gap-2 text-center">
                                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-600 dark:text-green-400">
                                    <Check className="h-5 w-5" />
                                  </div>
                                  <p className="text-sm font-semibold text-foreground">Receipt Uploaded Successfully</p>
                                </div>
                              )}
                              
                              {/* Bottom Control Bar */}
                              <div className="absolute bottom-0 left-0 right-0 z-10 bg-muted/80 backdrop-blur-sm dark:bg-muted/90 p-3 flex justify-between items-center gap-2 border-t border-border/40 w-full">
                                <span className="text-[11px] font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Receipt Loaded
                                </span>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setProofFileUrl(null)}
                                    className="text-xs h-8 text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 rounded-lg px-2.5"
                                  >
                                    Remove / Replace
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t border-border/30">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDialogStep('payment-methods');
                        }}
                        disabled={isSubmittingProof}
                      >
                        Back
                      </Button>
                      <Button
                        size="sm"
                        disabled={isSubmittingProof || isUploadingProofFile || !proofFileUrl}
                        onClick={async () => {
                          if (!proofFileUrl) return;
                          setIsSubmittingProof(true);
                          const amt = Math.max(0, Math.ceil(remainingForApproval));
                          const notes = "Payment proof uploaded by client";
                          const methodLabel = paymentTab === 'banks'
                            ? 'UCB Bank Transfer'
                            : selectedMethod === 'bkash_merchant'
                            ? 'bKash Payment'
                            : selectedMethod === 'bkash_personal'
                            ? 'bKash'
                            : selectedMethod === 'nagad_personal'
                            ? 'Nagad'
                            : 'Mobile Wallet';

                          const result = await submitPaymentProofAction(order.id, {
                            amount: amt,
                            paymentMethod: methodLabel,
                            notes: notes,
                            documentUrl: proofFileUrl
                          });

                          setIsSubmittingProof(false);
                          if ('error' in result) {
                            toast({ title: 'Submission failed', description: result.error, variant: 'destructive' });
                          } else {
                            setOrder(result);
                            toast({ title: 'Proof Submitted!', description: 'Your payment proof has been sent for review.' });
                            setDialogStep('terms');
                          }
                        }}
                      >
                        {isSubmittingProof ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Next'
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : dialogStep === 'payment-methods' ? (
                <>
                  <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setDialogStep('summary');
                        setSelectedMethod(null);
                      }}
                      className="hover:bg-muted p-1.5 rounded-md transition-colors -ml-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    Payment Methods
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="text-xs text-muted-foreground -mt-3 space-y-1.5 leading-relaxed bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-md text-amber-900 dark:text-amber-200 animate-in fade-in-50 duration-200">
                      <p className="font-semibold leading-relaxed flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <span>নিচের উল্লেখিত একাউন্ট ব্যতীত অন্য কোনো একাউন্টে লেনদেন করলে SEVEN SOLUTION কোনভাবেই দায়ী থাকবে না।</span>
                      </p>
                      <div className="pl-5 space-y-1 opacity-90">
                        <p>• রেফারেন্স অপশনে আপনার প্রতিষ্ঠানের নাম লিখে দিবেন প্লিজ।</p>
                        <p>• ১০ হাজারের বেশি পেমেন্ট সরাসরি বিকাশ থেকে ব্যাংকে পাঠাতে পারবেন।</p>
                      </div>
                    </div>
                  </DialogDescription>
                  <div className="space-y-4 pt-2">
                    {/* Tabs Header */}
                    <div className="flex bg-muted p-1 rounded-md gap-1 border border-border/10 text-xs font-medium items-center">
                      {/* Wallets Tab */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentTab('wallets');
                          setSelectedMethod(null);
                        }}
                        className={cn(
                          "flex-1 py-1.5 px-2 rounded-md transition-all capitalize font-semibold flex items-center justify-center gap-1.5 text-[11px] sm:text-xs whitespace-nowrap overflow-hidden text-ellipsis",
                          paymentTab === 'wallets'
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Wallet className="h-3.5 w-3.5 text-pink-500 flex-shrink-0" />
                        <span className="truncate">Wallets</span>
                      </button>

                      {/* Middle Non-clickable Amount Display */}
                      <div className="flex-1 py-1.5 px-2 flex items-center justify-center font-medium text-white text-[11px] sm:text-xs select-none pointer-events-none whitespace-nowrap bg-blue-500 rounded-md shadow-sm">
                        BDT {Math.round(remainingForApproval).toLocaleString('en-US')}
                      </div>

                      {/* Banks Tab */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentTab('banks');
                          setSelectedMethod(null);
                        }}
                        className={cn(
                          "flex-1 py-1.5 px-2 rounded-md transition-all capitalize font-semibold flex items-center justify-center gap-1.5 text-[11px] sm:text-xs whitespace-nowrap overflow-hidden text-ellipsis",
                          paymentTab === 'banks'
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Landmark className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="truncate">Banks</span>
                      </button>
                    </div>

                    {/* Wallets Content */}
                    {paymentTab === 'wallets' && (
                      <div className="flex flex-col gap-4 pt-3 animate-in fade-in-50 duration-200">
                        {/* bKash Merchant */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedMethod('bkash_merchant')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setSelectedMethod('bkash_merchant');
                            }
                          }}
                          className={cn(
                            "w-full px-4 border rounded-md flex items-center justify-between transition-all relative text-left overflow-visible cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/40 dark:focus:ring-white/40 select-none",
                            selectedMethod === 'bkash_merchant' 
                              ? "border-black dark:border-white bg-black/5 dark:bg-white/5 ring-1 ring-black/20 dark:ring-white/20 shadow-md shadow-black/5" 
                              : "border-border bg-card shadow-sm"
                          )}
                        >
                          <div className="w-24 h-10 rounded-md flex items-center justify-center flex-shrink-0">
                            <Image
                              src="/pm/bkash-payment.png"
                              alt="Payment bKash"
                              width={88}
                              height={24}
                              className="object-contain animate-in zoom-in-95 duration-150"
                              unoptimized
                            />
                          </div>
                          <div className="flex items-center border border-border rounded-md bg-muted/30 pl-2.5 pr-1.5 py-0.5 gap-1">
                            <span className="text-[13px] sm:text-sm font-medium text-foreground">
                              01860-594270
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, "01860-594270", "bkash_merchant")}
                              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-black dark:hover:text-white rounded transition-colors flex-shrink-0"
                            >
                              {copiedText === "bkash_merchant" ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 animate-in zoom-in-50 duration-150" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* bKash Personal */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedMethod('bkash_personal')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setSelectedMethod('bkash_personal');
                            }
                          }}
                          className={cn(
                            "w-full px-4 border rounded-md flex items-center justify-between transition-all relative text-left overflow-visible cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/40 select-none",
                            selectedMethod === 'bkash_personal' 
                              ? "border-pink-500 bg-pink-500/5 ring-1 ring-pink-500/20 shadow-md shadow-pink-500/5" 
                              : "border-border bg-card shadow-sm"
                          )}
                        >
                          <div className="w-24 h-10 rounded-md flex items-center justify-center flex-shrink-0">
                            <Image
                              src="/pm/bkash.png"
                              alt="Personal bKash"
                              width={40}
                              height={26}
                              className="object-contain animate-in zoom-in-95 duration-150"
                              unoptimized
                            />
                          </div>
                          <div className="flex items-center border border-border rounded-md bg-muted/30 pl-2.5 pr-1.5 py-0.5 gap-1">
                            <span className="text-[13px] sm:text-sm font-medium text-foreground">
                              01676-121893
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, "01676-121893", "bkash_personal")}
                              className="p-1 hover:bg-pink-500/10 text-muted-foreground hover:text-pink-500 rounded transition-colors flex-shrink-0"
                            >
                              {copiedText === "bkash_personal" ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 animate-in zoom-in-50 duration-150" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Nagad Personal */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedMethod('nagad_personal')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setSelectedMethod('nagad_personal');
                            }
                          }}
                          className={cn(
                            "w-full px-4 border rounded-md flex items-center justify-between transition-all relative text-left overflow-visible cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 select-none",
                            selectedMethod === 'nagad_personal' 
                              ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20 shadow-md shadow-blue-500/5" 
                              : "border-border bg-card shadow-sm"
                          )}
                        >
                          <div className="w-24 h-10 rounded-md flex items-center justify-center flex-shrink-0">
                            <Image
                              src="/pm/nagad.png"
                              alt="Personal Nagad"
                              width={48}
                              height={20}
                              className="object-contain animate-in zoom-in-95 duration-150"
                              unoptimized
                            />
                          </div>
                          <div className="flex items-center border border-border rounded-md bg-muted/30 pl-2.5 pr-1.5 py-0.5 gap-1">
                            <span className="text-[13px] sm:text-sm font-medium text-foreground">
                              01676-121893
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, "01676-121893", "nagad_personal")}
                              className="p-1 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 rounded-md transition-colors ml-1 flex-shrink-0"
                            >
                              {copiedText === "nagad_personal" ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 animate-in zoom-in-50 duration-150" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Banks Content */}
                    {paymentTab === 'banks' && (
                      <div className="space-y-2.5 animate-in fade-in-50 slide-in-from-top-2 duration-200 text-xs text-muted-foreground">
                        <div className="p-3 bg-card border border-border rounded-md space-y-3">
                          <div className="flex justify-center py-1 bg-white rounded-md p-1 border border-border/10">
                            <Image
                              src="/pm/ucb.svg"
                              alt="UCB Logo"
                              width={160}
                              height={48}
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                          <div className="space-y-1 border-t border-border/50 pt-2.5">
                            <p><strong className="text-foreground">Branch:</strong> Dania Branch</p>
                            <p><strong className="text-foreground">Account Name:</strong> COLOR HEART</p>
                            <p><strong className="text-foreground">Account Number:</strong> 0872101000007053</p>
                            <p><strong className="text-foreground">Routing Number:</strong> 245271423</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Dynamic Guides */}
                    {selectedMethod && (
                      <div className="space-y-2.5 animate-in fade-in-50 slide-in-from-top-2 duration-200">
                        {selectedMethod === 'visa_master' && (
                          <>
                            <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              Visa/Mastercard Gateway
                            </h4>
                            <div className="text-xs space-y-1 text-muted-foreground">
                              <p>Direct payment integration will allow online payment processing.</p>
                              <p className="font-semibold text-yellow-600 dark:text-yellow-400 mt-1.5">Note: Interactive gateway flow is coming soon.</p>
                            </div>
                          </>
                        )}
                        {selectedMethod === 'nexus' && (
                          <>
                            <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              DBBL Nexus Card Gateway
                            </h4>
                            <div className="text-xs space-y-1 text-muted-foreground">
                              <p>Pay instantly using your Dutch-Bangla Bank Nexus Debit card PIN and OTP.</p>
                              <p className="font-semibold text-yellow-600 dark:text-yellow-400 mt-1.5">Note: Interactive gateway flow is coming soon.</p>
                            </div>
                          </>
                        )}

                      </div>
                    )}

                    {/* Default Reference Note */}
                    <div className="text-xs pt-1.5 border-t border-border/30">
                      <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        * Reference-এ আপনার প্রতিষ্ঠানের নাম লিখুন।
                      </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDialogStep('summary');
                          setSelectedMethod(null);
                        }}
                      >
                        Back
                      </Button>
                      <Button
                        size="sm"
                        disabled={paymentTab === 'wallets' && !selectedMethod}
                        onClick={() => {
                          setProofFileUrl(null);
                          setDialogStep('payment-proof');
                        }}
                      >
                        Submit Proof
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Insufficient Payment
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground -mt-3">
                    A minimum of 50% advance payment is required to approve this order for production. Currently, only {paymentPercentage.toFixed(1)}% has been paid.
                  </DialogDescription>
                  <div className="space-y-4 pt-2">
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-md text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                      <div className="w-full">
                        <div className="text-xs space-y-1.5 font-medium max-w-[280px]">
                          <div className="flex justify-between">
                            <span className="opacity-80">Net Payable:</span>
                            <span>{formatCurrency(netPayable)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-80">Required (50%):</span>
                            <span>{formatCurrency(netPayable * 0.5)}</span>
                          </div>
                          <div className="flex justify-between text-green-600 dark:text-green-400 font-semibold">
                            <span className="opacity-80">Total Paid:</span>
                            <span>{formatCurrency(totalAdvancePaid)}</span>
                          </div>
                          <div className="flex justify-between text-red-600 dark:text-red-400 font-semibold">
                            <span className="opacity-80">More Needed:</span>
                            <span>{formatCurrency(remainingForApproval)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 flex justify-end">
                      {isOnlinePaymentEnabled ? (
                        <Button size="sm" asChild>
                          <a href={`/api/payment/pay/${encodeURIComponent(order.id)}?amount=${Math.ceil(remainingForApproval)}`}>
                            Pay {formatCurrency(remainingForApproval)}
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" disabled>
                          Online payment unavailable
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )
            ) : (
              <>
                <DialogTitle className="text-lg font-bold text-foreground">
                  প্রিয় গ্রাহক
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground -mt-3 leading-relaxed">
                  আপনার মেনু ডিজাইন কাজটি সঠিক ও দ্রুত সম্পন্ন করার জন্য অনুগ্রহ করে নিচের বিষয়গুলো যাচাই করে অনুমোদন প্রদান করুন:
                </DialogDescription>
                <div className="space-y-5 -mt-3 pt-0">
                  {isClearance ? (
                    <>
                      {/* Document Approval Terms and Conditions in Bengali */}
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-4 space-y-3.5 text-foreground/80 max-h-[40vh] overflow-y-auto">
                        <div className="space-y-2.5 pl-1">
                          <p className="text-[11px] sm:text-xs font-bold text-foreground/90 uppercase tracking-wider">আমি নিশ্চিত করছি যে—</p>
                          <ul className="space-y-2 text-[11px] sm:text-xs">
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>মেনুর সকল আইটেম, মূল্য, বানান, অফার ও তথ্য আমি যাচাই করেছি।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>প্রয়োজনীয় সকল ছবি, লোগো, ব্র্যান্ড গাইডলাইন এবং ডকুমেন্ট Seven Solution-কে প্রদান করা হয়েছে।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>পরবর্তীতে আমার পক্ষ থেকে নতুন তথ্য, আইটেম বা বড় ধরনের পরিবর্তন যোগ হলে অতিরিক্ত সময় ও চার্জ প্রযোজ্য হতে পারে।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>প্রদত্ত তথ্য ও ডকুমেন্ট অনুযায়ী ডিজাইন কাজ শুরু করা যাবে।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>ডিজাইন চলাকালীন সম্পূর্ণ নতুন কনসেপ্ট, নতুন মেনু স্ট্রাকচার বা অতিরিক্ত কনটেন্ট যুক্ত করার অনুরোধ করলে কাজের সময়সীমা পরিবর্তিত হতে পারে।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>চূড়ান্ত প্রুফ (Final Proof) অনুমোদনের পর বানান, মূল্য বা তথ্যগত ভুলের দায়ভার আমার থাকবে।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>সকল তথ্য, মূল্য, ছবি, লোগো এবং কনটেন্ট পূর্বেই জমা ও অনুমোদন করা হয়েছে।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>এই পর্যায়ের পর নতুন আইটেম, নতুন পেজ, নতুন ছবি, নতুন ক্যাটাগরি, নতুন মূল্য তালিকা অথবা বড় ধরনের কনটেন্ট পরিবর্তনকে অতিরিক্ত কাজ (Additional Work) হিসেবে গণ্য করা হবে।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>আমার পক্ষ থেকে দেরিতে তথ্য প্রদান, তথ্য পরিবর্তন বা নতুন নির্দেশনার কারণে ডেলিভারি সময় বৃদ্ধি পেতে পারে।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>এই অনুমোদনের পর কাজের পরিধি (Scope of Work) লক করা হয়েছে বলে আমি সম্মতি প্রদান করছি।</span>
                            </li>
                          </ul>
                        </div>

                        <Separator className="bg-zinc-200 dark:bg-zinc-800/80 my-1.5" />

                        <p className="text-xs font-semibold text-foreground/90 leading-relaxed">
                          আমি উপরোক্ত সকল শর্ত বুঝে ডিজাইন কাজ চালিয়ে যাওয়ার জন্য চূড়ান্ত অনুমোদন প্রদান করছি।
                        </p>

                        <div className="grid grid-cols-1 gap-2 text-[11px] bg-white dark:bg-zinc-950/40 p-3 rounded-lg border border-zinc-150 dark:border-zinc-850">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                            <span>১–২টি ছোট সংশোধন = <span className="font-semibold text-blue-600 dark:text-blue-400">Free</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                            <span>নতুন পেজ যোগ = <span className="font-semibold text-purple-600 dark:text-purple-400">Extra Charge</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                            <span>২০% এর বেশি কনটেন্ট পরিবর্তন = <span className="font-semibold text-amber-600 dark:text-amber-400">New Revision Charge</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            <span>ডিজাইনার অ্যাসাইনের পর সম্পূর্ণ নতুন মেনু স্ট্রাকচার = <span className="font-semibold text-red-600 dark:text-red-400">New Project Scope</span></span>
                          </div>
                        </div>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer group pt-1.5 select-none">
                        <input
                          type="checkbox"
                          checked={designChecked && paymentChecked && noModificationChecked}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDesignChecked(val);
                            setPaymentChecked(val);
                            setNoModificationChecked(val);
                          }}
                          className="h-4.5 w-4.5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer transition-all duration-200"
                        />
                        <span className="text-xs sm:text-sm font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                          অনুমোদন: <span className="text-primary font-bold underline decoration-wavy decoration-primary/45 underline-offset-4">হ্যাঁ, আমি সম্মতি প্রদান করছি।</span>
                        </span>
                      </label>
                    </>
                  ) : (
                    <>
                      {/* Final Design & Print Approval in Bengali */}
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-4 space-y-3.5 text-foreground/80 max-h-[40vh] overflow-y-auto">
                        <div className="space-y-2.5 pl-1">
                          <p className="text-[11px] sm:text-xs font-semibold text-foreground/90">আমি নিশ্চিত করছি যে—</p>
                          <ul className="space-y-2 text-[11px] sm:text-xs">
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>মেনুর সকল আইটেম, মূল্য, বানান, ছবি এবং তথ্য আমি নিজে যাচাই করেছি।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>Final Proof (PDF/JPG) আমি দেখে অনুমোদন প্রদান করেছি।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>মেনুর প্রতিটি পেজে আইটেম সংখ্যা, ফন্ট সাইজ, ছবি এবং ডিজাইন লেআউট সম্পর্কে আমি অবগত আছি।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>আমি বুঝতে পারছি যে একটি কার্যকর Menu Design-এর জন্য প্রতি পেজে সীমিত সংখ্যক আইটেম রাখা, পর্যাপ্ত স্পেস রাখা এবং খাবারের ছবি বড় আকারে প্রদর্শন করা প্রয়োজন।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>আমার অনুরোধে অতিরিক্ত আইটেম, অতিরিক্ত ছবি বা অতিরিক্ত তথ্য যুক্ত করার ফলে ফন্ট ছোট হওয়া, ছবি ছোট হওয়া বা ডিজাইনের ভারসাম্য পরিবর্তিত হতে পারে।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>প্রিন্টিং শুরু হওয়ার পর কোনো মূল্য, বানান, আইটেম, ছবি, ডিজাইন বা তথ্যগত পরিবর্তনের দায় Seven Solution বহন করবে না।</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-zinc-400 dark:text-zinc-650 flex-shrink-0 mt-0.5 select-none font-bold text-xs sm:text-sm">&bull;</span>
                              <span>প্রিন্টিং সম্পন্ন হওয়ার পর "প্রাইস খেয়াল করিনি", "এই আইটেম বাদ দিতে হবে", "লেখা বড় করতে হবে", "ছবি আরও বড় চাই" ইত্যাদি কারণে রিফান্ড, রিপ্রিন্ট বা ফ্রি রিডিজাইন প্রযোজ্য হবে না।</span>
                            </li>
                          </ul>
                        </div>

                        <Separator className="bg-zinc-200 dark:bg-zinc-800/80 my-1.5" />

                        <p className="text-xs font-semibold text-foreground/90 leading-relaxed">
                          আমি Final Proof দেখে প্রিন্টের জন্য চূড়ান্ত অনুমোদন প্রদান করছি।
                        </p>

                        <div className="text-[11px] bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-200">
                          <p className="leading-relaxed">
                            আমাদের অভিজ্ঞতা অনুযায়ী প্রতি পেজে সর্বোচ্চ ১০-১৫টি আইটেম রাখা এবং নির্বাচিত খাবারের ছবি বড় আকারে প্রদর্শন করা বিক্রয় বৃদ্ধিতে সহায়ক। অতিরিক্ত আইটেম বা অতিরিক্ত ছবি যুক্ত করার অনুরোধ গ্রাহকের নিজস্ব সিদ্ধান্ত হিসেবে গণ্য হবে এবং এর ফলে ডিজাইনের পাঠযোগ্যতা বা ভিজ্যুয়াল কার্যকারিতা কমে গেলে Seven Solution দায়ী থাকবে না।
                          </p>
                        </div>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer group pt-1.5 select-none">
                        <input
                          type="checkbox"
                          checked={designChecked && paymentChecked && noModificationChecked}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDesignChecked(val);
                            setPaymentChecked(val);
                            setNoModificationChecked(val);
                          }}
                          className="h-4.5 w-4.5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer transition-all duration-200"
                        />
                        <span className="text-xs sm:text-sm font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                          অনুমোদন: <span className="text-primary font-bold underline decoration-wavy decoration-primary/45 underline-offset-4">হ্যাঁ, আমি সম্মতি প্রদান করছি।</span>
                        </span>
                      </label>
                    </>
                  )}

                  <div className="pt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsApprovalDialogOpen(false)}
                      disabled={isApproving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleApproveOrder}
                      disabled={isApproving || !designChecked || !paymentChecked || !noModificationChecked}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-md hover:shadow-primary/30 transition-all duration-200"
                    >
                      {isApproving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        "Approve"
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
