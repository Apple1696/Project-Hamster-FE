import { supabase } from "@/lib/supabase";

export type Hamster = {
  id: string;
  hamster_name: string;
  species_breed: string | null;
  weight_grams: number | null;
  age_months: number | null;
  gender: string | null;
  image_url: string | null;
};

export type HamsterProfileValues = Omit<Hamster, "id">;

const HAMSTER_IMAGE_BUCKET = "hamster-images";
const HAMSTER_FIELDS =
  "id, hamster_name, species_breed, weight_grams, age_months, gender, image_url";

export async function getCurrentHamsterOwnerId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

export async function getHamsterProfiles(
  ownerId: string,
): Promise<Hamster[]> {
  const { data, error } = await supabase
    .from("hamsters")
    .select(HAMSTER_FIELDS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createHamsterProfile(
  ownerId: string,
  values: HamsterProfileValues,
): Promise<Hamster> {
  const { data, error } = await supabase
    .from("hamsters")
    .insert({ owner_id: ownerId, ...values })
    .select(HAMSTER_FIELDS)
    .single();

  if (error) throw error;
  return data;
}

export async function updateHamsterProfile(
  ownerId: string,
  hamsterId: string,
  values: HamsterProfileValues,
): Promise<Hamster> {
  const { data, error } = await supabase
    .from("hamsters")
    .update(values)
    .eq("id", hamsterId)
    .eq("owner_id", ownerId)
    .select(HAMSTER_FIELDS)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteHamsterProfile(
  ownerId: string,
  hamsterId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("hamsters")
    .delete()
    .eq("id", hamsterId)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Hamster profile was not found or could not be deleted.");
  }
}

export async function uploadHamsterImage(
  ownerId: string,
  file: File,
): Promise<{ path: string; url: string }> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(HAMSTER_IMAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(HAMSTER_IMAGE_BUCKET)
    .getPublicUrl(path);

  return { path, url: data.publicUrl };
}

export async function removeUploadedHamsterImage(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(HAMSTER_IMAGE_BUCKET)
    .remove([path]);

  if (error) throw error;
}