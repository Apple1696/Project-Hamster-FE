import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getVeterinarianSchedule,
  type VeterinarianScheduleSlot,
} from "@/services/MedicalService";

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(time: string): string {
  const [hours = "0", minutes = "00"] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes}`;
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

function AppointmentSummary({
  appointment,
}: {
  appointment: VeterinarianScheduleSlot["appointments"][number];
}) {
  return (
    <Card className="min-w-0 shadow-xs">
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            Customer: {appointment.customer_name}
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            Hamster:{" "}
            <span className="font-medium text-foreground">
              {appointment.hamster_name}
            </span>
          </p>
        </div>
        <Badge
          className={`h-7 max-w-full truncate px-3 ${getStatusClassName(appointment.status)}`}
          variant="outline"
        >
          {formatStatus(appointment.status)}
        </Badge>
        <Button
          className="col-span-2 w-full sm:col-span-1 sm:w-auto"
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

const ViewAppointment = () => {
  const [selectedDate, setSelectedDate] = useState(() =>
    getLocalDateKey(new Date()),
  );
  const [loadingDate, setLoadingDate] = useState(selectedDate);
  const [slots, setSlots] = useState<VeterinarianScheduleSlot[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isLoading = loadingDate === selectedDate;

  useEffect(() => {
    let isCurrentRequest = true;

    getVeterinarianSchedule(selectedDate)
      .then((schedule) => {
        if (isCurrentRequest) setSlots(schedule);
      })
      .catch((error: unknown) => {
        console.error("Unable to load veterinarian schedule:", error);
        if (!isCurrentRequest) return;
        setSlots([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load the schedule right now.",
        );
      })
      .finally(() => {
        if (isCurrentRequest) setLoadingDate("");
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [selectedDate]);

  function selectDate(date: string) {
    if (!date || date === selectedDate) return;
    setSelectedDate(date);
    setLoadingDate(date);
    setLoadError(null);
  }

  function changeDate(days: number) {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    selectDate(getLocalDateKey(date));
  }

  const selectedDateLabel = new Date(
    `${selectedDate}T00:00:00`,
  ).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Appointment schedule
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          View the appointments booked for each available time slot.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          aria-label="Previous day"
          onClick={() => changeDate(-1)}
          size="icon"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Input
          aria-label="Select schedule date"
          className="h-10 w-52"
          onChange={(event) => selectDate(event.target.value)}
          required
          type="date"
          value={selectedDate}
        />
        <Button
          aria-label="Next day"
          onClick={() => changeDate(1)}
          size="icon"
          variant="outline"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {selectedDateLabel}
        </h2>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-0 bg-primary hover:bg-primary">
                <TableHead className="w-32 px-4 text-center font-semibold text-primary-foreground sm:w-40">
                  Slots
                </TableHead>
                <TableHead className="px-4 font-semibold text-primary-foreground">
                  Info
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    className="py-12 text-center text-muted-foreground"
                    colSpan={2}
                  >
                    Loading schedule…
                  </TableCell>
                </TableRow>
              ) : loadError ? (
                <TableRow>
                  <TableCell
                    className="whitespace-normal py-8 text-center text-destructive"
                    colSpan={2}
                    role="alert"
                  >
                    {loadError}
                  </TableCell>
                </TableRow>
              ) : slots.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="whitespace-normal py-12 text-center text-muted-foreground"
                    colSpan={2}
                  >
                    No time slots or appointments are available for this date.
                  </TableCell>
                </TableRow>
              ) : (
                slots.map((slot) => (
                  <TableRow className="align-top" key={slot.id}>
                    <TableCell className="w-32 whitespace-normal border-r bg-muted/40 px-4 py-6 text-center font-semibold text-foreground sm:w-40">
                      {formatTime(slot.start_time)}
                      <span className="block pt-1 text-xs font-normal text-muted-foreground">
                        to {formatTime(slot.end_time)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal px-3 py-3 sm:px-4">
                      {slot.appointments.length > 0 ? (
                        <div className="grid gap-3">
                          {slot.appointments.map((appointment) => (
                            <AppointmentSummary
                              appointment={appointment}
                              key={appointment.id}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="py-3 text-sm text-muted-foreground">
                          No appointments scheduled
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
};

export default ViewAppointment;
