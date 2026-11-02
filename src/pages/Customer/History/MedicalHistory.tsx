import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Search, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function AppointmentCard({ appointment }: { appointment: MedicalAppointment }) {
  return (
    <Card className="shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="grid grid-cols-2 items-center gap-x-4 gap-y-5 p-4 sm:grid-cols-4 sm:p-5 xl:grid-cols-[1.15fr_1fr_1.2fr_auto_auto] xl:gap-6">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Hamster</p>
          <p className="mt-1 truncate text-base font-semibold text-primary">
            {appointment.hamster_name}
          </p>
        </div>

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-3.5 text-primary" />
            Appointment date
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {formatAppointmentDate(appointment.appointment_date)}
          </p>
        </div>

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UserRound aria-hidden="true" className="size-3.5 text-primary" />
            Veterinarian
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {appointment.veterinarian_name}
          </p>
        </div>

        <div className="flex items-center sm:justify-start xl:justify-center">
          <Badge
            className={`h-7 max-w-full truncate px-3 ${getStatusClassName(appointment.status)}`}
            variant="outline"
          >
            {formatStatus(appointment.status)}
          </Badge>
        </div>

        <Button
          className="w-full sm:col-span-1 xl:w-28"
          disabled
          title="Appointment details will be available here"
          variant="outline"
        >
          View
        </Button>
      </CardContent>
    </Card>
  );
}

const MedicalHistory = () => {
  const [appointments, setAppointments] = useState<MedicalAppointment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    getMedicalHistory()
      .then((history) => {
        if (!isCurrent) return;
        setAppointments(history);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        console.error("Unable to load medical history:", error);
        if (!isCurrent) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load medical history right now.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const statuses = useMemo(
    () => [...new Set(appointments.map((appointment) => appointment.status))],
    [appointments],
  );

  const filteredAppointments = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return appointments.filter((appointment) => {
      const matchesSearch =
        !normalizedQuery ||
        appointment.hamster_name.toLowerCase().includes(normalizedQuery) ||
        appointment.id.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        selectedStatus === "all" || appointment.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [appointments, searchQuery, selectedStatus]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Medical History
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review your hamsters’ booked medical appointments.
        </p>
      </header>

      <div className="mb-5 grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)]">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search by hamster name or appointment ID"
            className="h-10 pl-9"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by hamster name or appointment ID"
            type="search"
            value={searchQuery}
          />
        </div>

        <div className="relative">
          <label className="sr-only" htmlFor="appointment-status">
            Filter appointments by status
          </label>
          <select
            className="h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            id="appointment-status"
            onChange={(event) => setSelectedStatus(event.target.value)}
            value={selectedStatus}
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>

      {isLoading ? (
        <div
          aria-live="polite"
          className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground"
          role="status"
        >
          Loading medical history…
        </div>
      ) : loadError ? (
        <div
          className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-6 text-sm text-destructive"
          role="alert"
        >
          {loadError}
        </div>
      ) : filteredAppointments.length > 0 ? (
        <div className="grid gap-4">
          {filteredAppointments.map((appointment) => (
            <AppointmentCard appointment={appointment} key={appointment.id} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="font-medium text-foreground">
            {appointments.length === 0
              ? "No appointments yet"
              : "No appointments match your search"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {appointments.length === 0
              ? "Booked medical appointments will appear here."
              : "Try another hamster name, appointment ID, or status."}
          </p>
        </div>
      )}
    </section>
  );
};

export default MedicalHistory;
