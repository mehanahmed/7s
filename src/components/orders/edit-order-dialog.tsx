
"use client";

import { PaymentProofField } from '@/components/common/PaymentProofField';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TrackingLink, User, ServicePaymentMethodItem, OrderItem, ServiceModelItem, ServiceLaminationItem, ServiceVariationItem, AdvancePaymentRecord } from "@/types";
import { useToast } from '@/hooks/use-toast';
import { updateOrderAction, getClientDetailsAction, getClientPaymentsAction, deleteClientPaymentsBatchAction } from '@/app/(app)/orders/actions';
import { getPaymentMethods, getModels, getLaminations, getVariations } from '@/lib/service-options-service';
import { getGlobalSettings } from '@/lib/settings-service';
import { Loader2, PlusCircle, Trash2, ChevronsUpDown, Check, Info, Percent, CalendarDays, ReceiptText, UploadCloud, Paperclip, XCircle, Link as LinkIcon, Edit, AlertTriangle, Save, X, Star, Undo2, MoreVertical, Gift } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { v4 as uuidv4 } from 'uuid';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NextLink from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


interface EditOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  order: TrackingLink;
  currentUser: User;
  onOrderUpdated: (updatedOrder: TrackingLink) => void;
  allOrders?: TrackingLink[];
}

interface DialogOrderItem {
  id: string;
  model: string;
  quantity: string;
  lamination: string;
  variation?: string;
  unit?: string;
  unitPrice: number | null;
  lineItemTotalPrice: number | null;
  isGift?: boolean;
}

const formatCurrencyBdt = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BDT' }).format(value);
};

const formatDateForDialogInput = (dateString: string | Date | undefined): string => {
  if (!dateString) return "N/A";
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, "PPP");
  } catch (e) {
    return "Invalid Date";
  }
};


