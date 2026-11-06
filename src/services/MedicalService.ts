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

export type MedicalAppointment = {
  id: string;
  hamster_id: string;
  hamster_name: string;
  hamster_image_url?: string | null;
  species_breed?: string | null;
  weight_grams?: number | null;
  age_months?: number | null;
  gender?: string | null;
  appointment_date: string;
  veterinarian_name: string;
  status: string;
};

export type VeterinarianScheduleAppointment = {
  id: string;
  customer_name: string;
  hamster_name: string;
  status: string;
};

export type VeterinarianScheduleSlot = {
  id: string;
  availability_id: string | null;
  start_time: string;
  end_time: string;
  appointments: VeterinarianScheduleAppointment[];
};

type AvailabilityRow = Omit<AppointmentAvailability, "veterinarian">;
type ProfileRow = Record<string, unknown> & { id: string };
type AppointmentRow = {
  id: string;
  hamster_id: string;
  appointment_date: string;
  status: string;
  vet_id: string;
};
type ScheduleAppointmentRow = {
  id: string;
  hamster_id: string;
  owner_id: string;
  appointment_date: string;
  appointment_end_at: string | null;
  status: string;
  availability_id: string | null;
};
type HamsterNameRow = { id: string; hamster_name: string };

function getProfileName(profile: ProfileRow): string {
  const firstName =
    getProfileString(profile, "first_name") ??
    getProfileString(profile, "firstName");
  const lastName =
    getProfileString(profile, "last_name") ??
    getProfileString(profile, "lastName");
  const profileName =
    getProfileString(profile, "full_name") ??
    getProfileString(profile, "display_name") ??
    getProfileString(profile, "displayName") ??
    getProfileString(profile, "name") ??
    [firstName, lastName].filter(Boolean).join(" ");

  return profileName || getProfileString(profile, "email") || "Customer";
}

