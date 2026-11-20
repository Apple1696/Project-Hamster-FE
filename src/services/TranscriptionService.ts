import {
  supabase,
  supabasePublishableKey,
} from "@/lib/supabase";

export type TranscriptionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type Transcription = {
  id: string;
  media_id: string;
  raw_transcript: string | null;
  corrected_transcript: string | null;
  transcription_model: string | null;
  language: string | null;
  status: TranscriptionStatus;
  created_at: string;
  updated_at: string;
};

export type AudioProcessingResult = {
  ok: boolean;
  media_id: string;
  transcription_id: string;
  ai_analysis_id: string;
  status: "pending";
};

const TRANSCRIPTION_COLUMNS =
  "id, media_id, raw_transcript, corrected_transcript, transcription_model, language, status, created_at, updated_at";

export async function getLatestTranscription(
  mediaId: string,
): Promise<Transcription | null> {
  const { data, error } = await supabase
    .from("transcriptions")
    .select(TRANSCRIPTION_COLUMNS)
    .eq("media_id", mediaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as Transcription | null;
}

export async function getTranscriptionById(
  transcriptionId: string,
): Promise<Transcription | null> {
  const { data, error } = await supabase
    .from("transcriptions")
    .select(TRANSCRIPTION_COLUMNS)
    .eq("id", transcriptionId)
    .maybeSingle();

  if (error) throw error;
  return data as Transcription | null;
}

export async function requestAudioTranscription(
  media_id: string,
): Promise<AudioProcessingResult> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sign in to transcribe this recording.");

  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to transcribe this recording.");

  const { data, error } =
    await supabase.functions.invoke<AudioProcessingResult>(
      "process-medical-audio",
      {
        body: { media_id },
        headers: {
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

  if (error) throw error;
  if (
    !data ||
    data.ok !== true ||
    data.media_id !== media_id ||
    typeof data.transcription_id !== "string" ||
    typeof data.ai_analysis_id !== "string" ||
    data.status !== "pending"
  ) {
    throw new Error("The audio processing function returned an invalid response.");
  }

  return data;
}

export async function saveCorrectedTranscript(
  transcriptionId: string,
  correctedTranscript: string,
): Promise<Transcription> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to edit this transcript.");

  const transcript = correctedTranscript.trim();
  if (!transcript) throw new Error("The corrected transcript cannot be empty.");

  const { data, error } = await supabase
    .from("transcriptions")
    .update({
      corrected_transcript: transcript,
      status: "completed",
    })
    .eq("id", transcriptionId)
    .select(TRANSCRIPTION_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("The transcript was not found or you do not have permission to edit it.");
  }

  return data as Transcription;
}