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
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import {
  createHamsterProfile,
  deleteHamsterProfile,
  getCurrentHamsterOwnerId,
  getHamsterProfiles,
  removeUploadedHamsterImage,
  updateHamsterProfile,
  uploadHamsterImage,
  type Hamster,
  type HamsterProfileValues,
} from "@/services/HamsterProfileService"

type FormErrors = Record<string, string>

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function HamsterCard({
  hamster,
  onView,
  onEdit,
}: {
  hamster: Hamster
  onView: () => void
  onEdit: () => void
}) {
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
      <CardContent className="space-y-4 pb-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
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
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onView}>
            View
          </Button>
          <Button type="button" className="flex-1" onClick={onEdit}>
            Edit
          </Button>
        </div>
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editHamster, setEditHamster] = useState<Hamster | null>(null)
  const [viewHamster, setViewHamster] = useState<Hamster | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const imagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  )
  const selectedImagePreview =
    imagePreview ?? (imageRemoved ? null : editHamster?.image_url ?? null)

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
      setImageRemoved(false)
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
        const userId = await getCurrentHamsterOwnerId()
        if (!userId) {
          if (isCurrent) {
            setOwnerId(null)
            setLoadError("Sign in to view and add your hamster profiles.")
          }
          return
        }

        const data = await getHamsterProfiles(userId)

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
    const isEditing = editHamster !== null
    if (!ownerId) {
      toast.error(
        isEditing
          ? "Edit failed"
          : "Sign in before adding a hamster profile.",
      )
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
    if (Object.keys(nextErrors).length > 0) {
      if (isEditing) toast.error("Edit failed")
      return
    }

    setIsSubmitting(true)
    let uploadedImagePath: string | null = null

    try {
      let imageUrl = imageRemoved ? null : editHamster?.image_url ?? null
      if (imageFile) {
        const uploadedImage = await uploadHamsterImage(ownerId, imageFile)
        uploadedImagePath = uploadedImage.path
        imageUrl = uploadedImage.url
      }

      const values: HamsterProfileValues = {
        hamster_name: hamsterName,
        species_breed: speciesBreed || null,
        weight_grams: weight,
        age_months: age,
        gender: gender || null,
        image_url: imageUrl,
      }
      if (editHamster) {
        const data = await updateHamsterProfile(
          ownerId,
          editHamster.id,
          values,
        )

        setHamsters((currentHamsters) =>
          currentHamsters.map((hamster) =>
            hamster.id === data.id ? data : hamster,
          ),
        )
      } else {
        const data = await createHamsterProfile(ownerId, values)

        setHamsters((currentHamsters) => [data, ...currentHamsters])
      }

      formRef.current?.reset()
      setImageFile(null)
      setImageRemoved(false)
      setErrors({})
      setIsDialogOpen(false)
      setEditHamster(null)
      toast.success(isEditing ? "Edit success" : "Add success")
    } catch (error) {
      if (uploadedImagePath) {
        try {
          await removeUploadedHamsterImage(uploadedImagePath)
        } catch (cleanupError) {
          console.error("Unable to remove the uploaded hamster image.", cleanupError)
        }
      }
      if (isEditing) {
        console.error("Unable to edit hamster profile.", error)
        toast.error("Edit failed")
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to add the hamster profile.",
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteHamster() {
    if (!ownerId || !editHamster) {
      toast.error("Delete failed")
      return
    }

    setIsDeleting(true)

    try {
      await deleteHamsterProfile(ownerId, editHamster.id)

      setHamsters((currentHamsters) =>
        currentHamsters.filter((hamster) => hamster.id !== editHamster.id),
      )
      setIsDeleteDialogOpen(false)
      setIsDialogOpen(false)
      setEditHamster(null)
      setImageFile(null)
      setImageRemoved(false)
      formRef.current?.reset()
      toast.success("Delete success")
    } catch (error) {
      console.error("Unable to delete hamster profile.", error)
      setIsDeleteDialogOpen(false)
      toast.error("Delete failed")
    } finally {
      setIsDeleting(false)
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
            setEditHamster(null)
            setErrors({})
            setImageFile(null)
            setImageRemoved(false)
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
            <HamsterCard
              key={hamster.id}
              hamster={hamster}
              onView={() => setViewHamster(hamster)}
              onEdit={() => {
                setEditHamster(hamster)
                setErrors({})
                setImageFile(null)
                setImageRemoved(false)
                setIsDialogOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <Dialog
        open={viewHamster !== null}
        onOpenChange={(open) => {
          if (!open) setViewHamster(null)
        }}
      >
        <DialogContent className="gap-4 p-4 sm:max-w-md sm:p-5">
          {viewHamster && (
            <>
              <DialogHeader className="gap-1">
                <DialogTitle className="text-center">
                  {viewHamster.hamster_name}
                </DialogTitle>
                <DialogDescription className="text-center text-xs">
                  Hamster profile details
                </DialogDescription>
              </DialogHeader>
              {viewHamster.image_url ? (
                <img
                  src={viewHamster.image_url}
                  alt={viewHamster.hamster_name}
                  className="max-h-56 w-full rounded-lg bg-muted object-cover"
                />
              ) : (
                <div className="flex h-36 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <PawPrint aria-hidden="true" className="size-10 opacity-40" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3 text-sm">
                <p className="min-w-0">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Name
                  </span>
                  <span className="block truncate font-medium">
                    {viewHamster.hamster_name}
                  </span>
                </p>
                <p className="min-w-0">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Species / breed
                  </span>
                  <span className="block truncate">
                    {viewHamster.species_breed || "Not specified"}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-muted-foreground">
                    Weight
                  </span>
                  <span>
                    {viewHamster.weight_grams == null
                      ? "Not set"
                      : `${viewHamster.weight_grams} g`}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-muted-foreground">
                    Age
                  </span>
                  <span>
                    {viewHamster.age_months == null
                      ? "Not set"
                      : `${viewHamster.age_months} months`}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-muted-foreground">
                    Gender
                  </span>
                  <span>{viewHamster.gender || "Not specified"}</span>
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setErrors({})
            setImageFile(null)
            setImageRemoved(false)
            setEditHamster(null)
            formRef.current?.reset()
          }
        }}
      >
        <DialogContent className="gap-3 p-4 sm:max-w-md sm:p-5">
          <DialogHeader className="gap-1">
            <DialogTitle>
              {editHamster ? "Edit hamster" : "Add a hamster"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editHamster
                ? "Update your hamster's details and photo."
                : "Add the details and an optional photo."}
            </DialogDescription>
          </DialogHeader>
          <form
            key={editHamster?.id ?? "new-hamster"}
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
                  defaultValue={editHamster?.hamster_name ?? ""}
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
                    defaultValue={editHamster?.species_breed ?? ""}
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
                  defaultValue={editHamster?.weight_grams ?? ""}
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
                  defaultValue={editHamster?.age_months ?? ""}
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
                    defaultValue={editHamster?.gender ?? ""}
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
                {selectedImagePreview ? (
                  <div className="flex w-full items-center gap-3">
                    <img
                      src={selectedImagePreview}
                      alt="Selected hamster preview"
                      className="size-14 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {imageFile?.name ?? "Current hamster photo"}
                      </p>
                      {imageFile && (
                        <p className="text-xs text-muted-foreground">
                          {(imageFile.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove selected photo"
                      onClick={(event) => {
                        event.stopPropagation()
                        setImageFile(null)
                        setImageRemoved(true)
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
            <DialogFooter
              className={
                editHamster
                  ? "flex-row justify-between pt-1"
                  : "pt-1"
              }
            >
              {editHamster ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting || isDeleting}
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isSubmitting || isDeleting}
                      onClick={() => setIsDeleteDialogOpen(true)}
                    >
                      Delete
                    </Button>
                    <Button type="submit" disabled={isSubmitting || isDeleting}>
                      {isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeleting) setIsDeleteDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete hamster profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {editHamster?.hamster_name ?? "this hamster"}
              </span>
              &apos;s profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button variant="outline" disabled={isDeleting}>
                  Cancel
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDeleteHamster()}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

export default HamsterProfile
