import { z } from "zod";

export const brandingPath = z.string().max(200).regex(/^[0-9a-f-]{36}\/(logo|banner)\/[0-9a-f-]{36}\.webp$/).nullable().optional();
export function assertBrandingPath(path: string | null | undefined, associationId: string, kind: "logo" | "banner") {
  if (path && (!brandingPath.safeParse(path).success || !path.startsWith(`${associationId}/${kind}/`))) {
    throw new Error("Please upload an image for this association.");
  }
}