import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — UniEgo" },
      { name: "description", content: "Sign in or create your UniEgo account to pay dues, manage receipts and run your association workspace." },
      { property: "og:title", content: "Sign in — UniEgo" },
      { property: "og:description", content: "Access your UniEgo student or association account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      toast.success("Account created");
      navigate({ to: "/dashboard" });
      return;
    }
    setPendingEmail(email);
    toast.success("Account created — check your email to verify");
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setLoading(false); toast.error("Google sign-in failed"); return; }
    if (result.redirected) return;
    setLoading(false);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <aside className="hidden md:flex flex-col justify-between bg-royal text-royal-foreground p-10">
        <Link to="/"><Logo /></Link>
        <div>
          <h2 className="font-display text-4xl font-bold tracking-tight">Pay with ease.<br/>Stress free.</h2>
          <p className="mt-4 text-royal-foreground/80 max-w-md">UniEgo — premium campus payment infrastructure trusted by departments, faculties, and student organizations.</p>
        </div>
        <div className="text-xs text-royal-foreground/60">Powered by EMMTEC SECURITIES</div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8"><Link to="/"><Logo /></Link></div>

          {pendingEmail ? (
            <div className="space-y-4">
              <Alert>
                <MailCheck className="h-4 w-4" />
                <AlertTitle>Account created — verify your email</AlertTitle>
                <AlertDescription>
                  We sent a confirmation link to <span className="font-medium">{pendingEmail}</span>. Your account stays pending until you open that link. You can then sign in here.
                </AlertDescription>
              </Alert>
              <Button variant="outline" className="w-full" onClick={() => { setPendingEmail(null); setTab("signin"); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <div className="flex rounded-xl bg-secondary p-1 mb-6">
                <button onClick={() => setTab("signin")} className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Sign in</button>
                <button onClick={() => setTab("signup")} className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Create account</button>
              </div>

              {tab === "signin" ? (
                <form onSubmit={handleSignin} className="space-y-4">
                  <h1 className="font-display text-2xl font-bold">Welcome back</h1>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" disabled={loading} className="w-full bg-royal text-royal-foreground hover:opacity-90">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Sign in"}
                  </Button>
                  <div className="flex items-center justify-between text-sm">
                    <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">Forgot password?</Link>
                    <Link to="/association-login" className="text-muted-foreground hover:text-foreground">Association officer portal</Link>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  <h1 className="font-display text-2xl font-bold">Create your account</h1>
                  <div className="space-y-2"><Label>Full name</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" disabled={loading} className="w-full bg-royal text-royal-foreground hover:opacity-90">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Create account"}
                  </Button>
                </form>
              )}

              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                <div className="h-px bg-border flex-1"/>or<div className="h-px bg-border flex-1"/>
              </div>
              <Button type="button" variant="outline" disabled={loading} onClick={handleGoogle} className="w-full">
                Continue with Google
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
