import { supabase } from "@/lib/supabase";
import {
  getFecalExaminationImageUrls,
  getFecalExaminationsByMedicalRecordTestId,
  type FecalExamination,
} from "@/services/FecalExaminationService";

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
  medicalRecordId: string | null;
};

export type MedicalResults = {
  basicExamination: {
    weight: number | null;
    temperature: number | null;
    heart_rate: number | null;
    physical_examination_notes: string | null;
    confirmed_symptoms: unknown;
    confirmed_diagnosis: string | null;
    suggested_treatment: string | null;
  } | null;
  fecalExaminations: Array<{
    record: FecalExamination;
    imageUrls: Array<{ path: string; url: string }>;
  }>;
};

export async function getMedicalResults(
  appointmentId: string,
): Promise<MedicalResults> {
  const { data: medicalRecord, error: medicalRecordError } = await supabase
    .from("medical_records")
    .select(
      "id, weight, temperature, heart_rate, physical_examination_notes, confirmed_symptoms, confirmed_diagnosis, suggested_treatment",
    )
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (medicalRecordError) throw medicalRecordError;
  if (!medicalRecord) {
    return { basicExamination: null, fecalExaminations: [] };
  }

  const fecalRecords = await getFecalExaminationsByMedicalRecordTestId(
    medicalRecord.id,
  );
  const fecalExaminations = await Promise.all(
    fecalRecords.map(async (record) => ({
      record,
      imageUrls: await getFecalExaminationImageUrls(
        (record.fecal_images ?? []).slice(0, 4),
      ),
    })),
  );

  return {
    basicExamination: medicalRecord,
    fecalExaminations,
  };
}

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
    medicalRecordId: existingRecord?.id ?? null,
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
): Promise<string> {
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
    return existingRecord.id;
  }

  const { data: insertedRecord, error } = await supabase
    .from("medical_records")
    .insert(record)
    .select("id")
    .single();

  if (error) throw error;
  return insertedRecord.id;
}

export async function completeAppointment(
  appointmentId: string,
): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to complete this appointment.");

  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", appointmentId)
    .eq("vet_id", authData.user.id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "The appointment status was not updated. Confirm that you are the assigned veterinarian and that you have permission to update it.",
    );
  }
}