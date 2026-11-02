import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Undo2, Loader2 } from "lucide-react";

export type RefundReason = "duplicate" | "overcharged" | "service_not_rendered" | "wrong_payment" | "other";
export const REASONS: { v: RefundReason; l: string }[] = [
  { v: "duplicate", l: "I was charged twice" },
  { v: "overcharged", l: "I was charged the wrong amount" },
  { v: "wrong_payment", l: "I paid for the wrong item" },
  { v: "service_not_rendered", l: "The item/service wasn't provided" },
  { v: "other", l: "Something else" },
];

export function RefundRequestDialog(props: {
  publicPayer?: boolean;
  onSubmit: (v: { reason_type: RefundReason; reason: string; matric_no?: string; contact?: string }) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<RefundReason>("duplicate");
  const [reason, setReason] = useState("");
  const [matric, setMatric] = useState("");
  const [contact, setContact] = useState("");

  const submit = async () => {
    setBusy(true);
    try {
      await props.onSubmit({ reason_type: type, reason, matric_no: matric || undefined, contact: contact || undefined });
      toast.success("Refund request sent. UniEgo will review it and keep you updated.");
      setOpen(false); setReason("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const valid = reason.trim().length >= 10 && (!props.publicPayer || (matric.trim().length >= 4 && contact.trim().length >= 5));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Undo2 className="h-4 w-4 mr-1" />Request refund</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a refund</DialogTitle>
          <DialogDescription>Tell us what went wrong. A UniEgo administrator reviews every request within 90 days of payment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>What happened?</Label>
            <Select value={type} onValueChange={(v) => setType(v as RefundReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REASONS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {props.publicPayer && (
            <>
              <div className="space-y-1.5"><Label>Matric number used to pay</Label><Input value={matric} onChange={(e) => setMatric(e.target.value)} maxLength={30} /></div>
              <div className="space-y-1.5"><Label>Email or phone to reach you</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} /></div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>Details</Label>
            <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="At least 10 characters" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!valid || busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