function getProfileString(profile: ProfileRow, field: string): string | null {
  const value = profile[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getVeterinarianSchedule(
  selectedDate: string,
): Promise<VeterinarianScheduleSlot[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to view your schedule.");

  const { data: availabilityData, error: availabilityError } = await supabase
    .from("vet_availability")
    .select("id, vet_id, slot_date, start_time, end_time, max_capacity, current_bookings")
    .eq("vet_id", authData.user.id)
    .eq("slot_date", selectedDate)
    .order("start_time");

  if (availabilityError) throw availabilityError;

  const dayStart = new Date(`${selectedDate}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) {
    throw new Error("Select a valid schedule date.");
  }
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data: appointmentData, error: appointmentError } = await supabase
    .from("appointments")
    .select(
      "id, hamster_id, owner_id, appointment_date, appointment_end_at, status, availability_id",
    )
    .eq("vet_id", authData.user.id)
    .gte("appointment_date", dayStart.toISOString())
    .lt("appointment_date", dayEnd.toISOString())
    .order("appointment_date");

  if (appointmentError) throw appointmentError;

  const availability = (availabilityData ?? []) as AvailabilityRow[];
  const appointments = (appointmentData ?? []) as ScheduleAppointmentRow[];
  const hamsterIds = [...new Set(appointments.map(({ hamster_id }) => hamster_id))];
  const ownerIds = [...new Set(appointments.map(({ owner_id }) => owner_id))];
  const [hamsterResult, profileResult] = appointments.length
    ? await Promise.all([
        hamsterIds.length
          ? supabase
              .from("hamsters")
              .select("id, hamster_name")
              .in("id", hamsterIds)
          : Promise.resolve({ data: [], error: null }),
        ownerIds.length
          ? supabase.from("profiles").select("*").in("id", ownerIds)
          : Promise.resolve({ data: [], error: null }),
      ])
    : [
        { data: [] as HamsterNameRow[], error: null },
        { data: [] as ProfileRow[], error: null },
      ];

  if (hamsterResult.error) throw hamsterResult.error;
  if (profileResult.error) throw profileResult.error;

  const hamstersById = new Map(
    ((hamsterResult.data ?? []) as HamsterNameRow[]).map((hamster) => [
      hamster.id,
      hamster.hamster_name,
    ]),
  );
  const customersById = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      getProfileName(profile),
    ]),
  );
  const slots: VeterinarianScheduleSlot[] = availability.map((slot) => ({
    id: slot.id,
    availability_id: slot.id,
    start_time: slot.start_time,
    end_time: slot.end_time,
    appointments: [],
  }));

  const availabilityIds = new Set(availability.map(({ id }) => id));
  for (const appointment of appointments) {
    const start = new Date(appointment.appointment_date);
    const end = appointment.appointment_end_at
      ? new Date(appointment.appointment_end_at)
      : new Date(start.getTime() + 60 * 60 * 1000);
    const startTime = start.toTimeString().slice(0, 8);
    const endTime = end.toTimeString().slice(0, 8);
    const slot =
      (appointment.availability_id &&
        availabilityIds.has(appointment.availability_id) &&
        slots.find((item) => item.id === appointment.availability_id)) ||
      slots.find(
        (item) =>
          item.start_time.slice(0, 8) === startTime &&
          item.end_time.slice(0, 8) === endTime,
      );

    const appointmentSummary: VeterinarianScheduleAppointment = {
      id: appointment.id,
      customer_name: customersById.get(appointment.owner_id) ?? "Customer",
      hamster_name: hamstersById.get(appointment.hamster_id) ?? "Hamster",
      status: appointment.status,
    };

    if (slot) {
      slot.appointments.push(appointmentSummary);
      continue;
    }

    slots.push({
      id: `appointment-${appointment.id}`,
      availability_id: null,
      start_time: startTime,
      end_time: endTime,
      appointments: [appointmentSummary],
    });
  }

  return slots.sort((left, right) =>
    left.start_time.localeCompare(right.start_time),
  );
}

export async function getMedicalHistory(): Promise<MedicalAppointment[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to view your medical history.");

  const { data: appointmentRows, error } = await supabase
    .from("appointments")
    .select("id, hamster_id, appointment_date, status, vet_id")
    .eq("owner_id", authData.user.id)
    .order("appointment_date", { ascending: false });

  if (error) throw error;

  const appointments = (appointmentRows ?? []) as AppointmentRow[];
  if (appointments.length === 0) return [];

  const hamsterIds = [
    ...new Set(appointments.map((appointment) => appointment.hamster_id)),
  ];
  const vetIds = [...new Set(appointments.map((appointment) => appointment.vet_id))];
  const [hamsterResult, profileResult] = await Promise.all([
    supabase
      .from("hamsters")
      .select(
        "id, hamster_name, species_breed, weight_grams, age_months, gender, image_url",
      )
      .in("id", hamsterIds),
    supabase
      .from("profiles")
      .select("*")
      .in("id", vetIds)
      .ilike("role", "veterinarian"),
  ]);

  if (hamsterResult.error) throw hamsterResult.error;
  if (profileResult.error) throw profileResult.error;

  const hamstersById = new Map(
    ((hamsterResult.data ?? []) as MedicalHamster[]).map((hamster) => [
      hamster.id,
      hamster,
    ]),
  );
  const profilesById = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => {
      const firstName =
        getProfileString(profile, "first_name") ??
        getProfileString(profile, "firstName");
      const lastName =
        getProfileString(profile, "last_name") ??
        getProfileString(profile, "lastName");
      const profileName =
        getProfileString(profile, "full_name") ??
        getProfileString(profile, "display_name") ??
        getProfileString(profile, "displayName") ??
        getProfileString(profile, "name") ??
        [firstName, lastName].filter(Boolean).join(" ");

      return [
        profile.id,
        profileName || getProfileString(profile, "email") || "Veterinarian",
      ];
    }),
  );

  return appointments.map((appointment) => {
    const hamster = hamstersById.get(appointment.hamster_id);

    return {
      id: appointment.id,
      hamster_id: appointment.hamster_id,
      hamster_name: hamster?.hamster_name ?? "Hamster",
      hamster_image_url: hamster?.image_url ?? null,
      species_breed: hamster?.species_breed ?? null,
      weight_grams: hamster?.weight_grams ?? null,
      age_months: hamster?.age_months ?? null,
      gender: hamster?.gender ?? null,
      appointment_date: appointment.appointment_date,
      veterinarian_name: profilesById.get(appointment.vet_id) ?? "Veterinarian",
      status: appointment.status,
    };
  });
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
