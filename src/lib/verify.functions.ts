import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type VerifyResult =
  | { valid: false }
  | {
      valid: true; receipt_id: string; issued_at: string; reference: string; title: string;
      amount: number; status: string; paid_at: string | null; student_name: string; matric_no: string;
    };

/** Public verification — no auth, no service key. Database returns a masked projection only. */
export const verifyReceipt = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data }): Promise<VerifyResult> => {
    const { publicDb } = await import("@/lib/public-db.server");
    const { data: res, error } = await publicDb().rpc("verify_public_receipt", { _token: data.token });
    if (error || !res || !(res as any).valid) return { valid: false };
    const r = res as any;
    return { ...r, amount: Number(r.amount) } as VerifyResult;
  });
