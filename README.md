# Project Hamster FE

## Supabase authentication setup

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` using the
project URL and publishable/anon key from your Supabase project settings. Never
put the Supabase service-role key in a frontend environment variable. The
`.env.example` file shows the required variable names.

Enable email confirmations in Supabase Auth and add
`http://localhost:5173/verify-email` (and your production URL) to the project's
allowed redirect URLs. The signup form submits the user's full name and sets
the `customer` role in auth metadata; your existing database trigger creates
the profile row.
