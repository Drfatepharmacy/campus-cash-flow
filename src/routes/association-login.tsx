import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/logo";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/association-login")({
  head: () => ({
    meta: [
      { title: "Association officer sign in — UniEgo" },
      { name: "description", content: "Officer portal for association Presidents, Treasurers, Financial Secretaries and Staff Advisers to manage their UniEgo workspace." },
      { property: "og:title", content: "Association officer sign in — UniEgo" },
      { property: "og:description", content: "Sign in to manage your association workspace, dues, finance and settlement account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssociationLoginPage,
});

function AssociationLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("Sign in failed", { description: toUserMessage(error) });
    toast.success("Signed in");
    navigate({ to: "/associations" });
  }

  async function google() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        setLoading(false);
        return toast.error("Couldn't sign in with Google", { description: toUserMessage(result.error, "Please try again, or use your email and password.") });
      }
      if (result.redirected) return;
    } catch (err) {
      setLoading(false);
      return toast.error("Couldn't sign in with Google", { description: toUserMessage(err, "Please try again, or use your email and password.") });
    }
    setLoading(false);
    navigate({ to: "/associations" });
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <aside className="hidden md:flex flex-col justify-between bg-royal text-royal-foreground p-10">
        <Link to="/"><Logo /></Link>
        <div>
          <h2 className="font-display text-4xl font-bold tracking-tight">Officer portal</h2>
          <p className="mt-4 text-royal-foreground/80 max-w-md">
            Presidents, Treasurers, Financial Secretaries and Staff Advisers manage members, dues, finance and settlement accounts here.
          </p>
        </div>
        <div className="text-xs text-royal-foreground/60">Every action is recorded in your association audit log.</div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="md:hidden"><Link to="/"><Logo /></Link></div>
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Association sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Use your UniEgo account. Your workspace access comes from your approved officer role.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" disabled={loading} className="w-full bg-royal text-royal-foreground hover:opacity-90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in to workspace"}
            </Button>
          </form>
          <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={google}>Continue with Google</Button>
          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">Forgot password?</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="text-muted-foreground hover:text-foreground">Create an account</Link>
          </div>
          <p className="text-xs text-muted-foreground">
            No association yet? <Link to="/associations" className="underline">Browse the directory</Link> or register a new one after signing in.
          </p>
        </div>
      </main>
    </div>
  );
}
