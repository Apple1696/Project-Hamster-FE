import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, Pencil, UserRound } from "lucide-react";
import { toast } from "react-toastify";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import {
  updateUserName,
  updateUserPassword,
} from "@/services/AccountService";

const Profile = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error) {
          toast.error(error.message || "Unable to load your profile.");
        } else if (data.user) {
          const name =
            typeof data.user.user_metadata.full_name === "string"
              ? data.user.user_metadata.full_name
              : "";
          setFullName(name);
          setNameDraft(name);
          setEmail(data.user.email ?? "");
        } else {
          toast.error("Unable to load your profile.");
        }
      } catch (error) {
        if (isMounted) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to load your profile.",
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  function startEditing() {
    setNameDraft(fullName);
    setPasswordDraft("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setNameDraft(fullName);
    setPasswordDraft("");
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const updatedName = nameDraft.trim();
    if (!updatedName) {
      toast.error("Name cannot be empty.");
      return;
    }

    const shouldUpdateName = updatedName !== fullName;
    const shouldUpdatePassword = passwordDraft.length > 0;
    if (!shouldUpdateName && !shouldUpdatePassword) {
      toast.error("Make a change before saving.");
      return;
    }

    setIsSaving(true);
    let nameWasUpdated = false;

    try {
      if (shouldUpdateName) {
        await updateUserName(updatedName);
        setFullName(updatedName);
        nameWasUpdated = true;
      }

      if (shouldUpdatePassword) {
        await updateUserPassword(passwordDraft);
      }

      toast.success("Profile updated successfully.");
      setIsEditing(false);
      setPasswordDraft("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Please try again.";
      toast.error(
        nameWasUpdated
          ? `Name updated, but the password could not be changed: ${message}`
          : `Unable to update your profile: ${message}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  const avatarInitial = fullName.trim().charAt(0).toUpperCase() || "?";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="grid gap-6">
        <Card>
          <CardContent className="flex items-center gap-5 py-6">
            <Avatar className="size-16 bg-primary text-xl font-semibold text-primary-foreground after:hidden">
              <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">
                {isLoading ? "Loading profile..." : fullName || "Your profile"}
              </h2>
              <p className="truncate text-sm text-muted-foreground">
                {email || "No email address"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account information</CardTitle>
            <CardDescription>
              Update your name or choose a new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="profile-name">Username</Label>
                <div className="relative">
                  <UserRound
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="profile-name"
                    autoComplete="name"
                    className="h-10 pl-10"
                    value={isEditing ? nameDraft : fullName}
                    onChange={(event) => setNameDraft(event.target.value)}
                    readOnly={!isEditing}
                    disabled={isLoading || isSaving}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="profile-password">Password</Label>
                <div className="relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="profile-password"
                    type="password"
                    autoComplete="new-password"
                    className="h-10 pl-10"
                    value={isEditing ? passwordDraft : "••••••••"}
                    placeholder={isEditing ? "Enter a new password" : undefined}
                    onChange={(event) => setPasswordDraft(event.target.value)}
                    readOnly={!isEditing}
                    disabled={isLoading || isSaving}
                  />
                </div>
                {isEditing && (
                  <p className="text-xs text-muted-foreground">
                    Leave blank to keep your current password.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {isEditing ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelEditing}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading || isSaving}>
                      {isSaving ? "Saving..." : "Save changes"}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={startEditing}
                    disabled={isLoading}
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Profile;