export function EditOrderDialog({ isOpen, onOpenChange, order, currentUser, onOrderUpdated, allOrders }: EditOrderDialogProps) {
  const [jobIdInput, setJobIdInput] = useState('');
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [createdAt, setCreatedAt] = useState<Date | undefined>(undefined);
  const [acceptedDeliveryDate, setAcceptedDeliveryDate] = useState<Date | undefined>(undefined);
  const [specialClientDiscount, setSpecialClientDiscount] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [isStarred, setIsStarred] = useState<number>(0);

  const initialJobIdRef = useRef('');
  const initialCompanyNameRef = useRef('');
  const initialAddressRef = useRef('');
  const initialPhoneNumberRef = useRef('');

  const [orderItems, setOrderItems] = useState<DialogOrderItem[]>([]);
  const [orderItemsTotal, setOrderItemsTotal] = useState<number>(0);
  const [calculatedDiscountAmount, setCalculatedDiscountAmount] = useState<number>(0);
  const [netPayable, setNetPayable] = useState<number>(0);
  const [amountDue, setAmountDue] = useState<number>(0);
  const [adminVatPercent, setAdminVatPercent] = useState(0);
  // rate stored on the order; orders created before VAT existed show (and on save take) the current admin rate
  const vatPercent = order?.vatPercentage != null ? Number(order.vatPercentage) || 0 : adminVatPercent;
  const vatAmount = Math.round(netPayable * vatPercent) / 100;

  const [modelOptions, setModelOptions] = useState<ServiceModelItem[]>([]);
  const [laminationOptions, setLaminationOptions] = useState<ServiceLaminationItem[]>([]);
  const [variationOptions, setVariationOptions] = useState<ServiceVariationItem[]>([]);
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<ServicePaymentMethodItem[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [popoverOpenStates, setPopoverOpenStates] = useState<Record<string, boolean>>({});
  const [isPaymentMethodPopoverOpen, setIsPaymentMethodPopoverOpen] = useState(false);

  const [newAdvanceAmount, setNewAdvanceAmount] = useState('');
  const [newAdvancePaymentMethod, setNewAdvancePaymentMethod] = useState('');
  const [showNewCustomPaymentInput, setShowNewCustomPaymentInput] = useState(false);
  const [newCustomPaymentMethodText, setNewCustomPaymentMethodText] = useState('');
  const [newAdvancePaymentNotes, setNewAdvancePaymentNotes] = useState('');

  const [existingAdvancePayments, setExistingAdvancePayments] = useState<AdvancePaymentRecord[]>([]);
  const [totalExistingAdvancePaid, setTotalExistingAdvancePaid] = useState(0);
  const [shippingCharge, setShippingCharge] = useState<string>('0');

  const [selectedPaymentProof, setSelectedPaymentProof] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const paymentProofRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOrderDatePopoverOpen, setIsOrderDatePopoverOpen] = useState(false);
  const [isDeliveryDatePopoverOpen, setIsDeliveryDatePopoverOpen] = useState(false);
  const { toast } = useToast();

  const [paymentToDelete, setPaymentToDelete] = useState<AdvancePaymentRecord | null>(null);

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState('');
  const [editingMethod, setEditingMethod] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [clientPayments, setClientPayments] = useState<any[]>([]);
  const [queuedDeletedClientPaymentIds, setQueuedDeletedClientPaymentIds] = useState<string[]>([]);
  const [addedClientPaymentsMap, setAddedClientPaymentsMap] = useState<Record<string, string>>({});


  const fetchDialogOptions = useCallback(async () => {
    setIsLoadingOptions(true);
    try {
      const [fetchedPaymentMethods, fetchedModels, fetchedLaminations, fetchedVariations] = await Promise.all([
        getPaymentMethods(), getModels(), getLaminations(), getVariations()
      ]);
      setPaymentMethodOptions(fetchedPaymentMethods);
      setModelOptions(fetchedModels);
      setLaminationOptions(fetchedLaminations);
      setVariationOptions(fetchedVariations);
    } catch (error) {
      console.error("Failed to fetch dialog options:", error);
      toast({ title: "Error", description: "Could not load dialog options.", variant: "destructive" });
    } finally {
      setIsLoadingOptions(false);
    }
  }, [toast]);

  const resetForm = useCallback(() => {
    if (order) {
      const companyNameString = order.companyName || "";
      const separator = " • ";
      const firstSeparatorIndex = companyNameString.indexOf(separator);
      let parsedJobId = '';
      let parsedCompanyName = '';
      if (firstSeparatorIndex !== -1) {
        parsedJobId = companyNameString.substring(0, firstSeparatorIndex).trim();
        parsedCompanyName = companyNameString.substring(firstSeparatorIndex + separator.length).trim();
      } else {
        parsedCompanyName = companyNameString.trim();
      }

      setJobIdInput(parsedJobId);
      setCompanyNameInput(parsedCompanyName);
      setAddress(order.address || '');
      setPhoneNumber(order.phoneNumber || '');

      initialJobIdRef.current = parsedJobId;
      initialCompanyNameRef.current = parsedCompanyName;
      initialAddressRef.current = order.address || '';
      initialPhoneNumberRef.current = order.phoneNumber || '';

      setCreatedAt(order.createdAt ? parseISO(order.createdAt) : undefined);
      setAcceptedDeliveryDate(order.acceptedDeliveryDate ? parseISO(order.acceptedDeliveryDate) : undefined);
      setSpecialClientDiscount(order.specialClientDiscount && Number(order.specialClientDiscount) !== 0 ? order.specialClientDiscount.toString() : '');
      setOrderNotes(order.orderNotes || '');
      setOrderItems(order.orderItems.map(item => ({ ...item, quantity: item.quantity.toString() })));
      setShippingCharge(order.shippingCharge && Number(order.shippingCharge) !== 0 ? order.shippingCharge.toString() : '');
      setIsStarred(order.isStarred || 0);

      const currentAdvancePayments = order.advancePayments || [];
      if (currentAdvancePayments.length === 0 && order.advancePayment && order.advancePayment > 0) {
        const legacyRecord: AdvancePaymentRecord = {
          id: 'legacy-advance-001',
          amount: order.advancePayment,
          date: order.createdAt,
          paymentMethod: order.paymentMethod || "Unknown",
          notes: "Initial advance payment (legacy).",
          recordedByUserId: order.crmUserId,
          recordedByUserName: order.crmUserName,
        };
        setExistingAdvancePayments([legacyRecord]);
      } else {
        setExistingAdvancePayments(currentAdvancePayments);
      }
    }
    setNewAdvanceAmount(''); setNewAdvancePaymentMethod(''); setNewAdvancePaymentNotes('');
    setShowNewCustomPaymentInput(false); setNewCustomPaymentMethodText('');
    setPopoverOpenStates({}); setIsPaymentMethodPopoverOpen(false);
    setIsSubmitting(false);
    setSelectedPaymentProof(null);
    setIsUploadingProof(false);
    setEditingPaymentId(null);
    setEditingAmount('');
    setEditingMethod('');
    setEditingNotes('');
    setIsAutoFilled(false);
    setQueuedDeletedClientPaymentIds([]);
    setAddedClientPaymentsMap({});
  }, [order]);

  useEffect(() => {
    const fetchClientPayments = async () => {
      if (isOpen && order?.id) {
        setClientPayments([]);
        try {
          const res = await getClientPaymentsAction(order.id);
          if (res && res.success && res.payments) {
            setClientPayments(res.payments);
          }
        } catch (error) {
          console.error("Error fetching client payments for dialog:", error);
        }
      }
    };
    fetchClientPayments();
  }, [isOpen, order?.id]);

  useEffect(() => {
    if (isOpen) fetchDialogOptions();
  }, [isOpen, fetchDialogOptions]);

  useEffect(() => {
    if (isOpen && order && !isLoadingOptions) resetForm();
  }, [isOpen, order, isLoadingOptions, resetForm]);

  useEffect(() => {
    if (!isOpen) return;

    const trimmedJobId = jobIdInput.trim();

    if (!trimmedJobId) {
      if (isAutoFilled) {
        setCompanyNameInput('');
        setAddress('');
        setPhoneNumber('');
        setIsAutoFilled(false);
      }
      return;
    }

    if (trimmedJobId === initialJobIdRef.current) {
      setCompanyNameInput(initialCompanyNameRef.current);
      setAddress(initialAddressRef.current);
      setPhoneNumber(initialPhoneNumberRef.current);
      setIsAutoFilled(false);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        const res = await getClientDetailsAction(trimmedJobId);
        if (res && res.success && res.client) {
          const client = res.client;
          setCompanyNameInput(client.company_name);
          setAddress(client.address);
          setPhoneNumber(client.phone_number);
          setIsAutoFilled(true);

          toast({
            title: "Existing Client Found",
            description: `Details for "${trimmedJobId}" have been auto-filled from clients database.`,
          });
          return;
        }
      } catch (err) {
        console.error("Error fetching client details:", err);
      }

      if (allOrders && allOrders.length > 0) {
        const existingOrder = allOrders.find(o => {
          const orderJobId = (o.companyName || '').split(' • ')[0].trim();
          return orderJobId.toLowerCase() === trimmedJobId.toLowerCase();
        });

        if (existingOrder) {
          const nameParts = (existingOrder.companyName || '').split(' • ');
          const actualCompanyName = nameParts.length > 1 ? nameParts.slice(1).join(' • ').trim() : '';

          setCompanyNameInput(actualCompanyName);
          setAddress(existingOrder.address);
          setPhoneNumber(existingOrder.phoneNumber);
          setIsAutoFilled(true);

          toast({
            title: "Existing Client ID Found",
            description: `Details for "${trimmedJobId}" have been auto-filled from existing orders.`,
          });
          return;
        }
      }

      if (isAutoFilled) {
        setCompanyNameInput('');
        setAddress('');
        setPhoneNumber('');
        setIsAutoFilled(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [jobIdInput, allOrders, toast, isOpen, isAutoFilled]);

  useEffect(() => {
    const currentItemsTotal = orderItems.reduce((sum, item) => sum + (item.isGift ? 0 : (item.lineItemTotalPrice || 0)), 0);
    setOrderItemsTotal(currentItemsTotal);

    let discountNum = 0;
    const discountStr = specialClientDiscount.trim();
    if (discountStr.endsWith('%')) {
      const percentage = parseFloat(discountStr.substring(0, discountStr.length - 1));
      if (!isNaN(percentage) && percentage >= 0) discountNum = (percentage / 100) * currentItemsTotal;
    } else {
      const fixedAmount = parseFloat(discountStr);
      if (!isNaN(fixedAmount) && fixedAmount >= 0) discountNum = fixedAmount;
    }
    discountNum = Math.min(discountNum, currentItemsTotal);
    setCalculatedDiscountAmount(discountNum);

    const currentNetPayable = Math.max(0, currentItemsTotal - discountNum);
    setNetPayable(currentNetPayable);

    const currentTotalExistingAdvance = existingAdvancePayments.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
    setTotalExistingAdvancePaid(currentTotalExistingAdvance);

    const newAdvanceNum = parseFloat(newAdvanceAmount) || 0;
    const shippingChargeNum = parseFloat(shippingCharge) || 0;
    const grandTotal = currentNetPayable + Math.round(currentNetPayable * vatPercent) / 100 + shippingChargeNum;

    setAmountDue(Math.max(0, grandTotal - currentTotalExistingAdvance - newAdvanceNum));
  }, [orderItems, specialClientDiscount, newAdvanceAmount, existingAdvancePayments, shippingCharge, vatPercent]);

  useEffect(() => {
    if (editingPaymentId && amountInputRef.current) {
      amountInputRef.current.focus();
      amountInputRef.current.select();
    }
  }, [editingPaymentId]);

  const isAdmin = useMemo(() => currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN', [currentUser]);

  const handleStartEditPayment = (payment: AdvancePaymentRecord) => {
    if (!isAdmin) return;
    setEditingPaymentId(payment.id);
    setEditingAmount(payment.amount.toString());
    setEditingMethod(payment.paymentMethod || '');
    setEditingNotes(payment.notes || '');
  };

  const handleSavePaymentEdit = (paymentId: string) => {
    const newAmount = parseFloat(editingAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid positive number for the payment.", variant: "destructive" });
      setEditingAmount(existingAdvancePayments.find(p => p.id === paymentId)?.amount.toString() || '0');
      return;
    }
    setExistingAdvancePayments(prev =>
      prev.map(p => p.id === paymentId ? { ...p, amount: newAmount, paymentMethod: editingMethod, notes: editingNotes } : p)
    );
    setEditingPaymentId(null);
  };

  const handleCancelPaymentEdit = () => {
    setEditingPaymentId(null);
  };


  const calculateLineItemTotal = (unitPrice: number | null, quantityStr: string, unitStr?: string): number | null => {
    if (unitPrice === null) return null;
    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity) || quantity < 1) return null;
    let unitMultiplier = 1;
    if (unitStr) {
      const parsedUnit = parseFloat(unitStr);
      if (!isNaN(parsedUnit) && parsedUnit > 0) {
        unitMultiplier = parsedUnit;
      }
    }
    return unitPrice * quantity * unitMultiplier;
  };

  const handleItemChange = (itemId: string, field: keyof DialogOrderItem | 'modelName', value: string | number | null) => {
    setOrderItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item;
      const updatedItem = { ...item };
      if (field === 'modelName') updatedItem.model = modelOptions.find(opt => opt.name === value)?.name ?? '';
      else if (field === 'lamination') updatedItem.lamination = value as string;
      else if (field === 'quantity') updatedItem.quantity = value as string;
      else if (field === 'unitPrice') {
        const n = parseFloat(String(value));
        updatedItem.unitPrice = isNaN(n) || n < 0 ? null : n;
      }
      updatedItem.lineItemTotalPrice = calculateLineItemTotal(updatedItem.unitPrice, updatedItem.quantity);
      return updatedItem;
    }));
  };

  const lastTapRef = useRef<{ [key: string]: number }>({});
  const handleAddItem = () => setOrderItems(prev => [...prev, { id: uuidv4(), model: '', quantity: '1', lamination: '', unitPrice: null, lineItemTotalPrice: null, isGift: false }]);
  const handleRemoveItem = (id: string) => { if (orderItems.length > 1) setOrderItems(prev => prev.filter(item => item.id !== id)); };
  const handleToggleGift = (itemId: string) => {
    setOrderItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, isGift: !item.isGift } : item
      )
    );
  };
  const handleItemTouchEnd = (itemId: string, e: React.TouchEvent) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[itemId] || 0;
    if (now - lastTap < 350) {
      e.preventDefault();
      handleToggleGift(itemId);
      lastTapRef.current[itemId] = 0;
    } else {
      lastTapRef.current[itemId] = now;
    }
  };
  const togglePopover = (itemId: string, open?: boolean) => setPopoverOpenStates(prev => ({ ...prev, [itemId]: open === undefined ? !prev[itemId] : open }));

  const handleNewAdvancePaymentMethodChange = (value: string) => {
    setNewAdvancePaymentMethod(value);
    setShowNewCustomPaymentInput(value.toLowerCase() === 'other');
    if (value.toLowerCase() !== 'other') setNewCustomPaymentMethodText('');
  };

  const handleDiscountChangeEdit = (value: string) => {
    setSpecialClientDiscount(value);
    let discountVal = 0;
    const discountStr = value.trim();
    if (discountStr.endsWith('%')) {
      const percentage = parseFloat(discountStr.substring(0, discountStr.length - 1));
      if (!isNaN(percentage) && percentage >= 0) {
        discountVal = (percentage / 100) * orderItemsTotal;
      }
    } else {
      const fixedAmount = parseFloat(discountStr);
      if (!isNaN(fixedAmount) && fixedAmount >= 0) {
        discountVal = fixedAmount;
      }
    }

    if (discountVal > orderItemsTotal && orderItemsTotal > 0) {
      toast({
        title: "Validation Warning",
        description: `Special Client Discount cannot exceed total items price of ${formatCurrencyBdt(orderItemsTotal)}.`,
        variant: "destructive"
      });
    }
  };

  const isNewAdvanceEntered = (parseFloat(newAdvanceAmount) || 0) > 0;

  useEffect(() => {
    if (!isNewAdvanceEntered) {
      setNewAdvancePaymentMethod('');
      setNewCustomPaymentMethodText('');
      setShowNewCustomPaymentInput(false);
    }
  }, [isNewAdvanceEntered]);

  const handleProofFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File too large", description: "Please select an image smaller than 5MB.", variant: "destructive" });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid File Type", description: "Please select an image file.", variant: "destructive" });
        return;
      }
      setSelectedPaymentProof(file);
    }
  };

  const handleRemoveProofFile = () => {
    setSelectedPaymentProof(null);
    if (paymentProofRef.current) paymentProofRef.current.value = "";
  };

  const handleAddClientPaymentToInvoice = (clientPayment: any) => {
    const newRecordId = uuidv4();
    const newRecord: AdvancePaymentRecord = {
      id: newRecordId,
      amount: clientPayment.amount,
      date: clientPayment.createdAt ? (typeof clientPayment.createdAt === 'string' ? clientPayment.createdAt : new Date(clientPayment.createdAt).toISOString()) : new Date().toISOString(),
      paymentMethod: clientPayment.paymentMethod || 'Unknown',
      notes: clientPayment.notes || 'Added from client submission.',
      recordedByUserId: clientPayment.recordedByUserId || currentUser.id,
      recordedByUserName: clientPayment.recordedByUserName || currentUser.name,
      documentUrl: clientPayment.documentUrl || null,
      status: 'Approved',
    };

    setExistingAdvancePayments(prev => [...prev, newRecord]);
    setQueuedDeletedClientPaymentIds(prev => [...prev, clientPayment.id]);
    setAddedClientPaymentsMap(prev => ({ ...prev, [clientPayment.id]: newRecordId }));
    setClientPayments(prev => prev.map(p => p.id === clientPayment.id ? { ...p, isAdded: true } : p));

    toast({
      title: "Payment Added",
      description: `Added BDT ${clientPayment.amount} payment to the invoice. Click "Save Changes" to commit.`,
    });
  };

  const handleUndoClientPayment = (clientPayment: any) => {
    const newRecordId = addedClientPaymentsMap[clientPayment.id];
    if (newRecordId) {
      setExistingAdvancePayments(prev => prev.filter(p => p.id !== newRecordId));
      setQueuedDeletedClientPaymentIds(prev => prev.filter(id => id !== clientPayment.id));
      setAddedClientPaymentsMap(prev => {
        const copy = { ...prev };
        delete copy[clientPayment.id];
        return copy;
      });
      setClientPayments(prev => prev.map(p => p.id === clientPayment.id ? { ...p, isAdded: false } : p));
      toast({
        title: "Payment Removed",
        description: `Removed client payment from invoice.`,
      });
    }
  };

  const handleRemoveClientPayment = (clientPayment: any) => {
    setQueuedDeletedClientPaymentIds(prev => [...prev, clientPayment.id]);
    setClientPayments(prev => prev.map(p => p.id === clientPayment.id ? { ...p, isRemoved: true } : p));
    toast({
      title: "Payment Queued for Removal",
      description: `Client payment of BDT ${clientPayment.amount} will be deleted when you click "Save Changes".`,
    });
  };

  const handleUndoRemoveClientPayment = (clientPayment: any) => {
    setQueuedDeletedClientPaymentIds(prev => prev.filter(id => id !== clientPayment.id));
    setClientPayments(prev => prev.map(p => p.id === clientPayment.id ? { ...p, isRemoved: false } : p));
    toast({
      title: "Removal Undone",
      description: `Restored client payment.`,
    });
  };


  const canSubmit = useMemo(() => {
    if (!currentUser || !currentUser.role) return false;
    const totalAdvanceAfterNew = totalExistingAdvancePaid + (parseFloat(newAdvanceAmount) || 0);
    const shippingChargeNum = parseFloat(shippingCharge) || 0;
    const grandTotal = netPayable + vatAmount + shippingChargeNum;
    const isAdvPaymentValid = totalAdvanceAfterNew <= grandTotal || grandTotal === 0;
    const isDiscountValid = calculatedDiscountAmount <= orderItemsTotal || orderItemsTotal === 0;

    return !isSubmitting && !isUploadingProof && jobIdInput.trim() && companyNameInput.trim() && address.trim() && phoneNumber.trim() && createdAt &&
      !isLoadingOptions && orderItems.length > 0 && orderItems.every(item => item.model && item.quantity && parseInt(item.quantity) > 0 && item.unitPrice !== null && item.lineItemTotalPrice !== null) &&
      !(isNewAdvanceEntered && !newAdvancePaymentMethod.trim()) &&
      !(isNewAdvanceEntered && newAdvancePaymentMethod.toLowerCase() === 'other' && !newCustomPaymentMethodText.trim()) &&
      !(isNewAdvanceEntered && newAdvancePaymentNotes.trim().length < 4) &&
      isAdvPaymentValid && isDiscountValid;
  }, [isSubmitting, isUploadingProof, jobIdInput, companyNameInput, address, phoneNumber, createdAt, isLoadingOptions, orderItems, isNewAdvanceEntered, newAdvancePaymentMethod, newCustomPaymentMethodText, newAdvancePaymentNotes, currentUser, totalExistingAdvancePaid, newAdvanceAmount, netPayable, orderItemsTotal, calculatedDiscountAmount]);


  useEffect(() => {
    getGlobalSettings().then((g) => setAdminVatPercent(Number(g.vatPercentage) || 0)).catch(() => setAdminVatPercent(0));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.role) {
      toast({ title: "Authentication Error", variant: "destructive" }); return;
    }
    if (!canSubmit) {
      toast({ title: "Validation Error", description: "Please fill all required fields correctly and ensure values are valid.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    let newUploadedProofUrl: string | null = null;

    if (isNewAdvanceEntered && selectedPaymentProof) {
      setIsUploadingProof(true);
      const formData = new FormData();
      formData.append('file', selectedPaymentProof);
      try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok && result.success && result.file_url) {
          newUploadedProofUrl = result.file_url;
        } else {
          throw new Error(result.message || 'File upload failed');
        }
      } catch (error) {
        toast({ title: "Payment Proof Upload Failed", description: error instanceof Error ? error.message : "An unknown error occurred.", variant: "destructive" });
        setIsUploadingProof(false);
        setIsSubmitting(false);
        return;
      }
      setIsUploadingProof(false);
    }

    const finalUpdates: Partial<TrackingLink> & {
      specialClientDiscountString?: string | null;
      newAdvancePaymentAmount?: number | null;
      newAdvancePaymentMethod?: string | null;
      newAdvancePaymentNotes?: string | null;
      newAdvancePaymentDocumentUrl?: string | null;
    } = {
      clientId: jobIdInput.trim(),
      companyName: `${jobIdInput.trim()} • ${companyNameInput.trim()}`,
      address: address.trim(),
       phoneNumber: phoneNumber.trim(),
      createdAt: createdAt!.toISOString(),
      acceptedDeliveryDate: acceptedDeliveryDate ? acceptedDeliveryDate.toISOString() : null,
      specialClientDiscountString: specialClientDiscount.trim() || null,
      shippingCharge: parseFloat(shippingCharge) || 0,
      orderNotes: orderNotes.trim() || null,
      orderItems: orderItems.map(item => ({ ...item, quantity: parseInt(item.quantity, 10), unitPrice: item.unitPrice!, lineItemTotalPrice: item.lineItemTotalPrice!, isGift: item.isGift || false })),
      advancePayments: [...existingAdvancePayments],
      isStarred,
    };

    if (parseFloat(newAdvanceAmount) > 0) {
      finalUpdates.newAdvancePaymentAmount = parseFloat(newAdvanceAmount);
      finalUpdates.newAdvancePaymentMethod = newAdvancePaymentMethod.toLowerCase() === 'other' ? newCustomPaymentMethodText.trim() : newAdvancePaymentMethod.trim();
      finalUpdates.newAdvancePaymentNotes = newAdvancePaymentNotes.trim();
      finalUpdates.newAdvancePaymentDocumentUrl = newUploadedProofUrl;
    }

    const result = await updateOrderAction(order.id, finalUpdates, currentUser);
    setIsSubmitting(false);
    if (result.success && result.order) {
      if (queuedDeletedClientPaymentIds.length > 0) {
        try {
          await deleteClientPaymentsBatchAction(queuedDeletedClientPaymentIds);
        } catch (error) {
          console.error("Failed to delete client payments after successful order update:", error);
        }
      }
      onOrderUpdated(result.order);
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not update order.", variant: "destructive" });
    }
  };

  const confirmDeletePayment = () => {
    if (paymentToDelete) {
      setExistingAdvancePayments(prev => prev.filter(p => p.id !== paymentToDelete.id));
      setPaymentToDelete(null);
    }
  };


  const giftTotal = orderItems.reduce((sum, item) => sum + (item.isGift ? (item.lineItemTotalPrice || 0) : 0), 0);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:w-full max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-3xl xl:max-w-4xl max-h-[92vh] sm:max-h-[90vh] p-3.5 sm:p-6 overflow-hidden flex flex-col">
          <DialogHeader className="pb-1 sm:pb-2 pr-8 sm:pr-0">
            <DialogTitle className="text-base sm:text-lg">Edit Order: <span className="font-normal">{order?.companyName}</span></DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Modify details for order ID: <span className="font-mono">{order?.id}</span>.</DialogDescription>
          </DialogHeader>
          {isLoadingOptions ? (<div className="flex justify-center items-center h-60"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>)
            : (<form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden w-full max-w-full min-w-0"><div className="grid gap-3 sm:gap-4 py-2 sm:py-4 max-h-[68vh] sm:max-h-[70vh] overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0 pr-1 sm:pr-2 custom-scrollbar">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 w-full min-w-0">
                <div className="space-y-1 min-w-0"><Label htmlFor="edit-jobId" className="text-xs sm:text-sm truncate block">Client ID *</Label><Input id="edit-jobId" value={jobIdInput} onChange={(e) => setJobIdInput(e.target.value)} required disabled={isSubmitting} className="w-full text-xs sm:text-sm h-9" /></div>
                <div className="space-y-1 min-w-0"><Label htmlFor="edit-companyNamePart" className="text-xs sm:text-sm truncate block">Company Name *</Label><Input id="edit-companyNamePart" value={companyNameInput} onChange={(e) => { setCompanyNameInput(e.target.value); setIsAutoFilled(false); }} required disabled={isSubmitting} className="w-full text-xs sm:text-sm h-9" /></div>
              </div>
              <div className="space-y-1 min-w-0"><Label htmlFor="edit-address" className="text-xs sm:text-sm">Address *</Label><Textarea id="edit-address" value={address} onChange={(e) => { setAddress(e.target.value); setIsAutoFilled(false); }} required disabled={isSubmitting} className="w-full text-xs sm:text-sm min-h-[60px]" /></div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 w-full min-w-0">
                <div className="space-y-1 min-w-0">
                  <Label htmlFor="edit-phoneNumber" className="text-xs sm:text-sm h-5 flex items-center truncate">Phone Number *</Label>
                  <Input
                    id="edit-phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      const numericValue = e.target.value.replace(/[^0-9]/g, '');
                      if (numericValue.length <= 11) {
                        setPhoneNumber(numericValue);
                        setIsAutoFilled(false);
                      }
                    }}
                    required
                    disabled={isSubmitting}
                    pattern="0\d{10}"
                    maxLength={11}
                    title="Phone number must be 11 digits and start with 0."
                    placeholder="01xxxxxxxxx"
                    className="w-full text-xs sm:text-sm h-9"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <Label htmlFor="edit-orderDate" className="text-xs sm:text-sm h-5 flex items-center truncate">Date Created *</Label>
                  <Popover open={isOrderDatePopoverOpen} onOpenChange={setIsOrderDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal min-w-0 text-xs sm:text-sm h-9 px-2.5", !createdAt && "text-muted-foreground")} disabled={isSubmitting}>
                        <CalendarDays className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{createdAt ? formatDateForDialogInput(createdAt) : "Pick a date"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={createdAt} onSelect={(date) => { setCreatedAt(date); setIsOrderDatePopoverOpen(false); }} initialFocus disabled={isSubmitting} />
                    </PopoverContent>
                  </Popover>
                </div>
                {order.currentStatus !== 'delivered' && (
                  <div className="space-y-1 min-w-0">
                    <Label htmlFor="edit-acceptedDeliveryDate" className="text-xs sm:text-sm h-5 flex items-center truncate">Delivery Date</Label>
                    <Popover open={isDeliveryDatePopoverOpen} onOpenChange={setIsDeliveryDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal min-w-0 text-xs sm:text-sm h-9 px-2.5", !acceptedDeliveryDate && "text-muted-foreground")} disabled={isSubmitting}>
                          <CalendarDays className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{acceptedDeliveryDate ? formatDateForDialogInput(acceptedDeliveryDate) : "Pick a date"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={acceptedDeliveryDate} onSelect={(date) => { setAcceptedDeliveryDate(date); setIsDeliveryDatePopoverOpen(false); }} initialFocus disabled={isSubmitting} />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                <div className="space-y-1 min-w-0">
                  <Label className="flex items-center gap-1.5 h-5 cursor-pointer text-xs sm:text-sm truncate">
                    <Star className={cn("h-3.5 w-3.5 shrink-0 transition-all", isStarred > 0 ? "fill-amber-500 text-amber-500 scale-110" : "text-muted-foreground")} />
                    <span className="truncate">Priority Star</span>
                  </Label>
                  <div className="flex items-center justify-between h-9 px-2 sm:px-3 border rounded-md bg-background">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((starIndex) => {
                        const isFull = isStarred >= starIndex;
                        const isHalf = !isFull && isStarred >= starIndex - 0.5;

                        return (
                          <button
                            key={starIndex}
                            type="button"
                            onClick={() => {
                              if (isStarred === starIndex) {
                                setIsStarred(0);
                              } else if (isStarred === starIndex - 0.5) {
                                setIsStarred(starIndex);
                              } else {
                                setIsStarred(starIndex - 0.5);
                              }
                            }}
                            className="relative cursor-pointer transition-transform hover:scale-110 active:scale-95 shrink-0 outline-none"
                            disabled={isSubmitting}
                          >
                            {isFull ? (
                              <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                            ) : isHalf ? (
                              <div className="relative">
                                <Star className="h-5 w-5 text-muted-foreground/30 dark:text-muted-foreground/20" />
                                <div className="absolute top-0 left-0 overflow-hidden w-[50%] h-full">
                                  <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                                </div>
                              </div>
                            ) : (
                              <Star className="h-5 w-5 text-muted-foreground/30 dark:text-muted-foreground/20 hover:text-amber-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1"><Label htmlFor="edit-orderNotes">Order Notes (Optional)</Label><Textarea id="edit-orderNotes" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={3} disabled={isSubmitting} /></div>
              <div className="space-y-3 mt-4 border-t border-border pt-4">
                <Label className="text-lg font-semibold">Order Items *</Label>
                <div className="w-full max-w-full overflow-x-auto rounded-md border bg-background custom-scrollbar">
                  <Table className="w-full min-w-[620px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Service *</TableHead>
                        <TableHead className="w-[15%]">Quantity *</TableHead>
                      <TableHead className="w-[20%]">Unit Price *</TableHead>
                        <TableHead className="w-[20%] text-right pr-4">Total Price</TableHead>
                        <TableHead className="w-[5%] text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/30">
                          <TableCell className="p-2 align-middle">
                            <div className="flex items-center gap-1.5">
                              <Popover open={popoverOpenStates[item.id] || false} onOpenChange={(open) => togglePopover(item.id, open)} modal={true}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" aria-expanded={popoverOpenStates[item.id] || false} className="flex-1 min-w-0 justify-between bg-card text-sm" disabled={isLoadingOptions || modelOptions.length === 0 || isSubmitting}>
                                    <span className="flex items-center gap-1.5 flex-1 text-left whitespace-nowrap overflow-hidden">
                                      {item.model && modelOptions.find((option) => option.name === item.model)?.imageUrl ? (
                                        <Avatar className="h-4 w-4 rounded-sm shrink-0">
                                          <AvatarImage src={modelOptions.find((option) => option.name === item.model)?.imageUrl || undefined} alt={item.model} />
                                          <AvatarFallback className="rounded-sm bg-muted text-xs">IMG</AvatarFallback>
                                        </Avatar>
                                      ) : null}
                                      <span className="truncate">
                                        {item.model ? (modelOptions.find((option) => option.name === item.model)?.name ?? item.model) : (isLoadingOptions ? "Loading..." : (modelOptions.length === 0 ? "No services" : "Select service..."))}
                                      </span>
                                    </span>
                                    <ChevronsUpDown className="ml-1.5 h-3 w-3 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] w-max max-w-lg p-0 z-[60]" align="start" side="bottom" sideOffset={4}>
                                  <Command className="max-h-96 overflow-hidden flex flex-col">
                                    <CommandInput placeholder="Search service..." />
                                    <CommandList className="max-h-80 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                                      <CommandEmpty>No service found.</CommandEmpty>
                                      <CommandGroup>
                                        {modelOptions.map((option) => (
                                          <CommandItem key={option.id} value={option.name} onSelect={(currentValue) => { handleItemChange(item.id, 'modelName', currentValue === item.model ? '' : currentValue); togglePopover(item.id, false); }} className="flex items-center gap-2">
                                            <Check className={cn("h-4 w-4 shrink-0", item.model === option.name ? "opacity-100" : "opacity-0")} />
                                            <Avatar className="h-8 w-8 rounded-sm shrink-0">
                                              <AvatarImage src={option.imageUrl || undefined} alt={option.name} data-ai-hint="product photo" />
                                              <AvatarFallback className="rounded-sm bg-muted text-xs">IMG</AvatarFallback>
                                            </Avatar>
                                            <span className="flex-1 truncate">{option.name}</span>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>

                            </div>
                          </TableCell>
                          <TableCell className="p-2 align-middle">
                            <Input id={`quantity-${item.id}`} type="number" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} min="1" required className="bg-card text-sm h-9" disabled={isSubmitting} />
                          </TableCell>
                          <TableCell className="p-2 align-middle">
                            <Input type="number" min="0" step="0.01" value={item.unitPrice ?? ''} onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)} placeholder="0.00" required disabled={isSubmitting} className="bg-card text-sm h-9" />
                          </TableCell>
                          <TableCell 
                            className="p-2 align-middle text-right pr-4 font-semibold text-sm whitespace-nowrap cursor-pointer select-none"
                            onDoubleClick={() => handleToggleGift(item.id)}
                            onTouchEnd={(e) => handleItemTouchEnd(item.id, e)}
                          >
                            <span style={item.isGift ? { textDecoration: 'line-through', textDecorationColor: '#ef4444', color: '#6b7280' } : undefined}>
                              {formatCurrencyBdt(item.lineItemTotalPrice)}
                            </span>
                            {item.isGift && " (Gift)"}
                          </TableCell>
                          <TableCell className="p-2 align-middle text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} disabled={isSubmitting || orderItems.length <= 1} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive-foreground" title="Remove item"><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" onClick={handleAddItem} className="mt-2" disabled={isSubmitting || isLoadingOptions}><PlusCircle className="mr-2 h-4 w-4" /> Add Item</Button>
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                <div className="space-y-1"><Label htmlFor="edit-specialClientDiscount">Special Client Discount</Label><div className="relative"><Input id="edit-specialClientDiscount" type="text" value={specialClientDiscount} onChange={(e) => handleDiscountChangeEdit(e.target.value)} placeholder="e.g., 100 or 10%" disabled={isSubmitting} className="pl-7" /><Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div></div>
                <div className="space-y-1"><Label htmlFor="edit-shippingCharge">Shipping Charge</Label><Input id="edit-shippingCharge" type="number" value={shippingCharge} onChange={(e) => setShippingCharge(e.target.value)} placeholder="0" disabled={isSubmitting} /></div>
              </div>

              {existingAdvancePayments.length > 0 && (
                <div className="mt-4 space-y-2 w-full min-w-0">
                  <Label className="text-md font-semibold flex items-center"><ReceiptText className="mr-2 h-5 w-5 text-primary/80" />Payment History</Label>
                  <div className="w-full max-w-full max-h-40 overflow-y-auto overflow-x-auto rounded-md border bg-muted/20 p-2 custom-scrollbar">
                    <Table className="w-full min-w-[450px]"><TableHeader><TableRow><TableHead className="h-8 text-xs">Date</TableHead><TableHead className="h-8 text-xs">Amount</TableHead><TableHead className="h-8 text-xs">Method</TableHead><TableHead className="h-8 text-xs">Reference/Notes</TableHead>
                      {isAdmin && <TableHead className="h-8 text-right text-xs">Actions</TableHead>}
                    </TableRow></TableHeader>
                      <TableBody>
                        {existingAdvancePayments.map(record => (
                          <TableRow key={record.id} className="group" onDoubleClick={() => { if (!editingPaymentId) handleStartEditPayment(record); }}>
                            <TableCell className="text-xs py-1.5">{formatDateForDialogInput(record.date)}</TableCell>
                            <TableCell className="text-xs py-1.5">
                              {editingPaymentId === record.id ? (
                                <Input
                                  ref={amountInputRef}
                                  type="number"
                                  value={editingAmount}
                                  onChange={(e) => setEditingAmount(e.target.value)}
                                  className="h-7 text-xs"
                                />
                              ) : (
                                formatCurrencyBdt(record.amount)
                              )}
                            </TableCell>
                            <TableCell className="text-xs py-1.5">
                              {editingPaymentId === record.id ? (
                                <Select value={editingMethod} onValueChange={(value) => setEditingMethod(value)}>
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {paymentMethodOptions.map(pm => <SelectItem key={pm.id} value={pm.name}>{pm.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : (
                                record.paymentMethod || 'N/A'
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-1.5">
                              {editingPaymentId === record.id ? (
                                <Input
                                  value={editingNotes}
                                  onChange={(e) => setEditingNotes(e.target.value)}
                                  className="h-7 text-xs"
                                  placeholder="Notes/Ref"
                                />
                              ) : (
                                record.notes || 'N/A'
                              )}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right py-1.5">
                                {editingPaymentId === record.id ? (
                                  <div className="flex gap-1 justify-end">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-100" onClick={() => handleSavePaymentEdit(record.id)}><Check className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted" onClick={handleCancelPaymentEdit}><X className="h-4 w-4" /></Button>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                                    onClick={(e) => { e.stopPropagation(); setPaymentToDelete(record); }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {clientPayments.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-border pt-4 w-full min-w-0">
                  <Label className="text-md font-semibold flex items-center text-amber-600 dark:text-amber-400">
                    <ReceiptText className="mr-2 h-5 w-5 text-amber-500 animate-pulse" />
                    Client Payments
                  </Label>
                  <div className="w-full max-w-full max-h-40 overflow-y-auto overflow-x-auto border border-amber-200 dark:border-amber-900/50 rounded-md bg-amber-500/5 p-2 custom-scrollbar">
                    <Table className="w-full min-w-[500px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8 text-xs text-amber-800 dark:text-amber-300">Date</TableHead>
                          <TableHead className="h-8 text-xs text-amber-800 dark:text-amber-300">Amount</TableHead>
                          <TableHead className="h-8 text-xs text-amber-800 dark:text-amber-300">Method</TableHead>
                          <TableHead className="h-8 text-xs text-amber-800 dark:text-amber-300">Reference/Notes</TableHead>
                          <TableHead className="h-8 text-xs text-amber-800 dark:text-amber-300">Receipt</TableHead>
                          <TableHead className="h-8 text-right text-xs text-amber-800 dark:text-amber-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientPayments.map((payment) => {
                          const isAdded = payment.isAdded;
                          const isRemoved = payment.isRemoved;

                          return (
                            <TableRow key={payment.id} className={cn(
                              "group transition-colors",
                              isAdded && "bg-emerald-500/10 dark:bg-emerald-500/20",
                              isRemoved && "opacity-50 bg-red-500/5 dark:bg-red-500/10"
                            )}>
                              <TableCell className="text-xs py-1.5 font-medium">{formatDateForDialogInput(payment.createdAt)}</TableCell>
                              <TableCell className="text-xs py-1.5 font-semibold text-foreground">
                                {isRemoved ? (
                                  <span className="line-through text-muted-foreground">{formatCurrencyBdt(payment.amount)}</span>
                                ) : (
                                  formatCurrencyBdt(payment.amount)
                                )}
                              </TableCell>
                              <TableCell className="text-xs py-1.5">{payment.paymentMethod || 'N/A'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground py-1.5 max-w-[150px] truncate" title={payment.notes}>
                                {payment.notes || 'N/A'}
                              </TableCell>
                              <TableCell className="text-xs py-1.5">
                                {payment.documentUrl ? (
                                  <a
                                    href={payment.documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold transition-colors"
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    View Receipt
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground italic">No proof</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right py-1.5">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted/80">
                                      <MoreVertical className="h-4 w-4" />
                                      <span className="sr-only">Open menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    {isAdded ? (
                                      <DropdownMenuItem
                                        onClick={() => handleUndoClientPayment(payment)}
                                        className="text-xs text-amber-600 dark:text-amber-400 focus:text-amber-600 font-medium cursor-pointer"
                                      >
                                        <Undo2 className="mr-2 h-3.5 w-3.5" />
                                        Undo Add
                                      </DropdownMenuItem>
                                    ) : isRemoved ? (
                                      <DropdownMenuItem
                                        onClick={() => handleUndoRemoveClientPayment(payment)}
                                        className="text-xs text-amber-600 dark:text-amber-400 focus:text-amber-600 font-medium cursor-pointer"
                                      >
                                        <Undo2 className="mr-2 h-3.5 w-3.5" />
                                        Undo Remove
                                      </DropdownMenuItem>
                                    ) : (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => handleAddClientPaymentToInvoice(payment)}
                                          className="text-xs text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 font-medium cursor-pointer"
                                        >
                                          <Check className="mr-2 h-3.5 w-3.5" />
                                          Add to Invoice
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleRemoveClientPayment(payment)}
                                          className="text-xs text-destructive focus:text-destructive font-medium cursor-pointer"
                                        >
                                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                                          Remove
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="mt-4 border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                <div className="space-y-1">
                  <Label htmlFor="newAdvanceAmount">
                    {existingAdvancePayments.length > 0 ? "Adjustment Payment" : "Advance Payment"}
                  </Label>
                  <Input id="newAdvanceAmount" type="number" value={newAdvanceAmount} onChange={(e) => setNewAdvanceAmount(e.target.value)} placeholder="Amount (BDT)" min="0" step="0.01" disabled={isSubmitting} />
                </div>
                {isNewAdvanceEntered && (<div className="space-y-1"><Label htmlFor="newAdvancePaymentMethod">Payment Method *</Label>
                  <Popover open={isPaymentMethodPopoverOpen} onOpenChange={setIsPaymentMethodPopoverOpen}>
                    <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between bg-background" disabled={isLoadingOptions || paymentMethodOptions.length === 0 || isSubmitting}><span className="flex-1 text-left whitespace-nowrap">{newAdvancePaymentMethod ? paymentMethodOptions.find(opt => opt.name === newAdvancePaymentMethod)?.name || newAdvancePaymentMethod : (isLoadingOptions ? "Loading..." : (paymentMethodOptions.length === 0 ? "No methods" : "Select method..."))}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                    <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] w-max max-w-md p-0"><Command><CommandInput placeholder="Search method..." /><CommandList><CommandEmpty>No method found.</CommandEmpty><CommandGroup>{paymentMethodOptions.map(opt => (<CommandItem key={opt.id} value={opt.name} onSelect={(val) => { handleNewAdvancePaymentMethodChange(paymentMethodOptions.find(o => o.name.toLowerCase() === val.toLowerCase())?.name || val); setIsPaymentMethodPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", newAdvancePaymentMethod === opt.name ? "opacity-100" : "opacity-0")} /><span className="whitespace-nowrap">{opt.name}</span></CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                  </Popover>
                  {showNewCustomPaymentInput && (<div className="mt-2 space-y-1"><Label htmlFor="newCustomPaymentText">Specify Other Method *</Label><Input id="newCustomPaymentText" value={newCustomPaymentMethodText} onChange={e => setNewCustomPaymentMethodText(e.target.value)} required={newAdvancePaymentMethod.toLowerCase() === 'other'} disabled={isSubmitting} /></div>)}
                </div>)}
                {isNewAdvanceEntered && (<div className="space-y-1"><Label htmlFor="newAdvancePaymentNotes">Reference/Notes *</Label><Input id="newAdvancePaymentNotes" value={newAdvancePaymentNotes} onChange={e => setNewAdvancePaymentNotes(e.target.value)} placeholder="Reference or Transaction ID" required={isNewAdvanceEntered} minLength={4} /></div>)}
                {isNewAdvanceEntered && (<PaymentProofField file={selectedPaymentProof} onChange={setSelectedPaymentProof} disabled={isSubmitting || isUploadingProof} />)}
              </div>

              <div className="mt-4 p-4 border rounded-md bg-muted/30 space-y-2">
                <h4 className="text-md font-semibold text-foreground mb-2">Order Summary</h4>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Order Items Total:</span><span className="font-medium text-foreground">{formatCurrencyBdt(orderItemsTotal)}</span></div>
                {giftTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center">
                      <Gift className="h-4 w-4 mr-1 text-yellow-500" />
                      Gift Value:
                    </span>
                    <span className="font-medium text-yellow-500">{formatCurrencyBdt(giftTotal)}</span>
                  </div>
                )}
                {(calculatedDiscountAmount || 0) > 0 && (<div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount:</span><span className="font-medium text-red-600">- {formatCurrencyBdt(calculatedDiscountAmount)}</span></div>)}
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Net Payable:</span><span className="font-semibold text-foreground">{formatCurrencyBdt(netPayable)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT ({vatPercent}%):</span><span className="font-medium text-foreground">+ {formatCurrencyBdt(vatAmount)}</span></div>
                {(parseFloat(shippingCharge) || 0) > 0 && (<div className="flex justify-between text-sm"><span className="text-muted-foreground">Shipping Charge:</span><span className="font-medium text-foreground">+ {formatCurrencyBdt(parseFloat(shippingCharge))}</span></div>)}
                {(totalExistingAdvancePaid + (parseFloat(newAdvanceAmount) || 0)) > 0 && (<div className="flex justify-between text-sm mt-1 pt-1 border-t border-dashed border-border"><span className="text-muted-foreground">Total Paid:</span><span className="font-medium text-green-600">- {formatCurrencyBdt(totalExistingAdvancePaid + (parseFloat(newAdvanceAmount) || 0))}</span></div>)}
                <div className="flex justify-between text-lg font-bold mt-1 pt-1 border-t border-border"><span className="text-primary">Amount Due:</span><span className="text-primary">{formatCurrencyBdt(amountDue)}</span></div>
              </div>

            </div>
              <DialogFooter className="pt-3 sm:pt-4 border-t flex flex-col-reverse sm:flex-row gap-2 sm:gap-0"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={!canSubmit}>{isSubmitting || isUploadingProof ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isUploadingProof ? "Uploading..." : "Saving..."}</> : "Save Changes"}</Button></DialogFooter>
            </form>)}
        </DialogContent>
      </Dialog>
      {paymentToDelete && (
        <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will permanently delete the payment of {formatCurrencyBdt(paymentToDelete.amount)} made on {formatDateForDialogInput(paymentToDelete.date)}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPaymentToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeletePayment} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
