
"use client";

import type { User } from '@/types';
import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { serverSeedInitialAdminUser as seedInitialAdminUser, serverGetUserById as getUserById, serverVerifyUserPassword as verifyUserPassword, serverUpdateUserAvatar as updateUserAvatarService, serverVerifyTwoFactorCode, serverLogout } from '@/app/actions/auth';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password: string, customRedirect?: string) => Promise<{ success: boolean; require2FA?: boolean; pendingUser?: User }>;
  complete2FALogin: (pendingUser: User, code: string, customRedirect?: string) => Promise<boolean>;
  logout: () => void;
  updateUserAvatar: (avatarUrl: string | null) => Promise<boolean>;
  refreshCurrentUser: () => Promise<void>;
  impersonate: (user: User) => void;
  stopImpersonating: () => void;
  originalUser: User | null;
  isSuspendedDialogOpen: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuspendedDialogOpen, setIsSuspendedDialogOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const logout = useCallback(() => {
    console.log("AuthContext: Logging out user.");
    setCurrentUser(null);
    setOriginalUser(null);
    setIsSuspendedDialogOpen(false);
    localStorage.removeItem('colorhut-user');
    localStorage.removeItem('colorhut-original-user');
    if (typeof window !== 'undefined') {
      document.cookie = 'colorhut-user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      serverLogout().catch(() => {}).finally(() => { window.location.href = '/login'; });
    } else {
      router.push('/login');
    }
  }, [router]);

  const refreshCurrentUser = useCallback(async () => {
    if (currentUser && currentUser.id && !isSuspendedDialogOpen) {
      console.log(`AuthContext: Refreshing current user data for ID: ${currentUser.id}`);
      try {
        const dbUser = await getUserById(currentUser.id);
        if (dbUser) {
          if (dbUser.isBanned) {
            console.log("AuthContext: Current user has been banned during session. Showing suspension dialog.");
            setCurrentUser(dbUser as User);
            localStorage.setItem('colorhut-user', JSON.stringify(dbUser));
            setIsSuspendedDialogOpen(true);
          } else {
            const { password, ...userToStore } = dbUser;
            if (JSON.stringify(currentUser) !== JSON.stringify(userToStore)) {
              console.log("AuthContext: Fetched latest user data (not banned). Updating local state.");
              setCurrentUser(userToStore as User);
              localStorage.setItem('colorhut-user', JSON.stringify(userToStore));
            }
            if (isSuspendedDialogOpen) { // If dialog was open but user is no longer banned
              setIsSuspendedDialogOpen(false);
            }
          }
        } else {
          console.log("AuthContext: Current user not found in MySQL during refresh (e.g., deleted). Showing suspension dialog to force logout.");
          setIsSuspendedDialogOpen(true);
        }
      } catch (error) {
        console.error("AuthContext: Error refreshing current user data:", error);
      }
    }
  }, [currentUser, isSuspendedDialogOpen]);

  useEffect(() => {
    const initializeAuth = async () => {
      console.log("AuthContext: Initializing auth...");
      try {
        await seedInitialAdminUser();
        console.log("AuthContext: Initial admin user seeding/validation complete.");

        const storedUserJson = localStorage.getItem('colorhut-user');
        if (storedUserJson) {
          console.log("AuthContext: Found user in localStorage.");
          try {
            // Robust parsing and validation
            const storedUser = JSON.parse(storedUserJson);
            if (storedUser && typeof storedUser === 'object' && storedUser.id && typeof storedUser.id === 'string') {
              console.log(`AuthContext: Validating stored user ID: ${storedUser.id} against MySQL.`);
              try {
                const dbUser = await getUserById(storedUser.id);
                if (dbUser) {
                  setCurrentUser(dbUser as User);
                  if (dbUser.isBanned) {
                    console.log("AuthContext: Stored user is banned. Will trigger suspension dialog.");
                    setIsSuspendedDialogOpen(true);
                  }
                } else {
                  console.log("AuthContext: Stored user NOT found in MySQL. Clearing localStorage.");
                  localStorage.removeItem('colorhut-user');
                }
              } catch (dbErr) {
                console.warn("AuthContext: DB validation failed, using stored user state:", dbErr);
                setCurrentUser(storedUser as User);
              }
            } else {
              console.log("AuthContext: Invalid or corrupted user object in localStorage. Clearing.");
              localStorage.removeItem('colorhut-user');
            }
          } catch (error) {
            console.error("AuthContext: Failed to parse or validate stored user:", error);
            localStorage.removeItem('colorhut-user');
          }
        } else {
          console.log("AuthContext: No user found in localStorage.");
        }
      } catch (seedError) {
        console.error("AuthContext: Error during initial admin user seeding phase:", seedError);
      } finally {
        console.log("AuthContext: Initialization complete. Setting isLoading to false.");
        
        // Handle original user for impersonation
        const storedOriginalUserJson = localStorage.getItem('colorhut-original-user');
        if (storedOriginalUserJson) {
           try {
             setOriginalUser(JSON.parse(storedOriginalUserJson));
           } catch (e) {
             console.error("AuthContext: Failed to parse original user", e);
           }
        }
        
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const setAuthCookie = (user: User) => {
    if (typeof window !== 'undefined') {
      const value = JSON.stringify(user);
      const date = new Date();
      date.setTime(date.getTime() + (7 * 24 * 60 * 60 * 1000));
      document.cookie = `colorhut-user=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
    }
  };

  const login = async (email: string, pass: string, customRedirect?: string): Promise<{ success: boolean; require2FA?: boolean; pendingUser?: User }> => {
    try {

      const authenticatedUser = await verifyUserPassword(email, pass);

      if (authenticatedUser) {
        if (authenticatedUser.isBanned) {
          console.log("AuthContext: Login attempt by banned user. Setting state for suspension dialog.");
          setCurrentUser(authenticatedUser);
          localStorage.setItem('colorhut-user', JSON.stringify(authenticatedUser));
          setAuthCookie(authenticatedUser);
          setIsSuspendedDialogOpen(true);
          router.push('/dashboard');
          return { success: true };
        }

        if (authenticatedUser.hasTwoFactor) {
          console.log("AuthContext: User requires 2FA verification.");
          return { success: false, require2FA: true, pendingUser: authenticatedUser };
        }

        console.log("AuthContext: Authentication successful.");
        setCurrentUser(authenticatedUser);
        localStorage.setItem('colorhut-user', JSON.stringify(authenticatedUser));
        setAuthCookie(authenticatedUser);

        if (customRedirect) {
          window.location.href = customRedirect;
          return { success: true };
        }

        // Redirect logic based on role using fresh window navigation
        const systemRoles = ["SYSTEM_ADMIN", "ADMIN", "CR", "VENDOR", "LR", "CO", "HRM", "ACCOUNTANT", "MANAGER", "SW", "CG", "EDITOR", "ARTIST"];
        let targetPath = '/dashboard';
        if (!systemRoles.includes(authenticatedUser.role)) {
          targetPath = '/dashboard';
        } else if (authenticatedUser.role === 'LR') {
          targetPath = '/projects';
        }
        window.location.href = targetPath;
        return { success: true };
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid email or password. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("AuthContext: Error during login process:", error);
      toast({
        title: "Login Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
    return { success: false };
  };

  const complete2FALogin = async (pendingUser: User, code: string, customRedirect?: string): Promise<boolean> => {
    try {
      const res = await serverVerifyTwoFactorCode(pendingUser.id, code);
      if (res.success) {
        if (res.isBackupCode) {
          toast({
            title: "Backup Code Used",
            description: `Login verified using recovery backup code. (${res.remainingBackupCodes} remaining backup codes)`,
          });
        }
        setCurrentUser(pendingUser);
        localStorage.setItem('colorhut-user', JSON.stringify(pendingUser));
        setAuthCookie(pendingUser);

        if (customRedirect) {
          window.location.href = customRedirect;
          return true;
        }

        const systemRoles = ["SYSTEM_ADMIN", "ADMIN", "CR", "VENDOR", "LR", "CO", "HRM", "ACCOUNTANT", "MANAGER", "SW", "CG", "EDITOR", "ARTIST"];
        let targetPath = '/dashboard';
        if (!systemRoles.includes(pendingUser.role)) {
          targetPath = '/dashboard';
        } else if (pendingUser.role === 'LR') {
          targetPath = '/projects';
        }
        window.location.href = targetPath;
        return true;
      } else {
        toast({
          title: "2FA Verification Failed",
          description: res.message || "Invalid 6-digit code or backup code.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to verify 2FA code.", variant: "destructive" });
    }
    return false;
  };

  const updateUserAvatar = async (avatarUrl: string | null): Promise<boolean> => {
    if (!currentUser || !currentUser.id) {
      console.log("AuthContext: updateUserAvatar - No current user or user ID.");
      return false;
    }

    const success = await updateUserAvatarService(currentUser.id, avatarUrl);

    if (success) {
      console.log("AuthContext: Avatar updated successfully in MySQL. Updating local state.");
      const updatedUser = { ...currentUser, avatarUrl: avatarUrl || undefined };
      setCurrentUser(updatedUser);
      localStorage.setItem('colorhut-user', JSON.stringify(updatedUser));
    } else {
      console.log("AuthContext: Failed to update avatar in MySQL.");
    }
    return success;
  };

  const impersonate = useCallback((user: User) => {
    console.log(`AuthContext: Impersonating user: ${user.id}`);
    
    // Store current user as original user if not already impersonating
    if (!originalUser && currentUser) {
        setOriginalUser(currentUser);
        localStorage.setItem('colorhut-original-user', JSON.stringify(currentUser));
    }

    const { password, ...userToStore } = user;
    setCurrentUser(userToStore as User);
    localStorage.setItem('colorhut-user', JSON.stringify(userToStore));
    
    // Redirect logic based on role with full refresh
    const systemRoles = ["SYSTEM_ADMIN", "ADMIN", "CR", "VENDOR", "LR", "CO", "HRM", "ACCOUNTANT", "MANAGER", "SW", "CG", "EDITOR", "ARTIST"];
    if (!systemRoles.includes(user.role)) {
      window.location.href = '/dashboard';
    } else if (user.role === 'LR') {
      window.location.href = '/projects';
    } else {
      window.location.href = '/dashboard';
    }
    
    toast({
        title: "Viewing Mode Active",
        description: `You are now viewing as ${user.name}.`,
    });
  }, [router, toast, currentUser, originalUser]);

  const stopImpersonating = useCallback(() => {
    if (!originalUser) return;
    
    console.log(`AuthContext: Stopping impersonation, returning to: ${originalUser.id}`);
    setCurrentUser(originalUser);
    localStorage.setItem('colorhut-user', JSON.stringify(originalUser));
    
    setOriginalUser(null);
    localStorage.removeItem('colorhut-original-user');
    
    window.location.href = '/dashboard';
    
    toast({
        title: "Returned to Account",
        description: `Logged back in as ${originalUser.name}.`,
    });
  }, [router, toast, originalUser]);

  // Keep the 15-minute access token fresh while the app is open (rotates the refresh token too).
  useEffect(() => {
    if (!currentUser) return;
    let last = Date.now();
    const refresh = async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (res.status === 401) logout();
        else last = Date.now();
      } catch {
        /* offline: try again next tick */
      }
    };
    const timer = setInterval(refresh, 10 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > 10 * 60 * 1000) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    // A server action rejected with "Unauthorized" (access token expired between refreshes, or the session was revoked):
    // try one refresh; if that fails the session is gone, so go to the login page instead of leaving a broken screen.
    let recovering = false;
    const onRejection = async (e: PromiseRejectionEvent) => {
      const msg = String((e.reason && e.reason.message) || e.reason || '');
      if (!msg.includes('Unauthorized') || recovering) return;
      e.preventDefault();
      recovering = true;
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (res.status === 401) logout();
        else if (!sessionStorage.getItem('sv-auth-retry')) {
          sessionStorage.setItem('sv-auth-retry', '1');
          setTimeout(() => sessionStorage.removeItem('sv-auth-retry'), 30000);
          window.location.reload();
        }
      } catch {
        /* offline */
      } finally {
        recovering = false;
      }
    };
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [currentUser?.id, logout]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (currentUser) {
        const value = JSON.stringify(currentUser);
        const date = new Date();
        date.setTime(date.getTime() + (7 * 24 * 60 * 60 * 1000));
        document.cookie = `colorhut-user=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
      } else {
        document.cookie = 'colorhut-user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
      }
    }
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, complete2FALogin, logout, updateUserAvatar, refreshCurrentUser, impersonate, stopImpersonating, originalUser, isSuspendedDialogOpen }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
