import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, HeartPulse, PawPrint, X } from "lucide-react";
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
import {
  getBasicExaminationData,
  completeAppointment,
  saveBasicExamination,
  type BasicExaminationAppointment,
  type BasicExaminationForm,
} from "@/services/MedicalRecordService";
import {
  getFecalExaminationImageUrls,
  getFecalExaminationsByMedicalRecordTestId,
  MAX_FECAL_IMAGE_SIZE,
  MAX_FECAL_IMAGES,
  saveFecalExamination,
  type FecalExaminationForm,
} from "@/services/FecalExaminationService";

function formatAppointmentDate(value: string): string {
  const hasTime = /T\d{2}:\d{2}/.test(value);
  const date = new Date(hasTime ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(hasTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

const emptyForm: BasicExaminationForm = {
  weight: "",
  temperature: "",
  heartRate: "",
  physicalExaminationNotes: "",
  symptoms: "",
  diagnosis: "",
  treatment: "",
};

const emptyFecalForm: FecalExaminationForm = {
  sampleCollectedAt: "",
  sampleCondition: "",
  stoolColor: "",
  stoolConsistency: "",
  stoolShape: "",
  stoolSize: "",
  mucusPresent: null,
  bloodPresent: null,
  undigestedFoodPresent: null,
  examinationMethod: "",
  microscopicFindings: "",
  parasiteDetected: null,
  parasiteName: "",
  parasiteQuantity: "",
  overallResult: "",
  veterinarianNotes: "",
  completedAt: "",
};

function toDateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function getTriStateValue(value: boolean | null): string {
  return value == null ? "" : String(value);
}

const BasicExamination = () => {
  const navigate = useNavigate();
  const { appointmentId } = useParams();
  const [appointment, setAppointment] =
    useState<BasicExaminationAppointment | null>(null);
  const [form, setForm] = useState<BasicExaminationForm>(emptyForm);
  const [fecalForm, setFecalForm] =
    useState<FecalExaminationForm>(emptyFecalForm);
  const [fecalExaminationId, setFecalExaminationId] = useState<string | null>(
    null,
  );
  const [fecalImagePaths, setFecalImagePaths] = useState<string[]>([]);
  const [fecalImageUrls, setFecalImageUrls] = useState<
    Array<{ path: string; url: string }>
  >([]);
  const [newFecalImages, setNewFecalImages] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const newImagePreviews = useMemo(
    () =>
      newFecalImages.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [newFecalImages],
  );

  useEffect(
    () => () => {
      newImagePreviews.forEach(({ url }) => URL.revokeObjectURL(url));
    },
    [newImagePreviews],
  );

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
        const examinationData = await getBasicExaminationData(appointmentId);

        if (!isCurrent) return;

        setAppointment(examinationData.appointment);
        setForm(examinationData.form);
        if (examinationData.medicalRecordId) {
          const fecalRecords = await getFecalExaminationsByMedicalRecordTestId(
            examinationData.medicalRecordId,
          );
          if (!isCurrent) return;

          const fecalRecord = fecalRecords[0] ?? null;
          setFecalExaminationId(fecalRecord?.id ?? null);
          setFecalImagePaths(fecalRecord?.fecal_images ?? []);
          setFecalForm(
            fecalRecord
              ? {
                sampleCollectedAt: toDateTimeInput(
                  fecalRecord.sample_collected_at,
                ),
                sampleCondition: fecalRecord.sample_condition ?? "",
                stoolColor: fecalRecord.stool_color ?? "",
                stoolConsistency: fecalRecord.stool_consistency ?? "",
                stoolShape: fecalRecord.stool_shape ?? "",
                stoolSize: fecalRecord.stool_size ?? "",
                mucusPresent: fecalRecord.mucus_present,
                bloodPresent: fecalRecord.blood_present,
                undigestedFoodPresent:
                  fecalRecord.undigested_food_present,
                examinationMethod: fecalRecord.examination_method ?? "",
                microscopicFindings:
                  fecalRecord.microscopic_findings ?? "",
                parasiteDetected: fecalRecord.parasite_detected,
                parasiteName: fecalRecord.parasite_name ?? "",
                parasiteQuantity: fecalRecord.parasite_quantity ?? "",
                overallResult: fecalRecord.overall_result ?? "",
                veterinarianNotes: fecalRecord.veterinarian_notes ?? "",
                completedAt: toDateTimeInput(fecalRecord.completed_at),
              }
              : emptyFecalForm,
          );
          const imageUrls = await getFecalExaminationImageUrls(
            fecalRecord?.fecal_images ?? [],
          );
          if (!isCurrent) return;
          setFecalImageUrls(imageUrls);
        } else {
          setFecalExaminationId(null);
          setFecalImagePaths([]);
          setFecalImageUrls([]);
          setFecalForm(emptyFecalForm);
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

  function updateField(field: keyof BasicExaminationForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateFecalField<K extends keyof FecalExaminationForm>(
    field: K,
    value: FecalExaminationForm[K],
  ) {
    setFecalForm((current) => ({ ...current, [field]: value }));
  }

  function handleFecalImageSelection(files: FileList | null) {
    if (!files) return;

    const selectedFiles = Array.from(files);
    const validFiles = selectedFiles.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not a valid image file.`);
        return false;
      }

      if (file.size > MAX_FECAL_IMAGE_SIZE) {
        toast.error(`${file.name} is larger than 5 MB.`);
        return false;
      }

      return true;
    });

    const availableSlots =
      MAX_FECAL_IMAGES - fecalImagePaths.length - newFecalImages.length;
    if (validFiles.length > availableSlots) {
      toast.error(`You can attach up to ${MAX_FECAL_IMAGES} fecal images.`);
    }

    setNewFecalImages((current) => [
      ...current,
      ...validFiles.slice(0, Math.max(0, availableSlots)),
    ]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!appointmentId || !appointment) {
      toast.error("Appointment not found.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedMedicalRecordId = await saveBasicExamination(
        appointmentId,
        appointment.hamster_id,
        form,
      );
      const hasFecalData =
        fecalExaminationId !== null ||
        fecalImagePaths.length > 0 ||
        newFecalImages.length > 0 ||
        Object.entries(fecalForm).some(
          ([field, value]) =>
            field !== "mucusPresent" &&
            field !== "bloodPresent" &&
            field !== "undigestedFoodPresent" &&
            field !== "parasiteDetected" &&
            value !== "",
        ) ||
        fecalForm.mucusPresent !== null ||
        fecalForm.bloodPresent !== null ||
        fecalForm.undigestedFoodPresent !== null ||
        fecalForm.parasiteDetected !== null;

      if (hasFecalData) {
        const savedFecalExamination = await saveFecalExamination({
          medicalRecordTestId: savedMedicalRecordId,
          existingId: fecalExaminationId,
          existingImagePaths: fecalImagePaths,
          form: fecalForm,
          imageFiles: newFecalImages,
        });

        setFecalExaminationId(savedFecalExamination.id);
        setFecalImagePaths(savedFecalExamination.fecal_images);
      }

      await completeAppointment(appointmentId);
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

            <Card className="border-border/80 bg-card shadow-sm">
              <Accordion>
                <AccordionItem className="border-0" value="fecal-examination">
                  <div className="px-6 py-2">
                    <AccordionTrigger className="items-center p-0 text-lg font-semibold leading-none hover:no-underline">
                      <span className="leading-normal">Fecal Examination</span>
                    </AccordionTrigger>
                  </div>
                  <AccordionContent className="px-6">
                    <div className="space-y-6 pb-6">
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="sampleCollectedAt">Sample collected at</Label>
                          <Input
                            id="sampleCollectedAt"
                            onChange={(event) =>
                              updateFecalField("sampleCollectedAt", event.target.value)
                            }
                            type="datetime-local"
                            value={fecalForm.sampleCollectedAt}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sampleCondition">Sample condition</Label>
                          <Input
                            id="sampleCondition"
                            onChange={(event) =>
                              updateFecalField("sampleCondition", event.target.value)
                            }
                            placeholder="Fresh, dry, contaminated..."
                            value={fecalForm.sampleCondition}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stoolColor">Stool color</Label>
                          <Input
                            id="stoolColor"
                            onChange={(event) =>
                              updateFecalField("stoolColor", event.target.value)
                            }
                            placeholder="Brown"
                            value={fecalForm.stoolColor}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stoolConsistency">Stool consistency</Label>
                          <Input
                            id="stoolConsistency"
                            onChange={(event) =>
                              updateFecalField("stoolConsistency", event.target.value)
                            }
                            placeholder="Firm, soft, watery..."
                            value={fecalForm.stoolConsistency}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stoolShape">Stool shape</Label>
                          <Input
                            id="stoolShape"
                            onChange={(event) =>
                              updateFecalField("stoolShape", event.target.value)
                            }
                            placeholder="Typical, irregular..."
                            value={fecalForm.stoolShape}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stoolSize">Stool size</Label>
                          <Input
                            id="stoolSize"
                            onChange={(event) =>
                              updateFecalField("stoolSize", event.target.value)
                            }
                            placeholder="Small, normal, large..."
                            value={fecalForm.stoolSize}
                          />
                        </div>
                        {(
                          [
                            ["mucusPresent", "Mucus present"],
                            ["bloodPresent", "Blood present"],
                            ["undigestedFoodPresent", "Undigested food present"],
                            ["parasiteDetected", "Parasite detected"],
                          ] as const
                        ).map(([field, label]) => (
                          <div className="space-y-2" key={field}>
                            <Label htmlFor={field}>{label}</Label>
                            <select
                              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                              id={field}
                              onChange={(event) =>
                                updateFecalField(
                                  field,
                                  event.target.value === ""
                                    ? null
                                    : event.target.value === "true",
                                )
                              }
                              value={getTriStateValue(fecalForm[field])}
                            >
                              <option value="">Not recorded</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          </div>
                        ))}
                        <div className="space-y-2">
                          <Label htmlFor="examinationMethod">Examination method</Label>
                          <Input
                            id="examinationMethod"
                            onChange={(event) =>
                              updateFecalField("examinationMethod", event.target.value)
                            }
                            placeholder="Direct smear, flotation..."
                            value={fecalForm.examinationMethod}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="parasiteName">Parasite name</Label>
                          <Input
                            id="parasiteName"
                            onChange={(event) =>
                              updateFecalField("parasiteName", event.target.value)
                            }
                            value={fecalForm.parasiteName}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="parasiteQuantity">Parasite quantity</Label>
                          <Input
                            id="parasiteQuantity"
                            onChange={(event) =>
                              updateFecalField("parasiteQuantity", event.target.value)
                            }
                            placeholder="Few, moderate, many..."
                            value={fecalForm.parasiteQuantity}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="overallResult">Overall result</Label>
                          <Input
                            id="overallResult"
                            onChange={(event) =>
                              updateFecalField("overallResult", event.target.value)
                            }
                            placeholder="Negative, positive, inconclusive..."
                            value={fecalForm.overallResult}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="completedAt">Completed at</Label>
                          <Input
                            id="completedAt"
                            onChange={(event) =>
                              updateFecalField("completedAt", event.target.value)
                            }
                            type="datetime-local"
                            value={fecalForm.completedAt}
                          />
                        </div>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="microscopicFindings">Microscopic findings</Label>
                          <Textarea
                            id="microscopicFindings"
                            onChange={(event) =>
                              updateFecalField("microscopicFindings", event.target.value)
                            }
                            value={fecalForm.microscopicFindings}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="veterinarianNotes">Additional notes</Label>
                          <Textarea
                            id="veterinarianNotes"
                            onChange={(event) =>
                              updateFecalField("veterinarianNotes", event.target.value)
                            }
                            value={fecalForm.veterinarianNotes}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="fecalImages">Fecal images</Label>
                          <span className="text-xs text-muted-foreground">
                            {fecalImagePaths.length + newFecalImages.length} / {MAX_FECAL_IMAGES}
                          </span>
                        </div>
                        <Input
                          accept="image/*"
                          disabled={
                            fecalImagePaths.length + newFecalImages.length >=
                            MAX_FECAL_IMAGES
                          }
                          id="fecalImages"
                          multiple
                          onChange={(event) => {
                            handleFecalImageSelection(event.currentTarget.files);
                            event.currentTarget.value = "";
                          }}
                          type="file"
                        />

                        {fecalImageUrls.length > 0 || newImagePreviews.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {fecalImageUrls.map(({ path, url }) => (
                              <figure className="overflow-hidden rounded-lg border bg-background" key={path}>
                                <img
                                  alt="Saved fecal sample"
                                  className="h-32 w-full object-cover"
                                  src={url}
                                />
                                <figcaption className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                                  {path.split("/").pop()}
                                </figcaption>
                              </figure>
                            ))}
                            {newImagePreviews.map(({ file, url }, index) => (
                              <figure className="relative overflow-hidden rounded-lg border bg-background" key={`${file.name}-${file.lastModified}-${index}`}>
                                <img alt={file.name} className="h-32 w-full object-cover" src={url} />
                                <Button
                                  aria-label={`Remove pending image ${file.name}`}
                                  className="absolute right-2 top-2 size-7 rounded-full"
                                  onClick={() =>
                                    setNewFecalImages((current) =>
                                      current.filter((_, fileIndex) => fileIndex !== index),
                                    )
                                  }
                                  size="icon"
                                  type="button"
                                  variant="destructive"
                                >
                                  <X aria-hidden="true" className="size-4" />
                                </Button>
                                <figcaption className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                                  {file.name}
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        ) : null}
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
