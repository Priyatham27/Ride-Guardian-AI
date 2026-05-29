"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "firebase/auth";

interface UserProfile {
  uid: string;
  user_id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  has_profile: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// Pages that don't require authentication
const PUBLIC_ROUTES = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const fetchProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    try {
      const res = await fetch(`${apiUrl}/api/auth/profile?firebase_uid=${uid}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Could not fetch profile:", err);
    }
    return null;
  }, [apiUrl]);

  const refreshProfile = useCallback(async () => {
    if (currentUser) {
      const profile = await fetchProfile(currentUser.uid);
      setUserProfile(profile);
    }
  }, [currentUser, fetchProfile]);

  // Route guarding — only runs after auth has initialized
  useEffect(() => {
    if (!initialized || loading) return;

    if (currentUser) {
      if (!userProfile || !userProfile.has_profile) {
        if (pathname !== "/onboarding" && !PUBLIC_ROUTES.includes(pathname)) {
          router.replace("/onboarding");
        }
      } else {
        if (PUBLIC_ROUTES.includes(pathname) || pathname === "/onboarding") {
          router.replace("/");
        }
      }
    } else {
      if (!PUBLIC_ROUTES.includes(pathname)) {
        router.replace("/login");
      }
    }
  }, [pathname, currentUser, userProfile, loading, initialized, router]);

  // Firebase auth listener — runs once on mount, client-side only
  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      setInitialized(true);
      return;
    }

    // Safety timeout — if Firebase doesn't resolve within 6 seconds, stop loading
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setInitialized(true);
    }, 6000);

    let unsubscribe: (() => void) | null = null;

    // Dynamic import to avoid SSR issues with Firebase
    import("@/lib/firebase").then(({ getFirebaseAuth, onAuthStateChanged }) => {
      try {
        const authInstance = getFirebaseAuth();
        unsubscribe = onAuthStateChanged(authInstance, async (user: User | null) => {
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }

          setCurrentUser(user);

          if (user) {
            localStorage.setItem("firebase_uid", user.uid);
            const profile = await fetchProfile(user.uid);
            setUserProfile(profile);
          } else {
            localStorage.removeItem("firebase_uid");
            setUserProfile(null);
          }
          setLoading(false);
          setInitialized(true);
        });
      } catch (err) {
        console.error("Firebase auth initialization failed:", err);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        setLoading(false);
        setInitialized(true);
      }
    }).catch((err) => {
      console.error("Failed to load Firebase module:", err);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setLoading(false);
      setInitialized(true);
    });

    return () => {
      if (unsubscribe) unsubscribe();
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        const { getFirebaseAuth, signOut } = await import("@/lib/firebase");
        const authInstance = getFirebaseAuth();
        await signOut(authInstance);
      }
    } catch {}
    localStorage.removeItem("firebase_uid");
    setCurrentUser(null);
    setUserProfile(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
