import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — UniEgo" },
      { name: "description", content: "Choose a new password for your UniEgo student or association officer account." },
      { property: "og:title", content: "Set a new password — UniEgo" },
      { property: "og:description", content: "Choose a new password for your UniEgo account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated — you are signed in");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-secondary/30">
      <div className="w-full max-w-md space-y-6">
        <Link to="/"><Logo /></Link>
        <h1 className="font-display text-2xl font-bold">Set a new password</h1>
        {!ready && (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Open this page from your reset email</AlertTitle>
            <AlertDescription>The link is single-use and short-lived. Request a new one if it has expired.</AlertDescription>
          </Alert>
        )}
        <form method="post" action="#" onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label>New password</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="space-y-2"><Label>Confirm password</Label><Input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <Button type="submit" disabled={loading || !ready} className="w-full bg-royal text-royal-foreground hover:opacity-90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </Button>
        </form>
        <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">Request a new link</Link>
      </div>
    </div>
  );
}
