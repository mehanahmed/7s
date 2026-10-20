

"use client";

import { PaymentMethodsCard } from '@/components/settings/PaymentMethodsCard';
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/contexts/auth-context";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { CustomStatus, UserRole, User, GlobalSettings, ExpenseLoggingPermissions, ExpenseLoggingMode, ProjectStatusType, RoleBasedTarget } from "@/types";
import { getStatuses } from '@/lib/status-service';
import { getUsers } from '@/lib/user-service';
import { getGlobalSettings as fetchGlobalSettings } from '@/lib/settings-service';
import {
  updateCompletionStatusIdsAction,
  updateCommentsVisibilityAction,
  updateToastSoundUrlAction,
  updateVatPercentageAction,
  updateLeaderboardBackgroundImageUrlAction,
  updateExpenseLoggingPermissionsAction,
  updateMaintenanceModeAction,
  updateDrAssignmentNotificationTemplatesAction,
  updateRoleBasedTargetsAction,
  updateTelegramSettingsAction,
  updateCourierNoteVisibilityAction,
  updateSalaryTransferBankSettingsAction,
  updatePaymentGatewaySettingsAction,
} from './actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ListChecks, MessageSquare, Send, Users, Filter, X, CheckIcon, ChevronsUpDown, BellRing, Copy, ExternalLink, AlertTriangle, Music, Image as ImageIcon, Settings2, PowerOff, DraftingCompass, Target, Wallet, CreditCard, Eye, EyeOff, Percent } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import NextImage from 'next/image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DR_ROLES } from '@/lib/roles';



const EXPENSE_LOGGING_TARGET_ROLES: UserRole[] = ['ADMIN', 'CR', ...DR_ROLES];
const DEFAULT_LEADERBOARD_BACKGROUND_PLACEHOLDER = 'https://i.ibb.co/PGBMbxBc/360-F-338486227-q-Qit-Uvh3n-ILq-Yiu-QOUGxdfindo-NMbtp-H.jpg';


