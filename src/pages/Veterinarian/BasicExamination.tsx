import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, HeartPulse, PawPrint } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

type ExaminationForm = {
  weight: string;
  temperature: string;
  heartRate: string;
  physicalExaminationNotes: string;
  symptoms: string;
  diagnosis: string;
  treatment: string;
};

type AppointmentSummary = {
  id: string;
  hamster_id: string;
  hamster_name: string;
  species_breed: string | null;
  image_url: string | null;
  customer_name: string;
  appointment_date: string;
};

function formatAppointmentDate(value: string): string {
  const hasTime = /T\d{2}:\d{2}/.test(value);
  const date = new Date(hasTime ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(hasTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

const emptyForm: ExaminationForm = {
  weight: "",
  temperature: "",
  heartRate: "",
  physicalExaminationNotes: "",
  symptoms: "",
  diagnosis: "",
  treatment: "",
};

const BasicExamination = () => {
  const navigate = useNavigate();
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState<AppointmentSummary | null>(null);
  const [form, setForm] = useState<ExaminationForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadAppointment() {
      if (!appointmentId) {
        if (isCurrent) {
          setLoadError("Appointment not found.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          throw new Error("Sign in to begin an examination.");
        }

        const { data: appointmentRow, error: appointmentError } = await supabase
          .from("appointments")
          .select("id, owner_id, hamster_id, vet_id, appointment_date")
          .eq("id", appointmentId)
          .maybeSingle();

        if (appointmentError) throw appointmentError;
        if (!appointmentRow) {
          throw new Error("Appointment not found.");
        }

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

        const ownerName =
          (ownerProfile && typeof ownerProfile.full_name === "string" && ownerProfile.full_name.trim()) ||
          (ownerProfile && typeof ownerProfile.name === "string" && ownerProfile.name.trim()) ||
          "Customer";

        if (!isCurrent) return;

        setAppointment({
          id: appointmentRow.id,
          hamster_id: appointmentRow.hamster_id,
          hamster_name: hamster?.hamster_name ?? "Hamster",
          species_breed: hamster?.species_breed ?? null,
          image_url: hamster?.image_url ?? null,
          customer_name: ownerName,
          appointment_date: appointmentRow.appointment_date,
        });

        if (existingRecord) {
          setForm({
            weight: existingRecord.weight == null ? "" : String(existingRecord.weight),
            temperature: existingRecord.temperature == null ? "" : String(existingRecord.temperature),
            heartRate: existingRecord.heart_rate == null ? "" : String(existingRecord.heart_rate),
            physicalExaminationNotes:
              existingRecord.physical_examination_notes ?? "",
            symptoms:
              Array.isArray(existingRecord.confirmed_symptoms)
                ? existingRecord.confirmed_symptoms.join(", ")
                : typeof existingRecord.confirmed_symptoms === "string"
                  ? existingRecord.confirmed_symptoms
                  : "",
            diagnosis: existingRecord.confirmed_diagnosis ?? "",
            treatment: existingRecord.suggested_treatment ?? "",
          });
        }
      } catch (error) {
        console.error("Unable to load basic examination data:", error);
        if (isCurrent) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load appointment details right now.",
          );
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadAppointment();

    return () => {
      isCurrent = false;
    };
  }, [appointmentId]);

  const headerMeta = useMemo(() => {
    if (!appointment) return [];

    return [
      { label: "Hamster", value: appointment.hamster_name },
      { label: "Customer", value: appointment.customer_name },
      { label: "Appointment", value: formatAppointmentDate(appointment.appointment_date) },
    ];
  }, [appointment]);

  function updateField(field: keyof ExaminationForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!appointmentId || !appointment) {
      toast.error("Appointment not found.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign in to save this examination.");

      const parsedSymptoms = form.symptoms
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const record = {
        appointment_id: appointmentId,
        hamster_id: appointment.hamster_id,
        vet_id: authData.user.id,
        weight: form.weight === "" ? null : Number(form.weight),
        temperature: form.temperature === "" ? null : Number(form.temperature),
        heart_rate: form.heartRate === "" ? null : Number(form.heartRate),
        physical_examination_notes:
          form.physicalExaminationNotes.trim() || null,
        confirmed_symptoms: parsedSymptoms.length > 0 ? parsedSymptoms : null,
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
      } else {
        const { error } = await supabase
          .from("medical_records")
          .insert(record);

        if (error) throw error;
      }

      toast.success("Examination saved successfully.");
      navigate("/veterinarian/view-schedule");
    } catch (error) {
      console.error("Unable to save examination:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save this examination right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              type="button"
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
              Back
            </Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Examination
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Basic Examination
              </h1>
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          Loading examination details…
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-6 text-sm text-destructive">
          {loadError}
        </div>
      ) : appointment ? (
        <div className="space-y-6">
          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <PawPrint aria-hidden="true" className="size-5 text-primary" />
                Appointment Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {headerMeta.map(({ label, value }) => (
                <div key={label} className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="border-border/80 bg-card shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <HeartPulse aria-hidden="true" className="size-5 text-primary" />
                  Vital Signs
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (g)</Label>
                  <Input
                    id="weight"
                    name="weight"
                    onChange={(event) => updateField("weight", event.target.value)}
                    placeholder="0"
                    type="number"
                    value={form.weight}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature (°C)</Label>
                  <Input
                    id="temperature"
                    name="temperature"
                    onChange={(event) => updateField("temperature", event.target.value)}
                    placeholder="37.0"
                    step="0.1"
                    type="number"
                    value={form.temperature}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heartRate">Heart rate (bpm)</Label>
                  <Input
                    id="heartRate"
                    name="heartRate"
                    onChange={(event) => updateField("heartRate", event.target.value)}
                    placeholder="300"
                    type="number"
                    value={form.heartRate}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card shadow-sm">
              <Accordion defaultValue={["basic-examination"]}>
                <AccordionItem className="border-0" value="basic-examination">
                  <div className="px-6 py-2">
                    <AccordionTrigger className="items-center p-0 text-lg font-semibold leading-none hover:no-underline">
                      <span className="flex items-center gap-2 leading-normal">
                        Basic Examination
                      </span>
                    </AccordionTrigger>
                  </div>
                  <AccordionContent className="px-6">
                    <div className="space-y-5 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="symptoms">Confirmed symptoms</Label>
                  <Textarea
                    id="symptoms"
                    name="symptoms"
                    onChange={(event) => updateField("symptoms", event.target.value)}
                    placeholder="e.g. lethargy, wheezing, decreased appetite"
                    value={form.symptoms}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physicalExaminationNotes">Physical examination notes</Label>
                  <Textarea
                    id="physicalExaminationNotes"
                    name="physicalExaminationNotes"
                    onChange={(event) => updateField("physicalExaminationNotes", event.target.value)}
                    placeholder="Describe the hamster’s physical condition, posture, coat, hydration, mobility, respiratory rate, and any abnormal findings."
                    value={form.physicalExaminationNotes}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Confirmed diagnosis</Label>
                  <Textarea
                    id="diagnosis"
                    name="diagnosis"
                    onChange={(event) => updateField("diagnosis", event.target.value)}
                    placeholder="Record the final diagnosis or likely assessment."
                    value={form.diagnosis}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="treatment">Suggested treatment</Label>
                  <Textarea
                    id="treatment"
                    name="treatment"
                    onChange={(event) => updateField("treatment", event.target.value)}
                    placeholder="Recommend medication, care plan, follow-up instructions, or monitoring steps."
                    value={form.treatment}
                  />
                </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>

            <div className="flex justify-end">
              <Button disabled={isSubmitting} type="submit" size="lg">
                {isSubmitting ? "Saving..." : "Save Examination"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
};

export default BasicExamination;
