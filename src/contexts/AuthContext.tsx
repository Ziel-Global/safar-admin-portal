import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type UserRole = "pilgrim" | "agent" | "admin";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  country_code: string | null;
  preferred_locale: string;
  preferred_currency: string;
  created_at: string;
  deleted_at?: string | null;
  session_revoked_at?: string | null;
}

export interface Agent {
  id: string;
  user_id: string;
  business_name: string;
  slug: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  city: string | null;
  country_code: string | null;
  bio: string | null;
  status: string;
  subscription_tier: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  agent: Agent | null;
  loading: boolean;
  signOut: (opts?: { scope?: "local" | "global"; silent?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Local-storage keys that contain user-specific draft state and should be cleared on sign-out. */
const USER_LOCAL_KEYS = [
  "safar_watchlist",
  "safar.packing.v2",
  "safar:rfq:draft",
  "safar.checklist.draft",
];

function clearUserLocalState() {
  if (typeof window === "undefined") return;
  for (const key of USER_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function getJwtIssuedAt(accessToken: string | undefined): number | null {
  if (!accessToken || typeof window === "undefined") return null;
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(window.atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { iat?: unknown };
    return typeof json.iat === "number" ? json.iat : null;
  } catch {
    return null;
  }
}

function sessionWasRevoked(activeSession: Session | null, revokedAt: string | null | undefined): boolean {
  if (!activeSession || !revokedAt) return false;
  const issuedAt = getJwtIssuedAt(activeSession.access_token);
  const revokedAtSeconds = Math.floor(new Date(revokedAt).getTime() / 1000);
  return issuedAt !== null && issuedAt < revokedAtSeconds;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);
  const forcedSignOutRef = useRef(false);

  const forceLocalSignOut = async (message: string) => {
    if (forcedSignOutRef.current) return;
    forcedSignOutRef.current = true;
    try {
      await supabase.removeAllChannels();
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    clearUserLocalState();
    lastUserIdRef.current = null;
    setProfile(null);
    setAgent(null);
    setSession(null);
    toast.error(message);
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  const loadProfile = async (userId: string, activeSession?: Session | null) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const typed = profileData as Profile | null;

    // If the profile is soft-deleted, sign out immediately.
    if (typed?.deleted_at) {
      await supabase.auth.signOut();
      clearUserLocalState();
      setProfile(null);
      setAgent(null);
      toast.error("This account has been deleted.");
      if (typeof window !== "undefined") window.location.href = "/";
      return;
    }

    if (sessionWasRevoked(activeSession ?? session, typed?.session_revoked_at)) {
      await forceLocalSignOut("You've been signed out on all devices.");
      return;
    }

    setProfile(typed);

    if (typed?.role === "agent") {
      const { data: agentData } = await supabase
        .from("agents")
        .select(
          "id, user_id, business_name, slug, logo_url, cover_image_url, city, country_code, bio, status, subscription_tier",
        )
        .eq("user_id", userId)
        .maybeSingle();
      setAgent(agentData as Agent | null);
    } else {
      setAgent(null);
    }
  };

  useEffect(() => {
    // 1) Set up listener FIRST so we never miss an event during getSession()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Always update local session state synchronously
      setSession(newSession);

      // PASSWORD_RECOVERY: redirect user to set a new password
      if (event === "PASSWORD_RECOVERY") {
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/reset-password")) {
          window.location.href = "/reset-password";
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        lastUserIdRef.current = null;
        clearUserLocalState();
        setProfile(null);
        setAgent(null);
        return;
      }

      if (newSession?.user) {
        forcedSignOutRef.current = false;
        const newId = newSession.user.id;
        const userChanged = lastUserIdRef.current !== newId;
        lastUserIdRef.current = newId;

        // Re-fetch profile only when the user changes or on explicit USER_UPDATED.
        // TOKEN_REFRESHED should be silent — Supabase already updated the access token.
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED" || userChanged) {
          // Defer to avoid deadlock inside the callback
          setTimeout(() => {
            loadProfile(newId, newSession);
          }, 0);
        }
      } else {
        lastUserIdRef.current = null;
        setProfile(null);
        setAgent(null);
      }
    });

    // 2) Then check the current session (covers the case where there's no listener event on initial load)
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      if (existing?.user) {
        lastUserIdRef.current = existing.user.id;
        loadProfile(existing.user.id, existing).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 3) Multi-tab sync: if Supabase's auth token is removed in another tab, sign out here too.
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      // Supabase stores tokens under a key starting with "sb-"
      if (e.key.startsWith("sb-") && e.newValue === null) {
        // Trigger a clean local sign-out
        supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }

    return () => {
      subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    const checkRevocation = () => {
      loadProfile(session.user.id, session);
    };
    const onFocus = () => checkRevocation();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkRevocation();
    };

    const interval = window.setInterval(checkRevocation, 30_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [session?.access_token, session?.user?.id]);

  const signOut: AuthContextValue["signOut"] = async (opts) => {
    const scope = opts?.scope ?? "local";
    try {
      // Best-effort: remove all active realtime channels so they don't keep retrying with a stale token
      try {
        await supabase.removeAllChannels();
      } catch {
        /* ignore */
      }
      await supabase.auth.signOut({ scope });
    } finally {
      clearUserLocalState();
      lastUserIdRef.current = null;
      setProfile(null);
      setAgent(null);
      setSession(null);
      if (!opts?.silent && typeof window !== "undefined") {
        toast.success("You've been signed out.");
      }
    }
  };

  const refresh = async () => {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        agent,
        loading,
        signOut,
        refresh,
        refreshProfile: refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
