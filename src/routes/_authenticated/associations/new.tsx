import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createAssociation, submitNomination, submitAssociationForReview, listAssociationRoles } from "@/lib/associations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ShieldCheck, Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/_authenticated/associations/new")({
  head: () => ({
    meta: [
      { title: "Register an association — UniEgo" },
      { name: "description", content: "Register your student association on UniEgo. Submit your details and proposed President for platform verification." },
      { property: "og:title", content: "Register an association — UniEgo" },
      { property: "og:description", content: "Submit your association for UniEgo verification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewAssociation,
});

const TYPES = ["departmental", "faculty", "institutional", "religious", "social", "professional", "sports", "other"] as const;

/** Proposed executive slate. Approval by UniEgo is what actually activates these roles. */
const OFFICERS: { key: string; label: string; required: boolean }[] = [
  { key: "president", label: "President / Head", required: true },
  { key: "treasurer", label: "Treasurer", required: false },
  { key: "financial_secretary", label: "Financial Secretary", required: false },
  { key: "staff_adviser", label: "Staff Adviser", required: false },
];

function NewAssociation() {
  const navigate = useNavigate();
  const create = useServerFn(createAssociation);
  const nominate = useServerFn(submitNomination);
  const submit = useServerFn(submitAssociationForReview);
  const fetchRoles = useServerFn(listAssociationRoles);
  const roles = useQuery({ queryKey: ["association-roles"], queryFn: () => fetchRoles() });

  const [step, setStep] = useState(1);
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null);
  const [form, setForm] = useState({
    name: "", short_name: "", type: "departmental", institution: "",
    official_email: "", official_phone: "", description: "", session_year: String(new Date().getFullYear()),
  });
  const [head, setHead] = useState({ nominee_name: "", nominee_email: "", notes: "" });
  const [officers, setOfficers] = useState<Record<string, { name: string; email: string }>>({});
  const setOfficer = (key: string, field: "name" | "email", value: string) =>
    setOfficers((prev) => ({ ...prev, [key]: { name: "", email: "", ...prev[key], [field]: value } }));

  const mCreate = useMutation({
    mutationFn: () =>
      create({
        data: {
          name: form.name.trim(),
          short_name: form.short_name.trim() || null,
          type: form.type as (typeof TYPES)[number],
          institution: form.institution.trim(),
          official_email: form.official_email.trim() || null,
          official_phone: form.official_phone.trim() || null,
          description: form.description.trim() || null,
          session_year: form.session_year.trim() || null,
        },
      }),
    onSuccess: (row: any) => { setCreated(row); setStep(2); toast.success("Association draft saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mNominate = useMutation({
    mutationFn: () => nominate({ data: { slug: created!.slug, role_key: "president", nominee_name: head.nominee_name.trim(), nominee_email: head.nominee_email.trim(), notes: head.notes.trim() || null } }),
    onSuccess: (r: any) => {
      setStep(3);
      toast.success(r?.nominee_has_account ? "President nominated" : "President nominated — ask them to sign up with that email");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mSubmit = useMutation({
    mutationFn: () => submit({ data: { association_id: created!.id } }),
    onSuccess: () => { toast.success("Submitted for verification"); navigate({ to: "/association/$slug", params: { slug: created!.slug } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const headRole = (roles.data ?? []).find((r: any) => r.is_head);

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-background border-b">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/associations" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Associations
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Register your association</h1>
          <p className="text-muted-foreground mt-1">Three steps. Verification and financial activation are decided by UniEgo afterwards.</p>
        </div>

        <ol className="flex items-center gap-2 text-sm">
          {["Association details", "Proposed President", "Submit for review"].map((label, i) => (
            <li key={label} className={`flex items-center gap-2 ${step > i ? "text-foreground" : "text-muted-foreground"}`}>
              <span className={`h-6 w-6 rounded-full grid place-items-center text-xs font-semibold ${step > i + 1 ? "bg-emerald-600 text-white" : step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
              {i < 2 && <span className="w-6 h-px bg-border" />}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Association details</CardTitle>
              <CardDescription>These details are checked against your institution during verification.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mCreate.mutate(); }}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="name">Association name</Label>
                    <Input id="name" required minLength={3} maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pharmaceutical Students Association" />
                  </div>
                  <div>
                    <Label htmlFor="short">Short name</Label>
                    <Input id="short" maxLength={30} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} placeholder="PANS" />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="inst">Institution</Label>
                    <Input id="inst" required maxLength={160} value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="University of Nigeria, Nsukka" />
                  </div>
                  <div>
                    <Label htmlFor="email">Official email</Label>
                    <Input id="email" type="email" required maxLength={255} value={form.official_email} onChange={(e) => setForm({ ...form, official_email: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="phone">Official phone</Label>
                    <Input id="phone" maxLength={20} value={form.official_phone} onChange={(e) => setForm({ ...form, official_phone: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="session">Session year</Label>
                    <Input id="session" maxLength={20} value={form.session_year} onChange={(e) => setForm({ ...form, session_year: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="desc">Description</Label>
                    <Textarea id="desc" maxLength={2000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" disabled={mCreate.isPending}>
                  {mCreate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save and continue
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Proposed executives</CardTitle>
              <CardDescription>
                Nomination alone grants nothing. UniEgo verifies the association and only then activates these roles — each with its own
                permissions. {headRole?.name ?? "President"} is required; the rest are optional and can be nominated later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); mNominate.mutate(); }}>
                {OFFICERS.map((o) => (
                  <div key={o.key} className="space-y-3 border rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{o.label}</p>
                      <span className="text-xs text-muted-foreground">{o.required ? "Required" : "Optional"}</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`${o.key}-n`}>Full name</Label>
                        <Input id={`${o.key}-n`} required={o.required} maxLength={120}
                          value={officers[o.key]?.name ?? ""}
                          onChange={(e) => setOfficer(o.key, "name", e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor={`${o.key}-e`}>Email used on UniEgo</Label>
                        <Input id={`${o.key}-e`} type="email" required={o.required} maxLength={255}
                          value={officers[o.key]?.email ?? ""}
                          onChange={(e) => setOfficer(o.key, "email", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
                <div>
                  <Label htmlFor="hnote">Supporting note or evidence</Label>
                  <Textarea id="hnote" rows={3} maxLength={1000} value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} placeholder="Election minutes, appointment letter reference, staff adviser confirmation…" />
                </div>
                <Button type="submit" disabled={mNominate.isPending}>
                  {mNominate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit nominations
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Submit for verification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  Your association will move to <strong>Under review</strong>. Collecting payments stays disabled until UniEgo
                  verifies the association and approves your President.
                </AlertDescription>
              </Alert>
              <Button onClick={() => mSubmit.mutate()} disabled={mSubmit.isPending}>
                {mSubmit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit for review
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
