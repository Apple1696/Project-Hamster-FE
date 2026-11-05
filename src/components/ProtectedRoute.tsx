import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type AccountRole = "customer" | "veterinarian";
type AccessStatus = "loading" | "unauthenticated" | "forbidden" | "allowed";

function normalizeAccountRole(role: unknown): AccountRole | null {
  if (typeof role !== "string") return null;

  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === "customer" || normalizedRole === "veterinarian") {
    return normalizedRole;
  }

  return null;
}

export function ProtectedRoute({
  children,
  requiredRole = "customer",
}: {
  children: ReactNode;
  requiredRole?: AccountRole;
}) {
  const [status, setStatus] = useState<AccessStatus>("loading");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setStatus("unauthenticated");
        return;
      }

      const sessionRole =
        normalizeAccountRole(session.user.user_metadata?.role) ??
        normalizeAccountRole(session.user.app_metadata?.role);

      if (sessionRole === requiredRole) {
        setStatus("allowed");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!error && normalizeAccountRole(profile?.role) === requiredRole) {
        setStatus("allowed");
        return;
      }

      setStatus("forbidden");
    });

    return () => subscription.unsubscribe();
  }, [requiredRole]);

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
