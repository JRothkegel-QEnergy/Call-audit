"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { User } from "./api/types";

interface SessionValue {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void api.currentUser().then((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);
  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);
  return <SessionContext.Provider value={{ user, ready, setUser, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider");
  return ctx;
}
