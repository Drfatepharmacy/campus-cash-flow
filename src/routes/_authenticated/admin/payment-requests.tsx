import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCampuses, listFaculties, listDepartments, listPaymentRequests, createPaymentRequest, setPaymentRequestActive, deletePaymentRequest } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/charges";
import { toast } from "sonner";
import { Loader2, Pause, Play, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/payment-requests")({
  head: () => ({ meta: [{ title: "Payment requests — Admin" }] }),
  component: PaymentRequestsPage,
});

function PaymentRequestsPage() {
  const qc = useQueryClient();
  const fetchCampuses = useServerFn(listCampuses);
  const fetchFaculties = useServerFn(listFaculties);
  const fetchDepartments = useServerFn(listDepartments);
  const fetchPRs = useServerFn(listPaymentRequests);
  const create = useServerFn(createPaymentRequest);

  const campuses = useQuery({ queryKey: ["campuses"], queryFn: () => fetchCampuses() });
  const faculties = useQuery({ queryKey: ["faculties"], queryFn: () => fetchFaculties() });
  const departments = useQuery({ queryKey: ["departments"], queryFn: () => fetchDepartments() });
  const prs = useQuery({ queryKey: ["payment-requests"], queryFn: () => fetchPRs() });

  const [form, setForm] = useState({
    campus_id: "", title: "", description: "", base_amount: 0,
    target_faculty_id: "", target_department_id: "", target_level: "",
  });

  const m = useMutation({
    mutationFn: () => create({ data: {
      campus_id: form.campus_id,
      title: form.title,
      description: form.description || null,
      base_amount: Number(form.base_amount),
      target_faculty_id: form.target_faculty_id || null,
      target_department_id: form.target_department_id || null,
      target_level: form.target_level ? Number(form.target_level) : null,
      active: true,
    } }),
    onSuccess: () => { toast.success("Payment request created"); qc.invalidateQueries({ queryKey: ["payment-requests"] }); setForm({ ...form, title: "", description: "", base_amount: 0 }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const facs = (faculties.data ?? []).filter((f: any) => !form.campus_id || f.campus_id === form.campus_id);
  const deps = (departments.data ?? []).filter((d: any) => !form.target_faculty_id || d.faculty_id === form.target_faculty_id);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Payment requests</h1>
      <Card>
        <CardHeader><CardTitle>New payment request</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Campus</Label>
              <Select value={form.campus_id} onValueChange={(v) => setForm({ ...form, campus_id: v, target_faculty_id: "", target_department_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{(campuses.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base amount (₦)</Label>
              <Input type="number" min={1} required value={form.base_amount || ""} onChange={(e) => setForm({ ...form, base_amount: Number(e.target.value) })}/>
            </div>
            <div className="sm:col-span-2">
              <Label>Title</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/>
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/>
            </div>
            <div>
              <Label>Target faculty (optional)</Label>
              <Select value={form.target_faculty_id} onValueChange={(v) => setForm({ ...form, target_faculty_id: v, target_department_id: "" })}>
                <SelectTrigger><SelectValue placeholder="All faculties"/></SelectTrigger>
                <SelectContent>{facs.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target department (optional)</Label>
              <Select value={form.target_department_id} onValueChange={(v) => setForm({ ...form, target_department_id: v })}>
                <SelectTrigger><SelectValue placeholder="All departments"/></SelectTrigger>
                <SelectContent>{deps.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target level (optional)</Label>
              <Select value={form.target_level} onValueChange={(v) => setForm({ ...form, target_level: v })}>
                <SelectTrigger><SelectValue placeholder="All levels"/></SelectTrigger>
                <SelectContent>{[100,200,300,400,500,600,700].map((l) => <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={m.isPending || !form.campus_id || !form.title} className="bg-royal text-royal-foreground hover:opacity-90">
                {m.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}Create payment request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active requests</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {(prs.data ?? []).map((p: any) => (
              <li key={p.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium">{p.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.active ? <Badge className="bg-emerald text-white">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    {p.target_level && <Badge variant="outline">{p.target_level}L</Badge>}
                  </div>
                </div>
                <div className="font-display font-semibold">{formatNaira(Number(p.base_amount))}</div>
              </li>
            ))}
            {(prs.data ?? []).length === 0 && <li className="p-5 text-sm text-muted-foreground">No payment requests yet.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
