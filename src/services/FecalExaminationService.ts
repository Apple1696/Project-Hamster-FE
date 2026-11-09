import { supabase } from "@/lib/supabase";

export type FecalExamination = {
  id: string;
  medical_record_test_id: string;
  sample_collected_at: string | null;
  sample_condition: string | null;
  stool_color: string | null;
  stool_consistency: string | null;
  stool_shape: string | null;
  stool_size: string | null;
  mucus_present: boolean | null;
  blood_present: boolean | null;
  undigested_food_present: boolean | null;
  examination_method: string | null;
  microscopic_findings: string | null;
  parasite_detected: boolean | null;
  parasite_name: string | null;
  parasite_quantity: string | null;
  overall_result: string | null;
  veterinarian_notes: string | null;
  reviewed_by: string | null;
  completed_at: string | null;
  created_at: string;
  fecal_images: string[];
};

export type CreateFecalExamination = Pick<
  FecalExamination,
  "medical_record_test_id"
> &
  Partial<
    Omit<FecalExamination, "id" | "created_at" | "medical_record_test_id">
  >;

export type UpdateFecalExamination = Partial<
  Omit<FecalExamination, "id" | "created_at">
>;

export type FecalExaminationForm = {
  sampleCollectedAt: string;
  sampleCondition: string;
  stoolColor: string;
  stoolConsistency: string;
  stoolShape: string;
  stoolSize: string;
  mucusPresent: boolean | null;
  bloodPresent: boolean | null;
  undigestedFoodPresent: boolean | null;
  examinationMethod: string;
  microscopicFindings: string;
  parasiteDetected: boolean | null;
  parasiteName: string;
  parasiteQuantity: string;
  overallResult: string;
  veterinarianNotes: string;
  completedAt: string;
};

const FECAL_IMAGE_BUCKET = "fecal_images";
export const MAX_FECAL_IMAGES = 4;
export const MAX_FECAL_IMAGE_SIZE = 5 * 1024 * 1024;

export async function createFecalExamination(
  examination: CreateFecalExamination,
): Promise<FecalExamination> {
  const { data, error } = await supabase
    .from("fecal_examinations")
    .insert(examination)
    .select("*")
    .single();

  if (error) throw error;
  return data as FecalExamination;
}

export async function saveFecalExamination({
  medicalRecordTestId,
  existingId,
  existingImagePaths,
  form,
  imageFiles,
}: {
  medicalRecordTestId: string;
  existingId: string | null;
  existingImagePaths: string[];
  form: FecalExaminationForm;
  imageFiles: File[];
}): Promise<FecalExamination> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to save this examination.");
  if (existingImagePaths.length + imageFiles.length > MAX_FECAL_IMAGES) {
    throw new Error(`A fecal examination can have at most ${MAX_FECAL_IMAGES} images.`);
  }
  const invalidFile = imageFiles.find(
    (file) =>
      !file.type.startsWith("image/") || file.size > MAX_FECAL_IMAGE_SIZE,
  );
  if (invalidFile) {
    throw new Error(
      !invalidFile.type.startsWith("image/")
        ? `${invalidFile.name} is not a valid image file.`
        : `${invalidFile.name} is larger than 5 MB.`,
    );
  }

  const uploadedPaths: string[] = [];

  try {
    for (const file of imageFiles) {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 10) || "jpg";
      const path = `${medicalRecordTestId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from(FECAL_IMAGE_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) throw error;
      uploadedPaths.push(path);
    }

    const examination: CreateFecalExamination = {
      medical_record_test_id: medicalRecordTestId,
      sample_collected_at: form.sampleCollectedAt
        ? new Date(form.sampleCollectedAt).toISOString()
        : null,
      sample_condition: form.sampleCondition.trim() || null,
      stool_color: form.stoolColor.trim() || null,
      stool_consistency: form.stoolConsistency.trim() || null,
      stool_shape: form.stoolShape.trim() || null,
      stool_size: form.stoolSize.trim() || null,
      mucus_present: form.mucusPresent,
      blood_present: form.bloodPresent,
      undigested_food_present: form.undigestedFoodPresent,
      examination_method: form.examinationMethod.trim() || null,
      microscopic_findings: form.microscopicFindings.trim() || null,
      parasite_detected: form.parasiteDetected,
      parasite_name: form.parasiteName.trim() || null,
      parasite_quantity: form.parasiteQuantity.trim() || null,
      overall_result: form.overallResult.trim() || null,
      veterinarian_notes: form.veterinarianNotes.trim() || null,
      reviewed_by: authData.user.id,
      completed_at: form.completedAt
        ? new Date(form.completedAt).toISOString()
        : null,
      fecal_images: [...existingImagePaths, ...uploadedPaths],
    };

    if (existingId) {
      return await updateFecalExamination(existingId, examination);
    }

    return await createFecalExamination(examination);
  } catch (error) {
    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from(FECAL_IMAGE_BUCKET)
        .remove(uploadedPaths);

      if (cleanupError) {
        console.error("Unable to clean up uploaded fecal images:", cleanupError);
      }
    }
    throw error;
  }
}

export async function getFecalExaminationImageUrls(
  paths: string[],
): Promise<Array<{ path: string; url: string }>> {
  if (paths.length === 0) return [];

  const { data, error } = await supabase.storage
    .from(FECAL_IMAGE_BUCKET)
    .createSignedUrls(paths, 60 * 60);

  if (error) throw error;

  return data.map((item, index) => {
    if (!item.signedUrl) {
      throw new Error(`Unable to create a viewing link for fecal image ${index + 1}.`);
    }

    return { path: paths[index], url: item.signedUrl };
  });
}

export async function getFecalExaminationById(
  id: string,
): Promise<FecalExamination | null> {
  const { data, error } = await supabase
    .from("fecal_examinations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as FecalExamination | null;
}

export async function getFecalExaminationsByMedicalRecordTestId(
  medicalRecordTestId: string,
): Promise<FecalExamination[]> {
  const { data, error } = await supabase
    .from("fecal_examinations")
    .select("*")
    .eq("medical_record_test_id", medicalRecordTestId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as FecalExamination[];
}

export async function updateFecalExamination(
  id: string,
  updates: UpdateFecalExamination,
): Promise<FecalExamination> {
  const { data, error } = await supabase
    .from("fecal_examinations")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as FecalExamination;
}

export async function deleteFecalExamination(id: string): Promise<void> {
  const { error } = await supabase
    .from("fecal_examinations")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
