import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, MailCheck } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — UniEgo" },
      { name: "description", content: "Request a secure password reset link for your UniEgo student or association officer account." },
      { property: "og:title", content: "Reset your password — UniEgo" },
      { property: "og:description", content: "Request a secure password reset link for your UniEgo account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Always show the same result — never reveal whether an account exists.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-secondary/30">
      <div className="w-full max-w-md space-y-6">
        <Link to="/"><Logo /></Link>
        <h1 className="font-display text-2xl font-bold">Forgot your password?</h1>
        {sent ? (
          <Alert>
            <MailCheck className="h-4 w-4" />
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>If an account exists for that address, we have sent a single-use reset link. It expires shortly.</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter the email on your account and we will send a secure reset link.</p>
            <div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" disabled={loading} className="w-full bg-royal text-royal-foreground hover:opacity-90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </form>
        )}
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Back to sign in</Link>
      </div>
    </div>
  );
}
