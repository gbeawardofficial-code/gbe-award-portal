import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normaliseWinnerPhone(value: string) {
  return parsePhoneNumberFromString(value, "LK")?.number;
}

export const manualWinnerSchema = z.object({
  requestId: z.uuid(),
  cycleId: z.uuid(),
  categoryId: z.uuid(),
  nomineeName: z.string().trim().min(2).max(180),
  awardNomination: z.string().trim().min(10).max(4000),
  email: z.email().max(320),
  phone: z
    .string()
    .trim()
    .min(5)
    .max(40)
    .refine((value) => !!normaliseWinnerPhone(value), "Enter a valid phone number."),
  businessWebsite: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (value) =>
        !value ||
        z.url().safeParse(/^https?:\/\//i.test(value) ? value : `https://${value}`).success,
      "Enter a valid website address.",
    ),
});

export type ManualWinnerInput = z.infer<typeof manualWinnerSchema>;

export function manualWinnerPayloadFingerprint(
  input: Omit<ManualWinnerInput, "requestId">,
) {
  return JSON.stringify({
    cycleId: input.cycleId,
    categoryId: input.categoryId,
    email: input.email.trim().toLowerCase(),
    nomineeName: input.nomineeName.trim(),
    awardNomination: input.awardNomination.trim(),
    phone: input.phone.trim(),
    businessWebsite: input.businessWebsite?.trim() ?? "",
  });
}
