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
  const [loadError, setLoadError] = useState<string | null>(null);

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
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
};

export default ViewAppointmentDetail;
