import { supabase } from "@/lib/supabase";

export type BasicExaminationForm = {
  weight: string;
  temperature: string;
  heartRate: string;
  physicalExaminationNotes: string;
  symptoms: string;
  diagnosis: string;
  treatment: string;
};

export type BasicExaminationAppointment = {
  id: string;
  hamster_id: string;
  hamster_name: string;
  species_breed: string | null;
  image_url: string | null;
  customer_name: string;
  appointment_date: string;
};

export type BasicExaminationData = {
  appointment: BasicExaminationAppointment;
  form: BasicExaminationForm;
};

export async function getBasicExaminationData(
  appointmentId: string,
): Promise<BasicExaminationData> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to begin an examination.");

  const { data: appointmentRow, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, owner_id, hamster_id, vet_id, appointment_date")
    .eq("id", appointmentId)
    .maybeSingle();

  if (appointmentError) throw appointmentError;
  if (!appointmentRow) throw new Error("Appointment not found.");

  const [hamsterResult, ownerResult, existingRecordResult] = await Promise.all([
    supabase
      .from("hamsters")
      .select("id, hamster_name, species_breed, image_url")
      .eq("id", appointmentRow.hamster_id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("*")
      .eq("id", appointmentRow.owner_id)
      .maybeSingle(),
    supabase
      .from("medical_records")
      .select("*")
      .eq("appointment_id", appointmentId)
      .maybeSingle(),
  ]);

  if (hamsterResult.error) throw hamsterResult.error;
  if (ownerResult.error) throw ownerResult.error;
  if (existingRecordResult.error) throw existingRecordResult.error;

  const hamster = hamsterResult.data;
  const ownerProfile = ownerResult.data;
  const existingRecord = existingRecordResult.data;
  const customerName =
    (typeof ownerProfile?.full_name === "string" &&
      ownerProfile.full_name.trim()) ||
    (typeof ownerProfile?.name === "string" && ownerProfile.name.trim()) ||
    "Customer";
  const confirmedSymptoms = existingRecord?.confirmed_symptoms;

  return {
    appointment: {
      id: appointmentRow.id,
      hamster_id: appointmentRow.hamster_id,
      hamster_name: hamster?.hamster_name ?? "Hamster",
      species_breed: hamster?.species_breed ?? null,
      image_url: hamster?.image_url ?? null,
      customer_name: customerName,
      appointment_date: appointmentRow.appointment_date,
    },
    form: {
      weight:
        existingRecord?.weight == null ? "" : String(existingRecord.weight),
      temperature:
        existingRecord?.temperature == null
          ? ""
          : String(existingRecord.temperature),
      heartRate:
        existingRecord?.heart_rate == null
          ? ""
          : String(existingRecord.heart_rate),
      physicalExaminationNotes:
        existingRecord?.physical_examination_notes ?? "",
      symptoms: Array.isArray(confirmedSymptoms)
        ? confirmedSymptoms.join(", ")
        : typeof confirmedSymptoms === "string"
          ? confirmedSymptoms
          : "",
      diagnosis: existingRecord?.confirmed_diagnosis ?? "",
      treatment: existingRecord?.suggested_treatment ?? "",
    },
  };
}

export async function saveBasicExamination(
  appointmentId: string,
  hamsterId: string,
  form: BasicExaminationForm,
): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to save this examination.");

  const confirmedSymptoms = form.symptoms
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const record = {
    appointment_id: appointmentId,
    hamster_id: hamsterId,
    vet_id: authData.user.id,
    weight: form.weight === "" ? null : Number(form.weight),
    temperature: form.temperature === "" ? null : Number(form.temperature),
    heart_rate: form.heartRate === "" ? null : Number(form.heartRate),
    physical_examination_notes:
      form.physicalExaminationNotes.trim() || null,
    confirmed_symptoms:
      confirmedSymptoms.length > 0 ? confirmedSymptoms : null,
    confirmed_diagnosis: form.diagnosis.trim() || null,
    suggested_treatment: form.treatment.trim() || null,
    status: "pending_review",
  };

  const { data: existingRecord, error: existingError } = await supabase
    .from("medical_records")
    .select("id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existingRecord) {
    const { error } = await supabase
      .from("medical_records")
      .update(record)
      .eq("id", existingRecord.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("medical_records").insert(record);
  if (error) throw error;
}