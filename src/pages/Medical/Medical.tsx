import { useEffect, useMemo, useState } from "react";
import { Steps } from "antd";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  PawPrint,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bookMedicalAppointment,
  getMedicalBookingData,
  getWeekAvailability,
  type AppointmentAvailability,
  type MedicalHamster,
} from "@/services/MedicalService";
import "./Medical.css";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const APPOINTMENT_TIMES = [
  { start: "09:00", end: "10:00" },
  { start: "10:00", end: "11:00" },
  { start: "11:00", end: "12:00" },
  { start: "13:00", end: "14:00" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
  { start: "16:00", end: "17:00" },
];

type SelectedSlot = { date: string; start: string; end: string };

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonday(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOffset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayOffset);
  return monday;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatTime(time: string): string {
  const [hours = "0", minutes = "00"] = time.split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minutes} ${suffix}`;
}

function getRemainingCapacity(slot: AppointmentAvailability): number {
  return Math.max(
    0,
    (slot.max_capacity ?? 1) - (slot.current_bookings ?? 0),
  );
}

function isPastSlot(date: string, time: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes).getTime() <= Date.now();
}

// ----------
// Shared UI helpers for the medical booking flow
// ----------
function HamsterDetails({ hamster }: { hamster: MedicalHamster }) {
  const details = [
    ["Species", hamster.species_breed || "Not specified"],
    ["Weight", hamster.weight_grams == null ? "Not set" : `${hamster.weight_grams} g`],
    ["Age", hamster.age_months == null ? "Not set" : `${hamster.age_months} months`],
    ["Gender", hamster.gender || "Not specified"],
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-left text-sm">
      {details.map(([label, value]) => (
        <p className="min-w-0" key={label}>
          <span className="text-muted-foreground">{label}: </span>
          <span className="font-medium text-foreground">{value}</span>
        </p>
      ))}
    </div>
  );
}

const Medical = () => {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [hamsters, setHamsters] = useState<MedicalHamster[]>([]);
  const [isLoadingHamsters, setIsLoadingHamsters] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [selectedHamster, setSelectedHamster] =
    useState<MedicalHamster | null>(null);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [availability, setAvailability] = useState<AppointmentAvailability[]>(
    [],
  );
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedVeterinarian, setSelectedVeterinarian] =
    useState<AppointmentAvailability | null>(null);
  const [reason, setReason] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // ----------
  // Step 1: load the current customer's hamster profiles and select one
  // ----------
  const weekDates = useMemo(
    () => WEEKDAYS.map((_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekStartKey = toDateKey(weekStart);
  const weekEndKey = toDateKey(weekDates[4]);

  function changeWeek(offset: number) {
    setIsLoadingAvailability(true);
    setAvailabilityError(null);
    setSelectedSlot(null);
    setSelectedVeterinarian(null);
    setWeekStart((current) => addDays(current, offset));
  }

  function continueToTimeSlots() {
    setIsLoadingAvailability(true);
    setAvailabilityError(null);
    setStep(1);
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadHamsters() {
      try {
        const result = await getMedicalBookingData();
        if (!isCurrent) return;
        setOwnerId(result.ownerId);
        setHamsters(result.hamsters);
        setLoadError(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load your hamster profiles.";
        if (isCurrent) {
          setLoadError(message);
          toast.error(message);
        }
      } finally {
        if (isCurrent) setIsLoadingHamsters(false);
      }
    }

    void loadHamsters();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (step !== 1) return;

    let isCurrent = true;

    async function loadAvailability() {
      try {
        const result = await getWeekAvailability(weekStartKey, weekEndKey);
        if (isCurrent) setAvailability(result);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load veterinarian availability.";
        if (isCurrent) {
          setAvailability([]);
          setAvailabilityError(message);
          toast.error(message);
        }
      } finally {
        if (isCurrent) setIsLoadingAvailability(false);
      }
    }

    void loadAvailability();
    return () => {
      isCurrent = false;
    };
  }, [step, weekStartKey, weekEndKey]);

  function getSlotAvailability(date: string, start: string, end: string) {
    return availability.filter(
      (slot) =>
        slot.slot_date === date &&
        slot.start_time.slice(0, 5) === start &&
        slot.end_time.slice(0, 5) === end,
    );
  }

  function selectSlot(date: string, time: (typeof APPOINTMENT_TIMES)[number]) {
    setSelectedSlot({ date, start: time.start, end: time.end });
    setSelectedVeterinarian(null);
  }

  async function confirmAppointment() {
    if (!ownerId || !selectedHamster || !selectedSlot || !selectedVeterinarian) {
      toast.error("Complete each appointment step before confirming.");
      return;
    }

    setIsBooking(true);
    try {
      const [year, month, day] = selectedSlot.date.split("-").map(Number);
      const [startHours, startMinutes] = selectedSlot.start
        .split(":")
        .map(Number);
      const [endHours, endMinutes] = selectedSlot.end.split(":").map(Number);
      const appointmentDate = new Date(
        year,
        month - 1,
        day,
        startHours,
        startMinutes,
      ).toISOString();
      const appointmentEndAt = new Date(
        year,
        month - 1,
        day,
        endHours,
        endMinutes,
      ).toISOString();

      await bookMedicalAppointment({
        hamsterId: selectedHamster.id,
        ownerId,
        availabilityId: selectedVeterinarian.id,
        vetId: selectedVeterinarian.vet_id,
        appointmentDate,
        appointmentEndAt,
        reasonForVisit: reason.trim(),
      });

      setAvailability((current) =>
        current.map((item) =>
          item.id === selectedVeterinarian.id
            ? { ...item, current_bookings: (item.current_bookings ?? 0) + 1 }
            : item,
        ),
      );
      setIsConfirmed(true);
      toast.success("Your medical appointment is confirmed.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to book this appointment right now.",
      );
    } finally {
      setIsBooking(false);
    }
  }

  function startAnotherAppointment() {
    setIsConfirmed(false);
    setStep(0);
    setSelectedHamster(null);
    setSelectedSlot(null);
    setSelectedVeterinarian(null);
    setReason("");
  }

  const selectedAppointmentDate = selectedSlot
    ? new Date(`${selectedSlot.date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  // ----------
  // Main booking flow render
  // Step 0 = Select Hamster
  // Step 1 = Select Slot + Veterinarian
  // Step 2 = Confirmation
  // ----------
  return (
    <section className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">HamCare appointments</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Medical checkup
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Choose your hamster, find a time that works, and confirm your visit.
        </p>
      </div>

      <section aria-label="Appointment steps" className="pb-2">
        <Steps
          className="medical-steps"
          current={step}
          items={[
            { title: "Select Hamster", icon: <PawPrint aria-hidden="true" /> },
            { title: "Select Slot", icon: <CalendarDays aria-hidden="true" /> },
            { title: "Confirmation", icon: <Check aria-hidden="true" /> },
          ]}
        />
      </section>

      {isConfirmed && selectedHamster && selectedSlot && selectedVeterinarian ? (
        <Card className="mx-auto max-w-2xl text-center">
          <CardHeader>
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check aria-hidden="true" className="size-7" />
            </div>
            <CardTitle className="text-2xl">Appointment confirmed</CardTitle>
            <CardDescription>
              We have scheduled the medical checkup for{" "}
              {selectedHamster.hamster_name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {selectedAppointmentDate} · {formatTime(selectedSlot.start)}–
              {formatTime(selectedSlot.end)} with{" "}
              {selectedVeterinarian.veterinarian.name}
            </p>
            <Button onClick={startAnotherAppointment}>
              Book another appointment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 0
                ? "Choose a hamster"
                : step === 1
                  ? "Choose a time and veterinarian"
                  : "Review your appointment"}
            </CardTitle>
            <CardDescription>
              {step === 0
                ? "Select which hamster will be seen."
                : step === 1
                  ? "Select an open weekday time slot, then choose a veterinarian."
                  : "Check the details before confirming your visit."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/*
              Step 0
              - Render the hamster cards
              - User selects a hamster
              - Continue button appears only after selection
            */}
            {step === 0 && (
              <>
                {isLoadingHamsters ? (
                  <div className="py-12 text-center text-muted-foreground" role="status">
                    Loading hamster profiles...
                  </div>
                ) : loadError ? (
                  <p className="py-8 text-center text-destructive" role="alert">
                    {loadError}
                  </p>
                ) : hamsters.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <PawPrint className="mx-auto mb-3 size-8 text-muted-foreground" />
                    <p className="font-medium">No hamster profiles yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add a hamster profile before booking a checkup.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {hamsters.map((hamster) => {
                      const isSelected = selectedHamster?.id === hamster.id;
                      return (
                        <button
                          key={hamster.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedHamster(hamster)}
                          className={`rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isSelected
                              ? "border-primary bg-accent/50 ring-2 ring-primary/30"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                              {hamster.image_url ? (
                                <img
                                  src={hamster.image_url}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                <PawPrint className="size-8 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="truncate text-lg font-semibold">
                                {hamster.hamster_name}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">
                                {hamster.species_breed || "Species not specified"}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="ml-auto size-5 shrink-0 text-primary" />
                            )}
                          </div>
                          <HamsterDetails hamster={hamster} />
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedHamster && (
                  <div className="flex justify-end">
                    <Button onClick={continueToTimeSlots}>
                      Continue to time slots
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </>
            )}

            {/*
              Step 1
              - Show a week view of all available time slots
              - User picks one date/time cell
              - Then choose a veterinarian from the available cards below
              - Continue button appears only when both are selected
            */}
            {step === 1 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      Week of{" "}
                      {weekStart.toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Green slots have availability. Choose one to see the
                      veterinarians.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Previous week"
                      onClick={() => changeWeek(-7)}
                    >
                      <ChevronLeft aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Next week"
                      onClick={() => changeWeek(7)}
                    >
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {availabilityError && (
                  <p className="text-sm text-destructive" role="alert">
                    {availabilityError}
                  </p>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-28">Time</TableHead>
                      {weekDates.map((date, index) => (
                        <TableHead className="min-w-32 text-center" key={WEEKDAYS[index]}>
                          <span className="block">{WEEKDAYS[index]}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {date.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {APPOINTMENT_TIMES.map((time) => (
                      <TableRow key={time.start}>
                        <TableHead className="font-medium">
                          {formatTime(time.start)}–{formatTime(time.end)}
                        </TableHead>
                        {weekDates.map((date, index) => {
                          const dateKey = toDateKey(date);
                          const matchingSlots = getSlotAvailability(
                            dateKey,
                            time.start,
                            time.end,
                          );
                          const remaining = matchingSlots.reduce(
                            (total, slot) => total + getRemainingCapacity(slot),
                            0,
                          );
                          const unavailable =
                            matchingSlots.length === 0 ||
                            remaining === 0 ||
                            isPastSlot(dateKey, time.start);
                          const isSelected =
                            selectedSlot?.date === dateKey &&
                            selectedSlot.start === time.start;

                          return (
                            <TableCell className="p-1.5 text-center" key={WEEKDAYS[index]}>
                              <button
                                type="button"
                                disabled={unavailable || isLoadingAvailability}
                                aria-pressed={isSelected}
                                onClick={() => selectSlot(dateKey, time)}
                                className={`min-h-14 w-full rounded-md border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : unavailable
                                      ? "border-border bg-muted text-muted-foreground"
                                      : "border-primary/20 bg-primary/10 text-foreground hover:border-primary hover:bg-primary/20"
                                }`}
                              >
                                {isLoadingAvailability
                                  ? "Loading"
                                  : isPastSlot(dateKey, time.start)
                                    ? "Past"
                                    : matchingSlots.length === 0
                                      ? "No slots"
                                    : remaining > 0
                                      ? `${remaining} available`
                                      : "Full"}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {selectedSlot && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">Available veterinarians</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedAppointmentDate} ·{" "}
                        {formatTime(selectedSlot.start)}–
                        {formatTime(selectedSlot.end)}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {getSlotAvailability(
                        selectedSlot.date,
                        selectedSlot.start,
                        selectedSlot.end,
                      )
                        .filter((slot) => getRemainingCapacity(slot) > 0)
                        .map((slot) => {
                          const isSelected = selectedVeterinarian?.id === slot.id;
                          return (
                            <button
                              type="button"
                              key={slot.id}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedVeterinarian(slot)}
                              className={`flex items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                isSelected
                                  ? "border-primary bg-accent/50 ring-2 ring-primary/30"
                                  : "border-border"
                              }`}
                            >
                              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <UserRound aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {slot.veterinarian.name}
                                </span>
                                <span className="block text-sm text-muted-foreground">
                                  {slot.veterinarian.role} ·{" "}
                                  {getRemainingCapacity(slot)} spot
                                  {getRemainingCapacity(slot) === 1 ? "" : "s"}{" "}
                                  available
                                </span>
                              </span>
                              {isSelected && (
                                <Check className="size-5 shrink-0 text-primary" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                    {getSlotAvailability(
                      selectedSlot.date,
                      selectedSlot.start,
                      selectedSlot.end,
                    ).every((slot) => getRemainingCapacity(slot) === 0) && (
                      <p className="text-sm text-muted-foreground">
                        No veterinarians are available for this time. Select
                        another slot.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(0)}
                  >
                    <ChevronLeft aria-hidden="true" />
                    Back to hamster
                  </Button>
                  {selectedSlot && selectedVeterinarian && (
                    <Button onClick={() => setStep(2)}>
                      Continue to confirmation
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </>
            )}

            {/*
              Step 2
              - Review the appointment summary in a table
              - User can add a reason for visit
              - Confirm button creates the appointment
            */}
            {step === 2 && selectedHamster && selectedSlot && selectedVeterinarian && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Appointment detail</TableHead>
                      <TableHead>Selected information</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableHead>
                        <span className="inline-flex items-center gap-2">
                          <PawPrint className="size-4" /> Hamster
                        </span>
                      </TableHead>
                      <TableCell>
                        <span className="font-medium">
                          {selectedHamster.hamster_name}
                        </span>
                        <span className="block whitespace-normal text-sm text-muted-foreground">
                          {selectedHamster.species_breed || "Species not specified"}
                          {" · "}
                          {selectedHamster.weight_grams == null
                            ? "Weight not set"
                            : `${selectedHamster.weight_grams} g`}
                          {" · "}
                          {selectedHamster.age_months == null
                            ? "Age not set"
                            : `${selectedHamster.age_months} months`}
                          {" · "}
                          {selectedHamster.gender || "Gender not specified"}
                        </span>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableHead>
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays className="size-4" /> Date
                        </span>
                      </TableHead>
                      <TableCell>{selectedAppointmentDate}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableHead>
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="size-4" /> Time
                        </span>
                      </TableHead>
                      <TableCell>
                        {formatTime(selectedSlot.start)}–
                        {formatTime(selectedSlot.end)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableHead>
                        <span className="inline-flex items-center gap-2">
                          <Stethoscope className="size-4" /> Veterinarian
                        </span>
                      </TableHead>
                      <TableCell>
                        {selectedVeterinarian.veterinarian.name}
                        {selectedVeterinarian.veterinarian.email && (
                          <span className="block text-sm text-muted-foreground">
                            {selectedVeterinarian.veterinarian.email}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableHead>Reason for visit</TableHead>
                      <TableCell>
                        {reason.trim() || "General medical checkup"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">
                    Anything the veterinarian should know? (optional)
                  </span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Share symptoms or other notes for the visit"
                    className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>

                <div className="flex flex-wrap justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBooking}
                    onClick={continueToTimeSlots}
                  >
                    <ChevronLeft aria-hidden="true" />
                    Back to time slots
                  </Button>
                  <Button disabled={isBooking} onClick={confirmAppointment}>
                    {isBooking ? "Booking..." : "Confirm appointment"}
                    <Check aria-hidden="true" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
};

export default Medical;
