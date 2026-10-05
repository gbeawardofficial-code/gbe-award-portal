// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  manualWinnerPayloadFingerprint,
  manualWinnerSchema,
  normaliseWinnerPhone,
} from "@/lib/domain/manual-winner";

const validWinner = {
  requestId: "01911111-1111-7111-8111-111111111112",
  cycleId: "01911111-1111-7111-8111-111111111113",
  categoryId: "01911111-1111-7111-8111-111111111114",
  nomineeName: "Codezela Technologies",
  awardNomination: "Best Web Development Company of the Year",
  email: "sayuru@codezela.com",
  phone: "0768622302",
  businessWebsite: "www.codezela.com",
};

describe("manual winner entry", () => {
  it("accepts complete winner contact and award details", () => {
    expect(manualWinnerSchema.safeParse(validWinner).success).toBe(true);
  });

  it("requires all listed winner details and rejects invalid website URLs", () => {
    expect(
      manualWinnerSchema.safeParse({ ...validWinner, phone: "" }).success,
    ).toBe(false);
    expect(
      manualWinnerSchema.safeParse({
        ...validWinner,
        businessWebsite: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("normalizes email and whitespace in the idempotency fingerprint", () => {
    const details = {
      cycleId: validWinner.cycleId,
      categoryId: validWinner.categoryId,
      nomineeName: "Codezela Technologies",
      awardNomination: "Best Web Development Company of the Year",
      email: "sayuru@codezela.com",
      phone: "0768622302",
      businessWebsite: "www.codezela.com",
    };
    const first = manualWinnerPayloadFingerprint({
      ...details,
      nomineeName: " Codezela Technologies ",
      awardNomination: " Best Web Development Company of the Year ",
      email: "SAYURU@CODEZELA.COM",
    });
    const retry = manualWinnerPayloadFingerprint(details);
    expect(first).toBe(retry);
  });

  it("normalizes local Sri Lankan phones while retaining international numbers", () => {
    expect(normaliseWinnerPhone("0768622302")).toBe("+94768622302");
    expect(normaliseWinnerPhone("+9476862302")).toBe("+9476862302");
  });

  it("excludes request identifiers from the payload fingerprint", () => {
    const retry = {
      ...validWinner,
      requestId: "01911111-1111-7111-8111-111111111115",
    };
    expect(manualWinnerPayloadFingerprint(validWinner)).toBe(
      manualWinnerPayloadFingerprint(retry),
    );
  });
});
