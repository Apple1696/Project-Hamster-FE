# HamCare - Project Hamster FE

HamCare is a React prototype for hamster care appointments. Customers can keep
hamster profiles, book veterinary appointments, and review completed results.
Veterinarians can view their schedules, record examinations, and submit audio
recordings for transcription and AI-assisted analysis.

## Requirements

- Node.js and npm
- A configured Supabase project (hosted or local)
- Access to a veterinarian account and appointment availability for the
  veterinarian workflow

## Install and run

From the repository root:

```sh
npm install
npm run dev
```

Open the URL Vite prints in the terminal (by default,
`http://localhost:5173`). To check a production build, run `npm run build`.
To serve that build locally, run `npm run preview`.

## Configure Supabase

The browser client in `src/lib/supabase.ts` requires these values. Create a
`.env.local` file in the repository root and fill in the values from your
Supabase project's API settings:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

Restart the Vite server after changing environment variables. `.env.local` is
git-ignored. Vite exposes variables prefixed with `VITE_` to browser code, so
only use the Supabase publishable key here. Never put a Supabase secret or
service-role key, database password, or AI provider key in this file or any
frontend environment variable. The publishable key is not a substitute for
authorization: configure Row Level Security (RLS) and Storage policies in
Supabase for every table and bucket the app uses.

### Supabase project prerequisites

The frontend expects the Supabase backend to be provisioned separately. This
repository includes `supabase/config.toml`, but does not include database
migrations, seed data, or the Edge Function source. A fresh Supabase project
therefore needs its schema, policies, storage buckets, and audio-processing
function configured/deployed before all prototype flows can work.

The app reads and writes these main tables:

- `profiles` - account names and roles
- `hamsters` - customer hamster profiles
- `vet_availability` and `appointments` - bookable slots and appointment
  records
- `medical_records` - veterinarian examination findings and completed results
- `medical_record_media`, `transcriptions`, and `ai_analysis` - examination
  audio metadata, transcript, and AI analysis

The app also uses Supabase Storage buckets named `hamster-images` and `audio`.
The veterinarian audio flow stores the file in `audio` and requests a signed
URL; configure access policies to match that private-file workflow. Hamster
images are displayed using public URLs from `hamster-images`. The checked-in
Supabase config sets a 50 MiB storage file-size limit; verify the limit and
bucket policies for the Supabase environment you actually run.

For signup and email verification, enable email signups in Supabase Auth and
allow the redirect URL for the Vite origin, for example
`http://localhost:5173/verify-email`. Add the production verification URL too
when deploying. Customer signup uses the `customer` role and expects the
backend's profile-creation setup to create a matching `profiles` row.
Veterinarian accounts must be provisioned with the `veterinarian` role by an
authorized administrator; the app includes a veterinarian account creation
screen at `/create-vet-account`.

The veterinarian AI workflow invokes a Supabase Edge Function named
`process-medical-audio`. Deploy and configure that function, its AI/transcription
provider credentials, and its database access on the server side. The frontend
expects it to create transcription and analysis records and return their IDs;
the function itself is not included in this repository. Do not copy provider
secrets into the React app.

> The route guards in the frontend control the prototype's navigation, not
> backend authorization. Protect data and enforce customer/veterinarian access
> with Supabase RLS and Storage policies. Assign roles through a trusted
> server-side/admin process; user-editable auth metadata must not be the sole
> basis for backend permissions.

## User manual: reproduce the sample flows

Use separate customer and veterinarian accounts. A veterinarian needs
availability for the dates you intend to book. To see the complete cycle, make
the appointment as the customer, then sign in as the veterinarian assigned to
that appointment.

### Customer: create a hamster, book, and view results

1. Open `/signup`, create an account, and verify your email if confirmations
   are enabled. Sign in at `/login`.
2. Open **Settings > Hamster Profile** (`/settings/hamsterprofile`). Add a
   hamster with a name and any available breed, age, weight, gender, or image
   details, then save it.
3. Open **Medical Checkup** (`/medical-checkup`). Select the hamster, choose an
   available veterinarian and appointment slot, complete the booking details,
   review the summary, and confirm the appointment.
4. After the veterinarian completes the examination, open **Settings > Medical
   History** (`/settings/medical-history`), select the appointment, and review
   its results. Results are available once the appointment is completed and
   examination findings have been saved.

### Veterinarian: review, examine, and process audio

1. Sign in with an account provisioned with the veterinarian role.
2. Open the veterinarian schedule at `/veterinarian/view-schedule`, select the
   date, and open the appointment assigned to you.
3. Choose **Begin examination** to open the examination form and enter the
   initial findings. Do not submit the examination yet; uploading audio saves
   the draft record if needed.
4. Choose one supported audio file (`aac`, `amr`, `flac`, `m4a`, `mp3`, `oga`,
   `ogg`, `opus`, `wav`, or `webm`) and upload it. The current interface allows
   one audio recording per medical record; delete the existing recording
   before replacing it.
5. Choose the audio's transcription/AI analysis action. The app submits the
   recording metadata to `process-medical-audio`; when processing completes,
   inspect the transcript and generated analysis in the review interface.
   Correct the transcript or analysis as needed and save your review.
6. Submit the examination to save the findings and complete the appointment.
   The customer can then view the saved examination results in Medical History.

The AI output is assistance for the veterinarian to review, not a confirmed
diagnosis or a substitute for professional judgment. If no appointments appear,
confirm that the selected veterinarian has `vet_availability` entries and that
the signed-in account is the assigned veterinarian. If audio processing fails,
check the deployed Edge Function, its server-side provider configuration, and
its Supabase permissions.

## Main files

- `src/App.tsx` - application routes and customer/veterinarian route groups
- `src/lib/supabase.ts` - browser Supabase client and required environment
  variable names
- `src/services/AccountService.ts` - signup, login, and account role handling
- `src/services/HamsterProfileService.ts` - customer hamster profiles and
  hamster image storage
- `src/services/MedicalService.ts` - appointment availability, booking, and
  medical history
- `src/services/MedicalRecordService.ts` - examination records and customer
  results
- `src/services/MedicalRecordMediaService.ts` - veterinarian audio upload and
  storage
- `src/services/TranscriptionService.ts` - transcription request and transcript
  editing
- `src/services/AIAnalysisService.ts` - AI analysis retrieval and veterinarian
  review
- `src/pages/Customer/` - customer medical checkup, history, and settings
- `src/pages/Veterinarian/` - veterinarian schedule, appointment details, and
  examination workflow
- `supabase/config.toml` - Supabase local-development configuration

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run Oxlint |
