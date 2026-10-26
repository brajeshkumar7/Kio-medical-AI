"use client";

import { checkApiAvailability } from "@/lib/http/client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useBackendStatus() {
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const backendCheckInFlight = useRef(false);
  const checkBackend = useCallback(async (showChecking = false) => {
    if (backendCheckInFlight.current) return;
    backendCheckInFlight.current = true;
    if (showChecking) setBackendStatus("checking");
    try {
      setBackendStatus((await checkApiAvailability()) ? "online" : "offline");
    } finally {
      backendCheckInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // The first probe only updates state after the network request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkBackend();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkBackend();
    }, 15000);
    const recheck = () => {
      void checkBackend();
    };
    window.addEventListener("online", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [checkBackend]);

  return { backendStatus, checkBackend };
}
