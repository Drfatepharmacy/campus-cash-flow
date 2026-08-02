import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyReceipt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: receipt, error } = await context.supabase
      .from("receipts")
      .select("id, qr_token, issued_at, transaction:transactions(*, payment_request:payment_requests(title, description), student:profiles!transactions_student_id_profiles_fkey(full_name, matric_no, email))")
      .eq("qr_token", data.token)
      .maybeSingle();
    if (error) throw new Error(`Receipt lookup failed: ${error.message}`);
    if (!receipt) throw new Error("Receipt not found");
    return receipt;
  });
