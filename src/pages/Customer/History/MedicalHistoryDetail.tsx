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
import {
  getMedicalHistory,
  type MedicalAppointment,
} from "@/services/MedicalService";

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

function formatResultValue(value: unknown): string {
  if (value == null || value === "") return "Not recorded";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Not recorded";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value) ?? String(value);
  return String(value);
}

const MedicalHistoryDetail = () => {
  const navigate = useNavigate();
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState<MedicalAppointment | null>(null);
  const [customerName, setCustomerName] = useState("Customer");
  const [imageFailed, setImageFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [medicalResults, setMedicalResults] = useState<MedicalResults | null>(
    null,
  );
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [selectedFecalImage, setSelectedFecalImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!isCurrent) return;

        const metadataName =
          data.user?.user_metadata?.full_name ||
          data.user?.user_metadata?.name ||
          data.user?.user_metadata?.display_name ||
          [
            data.user?.user_metadata?.first_name,
            data.user?.user_metadata?.last_name,
          ]
            .filter(Boolean)
            .join(" ") ||
          data.user?.email ||
          "Customer";

        setCustomerName(metadataName);

        if (error) {
          console.warn("Unable to load customer metadata:", error);
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        console.warn("Unable to load customer metadata:", error);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    if (!appointmentId) {
      setAppointment(null);
      setLoadError("Appointment not found.");
      setIsLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setImageFailed(false);

    getMedicalHistory()
      .then((history) => {
        if (!isCurrent) return;

        const foundAppointment = history.find((item) => item.id === appointmentId) ?? null;
        setAppointment(foundAppointment);
        setLoadError(foundAppointment ? null : "Appointment not found.");
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        console.error("Unable to load appointment details:", error);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load appointment details right now.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [appointmentId]);

  useEffect(() => {
    let isCurrent = true;
    const isCompleted =
      appointment?.status.trim().toLowerCase().replace(/[_-]+/g, " ") ===
      "completed";

    if (!appointmentId || !isCompleted) {
      setMedicalResults(null);
      setResultsError(null);
      setIsLoadingResults(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsLoadingResults(true);
    setResultsError(null);

    getMedicalResults(appointmentId)
      .then((results) => {
        if (isCurrent) setMedicalResults(results);
      })
      .catch((error: unknown) => {
        console.error("Unable to load medical results:", error);
        if (!isCurrent) return;
        setResultsError(
          error instanceof Error
            ? error.message
            : "Unable to load medical results right now.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoadingResults(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [appointment?.status, appointmentId]);

  const details = useMemo(() => {
    if (!appointment) return [];

    return [
      {
        label: "Customer",
        value: customerName,
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
  }, [appointment, customerName]);

  const hamsterFacts = useMemo(() => {
    if (!appointment) return [];

    return [
      { label: "Species / breed", value: appointment.species_breed || "Not specified" },
      { label: "Age", value: appointment.age_months == null ? "Not specified" : `${appointment.age_months} months` },
      { label: "Weight", value: appointment.weight_grams == null ? "Not specified" : `${appointment.weight_grams} g` },
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
              </div>
            </CardContent>
          </Card>

          {appointment.status.trim().toLowerCase().replace(/[_-]+/g, " ") ===
            "completed" && (
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

export default MedicalHistoryDetail;
