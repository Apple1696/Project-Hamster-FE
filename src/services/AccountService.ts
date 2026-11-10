import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export type AccountRole = "customer" | "veterinarian";

function normalizeAccountRole(role: unknown): AccountRole | null {
  if (typeof role !== "string") return null;

  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === "customer" || normalizedRole === "veterinarian") {
    return normalizedRole;
  }

  return null;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AccountRole> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;

  if (!data.user) {
    throw new Error("Unable to determine the signed-in account.");
  }

  const userMetadataRole = normalizeAccountRole(data.user.user_metadata.role);
  if (userMetadataRole) return userMetadataRole;

  const appMetadataRole = normalizeAccountRole(data.user.app_metadata.role);
  if (appMetadataRole) return appMetadataRole;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  const profileRole = normalizeAccountRole(profile?.role);
  if (profileRole) return profileRole;

  throw new Error("Your account role could not be determined.");
}

export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string,
  emailRedirectTo: string,
  role: AccountRole = "customer",
): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
      },
      emailRedirectTo,
    },
  });

  if (error) throw error;
}

export async function signUpVeterinarianWithEmail(
  fullName: string,
  email: string,
  password: string,
  emailRedirectTo: string,
): Promise<void> {
  await signUpWithEmail(
    fullName,
    email,
    password,
    emailRedirectTo,
    "veterinarian",
  );
}

export async function updateUserName(fullName: string): Promise<void> {
  const { data, error } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });

  if (error) throw error;
  if (!data.user) {
    throw new Error("Unable to determine the signed-in account.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", data.user.id)
    .select("id")
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    throw new Error("Your profile could not be updated.");
  }
}

export async function updateUserPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) throw error;
}

export async function getVerificationSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resendSignupVerificationEmail(
  email: string,
  emailRedirectTo: string,
): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });

  if (error) throw error;
}