"use server";

import { createHash, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  applicationStatusHistory,
  applications,
  auditLogs,
  awardCategories,
  awardCycles,
  cycleSequences,
  payments,
} from "@/lib/db/schema";
import {
  manualWinnerPayloadFingerprint,
  manualWinnerSchema,
  normaliseWinnerPhone,
} from "@/lib/domain/manual-winner";
import { normaliseUrl } from "@/lib/validation/application";
import { hasPermission, requireStaff } from "@/server/dal/auth";
import { enforceRateLimit } from "@/server/security/rate-limit";

class ManualWinnerError extends Error {}

const winnerAction = "staff_winner_entry_created";
const winnerReason =
  "Staff-recorded award winner. Applicant declaration was not collected.";
const focNote = "FOC approved for staff-recorded winner entry.";

export async function createManualWinnerAction(raw: unknown) {
  try {
    const { profile, membership } = await requireStaff();
    if (
      membership.role !== "super_admin" ||
      !hasPermission(membership, "applications.release_outcome") ||
      !hasPermission(membership, "payments.verify")
    )
      throw new ManualWinnerError(
        "Only a super administrator with outcome and payment permissions can record a winner.",
      );
    await enforceRateLimit(`manual-winner:${profile.id}`, 12, 3600);
    const input = manualWinnerSchema.parse(raw);
    const email = input.email.trim().toLowerCase();
    const website = normaliseUrl(input.businessWebsite) || null;
    const phoneE164 = normaliseWinnerPhone(input.phone) ?? null;
    const fingerprint = createHash("sha256")
      .update(
        manualWinnerPayloadFingerprint({
          ...input,
          email,
          phone: phoneE164 ?? input.phone,
          businessWebsite: website ?? "",
        }),
      )
      .digest("hex");
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [cycle] = await tx
        .select()
        .from(awardCycles)
        .where(eq(awardCycles.id, input.cycleId))
        .for("update")
        .limit(1);
      if (!cycle) throw new ManualWinnerError("Award cycle not found.");
      if (["draft", "scheduled", "open"].includes(cycle.status))
        throw new ManualWinnerError(
          "Record winners only after nominations close and review begins.",
        );
      const now = new Date();
      if (!cycle.resultsReleaseAt || cycle.resultsReleaseAt > now)
        throw new ManualWinnerError(
          "The cycle's results release date must have passed before recording a winner.",
        );
      if (!cycle.currency)
        throw new ManualWinnerError(
          "Set the award cycle currency before recording a waived payment.",
        );

      const [priorRequest] = await tx
        .select({
          actorProfileId: auditLogs.actorProfileId,
          entityId: auditLogs.entityId,
          fingerprint: auditLogs.metadataRedacted,
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, winnerAction),
            eq(auditLogs.requestId, input.requestId),
          ),
        )
        .limit(1);
      if (priorRequest) {
        const priorMetadata =
          typeof priorRequest.fingerprint === "object" &&
          priorRequest.fingerprint !== null
            ? priorRequest.fingerprint
            : {};
        const priorFingerprint =
          "payloadFingerprint" in priorMetadata
            ? priorMetadata.payloadFingerprint
            : undefined;
        if (
          priorRequest.actorProfileId !== profile.id ||
          priorFingerprint !== fingerprint
        )
          throw new ManualWinnerError(
            "This request was already used for different winner details.",
          );
        const [existing] = await tx
          .select({ id: applications.id, reference: applications.reference })
          .from(applications)
          .where(eq(applications.id, priorRequest.entityId!))
          .limit(1);
        if (!existing)
          throw new ManualWinnerError(
            "The earlier winner record could not be found. Contact support.",
          );
        return { ...existing, repeated: true };
      }

      const [category] = await tx
        .select()
        .from(awardCategories)
        .where(
          and(
            eq(awardCategories.id, input.categoryId),
            eq(awardCategories.cycleId, cycle.id),
            eq(awardCategories.isActive, true),
          ),
        )
        .for("update")
        .limit(1);
      if (!category)
        throw new ManualWinnerError(
          "Choose an active category in the selected award cycle.",
        );
      const [duplicate] = await tx
        .select({ id: applications.id })
        .from(applications)
        .where(
          and(
            eq(applications.cycleId, cycle.id),
            eq(applications.categoryId, category.id),
            eq(applications.emailNormalised, email),
            eq(applications.awardNomination, input.awardNomination.trim()),
          ),
        )
        .limit(1);
      if (duplicate)
        throw new ManualWinnerError(
          "This winner and award title are already recorded in this cycle.",
        );

      let created: { id: string; reference: string } | undefined;
      for (let attempt = 0; attempt < 12 && !created; attempt += 1) {
        const reference = `GBE-${cycle.year}-${randomInt(100000, 1000000)}`;
        const [row] = await tx
          .insert(applications)
          .values({
            reference,
            recordOrigin: "staff_winner",
            cycleId: cycle.id,
            categoryId: category.id,
            workflowStatus: "winner",
            paymentStatus: "waived",
            accountAccessStatus: "not_created",
            nomineeName: input.nomineeName.trim(),
            awardNomination: input.awardNomination.trim(),
            businessWebsite: website,
            emailNormalised: email,
            emailDisplay: input.email.trim(),
            phoneE164,
            phoneDisplay: input.phone.trim(),
            categoryNameSnapshot: category.name,
            categoryCodeSnapshot: category.code,
            declarationAccepted: false,
            declarationTextSnapshot: cycle.declarationText,
            declarationVersion: cycle.declarationVersion,
            termsVersion: cycle.termsVersion,
            privacyVersion: cycle.privacyVersion,
            formSchemaVersion: cycle.formSchemaVersion,
            submittedAt: now,
            lastActivityAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing({ target: applications.reference })
          .returning({ id: applications.id, reference: applications.reference });
        created = row?.reference
          ? { id: row.id, reference: row.reference }
          : undefined;
      }
      if (!created) {
        const [racedDuplicate] = await tx
          .select({ id: applications.id })
          .from(applications)
          .where(
            and(
              eq(applications.cycleId, cycle.id),
              eq(applications.categoryId, category.id),
              eq(applications.emailNormalised, email),
              eq(applications.awardNomination, input.awardNomination.trim()),
            ),
          )
          .limit(1);
        if (racedDuplicate)
          throw new ManualWinnerError(
            "This winner and award title are already recorded in this cycle.",
          );
        throw new ManualWinnerError(
          "A unique nomination reference could not be allocated. Retry once.",
        );
      }

      await tx
        .insert(cycleSequences)
        .values({ cycleId: cycle.id, nextReceiptNumber: 2 })
        .onConflictDoUpdate({
          target: cycleSequences.cycleId,
          set: {
            nextReceiptNumber: sql`${cycleSequences.nextReceiptNumber} + 1`,
            updatedAt: now,
          },
        });
      const [sequence] = await tx
        .select({ next: cycleSequences.nextReceiptNumber })
        .from(cycleSequences)
        .where(eq(cycleSequences.cycleId, cycle.id));
      const receiptReference = `RCT-${cycle.year}-${String(Math.max(1, sequence.next - 1)).padStart(6, "0")}`;
      const [payment] = await tx
        .insert(payments)
        .values({
          applicationId: created.id,
          status: "waived",
          expectedAmountMinor: 0,
          amountMinor: 0,
          currency: cycle.currency,
          receiptReference,
          financeNote: focNote,
          verifiedBy: profile.id,
          verifiedAt: now,
          updatedAt: now,
        })
        .returning({ id: payments.id });
      await tx.insert(applicationStatusHistory).values({
        applicationId: created.id,
        fromStatus: null,
        toStatus: "winner",
        applicantLabel: "Award winner",
        internalReason: winnerReason,
        changedByProfileId: profile.id,
        effectiveAt: now,
      });
      await tx.insert(auditLogs).values([
        {
          actorProfileId: profile.id,
          actorType: "staff",
          action: winnerAction,
          entityType: "application",
          entityId: created.id,
          applicationId: created.id,
          afterRedacted: {
            recordOrigin: "staff_winner",
            workflowStatus: "winner",
            declarationAccepted: false,
          },
          reason: winnerReason,
          requestId: input.requestId,
          metadataRedacted: { payloadFingerprint: fingerprint },
        },
        {
          actorProfileId: profile.id,
          actorType: "staff",
          action: "manual winner payment waived",
          entityType: "payment",
          entityId: payment.id,
          applicationId: created.id,
          beforeRedacted: { status: null },
          afterRedacted: {
            status: "waived",
            amountMinor: 0,
            currency: cycle.currency,
          },
          reason: focNote,
        },
      ]);
      return { ...created, repeated: false };
    });

    revalidatePath("/admin/applications");
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return { ok: true as const, ...result };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof ManualWinnerError
          ? error.message
          : error instanceof z.ZodError
            ? (error.issues[0]?.message ?? "Check the winner details.")
            : "The winner record could not be saved. Refresh and try again.",
    };
  }
}
