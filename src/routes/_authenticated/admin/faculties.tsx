import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCampuses, listFaculties, listDepartments, createFaculty, createDepartment } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/faculties")({
  head: () => ({ meta: [{ title: "Faculties & departments — Admin" }] }),
  component: FacultiesPage,
});

function FacultiesPage() {
  const qc = useQueryClient();
  const fetchCampuses = useServerFn(listCampuses);
  const fetchFaculties = useServerFn(listFaculties);
  const fetchDepartments = useServerFn(listDepartments);
  const addFaculty = useServerFn(createFaculty);
  const addDept = useServerFn(createDepartment);

  const campuses = useQuery({ queryKey: ["campuses"], queryFn: () => fetchCampuses() });
  const faculties = useQuery({ queryKey: ["faculties"], queryFn: () => fetchFaculties() });
  const departments = useQuery({ queryKey: ["departments"], queryFn: () => fetchDepartments() });

  const [facForm, setFacForm] = useState({ campus_id: "", name: "" });
  const [depForm, setDepForm] = useState({ faculty_id: "", name: "" });

  const mFac = useMutation({
    mutationFn: () => addFaculty({ data: facForm }),
    onSuccess: () => { toast.success("Faculty created"); setFacForm({ campus_id: "", name: "" }); qc.invalidateQueries({ queryKey: ["faculties"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDep = useMutation({
    mutationFn: () => addDept({ data: depForm }),
    onSuccess: () => { toast.success("Department created"); setDepForm({ faculty_id: "", name: "" }); qc.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Faculties & departments</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Add faculty</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); mFac.mutate(); }} className="space-y-3">
              <div>
                <Label>Campus</Label>
                <Select value={facForm.campus_id} onValueChange={(v) => setFacForm({ ...facForm, campus_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select campus"/></SelectTrigger>
                  <SelectContent>{(campuses.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Faculty name</Label>
                <Input required value={facForm.name} onChange={(e) => setFacForm({ ...facForm, name: e.target.value })}/>
              </div>
              <Button type="submit" disabled={mFac.isPending || !facForm.campus_id}>
                {mFac.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}Add faculty
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add department</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); mDep.mutate(); }} className="space-y-3">
              <div>
                <Label>Faculty</Label>
                <Select value={depForm.faculty_id} onValueChange={(v) => setDepForm({ ...depForm, faculty_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select faculty"/></SelectTrigger>
                  <SelectContent>{(faculties.data ?? []).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department name</Label>
                <Input required value={depForm.name} onChange={(e) => setDepForm({ ...depForm, name: e.target.value })}/>
              </div>
              <Button type="submit" disabled={mDep.isPending || !depForm.faculty_id}>
                {mDep.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}Add department
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Faculties</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {(faculties.data ?? []).map((f: any) => (
                <li key={f.id} className="px-5 py-3 flex justify-between text-sm">
                  <span className="font-medium">{f.name}</span>
                  <span className="text-muted-foreground">{f.campus?.name}</span>
                </li>
              ))}
              {(faculties.data ?? []).length === 0 && <li className="p-5 text-sm text-muted-foreground">None yet.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {(departments.data ?? []).map((d: any) => (
                <li key={d.id} className="px-5 py-3 flex justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground">{d.faculty?.name}</span>
                </li>
              ))}
              {(departments.data ?? []).length === 0 && <li className="p-5 text-sm text-muted-foreground">None yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
