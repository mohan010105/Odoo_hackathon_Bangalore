import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

/** Sign out after this much inactivity. */
const IDLE_LIMIT_MS = 30 * 60 * 1000;
/** Warn this long before the automatic sign-out. */
const WARNING_MS = 2 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "visibilitychange"] as const;

/**
 * Idle session guard. After 30 minutes without interaction the user is warned,
 * then signed out with the same teardown as a manual sign-out: in-flight
 * queries cancelled, cached protected data cleared, session ended, history
 * replaced so Back cannot restore an authenticated screen.
 */
export function SessionTimeout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());

  const endSession = useCallback(async () => {
    setSecondsLeft(null);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut();
    } finally {
      toast.info("Signed out", { description: "Your session expired after 30 minutes idle." });
      navigate({ to: "/login", replace: true });
    }
  }, [navigate, queryClient, signOut]);

  useEffect(() => {
    if (!user) return;

    const markActive = () => {
      if (document.visibilityState === "hidden") return;
      lastActivity.current = Date.now();
      setSecondsLeft(null);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    const interval = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_LIMIT_MS) {
        void endSession();
        return;
      }
      if (idle >= IDLE_LIMIT_MS - WARNING_MS) {
        setSecondsLeft(Math.max(Math.ceil((IDLE_LIMIT_MS - idle) / 1000), 0));
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
    };
  }, [endSession, user]);

  if (!user || secondsLeft === null) return null;

  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Still there?</DialogTitle>
          <DialogDescription>
            For your security we will sign you out in {secondsLeft} second
            {secondsLeft === 1 ? "" : "s"} because of inactivity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => void endSession()}>
            Sign out now
          </Button>
          <Button
            onClick={() => {
              lastActivity.current = Date.now();
              setSecondsLeft(null);
            }}
          >
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
