import { supabase } from "@/lib/supabase";

const AUDIO_BUCKET = "audio";
const AUDIO_FILE_EXTENSIONS = new Set([
  "aac",
  "amr",
  "flac",
  "m4a",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
  "webm",
]);

export type UploadedMedicalRecordAudio = {
  id: string;
  name: string;
  path: string;
  url: string;
};

type MedicalRecordAudioRow = {
  id: string;
  file_url: string;
  description: string | null;
};

export async function getMedicalRecordAudioFiles(
  medicalRecordId: string,
): Promise<UploadedMedicalRecordAudio[]> {
  const { data: rows, error: queryError } = await supabase
    .from("medical_record_media")
    .select("id, file_url, description")
    .eq("medical_record_id", medicalRecordId)
    .eq("media_type", "audio")
    .order("created_at", { ascending: false });

  if (queryError) throw queryError;

  const audioRows = rows as MedicalRecordAudioRow[];
  return Promise.all(
    audioRows.map(async (row) => {
      const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .createSignedUrl(row.file_url, 60 * 60);
      if (error) throw error;

      return {
        id: row.id,
        name: row.description || row.file_url.split("/").pop() || "Audio recording",
        path: row.file_url,
        url: data.signedUrl,
      };
    }),
  );
}

export function isSupportedAudioFile(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    file.type.startsWith("audio/") ||
    (file.type === "" && AUDIO_FILE_EXTENSIONS.has(extension))
  );
}

export async function uploadMedicalRecordAudio(
  medicalRecordId: string,
  file: File,
): Promise<UploadedMedicalRecordAudio> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to upload an audio recording.");
  if (file.size === 0) throw new Error("The selected audio file is empty.");

  if (!isSupportedAudioFile(file)) throw new Error("Choose a valid audio file.");

  const extension =
    file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) ||
    "audio";
  const path = `${medicalRecordId}/${authData.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, file, {
      ...(file.type ? { contentType: file.type } : {}),
      upsert: false,
    });

  if (uploadError) throw uploadError;

  try {
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (signedUrlError) throw signedUrlError;

    const { data: mediaRow, error: insertError } = await supabase
      .from("medical_record_media")
      .insert({
        medical_record_id: medicalRecordId,
        media_type: "audio",
        file_url: path,
        description: file.name,
        uploaded_by: authData.user.id,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    return {
      id: mediaRow.id,
      name: file.name,
      path,
      url: signedUrlData.signedUrl,
    };
  } catch (error) {
    const { error: cleanupError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .remove([path]);

    if (cleanupError) {
      console.error("Unable to clean up uploaded medical record audio:", cleanupError);
    }

    throw error;
  }
}