function CrmTargetSettingsPageInner() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();

  const currentTab = searchParams ? (searchParams.get('tab') || 'crm-performance') : 'crm-performance';

  const handleTabChange = (value: string) => {
    if (!searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Settings states
  const [allStatuses, setAllStatuses] = useState<CustomStatus[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<Set<string>>(new Set());
  const [areCommentsVisible, setAreCommentsVisible] = useState(true);
  const [isCourierNoteVisible, setIsCourierNoteVisible] = useState(true);
  const [toastSoundUrl, setToastSoundUrl] = useState<string>('');
  const [vatPercent, setVatPercent] = useState<string>('0');
  const [isSubmittingVat, setIsSubmittingVat] = useState(false);
  const [leaderboardBgUrl, setLeaderboardBgUrl] = useState<string>('');
  const [expenseLoggingPerms, setExpenseLoggingPerms] = useState<ExpenseLoggingPermissions>({
    mode: 'all', allowedRoles: [], allowedUserIds: []
  });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [drNotifTitle, setDrNotifTitle] = useState('');
  const [drNotifBody, setDrNotifBody] = useState('');
  const [roleBasedTargets, setRoleBasedTargets] = useState<RoleBasedTarget>({ CR: 50, DR_TEAM: 20, LR: 100 });
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatIds, setTelegramChatIds] = useState('');
  const [telegramRedirectDomain, setTelegramRedirectDomain] = useState('');
  const [salaryTransferBankName, setSalaryTransferBankName] = useState('');
  const [salaryTransferBankAccountNo, setSalaryTransferBankAccountNo] = useState('');
  const [pgMerchantId, setPgMerchantId] = useState('');
  const [pgPassword, setPgPassword] = useState('');
  const [pgEnvironment, setPgEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [pgCallbackUrl, setPgCallbackUrl] = useState('');
  const [pgIpnUrl, setPgIpnUrl] = useState('');
  const [pgPayWithCharge, setPgPayWithCharge] = useState(true);
  const [pgEmi, setPgEmi] = useState(false);
  const [pgEnabled, setPgEnabled] = useState(false);
  const [pgShowPassword, setPgShowPassword] = useState(false);


  const [allTargetableUsersForExpensePerms, setAllTargetableUsersForExpensePerms] = useState<User[]>([]); // For expense perm user picker
  const [isExpenseUserPopoverOpen, setIsExpenseUserPopoverOpen] = useState(false);


  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCrmTargets, setIsSubmittingCrmTargets] = useState(false);
  const [isSubmittingCommentsVisibility, setIsSubmittingCommentsVisibility] = useState(false);
  const [isSubmittingCourierNoteVisibility, setIsSubmittingCourierNoteVisibility] = useState(false);
  const [isSubmittingToastSound, setIsSubmittingToastSound] = useState(false);
  const [isSubmittingLeaderboardBg, setIsSubmittingLeaderboardBg] = useState(false);
  const [isSubmittingExpensePerms, setIsSubmittingExpensePerms] = useState(false);
  const [isSubmittingMaintenanceMode, setIsSubmittingMaintenanceMode] = useState(false);
  const [isSubmittingDrNotif, setIsSubmittingDrNotif] = useState(false);
  const [isSubmittingRoleTargets, setIsSubmittingRoleTargets] = useState(false);
  const [isSubmittingTelegram, setIsSubmittingTelegram] = useState(false);
  const [isSubmittingSalaryTransferBank, setIsSubmittingSalaryTransferBank] = useState(false);
  const [isSubmittingPaymentGateway, setIsSubmittingPaymentGateway] = useState(false);


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedStatuses, globalSettings, fetchedUsersDb] = await Promise.all([
        getStatuses(),
        fetchGlobalSettings(),
        getUsers(), // Fetch all users once from DB
      ]);
      setAllStatuses(fetchedStatuses);
      setSelectedStatusIds(new Set(globalSettings.crmCompletionStatusIds ?? []));
      setAreCommentsVisible(globalSettings.areCommentsVisibleOnPublicPage ?? true);
      setIsCourierNoteVisible(globalSettings.isCourierNoteVisible ?? true);
      setToastSoundUrl(globalSettings.toastSoundUrl ?? '');
      setVatPercent(String(globalSettings.vatPercentage ?? 0));
      setLeaderboardBgUrl(globalSettings.leaderboardBackgroundImageUrl ?? '');
      setExpenseLoggingPerms(globalSettings.expenseLoggingPermissions ?? { mode: 'all', allowedRoles: [], allowedUserIds: [] });
      setMaintenanceMode(globalSettings.maintenanceMode ?? false);
      setMaintenanceMessage(globalSettings.maintenanceMessage ?? '');
      setDrNotifTitle(globalSettings.drAssignmentNotificationTitle || '');
      setDrNotifBody(globalSettings.drAssignmentNotificationBody || '');
      setRoleBasedTargets(globalSettings.roleBasedTargets || { CR: 50, DR_TEAM: 20, LR: 100 });
      setTelegramBotToken(globalSettings.telegramBotToken || '');
      setTelegramChatIds(Array.isArray(globalSettings.telegramChatIds) ? globalSettings.telegramChatIds.join(', ') : '');
      setTelegramRedirectDomain(globalSettings.telegramRedirectDomain || '');
      setSalaryTransferBankName(globalSettings.salaryTransferBankName || '');
      setSalaryTransferBankAccountNo(globalSettings.salaryTransferBankAccountNo || '');
      setPgMerchantId(globalSettings.paymentGatewayMerchantId || '');
      setPgPassword(globalSettings.paymentGatewayPassword || '');
      setPgEnvironment(globalSettings.paymentGatewayEnvironment || 'sandbox');
      setPgCallbackUrl(globalSettings.paymentGatewayCallbackUrl || '');
      setPgIpnUrl(globalSettings.paymentGatewayIpnUrl || '');
      setPgPayWithCharge(globalSettings.paymentGatewayPayWithCharge ?? true);
      setPgEmi(globalSettings.paymentGatewayEmi ?? false);
      setPgEnabled(globalSettings.paymentGatewayEnabled ?? false);

      setAllTargetableUsersForExpensePerms(fetchedUsersDb.filter(u => u.role !== 'SYSTEM_ADMIN')); // For expense perm specific user picker
    } catch (error) {
      console.error("Error fetching settings data:", error);
      toast({ title: "Error", description: "Could not load settings or user data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser && currentUser.role === 'SYSTEM_ADMIN') {
      fetchData();
    } else if (currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, router, fetchData]);

  const handleCrmTargetCheckboxChange = (statusId: string, checked: boolean | "indeterminate") => {
    setSelectedStatusIds(prev => {
      const newSet = new Set(prev);
      if (checked === true) newSet.add(statusId);
      else newSet.delete(statusId);
      return newSet;
    });
  };

  const handleSaveCrmTargets = async () => {
    setIsSubmittingCrmTargets(true);
    const result = await updateCompletionStatusIdsAction(Array.from(selectedStatusIds));
    if (result.success) toast({ title: "Settings Updated", description: "CR completion status settings have been saved." });
    else toast({ title: "Update Failed", description: result.error || "Could not save CR target settings.", variant: "destructive" });
    setIsSubmittingCrmTargets(false);
  };

  const handleToggleCommentsVisibility = async (newVisibility: boolean) => {
    setIsSubmittingCommentsVisibility(true);
    const result = await updateCommentsVisibilityAction(newVisibility);
    if (result.success) {
      setAreCommentsVisible(newVisibility);
      toast({ title: "Settings Updated", description: `Public comments section is now ${newVisibility ? 'visible' : 'hidden'}.` });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not update comments visibility.", variant: "destructive" });
    }
    setIsSubmittingCommentsVisibility(false);
  };

  const handleToggleCourierNoteVisibility = async (newVisibility: boolean) => {
    setIsSubmittingCourierNoteVisibility(true);
    const result = await updateCourierNoteVisibilityAction(newVisibility);
    if (result.success) {
      setIsCourierNoteVisible(newVisibility);
      toast({ title: "Settings Updated", description: `Courier note selector is now ${newVisibility ? 'visible' : 'hidden'} on dispatch dialogs.` });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not update courier note visibility.", variant: "destructive" });
    }
    setIsSubmittingCourierNoteVisibility(false);
  };

  const handleSaveVat = async () => {
    const value = parseFloat(vatPercent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      toast({ title: "Invalid VAT", description: "Enter a percentage between 0 and 100.", variant: "destructive" });
      return;
    }
    setIsSubmittingVat(true);
    const result = await updateVatPercentageAction(value);
    if (result.success) {
      toast({ title: "Settings Updated", description: `VAT is now ${value}% on new quotations and orders.` });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not save VAT.", variant: "destructive" });
    }
    setIsSubmittingVat(false);
  };

  const handleSaveToastSoundUrl = async () => {
    setIsSubmittingToastSound(true);
    const urlToSave = toastSoundUrl.trim() === '' ? null : toastSoundUrl.trim();
    const result = await updateToastSoundUrlAction(urlToSave);
    if (result.success) {
      toast({ title: "Settings Updated", description: "Toast notification sound URL has been saved." });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not save toast sound URL.", variant: "destructive" });
    }
    setIsSubmittingToastSound(false);
  };

  const handleSaveLeaderboardBgUrl = async () => {
    setIsSubmittingLeaderboardBg(true);
    const urlToSave = leaderboardBgUrl.trim() === '' ? null : leaderboardBgUrl.trim();
    const result = await updateLeaderboardBackgroundImageUrlAction(urlToSave);
    if (result.success) {
      toast({ title: "Settings Updated", description: "Leaderboard background image URL has been saved." });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not save leaderboard background image URL.", variant: "destructive" });
    }
    setIsSubmittingLeaderboardBg(false);
  };

  const handleExpensePermsModeChange = (newMode: ExpenseLoggingMode) => {
    setExpenseLoggingPerms(prev => ({ ...prev, mode: newMode, allowedRoles: [], allowedUserIds: [] }));
  };

  const handleExpensePermsRoleChange = (role: UserRole, checked: boolean | "indeterminate") => {
    setExpenseLoggingPerms(prev => {
      const newRoles = new Set(prev.allowedRoles);
      if (checked) newRoles.add(role); else newRoles.delete(role);
      return { ...prev, allowedRoles: Array.from(newRoles) };
    });
  };

  const handleExpensePermsUserSelect = (userId: string) => {
    setExpenseLoggingPerms(prev => {
      const newUserIds = new Set(prev.allowedUserIds);
      if (newUserIds.has(userId)) newUserIds.delete(userId); else newUserIds.add(userId);
      return { ...prev, allowedUserIds: Array.from(newUserIds) };
    });
  };

  const handleSaveExpensePermissions = async () => {
    setIsSubmittingExpensePerms(true);
    const result = await updateExpenseLoggingPermissionsAction(expenseLoggingPerms);
    if (result.success) {
      toast({ title: "Settings Updated", description: "Expense logging permissions saved." });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not save expense logging permissions.", variant: "destructive" });
    }
    setIsSubmittingExpensePerms(false);
  };

  const handleSaveMaintenanceMode = async () => {
    setIsSubmittingMaintenanceMode(true);
    const result = await updateMaintenanceModeAction(maintenanceMode, maintenanceMessage.trim());
    if (result.success) {
      toast({ title: "Settings Updated", description: `Maintenance mode has been ${maintenanceMode ? 'enabled' : 'disabled'}.` });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not update maintenance mode.", variant: "destructive" });
    }
    setIsSubmittingMaintenanceMode(false);
  };

  const handleSaveDrNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drNotifTitle.trim() || !drNotifBody.trim()) {
      toast({ title: "Validation Error", description: "Title and body are required for the DR notification.", variant: "destructive" });
      return;
    }
    setIsSubmittingDrNotif(true);
    const result = await updateDrAssignmentNotificationTemplatesAction(drNotifTitle.trim(), drNotifBody.trim());
    if (result.success) {
      toast({ title: "Settings Updated", description: "DR assignment notification template saved." });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not save DR notification template.", variant: "destructive" });
    }
    setIsSubmittingDrNotif(false);
  };

  const handleSaveTelegramSettings = async () => {
    setIsSubmittingTelegram(true);
    const chatIdsArray = telegramChatIds.split(',').map(id => id.trim()).filter(id => id);
    const result = await updateTelegramSettingsAction(
      telegramBotToken.trim() || null, 
      chatIdsArray.length > 0 ? chatIdsArray : null,
      telegramRedirectDomain.trim() || null
    );
    if (result.success) {
      toast({ title: "Settings Updated", description: "Telegram settings have been saved." });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not save Telegram settings.", variant: "destructive" });
    }
    setIsSubmittingTelegram(false);
  };



  const handleRoleTargetChange = (role: keyof RoleBasedTarget, value: string) => {
    const numericValue = parseInt(value, 10);
    setRoleBasedTargets(prev => ({
      ...prev,
      [role]: isNaN(numericValue) ? 0 : numericValue,
    }));
  };

  const handleSaveRoleTargets = async () => {
    setIsSubmittingRoleTargets(true);
    const result = await updateRoleBasedTargetsAction(roleBasedTargets);
    if (result.success) {
      toast({ title: "Settings Updated", description: "Role-based performance targets have been saved." });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not save role-based targets.", variant: "destructive" });
    }
    setIsSubmittingRoleTargets(false);
  };


  const handleSaveSalaryTransferBank = async () => {
    setIsSubmittingSalaryTransferBank(true);
    const result = await updateSalaryTransferBankSettingsAction(
      salaryTransferBankName.trim() || null,
      salaryTransferBankAccountNo.trim() || null
    );
    if (result.success) {
      toast({ title: "Settings Updated", description: "Salary transfer bank settings have been saved." });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not save salary transfer bank settings.", variant: "destructive" });
    }
    setIsSubmittingSalaryTransferBank(false);
  };


  const handleSavePaymentGateway = async () => {
    setIsSubmittingPaymentGateway(true);
    const result = await updatePaymentGatewaySettingsAction({
      merchantId: pgMerchantId.trim() || null,
      password: pgPassword.trim() || null,
      environment: pgEnvironment,
      callbackUrl: pgCallbackUrl.trim() || null,
      ipnUrl: pgIpnUrl.trim() || null,
      payWithCharge: pgPayWithCharge,
      emi: pgEmi,
      enabled: pgEnabled,
    });
    if (result.success) {
      toast({ title: "Settings Updated", description: "Payment gateway settings have been saved." });
    } else {
      toast({ title: "Update Failed", description: result.error || "Could not save payment gateway settings.", variant: "destructive" });
    }
    setIsSubmittingPaymentGateway(false);
  };

  const selectedExpenseUsersDisplay = useMemo(() => {
    if (expenseLoggingPerms.allowedUserIds.length === 0) return "Select users...";
    if (expenseLoggingPerms.allowedUserIds.length > 2) return `${expenseLoggingPerms.allowedUserIds.length} users selected`;
    return expenseLoggingPerms.allowedUserIds.map(id => allTargetableUsersForExpensePerms.find(u => u.id === id)?.name || id).join(", ");
  }, [expenseLoggingPerms.allowedUserIds, allTargetableUsersForExpensePerms]);

  if (!currentUser || currentUser.role !== 'SYSTEM_ADMIN') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Access Denied. You must be a System Administrator to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 pt-0 sm:pt-0 lg:pt-0">
      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <TabsList className="inline-flex h-auto items-center justify-start gap-1 bg-muted/80 backdrop-blur-sm p-1 border border-border/50 rounded-xl overflow-x-auto scrollbar-none scroll-smooth whitespace-nowrap mb-2">
          <TabsTrigger value="crm-performance" className="text-sm font-semibold rounded-lg py-2 px-4 transition-all duration-200 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground hover:bg-background/40 flex items-center justify-center">
            <Target className="h-4 w-4 mr-1.5" /> CR & Targets
          </TabsTrigger>
          <TabsTrigger value="features-access" className="text-sm font-semibold rounded-lg py-2 px-4 transition-all duration-200 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground hover:bg-background/40 flex items-center justify-center">
            <Settings2 className="h-4 w-4 mr-1.5" /> Features & Access
          </TabsTrigger>
          <TabsTrigger value="integrations-notifications" className="text-sm font-semibold rounded-lg py-2 px-4 transition-all duration-200 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground hover:bg-background/40 flex items-center justify-center">
            <Send className="h-4 w-4 mr-1.5" /> Integrations & Media
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crm-performance" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
          <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
            <CardHeader className="border-b p-5">
              <CardTitle className="text-card-foreground text-xl flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary" />CR Target Completion Statuses</CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-0.5">Select which order statuses count as "completed" for CR targets.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="flex items-center space-x-2"><Skeleton className="h-5 w-5 rounded" /><Skeleton className="h-5 w-40 rounded" /></div>)}</div>
                : allStatuses.length === 0 ? <p className="text-muted-foreground">No order statuses found. Configure statuses first.</p>
                  : <ScrollArea className="h-[calc(50vh-200px)] pr-3"><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                    {allStatuses.map((status) => (<div key={status.id} className="flex items-center space-x-3 p-2.5 rounded-md border border-border/30 hover:bg-muted/50 transition-colors">
                      <Checkbox id={`status-${status.id}`} checked={selectedStatusIds.has(status.id)} onCheckedChange={(checked) => handleCrmTargetCheckboxChange(status.id, checked)} disabled={isSubmittingCrmTargets} />
                      <Label htmlFor={`status-${status.id}`} className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer">
                        <span className="h-4 w-4 rounded-sm border border-border" style={{ backgroundColor: status.color }} title={status.name} />{status.name}
                        {status.isSystemStatus && <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-sm border border-border">System</span>}
                      </Label></div>))}
                  </div></ScrollArea>}
            </CardContent>
            <CardFooter className="border-t p-5 flex justify-end">
              <Button onClick={handleSaveCrmTargets} disabled={isLoading || isSubmittingCrmTargets || allStatuses.length === 0}>{isSubmittingCrmTargets ? "Saving..." : "Save CR Target Settings"}</Button>
            </CardFooter>
          </Card>
          <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
            <CardHeader className="border-b p-5">
              <CardTitle className="text-card-foreground text-xl flex items-center gap-2">
                <Percent className="h-6 w-6 text-primary" /> VAT / Tax
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-0.5">
                VAT percentage added to new quotations and orders. Existing ones keep the rate they were created with.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="vatPercentInput">VAT (%)</Label>
                <Input
                  id="vatPercentInput"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={vatPercent}
                  onChange={(e) => setVatPercent(e.target.value)}
                  placeholder="e.g., 5"
                  disabled={isLoading || isSubmittingVat}
                />
                <p className="text-xs text-muted-foreground">Set 0 to remove VAT from new quotations and orders.</p>
              </div>
            </CardContent>
            <CardFooter className="border-t p-5 flex justify-end">
              <Button onClick={handleSaveVat} disabled={isLoading || isSubmittingVat}>
                {isSubmittingVat ? "Saving..." : "Save VAT"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="features-access" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
          <PaymentMethodsCard />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-xl border bg-card rounded-lg overflow-hidden flex flex-col justify-between">
              <div>
                <CardHeader className="border-b p-5">
                  <CardTitle className="text-card-foreground text-xl flex items-center gap-2"><Settings2 className="h-6 w-6 text-primary" />Feature Visibility & Permissions</CardTitle>
                  <CardDescription className="text-muted-foreground text-sm mt-0.5">Control features like public comments and expense logging.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {isLoading ? (
                    <>
                      <div className="flex items-center space-x-2"><Skeleton className="h-6 w-6 rounded" /><Skeleton className="h-5 w-48 rounded" /></div>
                      <Skeleton className="h-24 w-full rounded-md" />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between space-x-2 p-3 rounded-md border border-border/30 hover:bg-muted/50 transition-colors">
                        <Label htmlFor="commentsVisibilitySwitch" className="flex flex-col space-y-1 cursor-pointer">
                          <span>Comments Section Visibility (Public Tracking)</span><span className="font-normal leading-snug text-muted-foreground text-xs">Show or hide comments on public order tracking pages.</span>
                        </Label>
                        <Switch id="commentsVisibilitySwitch" checked={areCommentsVisible} onCheckedChange={handleToggleCommentsVisibility} disabled={isSubmittingCommentsVisibility} aria-label="Toggle comments section visibility" />
                      </div>

                      <div className="p-3 rounded-md border border-border/30 hover:bg-muted/50 transition-colors">
                        <Label className="text-md font-medium flex flex-col space-y-1">
                          <span>Expense Logging for Non-System Admins</span>
                          <span className="font-normal leading-snug text-muted-foreground text-xs">
                            Control who can log expenses. System Admins always can.
                          </span>
                        </Label>
                        <RadioGroup value={expenseLoggingPerms.mode} onValueChange={handleExpensePermsModeChange} className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-4">
                          {([
                            { value: 'all', label: 'Allow All Staff' },
                            { value: 'specificRoles', label: 'Specific Roles' },
                            { value: 'specificUsers', label: 'Specific Users' },
                            { value: 'none', label: 'Disable for All Staff' }
                          ] as Array<{ value: ExpenseLoggingMode, label: string }>).map(opt => (
                            <div key={opt.value} className="flex items-center space-x-2"><RadioGroupItem value={opt.value} id={`expense-mode-${opt.value}`} /><Label htmlFor={`expense-mode-${opt.value}`}>{opt.label}</Label></div>
                          ))}
                        </RadioGroup>

                        {expenseLoggingPerms.mode === 'specificRoles' && (
                          <div className="mt-3 p-3 border rounded-md bg-secondary/30">
                            <Label className="mb-2 block text-sm font-medium">Select Roles *</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {EXPENSE_LOGGING_TARGET_ROLES.map(role => (
                                <div key={`expense-role-${role}`} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 bg-background">
                                  <Checkbox id={`expense-role-perm-${role}`} checked={expenseLoggingPerms.allowedRoles.includes(role)} onCheckedChange={(checked) => handleExpensePermsRoleChange(role, checked)} />
                                  <Label htmlFor={`expense-role-perm-${role}`} className="text-sm font-normal cursor-pointer">{role.replace(/_/g, ' ')}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {expenseLoggingPerms.mode === 'specificUsers' && (
                          <div className="mt-3 p-3 border rounded-md bg-secondary/30">
                            <Label className="mb-2 block text-sm font-medium">Select Users *</Label>
                            {isLoading ? <Skeleton className="h-10 w-full rounded-md" /> : (
                              <Popover open={isExpenseUserPopoverOpen} onOpenChange={setIsExpenseUserPopoverOpen}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" aria-expanded={isExpenseUserPopoverOpen} className="w-full justify-between bg-background">
                                    <span className="truncate">{selectedExpenseUsersDisplay}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                  <Command><CommandInput placeholder="Search user..." />
                                    <CommandList><CommandEmpty>No user found.</CommandEmpty>
                                      <CommandGroup>
                                        {allTargetableUsersForExpensePerms.map((user) => (
                                          <CommandItem key={`expense-user-${user.id}`} value={`${user.name} ${user.email} ${user.role}`} onSelect={() => handleExpensePermsUserSelect(user.id)} className="cursor-pointer">
                                            <CheckIcon className={cn("mr-2 h-4 w-4", expenseLoggingPerms.allowedUserIds.includes(user.id) ? "opacity-100" : "opacity-0")} />
                                            {user.name} <span className="text-xs text-muted-foreground ml-1">({user.role.replace(/_/g, ' ')})</span>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup></CommandList></Command>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </div>
              <CardFooter className="border-t p-5 flex justify-end">
                <Button onClick={handleSaveExpensePermissions} disabled={isSubmittingExpensePerms}>
                  {isSubmittingExpensePerms ? "Saving..." : "Save Expense Permissions"}
                </Button>
              </CardFooter>
            </Card>

            <Card className="shadow-xl border bg-card rounded-lg overflow-hidden flex flex-col justify-between">
              <div>
                <CardHeader className="border-b p-5">
                  <CardTitle className="text-card-foreground text-xl flex items-center gap-2">
                    <PowerOff className="h-6 w-6 text-primary" /> Maintenance Mode
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-sm mt-0.5">
                    Temporarily restrict access for non-admin users and display a maintenance message.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between space-x-2 p-3 rounded-md border border-border/30 hover:bg-muted/50 transition-colors">
                    <Label htmlFor="maintenanceModeSwitch" className="flex flex-col space-y-1 cursor-pointer">
                      <span>Enable Maintenance Mode</span>
                      <span className="font-normal leading-snug text-muted-foreground text-xs">
                        When enabled, only SYSTEM_ADMIN and ADMIN users can log in. Others will see the maintenance page.
                      </span>
                    </Label>
                    <Switch
                      id="maintenanceModeSwitch"
                      checked={maintenanceMode}
                      onCheckedChange={setMaintenanceMode}
                      disabled={isSubmittingMaintenanceMode || isLoading}
                      aria-label="Toggle maintenance mode"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                    <Textarea
                      id="maintenanceMessage"
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="e.g., The application is currently down for maintenance. We'll be back shortly!"
                      disabled={isSubmittingMaintenanceMode || isLoading}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">This message will be shown to users when maintenance mode is active.</p>
                  </div>
                </CardContent>
              </div>
              <CardFooter className="border-t p-5 flex justify-end">
                <Button onClick={handleSaveMaintenanceMode} disabled={isSubmittingMaintenanceMode || isLoading}>
                  {isSubmittingMaintenanceMode ? "Saving..." : "Save Maintenance Settings"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integrations-notifications" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
          <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
            <CardHeader className="border-b p-5">
              <CardTitle className="text-card-foreground text-xl flex items-center gap-2">
                <Send className="h-6 w-6 text-primary" /> Telegram Bot Integration
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-0.5">
                Configure your Telegram bot to receive real-time payment notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="telegram-token">Bot Token</Label>
                <Input
                  id="telegram-token"
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="Enter your Telegram Bot Token"
                  disabled={isSubmittingTelegram || isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telegram-chat-ids">Chat IDs</Label>
                <Textarea
                  id="telegram-chat-ids"
                  value={telegramChatIds}
                  onChange={(e) => setTelegramChatIds(e.target.value)}
                  placeholder="Enter one or more Chat IDs, separated by commas"
                  disabled={isSubmittingTelegram || isLoading}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  To send to multiple chats, separate each ID with a comma (e.g., -100123...,-100456...).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telegram-redirect-domain">Redirect Domain</Label>
                <Input
                  id="telegram-redirect-domain"
                  value={telegramRedirectDomain}
                  onChange={(e) => setTelegramRedirectDomain(e.target.value)}
                  placeholder="e.g., https://app.colorhutbd.xyz"
                  disabled={isSubmittingTelegram || isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="border-t p-5 flex justify-end">
              <Button onClick={handleSaveTelegramSettings} disabled={isSubmittingTelegram || isLoading}>
                {isSubmittingTelegram ? "Saving..." : "Save Telegram Settings"}
              </Button>
            </CardFooter>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
              <CardHeader className="border-b p-5">
                <CardTitle className="text-card-foreground text-xl flex items-center gap-2">
                  <Music className="h-6 w-6 text-primary" /> Toast Notification Sound
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm mt-0.5">
                  Set a custom sound URL for all app notifications. Leave blank to use default.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-24 rounded" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="toastSoundUrlInput">Sound URL</Label>
                    <Input
                      id="toastSoundUrlInput"
                      value={toastSoundUrl}
                      onChange={(e) => setToastSoundUrl(e.target.value)}
                      placeholder="e.g., https://example.com/sound.mp3 or /sounds/custom-toast.mp3"
                      disabled={isSubmittingToastSound}
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide a full URL or a relative path. Ensure the file is small for quick loading.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t p-5 flex justify-end">
                <Button onClick={handleSaveToastSoundUrl} disabled={isLoading || isSubmittingToastSound}>
                  {isSubmittingToastSound ? "Saving..." : "Save Sound Setting"}
                </Button>
              </CardFooter>
            </Card>

            <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
              <CardHeader className="border-b p-5">
                <CardTitle className="text-card-foreground text-xl flex items-center gap-2">
                  <ImageIcon className="h-6 w-6 text-primary" /> Leaderboard Background Image
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm mt-0.5">
                  Set a custom background image URL for the leaderboard page.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32 rounded" />
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-24 w-40 rounded-md mt-2" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="leaderboardBgUrlInput">Background Image URL</Label>
                    <Input
                      id="leaderboardBgUrlInput"
                      value={leaderboardBgUrl}
                      onChange={(e) => setLeaderboardBgUrl(e.target.value)}
                      placeholder="e.g., https://example.com/leaderboard-bg.jpg"
                      disabled={isSubmittingLeaderboardBg}
                    />
                    {leaderboardBgUrl && (
                      <div className="mt-4 p-2 border rounded-md inline-block bg-muted">
                        <NextImage
                          src={leaderboardBgUrl}
                          alt="Leaderboard background preview"
                          width={200}
                          height={120}
                          className="object-cover rounded"
                          unoptimized={true}
                          onError={(e) => { e.currentTarget.src = DEFAULT_LEADERBOARD_BACKGROUND_PLACEHOLDER; e.currentTarget.alt = 'Error loading image. Default shown.' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t p-5 flex justify-end">
                <Button onClick={handleSaveLeaderboardBgUrl} disabled={isLoading || isSubmittingLeaderboardBg}>
                  {isSubmittingLeaderboardBg ? "Saving..." : "Save Background"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CrmTargetSettingsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 pt-0 sm:pt-0 lg:pt-0">
        <div className="inline-flex h-10 w-[300px] bg-muted animate-pulse rounded-xl mb-2" />
        <div className="space-y-6">
          <div className="h-[250px] w-full bg-muted animate-pulse rounded-lg" />
          <div className="h-[200px] w-full bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    }>
      <CrmTargetSettingsPageInner />
    </Suspense>
  );
}
