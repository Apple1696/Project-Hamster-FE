import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  FlaskConical,
  HeartPulse,
  PawPrint,
  ShieldCheck,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import {
  getMedicalResults,
  type MedicalResults,
} from "@/services/MedicalRecordService";

type AppointmentDetail = {
  id: string;
  customer_name: string;
  veterinarian_name: string;
  hamster_name: string;
  hamster_image_url: string | null;
  species_breed: string | null;
  weight_grams: number | null;
  age_months: number | null;
  gender: string | null;
  appointment_date: string;
  status: string;
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

function formatStatus(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isAppointmentCompleted(status: string): boolean {
  return status.trim().toLowerCase().replace(/[_-]+/g, " ") === "completed";
}

function formatResultValue(value: unknown): string {
  if (value == null || value === "") return "Not recorded";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Not recorded";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value) ?? String(value);
  return String(value);
}

function getStatusClassName(status: string): string {
  const normalizedStatus = status.toLowerCase().replace(/[_-]+/g, " ");

  if (normalizedStatus.includes("cancel")) {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }
  if (normalizedStatus.includes("complete")) {
    return "border-border bg-muted text-muted-foreground";
  }
  if (normalizedStatus.includes("check")) {
    return "border-accent bg-accent text-accent-foreground";
  }
  return "border-primary/20 bg-primary/10 text-primary";
}

function getProfileName(profile: Record<string, unknown> | null): string {
  if (!profile) return "Customer";

  const firstName =
    typeof profile.first_name === "string" && profile.first_name.trim()
      ? profile.first_name.trim()
      : null;
  const lastName =
    typeof profile.last_name === "string" && profile.last_name.trim()
      ? profile.last_name.trim()
      : null;
  const fullName =
    typeof profile.full_name === "string" && profile.full_name.trim()
      ? profile.full_name.trim()
      : typeof profile.display_name === "string" && profile.display_name.trim()
        ? profile.display_name.trim()
        : typeof profile.name === "string" && profile.name.trim()
          ? profile.name.trim()
          : [firstName, lastName].filter(Boolean).join(" ");

  return fullName || "Customer";
}

const ViewAppointmentDetail = () => {
  const navigate = useNavigate();
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingExamination, setIsStartingExamination] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [medicalResultsState, setMedicalResultsState] = useState<{
    key: string;
    results?: MedicalResults;
    error?: string;
  } | null>(null);
  const [selectedFecalImage, setSelectedFecalImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadAppointment() {
      if (!appointmentId) {
        if (isCurrent) {
          setAppointment(null);
          setLoadError("Appointment not found.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data: appointmentRow, error: appointmentError } = await supabase
          .from("appointments")
          .select(
            "id, owner_id, hamster_id, vet_id, appointment_date, status, appointment_end_at, reason_for_visit",
          )
          .eq("id", appointmentId)
          .maybeSingle();

        if (appointmentError) throw appointmentError;
        if (!appointmentRow) {
          if (isCurrent) {
            setAppointment(null);
            setLoadError("Appointment not found.");
          }
          return;
        }

        const [hamsterResult, ownerResult, vetResult] = await Promise.all([
          supabase
            .from("hamsters")
            .select(
              "id, hamster_name, species_breed, weight_grams, age_months, gender, image_url",
            )
            .eq("id", appointmentRow.hamster_id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("*")
            .eq("id", appointmentRow.owner_id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("*")
            .eq("id", appointmentRow.vet_id)
            .maybeSingle(),
        ]);

        if (hamsterResult.error) throw hamsterResult.error;
        if (ownerResult.error) throw ownerResult.error;
        if (vetResult.error) throw vetResult.error;

        const hamster = hamsterResult.data;
        const ownerProfile = ownerResult.data;
        const vetProfile = vetResult.data;

        if (isCurrent) {
          setAppointment({
            id: appointmentRow.id,
            customer_name: getProfileName(ownerProfile),
            veterinarian_name: getProfileName(vetProfile),
            hamster_name: hamster?.hamster_name ?? "Hamster",
            hamster_image_url: hamster?.image_url ?? null,
            species_breed: hamster?.species_breed ?? null,
            weight_grams: hamster?.weight_grams ?? null,
            age_months: hamster?.age_months ?? null,
            gender: hamster?.gender ?? null,
            appointment_date: appointmentRow.appointment_date,
            status: appointmentRow.status,
          });
          setLoadError(null);
        }
      } catch (error) {
        console.error("Unable to load appointment details:", error);
        if (isCurrent) {
          setAppointment(null);
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

    setImageFailed(false);
    loadAppointment();

    return () => {
      isCurrent = false;
    };
  }, [appointmentId]);

  const appointmentStatus = appointment?.status ?? "";
  const normalizedAppointmentStatus = appointmentStatus
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  const isCompleted = normalizedAppointmentStatus === "completed";
  const resultsKey = `${appointmentId ?? ""}:${normalizedAppointmentStatus}`;
  const currentMedicalResults =
    medicalResultsState?.key === resultsKey ? medicalResultsState : null;
  const medicalResults = currentMedicalResults?.results ?? null;
  const isLoadingResults = isCompleted && currentMedicalResults === null;
  const resultsError = currentMedicalResults?.error ?? null;

  useEffect(() => {
    let isCurrent = true;

    if (!appointmentId || !isCompleted) {
      return () => {
        isCurrent = false;
      };
    }

    getMedicalResults(appointmentId)
      .then((results) => {
        if (isCurrent) setMedicalResultsState({ key: resultsKey, results });
      })
      .catch((error: unknown) => {
        console.error("Unable to load medical results:", error);
        if (!isCurrent) return;
        setMedicalResultsState({
          key: resultsKey,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load medical results right now.",
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [isCompleted, resultsKey, appointmentId]);

  const details = useMemo(() => {
    if (!appointment) return [];

    return [
      {
        label: "Customer",
        value: appointment.customer_name,
        icon: UserRound,
      },
      {
        label: "Veterinarian",
        value: appointment.veterinarian_name,
        icon: Stethoscope,
      },
      {
        label: "Appointment date",
        value: formatAppointmentDate(appointment.appointment_date),
        icon: CalendarDays,
      },
    ];
  }, [appointment]);

  const hamsterFacts = useMemo(() => {
    if (!appointment) return [];

    return [
      {
        label: "Species / breed",
        value: appointment.species_breed || "Not specified",
      },
      {
        label: "Age",
        value:
          appointment.age_months == null
            ? "Not specified"
            : `${appointment.age_months} months`,
      },
      {
        label: "Weight",
        value:
          appointment.weight_grams == null
            ? "Not specified"
            : `${appointment.weight_grams} g`,
      },
      { label: "Gender", value: appointment.gender || "Not specified" },
    ];
  }, [appointment]);

  const basicExamination = medicalResults?.basicExamination;
  const basicExaminationDetails: Array<{ label: string; value: unknown }> =
    basicExamination
      ? [
          {
            label: "Weight",
            value:
              basicExamination.weight == null
                ? null
                : `${basicExamination.weight} g`,
          },
          {
            label: "Temperature",
            value:
              basicExamination.temperature == null
                ? null
                : `${basicExamination.temperature} °C`,
          },
          {
            label: "Heart rate",
            value:
              basicExamination.heart_rate == null
                ? null
                : `${basicExamination.heart_rate} bpm`,
          },
          { label: "Confirmed symptoms", value: basicExamination.confirmed_symptoms },
          { label: "Confirmed diagnosis", value: basicExamination.confirmed_diagnosis },
          { label: "Suggested treatment", value: basicExamination.suggested_treatment },
          {
            label: "Physical examination notes",
            value: basicExamination.physical_examination_notes,
          },
        ]
      : [];

  async function handleBeginExamination() {
    if (!appointment) return;

    setIsStartingExamination(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign in to begin this examination.");

      const { data: updatedAppointment, error } = await supabase
        .from("appointments")
        .update({ status: "in_progress" })
        .eq("id", appointment.id)
        .eq("vet_id", authData.user.id)
        .select("id, status")
        .maybeSingle();

      if (error) throw error;
      if (!updatedAppointment) {
        throw new Error(
          "The appointment status was not updated. Confirm that you are the assigned veterinarian and that your appointment update policy allows this change.",
        );
      }

      navigate(`/veterinarian/basic-examination/${appointment.id}`);
    } catch (error) {
      console.error("Unable to start examination:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update the appointment status.",
      );
    } finally {
      setIsStartingExamination(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
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
              Appointment details
            </p>
          </div>
        </div>

        <Badge
          className={`h-8 px-3 ${appointment ? getStatusClassName(appointment.status) : "border-border bg-muted text-muted-foreground"}`}
          variant="outline"
        >
          {appointment ? formatStatus(appointment.status) : "Pending"}
        </Badge>
      </header>

      {isLoading ? (
        <div
          aria-live="polite"
          className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground"
          role="status"
        >
          Loading appointment details…
        </div>
      ) : loadError ? (
        <div
          className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-6 text-sm text-destructive"
          role="alert"
        >
          {loadError}
        </div>
      ) : appointment ? (
        <>
          <Dialog
            open={selectedFecalImage !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedFecalImage(null);
            }}
          >
            <DialogContent className="max-h-[95dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden p-4 sm:p-6">
              <DialogHeader className="flex-row items-start justify-between gap-4 pr-8">
                <DialogClose
                  aria-label="Close image preview"
                  className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden="true" className="size-4" />
                </DialogClose>
              </DialogHeader>
              {selectedFecalImage && (
                <img
                  alt={selectedFecalImage.alt}
                  className="mx-auto max-h-[75dvh] w-full rounded-lg object-contain"
                  src={selectedFecalImage.url}
                />
              )}
            </DialogContent>
          </Dialog>

          <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
            <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[320px_1fr]">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="overflow-hidden rounded-xl border bg-background">
                  {appointment.hamster_image_url && !imageFailed ? (
                    <img
                      alt={appointment.hamster_name}
                      className="h-72 w-full object-cover"
                      onError={() => setImageFailed(true)}
                      src={appointment.hamster_image_url}
                    />
                  ) : (
                    <div className="flex h-72 items-center justify-center bg-muted text-muted-foreground">
                      <PawPrint aria-hidden="true" className="size-16 opacity-40" />
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Hamster
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">
                    {appointment.hamster_name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {appointment.species_breed || "Breed not specified"}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  {details.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-xl border bg-muted/30 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                        <Icon aria-hidden="true" className="size-4 text-primary" />
                        {label}
                      </div>
                      <p className="mt-3 text-base font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
                    Hamster profile
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {hamsterFacts.map(({ label, value }) => (
                      <div key={label} className="rounded-lg border bg-background p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          {label}
                        </p>
                        <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {!isAppointmentCompleted(appointment.status) && (
                  <div className="flex justify-end pt-1">
                    <Button
                      className="w-full sm:w-auto"
                      disabled={isStartingExamination}
                      type="button"
                      variant="default"
                      onClick={handleBeginExamination}
                    >
                      {isStartingExamination ? "Starting..." : "Begin Examination"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {isAppointmentCompleted(appointment.status) && (
            <section aria-labelledby="medical-results-title" className="mt-8 space-y-4">
              <div>
                <h2
                  className="text-xl font-semibold tracking-tight text-foreground"
                  id="medical-results-title"
                >
                  Medical Results
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Examination findings recorded for this appointment.
                </p>
              </div>

              {isLoadingResults ? (
                <div
                  aria-live="polite"
                  className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground"
                  role="status"
                >
                  Loading medical results…
                </div>
              ) : resultsError ? (
                <div
                  className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-5 text-sm text-destructive"
                  role="alert"
                >
                  {resultsError}
                </div>
              ) : medicalResults ? (
                <div className="space-y-4">
                  <Card className="border-border/80 bg-card shadow-sm">
                    <Accordion defaultValue={["basic-results"]}>
                      <AccordionItem className="border-0" value="basic-results">
                        <div className="px-5 py-2 sm:px-6">
                          <AccordionTrigger className="items-center p-0 text-base font-semibold leading-none hover:no-underline">
                            <span className="flex items-center gap-2 leading-normal">
                              <HeartPulse aria-hidden="true" className="size-5 text-primary" />
                              Basic Examination
                            </span>
                          </AccordionTrigger>
                        </div>
                        <AccordionContent className="px-5 sm:px-6">
                          {basicExamination ? (
                            <div className="grid gap-3 pb-5 sm:grid-cols-2 lg:grid-cols-3">
                              {basicExaminationDetails.map(({ label, value }) => (
                                <div className="rounded-lg border bg-muted/30 p-3" key={label}>
                                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    {label}
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-foreground">
                                    {formatResultValue(value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="pb-5 text-sm text-muted-foreground">
                              No basic examination results were recorded.
                            </p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </Card>

                  <Card className="border-border/80 bg-card shadow-sm">
                    <Accordion defaultValue={["fecal-results"]}>
                      <AccordionItem className="border-0" value="fecal-results">
                        <div className="px-5 py-2 sm:px-6">
                          <AccordionTrigger className="items-center p-0 text-base font-semibold leading-none hover:no-underline">
                            <span className="flex items-center gap-2 leading-normal">
                              <FlaskConical aria-hidden="true" className="size-5 text-primary" />
                              Fecal Examination
                            </span>
                          </AccordionTrigger>
                        </div>
                        <AccordionContent className="px-5 sm:px-6">
                          {medicalResults.fecalExaminations.length > 0 ? (
                            <div className="space-y-5 pb-5">
                              {medicalResults.fecalExaminations.map(
                                ({ record, imageUrls }, index) => {
                                  const fecalDetails = [
                                    ["Sample collected", record.sample_collected_at ? formatAppointmentDate(record.sample_collected_at) : null],
                                    ["Sample condition", record.sample_condition],
                                    ["Stool color", record.stool_color],
                                    ["Stool consistency", record.stool_consistency],
                                    ["Stool shape", record.stool_shape],
                                    ["Stool size", record.stool_size],
                                    ["Mucus present", record.mucus_present],
                                    ["Blood present", record.blood_present],
                                    ["Undigested food present", record.undigested_food_present],
                                    ["Examination method", record.examination_method],
                                    ["Microscopic findings", record.microscopic_findings],
                                    ["Parasite detected", record.parasite_detected],
                                    ["Parasite name", record.parasite_name],
                                    ["Parasite quantity", record.parasite_quantity],
                                    ["Overall result", record.overall_result],
                                    ["Veterinarian notes", record.veterinarian_notes],
                                    ["Completed", record.completed_at ? formatAppointmentDate(record.completed_at) : null],
                                  ] as const;

                                  return (
                                    <div className="space-y-4" key={record.id}>
                                      {medicalResults.fecalExaminations.length > 1 && (
                                        <h3 className="text-sm font-semibold text-foreground">
                                          Fecal examination {index + 1}
                                        </h3>
                                      )}
                                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {fecalDetails.map(([label, value]) => (
                                          <div className="rounded-lg border bg-muted/30 p-3" key={label}>
                                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                              {label}
                                            </p>
                                            <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-foreground">
                                              {formatResultValue(value)}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                      {imageUrls.length > 0 && (
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                          {imageUrls.slice(0, 4).map(({ path, url }, imageIndex) => (
                                            <button
                                              aria-label={`View fecal examination image ${imageIndex + 1} enlarged`}
                                              key={path}
                                              className="group cursor-zoom-in overflow-hidden rounded-lg border bg-muted/30 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                              onClick={() =>
                                                setSelectedFecalImage({
                                                  url,
                                                  alt: "Fecal examination sample",
                                                })
                                              }
                                              type="button"
                                            >
                                              <img
                                                alt=""
                                                className="h-32 w-full object-cover transition-transform group-hover:scale-105"
                                                src={url}
                                              />
                                              <span className="sr-only">
                                                Open image preview
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          ) : (
                            <p className="pb-5 text-sm text-muted-foreground">
                              No fecal examination results were recorded.
                            </p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </Card>
                </div>
              ) : null}
            </section>
          )}
        </>
      ) : null}
    </section>
  );
};

export default ViewAppointmentDetail;
