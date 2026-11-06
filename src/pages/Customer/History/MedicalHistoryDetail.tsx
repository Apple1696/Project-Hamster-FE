import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  PawPrint,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
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

const MedicalHistoryDetail = () => {
  const navigate = useNavigate();
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState<MedicalAppointment | null>(null);
  const [customerName, setCustomerName] = useState("Customer");
  const [imageFailed, setImageFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      ) : null}
    </section>
  );
};

export default MedicalHistoryDetail;
