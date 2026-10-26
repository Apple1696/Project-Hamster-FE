import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type AccessStatus = "loading" | "unauthenticated" | "forbidden" | "allowed";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccessStatus>("loading");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setStatus("unauthenticated");
      } else if (session.user.user_metadata.role !== "customer") {
        setStatus("forbidden");
      } else {
        setStatus("allowed");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (status === "loading") {
    return <div role="status">Checking access...</div>;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (status === "forbidden") {
    return <Navigate to="/home" replace />;
  }

  return children;
}
