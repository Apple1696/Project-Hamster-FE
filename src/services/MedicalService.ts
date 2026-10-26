import { supabase } from "@/lib/supabase";

export type MedicalHamster = {
  id: string;
  hamster_name: string;
  species_breed: string | null;
  weight_grams: number | null;
  age_months: number | null;
  gender: string | null;
  image_url: string | null;
};

export type Veterinarian = {
  id: string;
  name: string;
  email: string | null;
  role: "Veterinarian";
};

export type AppointmentAvailability = {
  id: string;
  vet_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  veterinarian: Veterinarian;
};

export type AppointmentRequest = {
  hamsterId: string;
  ownerId: string;
  availabilityId: string;
  vetId: string;
  appointmentDate: string;
  appointmentEndAt: string;
  reasonForVisit: string;
};

type AvailabilityRow = Omit<AppointmentAvailability, "veterinarian">;
type ProfileRow = Record<string, unknown> & { id: string };

function getProfileString(profile: ProfileRow, field: string): string | null {
  const value = profile[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getMedicalBookingData(): Promise<{
  ownerId: string;
  hamsters: MedicalHamster[];
}> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to book a medical appointment.");

  const { data: hamsters, error } = await supabase
    .from("hamsters")
    .select(
      "id, hamster_name, species_breed, weight_grams, age_months, gender, image_url",
    )
    .eq("owner_id", authData.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return { ownerId: authData.user.id, hamsters: hamsters ?? [] };
}

export async function getWeekAvailability(
  startDate: string,
  endDate: string,
): Promise<AppointmentAvailability[]> {
  const { data: availabilityRows, error } = await supabase
    .from("vet_availability")
    .select(
      "id, vet_id, slot_date, start_time, end_time, max_capacity, current_bookings",
    )
    .gte("slot_date", startDate)
    .lte("slot_date", endDate)
    .order("slot_date")
    .order("start_time");

  if (error) throw error;

  const rows = (availabilityRows ?? []) as AvailabilityRow[];
  const vetIds = [...new Set(rows.map((row) => row.vet_id))];
  if (vetIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", vetIds)
    .ilike("role", "veterinarian");

  if (profileError) throw profileError;

  const profilesById = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return rows.map((row) => {
    const profile = profilesById.get(row.vet_id);
    const firstName = profile
      ? getProfileString(profile, "first_name") ??
        getProfileString(profile, "firstName")
      : null;
    const lastName = profile
      ? getProfileString(profile, "last_name") ??
        getProfileString(profile, "lastName")
      : null;
    const profileName = profile
      ? getProfileString(profile, "full_name") ??
        getProfileString(profile, "display_name") ??
        getProfileString(profile, "displayName") ??
        getProfileString(profile, "name") ??
        [firstName, lastName].filter(Boolean).join(" ")
      : "";
    const email = profile ? getProfileString(profile, "email") : null;
    const name = profileName || email || "Veterinarian";

    return {
      ...row,
      veterinarian: {
        id: row.vet_id,
        name,
        email,
        role: "Veterinarian",
      },
    };
  });
}

export async function bookMedicalAppointment(
  request: AppointmentRequest,
): Promise<void> {
  const { error } = await supabase.from("appointments").insert({
    hamster_id: request.hamsterId,
    owner_id: request.ownerId,
    appointment_date: request.appointmentDate,
    appointment_end_at: request.appointmentEndAt,
    reason_for_visit: request.reasonForVisit || null,
    status: "scheduled",
    vet_id: request.vetId,
    availability_id: request.availabilityId,
  });

  if (error) throw error;
}
