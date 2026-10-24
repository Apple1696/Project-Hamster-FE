import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkVerifiedSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          toast.error(error.message);
          return;
        }

        if (isMounted && data.session) {
          toast.success("Email verified successfully.");
          navigate("/home", { replace: true });
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to check your verification status.",
        );
      }
    }

    void checkVerifiedSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Verification email sent. Check your inbox.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to resend the verification email.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <MailCheck className="mb-2 size-10 text-primary" aria-hidden="true" />
          <CardTitle className="text-xl font-semibold">
            Verify your email
          </CardTitle>
          <CardDescription className="text-sm">
            We sent a confirmation link to your email address. Open the link to
            finish creating your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleResend} className="space-y-3">
            <Input
              type="email"
              aria-label="Email address"
              placeholder="m@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Button
              className="w-full"
              type="submit"
              variant="outline"
              disabled={isResending}
            >
              {isResending ? "Sending..." : "Resend verification email"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Already verified?{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
