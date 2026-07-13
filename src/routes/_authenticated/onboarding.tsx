import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { getMyProfile, updateMyProfile } from "@/lib/payments.functions";
import { listCampuses, listFaculties, listDepartments } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/brand/logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Complete profile — UniPay NG" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchCampuses = useServerFn(listCampuses);
  const fetchFaculties = useServerFn(listFaculties);
  const fetchDepartments = useServerFn(listDepartments);
  const update = useServerFn(updateMyProfile);

  const profile = useQuery({ queryKey: ["me"], queryFn: () => fetchProfile() });
  const campuses = useQuery({ queryKey: ["campuses"], queryFn: () => fetchCampuses() });
  const faculties = useQuery({ queryKey: ["faculties"], queryFn: () => fetchFaculties() });
  const departments = useQuery({ queryKey: ["departments"], queryFn: () => fetchDepartments() });

  const [form, setForm] = useState({
    full_name: "", phone: "", matric_no: "",
    campus_id: "" as string | null,
    faculty_id: "" as string | null,
    department_id: "" as string | null,
    level: 100,
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        full_name: profile.data.full_name ?? "",
        phone: profile.data.phone ?? "",
        matric_no: profile.data.matric_no ?? "",
        campus_id: profile.data.campus_id,
        faculty_id: profile.data.faculty_id,
        department_id: profile.data.department_id,
        level: profile.data.level ?? 100,
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => update({ data: {
      full_name: form.full_name,
      phone: form.phone || null,
      matric_no: form.matric_no || null,
      campus_id: form.campus_id || null,
      faculty_id: form.faculty_id || null,
      department_id: form.department_id || null,
      level: Number(form.level),
    } }),
    onSuccess: () => { toast.success("Profile saved"); navigate({ to: "/dashboard" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const facultiesOnCampus = (faculties.data ?? []).filter((f: any) => !form.campus_id || f.campus_id === form.campus_id);
  const deptsInFaculty = (departments.data ?? []).filter((d: any) => !form.faculty_id || d.faculty_id === form.faculty_id);

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <div className="mx-auto max-w-2xl px-6">
        <Link to="/dashboard"><Logo /></Link>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Complete your profile</CardTitle>
            <CardDescription>This determines which payments you're eligible for.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name"><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}/></Field>
                <Field label="Matric number"><Input value={form.matric_no} onChange={(e) => setForm({ ...form, matric_no: e.target.value.toUpperCase() })} placeholder="e.g. PHA2006960" pattern="[A-Z]{3}[0-9]{7}" title="3 faculty letters + 3-digit year (e.g. 200 for 2020) + 4-digit position, no slashes"/></Field>
                <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}/></Field>
                <Field label="Level">
                  <Select value={String(form.level)} onValueChange={(v) => setForm({ ...form, level: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[100,200,300,400,500,600,700].map((l) => <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Campus">
                  <Select value={form.campus_id ?? ""} onValueChange={(v) => setForm({ ...form, campus_id: v, faculty_id: null, department_id: null })}>
                    <SelectTrigger><SelectValue placeholder="Select campus"/></SelectTrigger>
                    <SelectContent>{(campuses.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Faculty">
                  <Select value={form.faculty_id ?? ""} onValueChange={(v) => setForm({ ...form, faculty_id: v, department_id: null })} disabled={!form.campus_id}>
                    <SelectTrigger><SelectValue placeholder="Select faculty"/></SelectTrigger>
                    <SelectContent>{facultiesOnCampus.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Department" className="sm:col-span-2">
                  <Select value={form.department_id ?? ""} onValueChange={(v) => setForm({ ...form, department_id: v })} disabled={!form.faculty_id}>
                    <SelectTrigger><SelectValue placeholder="Select department"/></SelectTrigger>
                    <SelectContent>{deptsInFaculty.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Button type="submit" disabled={save.isPending} className="bg-royal text-royal-foreground hover:opacity-90">
                {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
