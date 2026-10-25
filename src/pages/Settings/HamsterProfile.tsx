import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "react-toastify"
import {
  ChevronDown,
  PawPrint,
  Plus,
  Upload,
  X,
} from "lucide-react"
import { useDropzone } from "react-dropzone"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

type Hamster = {
  id: string
  hamster_name: string
  species_breed: string | null
  weight_grams: number | null
  age_months: number | null
  gender: string | null
  image_url: string | null
}

type FormErrors = Record<string, string>

const HAMSTER_IMAGE_BUCKET = "hamster-images"
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function HamsterCard({ hamster }: { hamster: Hamster }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
        {hamster.image_url && !imageFailed ? (
          <img
            src={hamster.image_url}
            alt={hamster.hamster_name}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <PawPrint aria-hidden="true" className="size-12 opacity-40" />
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-center text-lg font-semibold">
          {hamster.hamster_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 pb-4 text-sm">
        <p className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Species:
          </span>
          <span className="truncate text-foreground">
            {hamster.species_breed || "Not specified"}
          </span>
        </p>
        <p className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Weight:
          </span>
          <span className="truncate text-foreground">
            {hamster.weight_grams == null
              ? "Not set"
              : `${hamster.weight_grams} g`}
          </span>
        </p>
        <p className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Age:
          </span>
          <span className="truncate text-foreground">
            {hamster.age_months == null
              ? "Not set"
              : `${hamster.age_months} months`}
          </span>
        </p>
        <p className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Gender:
          </span>
          <span className="truncate text-foreground">
            {hamster.gender || "Not specified"}
          </span>
        </p>
      </CardContent>
    </Card>
  )
}

const HamsterProfile = () => {
  const formRef = useRef<HTMLFormElement>(null)
  const [hamsters, setHamsters] = useState<Hamster[]>([])
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const imagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  )

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const {
    getInputProps,
    getRootProps,
    isDragActive,
    open: openFilePicker,
  } = useDropzone({
    accept: { "image/*": [] },
    maxSize: MAX_IMAGE_SIZE,
    multiple: false,
    noClick: true,
    onDropAccepted: ([file]) => {
      setImageFile(file ?? null)
      clearFieldError("image_file")
    },
    onDropRejected: ([rejection]) => {
      const rejectionError = rejection?.errors[0]
      setErrors((currentErrors) => ({
        ...currentErrors,
        image_file:
          rejectionError?.code === "file-too-large"
            ? "Choose an image smaller than 5 MB."
            : "Choose a valid image file.",
      }))
    },
  })

  useEffect(() => {
    let isCurrent = true

    async function loadHamsters() {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession()
        if (sessionError) throw sessionError

        const userId = sessionData.session?.user.id
        if (!userId) {
          if (isCurrent) {
            setOwnerId(null)
            setLoadError("Sign in to view and add your hamster profiles.")
          }
          return
        }

        const { data, error } = await supabase
          .from("hamsters")
          .select(
            "id, hamster_name, species_breed, weight_grams, age_months, gender, image_url",
          )
          .eq("owner_id", userId)
          .order("created_at", { ascending: false })

        if (error) throw error

        if (isCurrent) {
          setOwnerId(userId)
          setHamsters(data ?? [])
          setLoadError(null)
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load your hamster profiles."
        if (isCurrent) {
          setLoadError(message)
          toast.error(message)
        }
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadHamsters()

    return () => {
      isCurrent = false
    }
  }, [])

  function clearFieldError(field: string) {
    setErrors((currentErrors) => {
      if (!(field in currentErrors)) return currentErrors
      const nextErrors = { ...currentErrors }
      delete nextErrors[field]
      return nextErrors
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ownerId) {
      toast.error("Sign in before adding a hamster profile.")
      return
    }

    const formData = new FormData(event.currentTarget)
    const hamsterName = String(formData.get("hamster_name") ?? "").trim()
    const speciesBreed = String(formData.get("species_breed") ?? "").trim()
    const weightValue = String(formData.get("weight_grams") ?? "").trim()
    const ageValue = String(formData.get("age_months") ?? "").trim()
    const gender = String(formData.get("gender") ?? "").trim()
    const nextErrors: FormErrors = {}

    if (!hamsterName) nextErrors.hamster_name = "Enter a hamster name."

    const weight = weightValue === "" ? null : Number(weightValue)
    if (
      weightValue !== "" &&
      (weight === null || !Number.isFinite(weight) || weight <= 0)
    ) {
      nextErrors.weight_grams = "Enter a weight greater than 0 grams."
    }

    const age = ageValue === "" ? null : Number(ageValue)
    if (
      ageValue !== "" &&
      (age === null || !Number.isInteger(age) || age < 0)
    ) {
      nextErrors.age_months = "Enter a whole number of months (0 or more)."
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    let uploadedImagePath: string | null = null

    try {
      let imageUrl: string | null = null
      if (imageFile) {
        const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg"
        const imagePath = `${ownerId}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from(HAMSTER_IMAGE_BUCKET)
          .upload(imagePath, imageFile, {
            contentType: imageFile.type,
            upsert: false,
          })

        if (uploadError) throw uploadError
        uploadedImagePath = imagePath

        imageUrl = supabase.storage
          .from(HAMSTER_IMAGE_BUCKET)
          .getPublicUrl(imagePath).data.publicUrl
      }

      const { data, error } = await supabase
        .from("hamsters")
        .insert({
          owner_id: ownerId,
          hamster_name: hamsterName,
          species_breed: speciesBreed || null,
          weight_grams: weight,
          age_months: age,
          gender: gender || null,
          image_url: imageUrl,
        })
        .select(
          "id, hamster_name, species_breed, weight_grams, age_months, gender, image_url",
        )
        .single()

      if (error) throw error

      setHamsters((currentHamsters) => [data, ...currentHamsters])
      formRef.current?.reset()
      setImageFile(null)
      setErrors({})
      setIsDialogOpen(false)
      toast.success("Add success")
    } catch (error) {
      if (uploadedImagePath) {
        const { error: cleanupError } = await supabase.storage
          .from(HAMSTER_IMAGE_BUCKET)
          .remove([uploadedImagePath])
        if (cleanupError) {
          toast.error(
            `The profile could not be saved, and the uploaded image could not be removed: ${cleanupError.message}`,
          )
        }
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to add the hamster profile.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hamster Profiles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep your hamsters&apos; details in one place.
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0"
          disabled={!ownerId || isLoading}
          onClick={() => {
            setErrors({})
            setImageFile(null)
            setIsDialogOpen(true)
          }}
        >
          <Plus aria-hidden="true" />
          Add Hamster
        </Button>
      </header>

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">
          Loading hamster profiles...
        </p>
      ) : loadError ? (
        <p role="alert" className="py-12 text-center text-destructive">
          {loadError}
        </p>
      ) : hamsters.length === 0 ? (
        <Card className="items-center justify-center gap-3 px-6 py-14 text-center">
          <PawPrint
            aria-hidden="true"
            className="size-10 text-muted-foreground"
          />
          <p className="font-medium">Add hamsters</p>
          <p className="text-sm text-muted-foreground">
            Your hamster profiles will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {hamsters.map((hamster) => (
            <HamsterCard key={hamster.id} hamster={hamster} />
          ))}
        </div>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setErrors({})
            setImageFile(null)
            formRef.current?.reset()
          }
        }}
      >
        <DialogContent className="gap-3 p-4 sm:max-w-md sm:p-5">
          <DialogHeader className="gap-1">
            <DialogTitle>Add a hamster</DialogTitle>
            <DialogDescription className="text-xs">
              Add the details and an optional photo.
            </DialogDescription>
          </DialogHeader>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="space-y-3"
            noValidate
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hamster_name" className="text-xs">
                  Hamster name *
                </Label>
                <Input
                  id="hamster_name"
                  name="hamster_name"
                  autoComplete="off"
                  aria-invalid={Boolean(errors.hamster_name)}
                  aria-describedby={
                    errors.hamster_name ? "hamster_name-error" : undefined
                  }
                  onChange={() => clearFieldError("hamster_name")}
                />
                {errors.hamster_name && (
                  <p
                    id="hamster_name-error"
                    className="text-xs text-destructive"
                  >
                    {errors.hamster_name}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="species_breed" className="text-xs">
                  Species / breed
                </Label>
                <div className="relative">
                  <select
                    id="species_breed"
                    name="species_breed"
                    defaultValue=""
                    className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 py-1 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">Select a breed</option>
                    <option value="Syrian">Syrian</option>
                    <option value="Winter White Dwarf">
                      Winter White Dwarf
                    </option>
                    <option value="Roborovski Dwarf">
                      Roborovski Dwarf
                    </option>
                    <option value="Campbell's Dwarf">
                      Campbell&apos;s Dwarf
                    </option>
                    <option value="Chinese">Chinese</option>
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="weight_grams" className="text-xs">
                  Weight (g)
                </Label>
                <Input
                  id="weight_grams"
                  name="weight_grams"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  aria-invalid={Boolean(errors.weight_grams)}
                  aria-describedby={
                    errors.weight_grams ? "weight_grams-error" : undefined
                  }
                  onChange={() => clearFieldError("weight_grams")}
                />
                {errors.weight_grams && (
                  <p
                    id="weight_grams-error"
                    className="text-xs text-destructive"
                  >
                    {errors.weight_grams}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age_months" className="text-xs">
                  Age (months)
                </Label>
                <Input
                  id="age_months"
                  name="age_months"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  aria-invalid={Boolean(errors.age_months)}
                  aria-describedby={
                    errors.age_months ? "age_months-error" : undefined
                  }
                  onChange={() => clearFieldError("age_months")}
                />
                {errors.age_months && (
                  <p
                    id="age_months-error"
                    className="text-xs text-destructive"
                  >
                    {errors.age_months}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender" className="text-xs">
                  Gender
                </Label>
                <div className="relative">
                  <select
                    id="gender"
                    name="gender"
                    defaultValue=""
                    className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 py-1 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hamster photo</Label>
              <div
                {...getRootProps({
                  className: `flex min-h-20 cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-2 transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-primary/60 hover:bg-muted/50"
                  }`,
                })}
              >
                <input {...getInputProps()} />
                {imageFile && imagePreview ? (
                  <div className="flex w-full items-center gap-3">
                    <img
                      src={imagePreview}
                      alt="Selected hamster preview"
                      className="size-14 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {imageFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(imageFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove selected photo"
                      onClick={(event) => {
                        event.stopPropagation()
                        setImageFile(null)
                      }}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-center">
                    <Upload
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                    <div className="text-left">
                      <p className="text-xs font-medium">
                        {isDragActive
                          ? "Drop the image here"
                          : "Drag an image here or"}
                        {!isDragActive && (
                          <button
                            type="button"
                            className="ml-1 text-primary underline underline-offset-2"
                            onClick={(event) => {
                              event.stopPropagation()
                              openFilePicker()
                            }}
                          >
                            browse files
                          </button>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Images up to 5 MB
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {errors.image_file && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.image_file}
                </p>
              )}
            </div>
            <DialogFooter className="pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Hamster"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default HamsterProfile
