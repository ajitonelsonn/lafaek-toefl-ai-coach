"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  sound: boolean;
  reminders: boolean;
  recordingConsent: boolean;
}

interface SessionValue {
  user: SessionUser;
  settings: UserSettings;
  setUser: (u: SessionUser) => void;
  setSettings: (s: UserSettings) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Session state comes from the server (cookie-verified) on every page load. */
export function SessionProvider({ initialUser, initialSettings, children }: { initialUser: SessionUser; initialSettings: UserSettings; children: ReactNode }) {
  const [user, setUserState] = useState(initialUser);
  const [settings, setSettingsState] = useState(initialSettings);
  const setUser = useCallback((u: SessionUser) => setUserState(u), []);
  const setSettings = useCallback((s: UserSettings) => {
    setSettingsState(s);
    try {
      localStorage.setItem("lafaek-toefl:theme", s.theme);
    } catch {
      /* theme cache is a convenience only */
    }
  }, []);
  const value = useMemo(() => ({ user, settings, setUser, setSettings }), [user, settings, setUser, setSettings]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}

/** For components that may render outside the authenticated shell. */
export function useOptionalSession(): SessionValue | null {
  return useContext(SessionContext);
}
