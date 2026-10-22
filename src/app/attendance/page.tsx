
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Clock, Fingerprint, Home, History, Power, Lock, ArrowDown, ArrowUp, MapPin, Loader2, Navigation } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInHours, differenceInMinutes, parse, differenceInSeconds, parseISO, isToday } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, formatDisplayName } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getOfficeLocations, type CompanyLocation } from '@/lib/office-location-service';
import { getOfficeTimes } from '@/lib/office-time-service';
import { saveAttendanceAction } from '@/app/(app)/hrm/attendance/actions';
import { getAttendanceMark } from '@/lib/attendance-service';
import { getWeekendSettings } from '@/lib/weekend-service';
import type { OfficeTime, AttendanceStatus } from '@/types';



const getInitials = (name: string | undefined): string => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};

const ATTENDANCE_STORAGE_KEY = 'colorHutAttendanceMark';

const SlideToConfirm = ({ onConfirm, status, disabled, disabledReason }: { onConfirm: () => void, status: 'Checked In' | 'Checked Out', disabled: boolean, disabledReason: string }) => {
  const [unlocked, setUnlocked] = useState(false);
  const x = useMotionValue(0);
  const sliderRef = React.useRef<HTMLDivElement>(null);
  const [sliderWidth, setSliderWidth] = useState(0);
  const handleSize = 64;

  const textOpacity = useTransform(x, [0, sliderWidth / 3], [1, 0]);

  useEffect(() => {
    const updateSliderWidth = () => {
      if (sliderRef.current) {
        setSliderWidth(sliderRef.current.offsetWidth);
      }
    }
    updateSliderWidth();
    window.addEventListener('resize', updateSliderWidth);
    return () => window.removeEventListener('resize', updateSliderWidth);
  }, [sliderRef]);

  const handleDragEnd = (event: any, info: any) => {
    if (disabled) {
      x.set(0);
      return;
    }
    if (info.offset.x > sliderWidth - handleSize - 20) {
      setUnlocked(true);
      onConfirm();
      setTimeout(() => {
        x.set(0);
        setUnlocked(false);
      }, 1000);
    } else {
      x.set(0);
    }
  };

  const isCheckIn = status === 'Checked Out';
  const text = isCheckIn ? "Slide to Check In" : "Slide to Check Out";
  const bgColor = isCheckIn ? (disabled ? "bg-gray-400" : "bg-green-600") : (disabled ? "bg-gray-400" : "bg-red-600");
  const handleColor = isCheckIn ? (disabled ? "bg-gray-500" : "bg-green-700") : (disabled ? "bg-gray-500" : "bg-red-700");

  return (
    <div
      ref={sliderRef}
      className={cn(
        "relative w-full h-20 rounded-full text-white font-semibold text-lg flex items-center justify-center overflow-hidden transition-colors",
        bgColor
      )}
    >
      <motion.div
        className={cn("absolute left-1 top-1 h-16 w-16 rounded-full flex items-center justify-center z-10", handleColor, disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing")}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: sliderWidth > handleSize ? sliderWidth - handleSize - 8 : 0 }}
        onDragEnd={handleDragEnd}
        dragElastic={0.05}
        whileTap={{ scale: disabled ? 1 : 1.1 }}
      >
        <Fingerprint className="h-8 w-8" />
      </motion.div>
      <AnimatePresence>
        {!unlocked && (
          <motion.span
            style={{ opacity: textOpacity }}
            className="select-none pointer-events-none text-center px-20"
          >
            {disabled ? disabledReason : text}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};


export default function CheckInOutPage() {
  const { currentUser, isLoading: isAuthLoading, stopImpersonating, originalUser } = useAuth();
  const { socket, isConnected } = useSocket();
  const router = useRouter();
  const [status, setStatus] = useState<'Checked In' | 'Checked Out'>('Checked Out');
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Requesting location...');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [checkInLocation, setCheckInLocation] = useState<{ lat: number; lng: number; } | undefined>(undefined);
  const [officeLocations, setOfficeLocations] = useState<CompanyLocation[]>([]);
  const [officeTimes, setOfficeTimes] = useState<OfficeTime[]>([]);
  const [weekendDays, setWeekendDays] = useState<string[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('On Time');

  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      router.replace('/attendance/login');
    }
  }, [currentUser, isAuthLoading, router]);

  const isTodayWeekend = useMemo(() => {
    if (!isClient) return false;
    const today = format(new Date(), 'EEEE');
    return weekendDays.includes(today);
  }, [isClient, weekendDays]);

  const canPerformAction = useMemo(() => {
    if (checkOutTime && isToday(checkOutTime)) {
      return false;
    }
    const isLocationOkForCheckIn = locationStatus === 'Inside Office Location';
    const isLocationPermissionGranted = !locationStatus.includes('denied') && !locationStatus.includes('unavailable') && !locationStatus.includes('timed out');

    if (status === 'Checked Out') {
      return isLocationOkForCheckIn;
    }
    if (status === 'Checked In') {
      return isLocationPermissionGranted;
    }
    return false;
  }, [status, locationStatus, checkOutTime]);

  const disabledReason = useMemo(() => {
    if (checkOutTime && isToday(checkOutTime)) {
      return 'Attendance complete for today';
    }
    if (status === 'Checked Out' && locationStatus !== 'Inside Office Location') {
      return 'Must be inside office to check in';
    }
    if (status === 'Checked In' && !(!locationStatus.includes('denied') && !locationStatus.includes('unavailable') && !locationStatus.includes('timed out'))) {
      return 'Location permission required';
    }
    if (status === 'Checked Out') return 'Check-in unavailable';
    if (status === 'Checked In') return 'Check-out unavailable';
    return 'Action unavailable';
  }, [status, locationStatus, checkOutTime]);


  const saveStateToLocalStorage = (newState: any) => {
    if (currentUser) {
      const dataToStore = {
        userId: currentUser.id,
        date: new Date().toISOString().split('T')[0],
        ...newState,
      };
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(dataToStore));
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in metres
  }

  useEffect(() => {
    setIsClient(true);

    const storedMark = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (storedMark) {
      try {
        const mark = JSON.parse(storedMark);
        if (mark.userId === currentUser?.id && isToday(parseISO(mark.date))) {
          setStatus(mark.status);
          if (mark.checkInTime) setCheckInTime(parseISO(mark.checkInTime));
          if (mark.checkInLocation) setCheckInLocation(mark.checkInLocation); // Load check-in location
          if (mark.checkOutTime) setCheckOutTime(parseISO(mark.checkOutTime));
          if (mark.attendanceStatus) setAttendanceStatus(mark.attendanceStatus);
        } else {
          localStorage.removeItem(ATTENDANCE_STORAGE_KEY);
        }
      } catch (e) {
        console.error("Failed to parse attendance mark from localStorage", e);
        localStorage.removeItem(ATTENDANCE_STORAGE_KEY);
      }
    }

    const fetchInitialData = async () => {
      try {
        if (currentUser) {
          const mark = await getAttendanceMark(currentUser.id);
          if (mark) {
            if (isToday(parseISO(mark.date))) {
              setStatus(mark.status);
              if (mark.lastCheckInTime) setCheckInTime(parseISO(mark.lastCheckInTime));
              if (mark.checkInLocation) setCheckInLocation(mark.checkInLocation);
              if (mark.lastCheckOutTime) setCheckOutTime(parseISO(mark.lastCheckOutTime));
              if (mark.attendanceStatus) setAttendanceStatus(mark.attendanceStatus);
              saveStateToLocalStorage({
                status: mark.status,
                checkInTime: mark.lastCheckInTime,
                checkInLocation: mark.checkInLocation,
                checkOutTime: mark.lastCheckOutTime,
                attendanceStatus: mark.attendanceStatus,
              });
            }
          }
        }

        const [locations, times, weekendSettings] = await Promise.all([getOfficeLocations(), getOfficeTimes(), getWeekendSettings()]);
        setOfficeLocations(locations);
        setOfficeTimes(times);
        setWeekendDays(weekendSettings.days);

        if ('geolocation' in navigator) {
          let watchId: number;

          const startWatching = (highAccuracy: boolean): number => {
            const id: number = navigator.geolocation.watchPosition(
              (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                const newLocation = { lat: latitude, lng: longitude };
                setCurrentLocation(newLocation);

                // Emit location update via socket
                if (socket && isConnected && currentUser) {
                  socket.emit("attendance-location-update", {
                    userId: currentUser.id,
                    userName: currentUser.name,
                    location: newLocation,
                    accuracy,
                    timestamp: new Date().toISOString()
                  });
                }

                let isInside = false;
                if (locations.length > 0) {
                  for (const office of locations) {
                    const distance = getDistance(latitude, longitude, office.latitude, office.longitude);
                    if (distance <= office.radius) { isInside = true; break; }
                  }
                }
                setLocationStatus(isInside ? 'Inside Office Location' : 'Outside Office Location');
              },
              (error) => {
                if (highAccuracy && (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE)) {
                  console.warn("High accuracy location failed, falling back to low accuracy...");
                  navigator.geolocation.clearWatch(id);
                  watchId = startWatching(false);
                } else {
                  switch (error.code) {
                    case error.PERMISSION_DENIED: setLocationStatus('Location permission denied.'); break;
                    case error.POSITION_UNAVAILABLE: setLocationStatus('Location information is unavailable.'); break;
                    case error.TIMEOUT: setLocationStatus('Location request timed out.'); break;
                    default: setLocationStatus('An unknown error occurred.'); break;
                  }
                }
              },
              {
                enableHighAccuracy: highAccuracy,
                timeout: highAccuracy ? 15000 : 20000,
                maximumAge: 60000 // Accept a cached position from the last 1 minute
              }
            );
            return id;
          };

          watchId = startWatching(true);
          return () => navigator.geolocation.clearWatch(watchId);
        } else {
          setLocationStatus('Geolocation is not supported by this browser.');
        }
      } catch (error) {
        setLocationStatus('Could not load office locations or times.');
        console.error("Failed to fetch office data:", error);
      }
    };

    let cleanup: (() => void) | undefined;
    if (currentUser) {
      fetchInitialData().then(fn => cleanup = fn);
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, [currentUser, socket, isConnected]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCheckIn = async () => {
    if (!canPerformAction) {
      toast({ title: "Check-in Failed", description: disabledReason, variant: "destructive" });
      return;
    }
    if (status === 'Checked In' || !currentUser) return;

    const now = new Date();

    let isLate = false;
    let checkInMessage = 'You checked in on time.';

    const userRole = currentUser.role;
    const applicableOfficeTime = officeTimes.find(time =>
      (Array.isArray(time.applicableRoles) && time.applicableRoles.includes(userRole)) || time.applicableRoles === 'all'
    );

    if (applicableOfficeTime) {
      const [hours, minutes] = applicableOfficeTime.startTime.split(':').map(Number);
      const officeStartTime = new Date(now);
      officeStartTime.setHours(hours, minutes, 0, 0);

      const gracePeriodMinutes = applicableOfficeTime.graceTime || 0;
      const graceEndTime = new Date(officeStartTime.getTime() + gracePeriodMinutes * 60000);

      if (now > graceEndTime) {
        isLate = true;
        checkInMessage = `You are late. Check-in was at ${format(now, 'h:mm:ss a')}.`;
      }
    }

    const newAttendanceStatus = isLate ? 'Late' as const : 'On Time' as const;
    setAttendanceStatus(newAttendanceStatus);
    setCheckInLocation(currentLocation || undefined);

    const recordData = {
      date: format(now, 'yyyy-MM-dd'),
      checkInTime: now.toISOString(),
      status: newAttendanceStatus,
      location: locationStatus,
      checkInLocation: currentLocation || undefined,
    };
    const result = await saveAttendanceAction(currentUser, recordData);
    if (result.success) {
      setStatus('Checked In');
      setCheckInTime(now);
      setCheckOutTime(null);
      saveStateToLocalStorage({
        status: 'Checked In',
        checkInTime: now.toISOString(),
        checkInLocation: currentLocation,
        checkOutTime: null,
        attendanceStatus: newAttendanceStatus,
      });
      toast({
        title: isLate ? "Checked In (Late)" : "Checked In Successfully",
        description: checkInMessage,
        variant: isLate ? "destructive" : "default",
      });
    } else {
      toast({ title: "Check-in Failed", description: result.error, variant: "destructive" });
    }
  };

  const handleCheckOut = async () => {
    if (!canPerformAction) {
      toast({ title: "Check-out Failed", description: disabledReason, variant: "destructive" });
      return;
    }
    if (status === 'Checked Out' || !checkInTime || !currentUser) return;
    const now = new Date();

    const workedSeconds = differenceInSeconds(now, checkInTime);
    const hours = Math.floor(workedSeconds / 3600);
    const minutes = Math.floor((workedSeconds % 3600) / 60);
    const hoursWorked = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    const recordData = {
      date: format(checkInTime, 'yyyy-MM-dd'),
      checkInTime: checkInTime.toISOString(),
      status: attendanceStatus,
      checkInLocation: checkInLocation,
      checkOutTime: now.toISOString(),
      hoursWorked: hoursWorked,
      checkOutLocation: currentLocation || undefined,
    };
    const result = await saveAttendanceAction(currentUser, recordData);
    if (result.success) {
      setStatus('Checked Out');
      setCheckOutTime(now);
      saveStateToLocalStorage({
        status: 'Checked Out',
        checkInTime: checkInTime.toISOString(),
        checkInLocation: checkInLocation,
        checkOutTime: now.toISOString(),
        attendanceStatus: attendanceStatus,
      });
      toast({
        title: "Checked Out Successfully",
        description: `You checked out at ${format(now, 'h:mm:ss a')}. Total hours: ${hoursWorked}.`,
      });
    } else {
      toast({ title: "Check-out Failed", description: result.error, variant: "destructive" });
    }
  };

  const handleActionConfirm = () => {
    if (status === 'Checked Out') {
      handleCheckIn();
    } else {
      handleCheckOut();
    }
    setIsSheetOpen(false); // Close sheet after action is triggered
  };

  const calculateHoursWorked = () => {
    if (checkInTime && checkOutTime) {
      const hours = differenceInHours(checkOutTime, checkInTime);
      const minutes = differenceInMinutes(checkOutTime, checkInTime) % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    if (checkInTime && status === 'Checked In') {
      const hours = differenceInHours(new Date(), checkInTime);
      const minutes = differenceInMinutes(new Date(), checkInTime) % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return '00:00';
  };

  const getGreeting = useCallback(() => {
    if (!isClient) return 'Loading...';
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, [currentTime, isClient]);

  const name = formatDisplayName(currentUser?.name);
  const ActionIcon = status === 'Checked Out' ? Lock : Power;

  const isActionDisabled = !canPerformAction;

  if (isAuthLoading || !currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-gray-100 dark:bg-gray-900 p-0 sm:p-6 pb-28">
      {originalUser && (
        <div className="w-full bg-primary/10 border-b border-primary/20 py-3 px-4 flex flex-col sm:flex-row justify-center items-center gap-3 z-50">
          <p className="text-xs sm:text-sm font-medium text-primary flex items-center gap-2 text-center">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Viewing as <span className="font-bold">{currentUser?.name}</span>
          </p>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 border-none px-4 text-xs"
            onClick={stopImpersonating}
          >
            Return to My Account
          </Button>
        </div>
      )}
      <div className="w-full max-w-md p-4 sm:p-0 flex-grow flex flex-col items-center justify-between">
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            Hey {name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{getGreeting()}, mark your attendance.</p>
        </div>
        <Avatar className="h-12 w-12 border-2 border-primary">
          <AvatarImage src={currentUser?.avatarUrl || undefined} alt={currentUser?.name} />
          <AvatarFallback>{getInitials(currentUser?.name)}</AvatarFallback>
        </Avatar>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-grow w-full">
        <div className="text-center mb-10">
          <p className="text-5xl sm:text-6xl font-bold text-gray-800 dark:text-gray-200 font-mono tracking-tighter">
            {isClient ? format(currentTime, 'h:mm:ss a') : '--:--'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isClient ? format(currentTime, "eeee, MMMM d, yyyy") : 'Loading...'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center justify-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {locationStatus}
          </p>
        </div>



        <motion.div
          key={status}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative"
        >
          <Button
            className={cn(
              "h-48 w-48 sm:h-56 sm:w-56 rounded-full text-2xl font-bold flex flex-col items-center justify-center transition-all duration-300 transform",
              "shadow-[inset_4px_4px_8px_rgba(255,255,255,0.4),_inset_-4px_-4px_8px_rgba(0,0,0,0.1),_8px_8px_16px_rgba(0,0,0,0.1)]",
              "disabled:opacity-50 disabled:shadow-none",
              !isActionDisabled && "hover:shadow-[inset_2px_2px_4px_rgba(255,255,255,0.3),_inset_-2px_-2px_4px_rgba(0,0,0,0.15),_4px_4px_8px_rgba(0,0,0,0.1)]",
              status === 'Checked Out' ? 'bg-white hover:bg-gray-50 text-gray-700' : 'bg-red-500 hover:bg-red-600 text-white'
            )}
            onClick={() => { if (!isActionDisabled) setIsSheetOpen(true) }}
            disabled={isActionDisabled}
          >
            <ActionIcon className="h-20 w-20 mb-2" />
            {status === 'Checked Out' ? 'Check In' : 'Check Out'}
          </Button>
        </motion.div>
      </div>

      {/* Bottom Panel */}
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <ArrowDown className="h-3 w-3" /> Check-in
          </div>
          <p className="font-bold text-lg text-green-600">
            {checkInTime ? format(checkInTime, 'h:mm a') : '--:--'}
          </p>
        </div>
        <div className="border-l border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3" /> Total Hrs
          </div>
          <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
            {isClient ? calculateHoursWorked() : '--:--'}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <ArrowUp className="h-3 w-3" /> Check-out
          </div>
          <p className="font-bold text-lg text-red-600">
            {checkOutTime ? format(checkOutTime, 'h:mm a') : '--:--'}
          </p>
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="w-full max-w-lg mx-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-center text-xl">Confirm Action</SheetTitle>
            <SheetDescription className="text-center">
              Slide to {status === 'Checked Out' ? 'check in' : 'check out'}.
            </SheetDescription>
          </SheetHeader>
          <div className="py-8 text-center">
            <SlideToConfirm onConfirm={handleActionConfirm} status={status} disabled={isActionDisabled} disabledReason={disabledReason} />
          </div>
        </SheetContent>
      </Sheet>
      </div>
    </div>
  );
}
