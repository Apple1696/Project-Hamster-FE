import { supabase } from "@/lib/supabase";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AIAnalysisStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type AIAnalysisReviewStatus = "approved" | "modified" | "rejected";

export type AIAnalysis = {
  id: string;
  transcription_id: string;
  medical_record_id: string;
  extracted_symptoms: JsonValue | null;
  extracted_observations: JsonValue | null;
  extracted_weight: number | null;
  extracted_temperature: number | null;
  extracted_heart_rate: number | null;
  predicted_diagnosis: JsonValue | null;
  suggested_diagnostic_tests: JsonValue | null;
  suggested_treatment: JsonValue | null;
  additional_notes: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  prompt_version: string | null;
  status: AIAnalysisStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type AIAnalysisEdits = Partial<
  Pick<
    AIAnalysis,
    | "extracted_symptoms"
    | "extracted_observations"
    | "extracted_weight"
    | "extracted_temperature"
    | "extracted_heart_rate"
    | "predicted_diagnosis"
    | "suggested_diagnostic_tests"
    | "suggested_treatment"
    | "additional_notes"
  >
>;

const AI_ANALYSIS_COLUMNS =
  "id, transcription_id, medical_record_id, extracted_symptoms, extracted_observations, extracted_weight, extracted_temperature, extracted_heart_rate, predicted_diagnosis, suggested_diagnostic_tests, suggested_treatment, additional_notes, llm_provider, llm_model, prompt_version, status, reviewed_by, reviewed_at, created_at";

export async function getAIAnalysisByTranscription(
  transcriptionId: string,
): Promise<AIAnalysis | null> {
  const { data, error } = await supabase
    .from("ai_analysis")
    .select(AI_ANALYSIS_COLUMNS)
    .eq("transcription_id", transcriptionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as AIAnalysis | null;
}

export async function getAIAnalysisById(
  analysisId: string,
): Promise<AIAnalysis | null> {
  const { data, error } = await supabase
    .from("ai_analysis")
    .select(AI_ANALYSIS_COLUMNS)
    .eq("id", analysisId)
    .maybeSingle();

  if (error) throw error;
  return data as AIAnalysis | null;
}

export async function getLatestAIAnalysisByMedicalRecord(
  medicalRecordId: string,
): Promise<AIAnalysis | null> {
  const { data, error } = await supabase
    .from("ai_analysis")
    .select(AI_ANALYSIS_COLUMNS)
    .eq("medical_record_id", medicalRecordId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as AIAnalysis | null;
}

export async function reviewAIAnalysis(
  input:
    | {
        analysisId: string;
        status: "rejected";
        edits?: AIAnalysisEdits;
      }
    | {
        analysisId: string;
        status: "approved" | "modified";
        edits?: AIAnalysisEdits;
      },
): Promise<AIAnalysis> {
  const { analysisId, edits = {} } = input;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to review this analysis.");

  const { data: analysisRecord, error: lookupError } = await supabase
    .from("ai_analysis")
    .select("medical_record_id")
    .eq("id", analysisId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!analysisRecord) {
    throw new Error("The AI analysis was not found or you do not have permission to review it.");
  }

  const { data, error } = await supabase
    .from("ai_analysis")
    .update({
      ...edits,
      reviewed_by: authData.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", analysisId)
    .eq("medical_record_id", analysisRecord.medical_record_id)
    .select(AI_ANALYSIS_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("The AI review was not saved or you do not have permission to update it.");
  }

  return data as AIAnalysis;
}