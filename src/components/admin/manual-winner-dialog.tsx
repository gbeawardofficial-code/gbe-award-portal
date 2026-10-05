"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createManualWinnerAction } from "@/server/actions/manual-winner-actions";

type WinnerCycle = { id: string; name: string };
type WinnerCategory = { id: string; cycleId: string; name: string };

export function ManualWinnerDialog({
  cycles,
  categories,
  preferredCycleId,
}: {
  cycles: WinnerCycle[];
  categories: WinnerCategory[];
  preferredCycleId?: string;
}) {
  const firstCycleId =
    cycles.find((cycle) => cycle.id === preferredCycleId)?.id ?? cycles[0]?.id ?? "";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cycleId, setCycleId] = useState(firstCycleId);
  const [categoryId, setCategoryId] = useState(
    categories.find((category) => category.cycleId === firstCycleId)?.id ?? "",
  );
  const [nomineeName, setNomineeName] = useState("");
  const [awardNomination, setAwardNomination] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const lock = useRef(false);
  const requestId = useRef("");
  const router = useRouter();
  const cycleCategories = categories.filter(
    (category) => category.cycleId === cycleId,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setOpen(value);
          if (value) requestId.current = crypto.randomUUID();
        }
      }}
    >
      <DialogTrigger render={<Button className="h-11 min-h-11" />}>
        <Award aria-hidden />
        Record winner
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record winner</DialogTitle>
          <DialogDescription>
            Staff-only record. No applicant declaration or email notification is created.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            setError("");
            try {
              const result = await createManualWinnerAction({
                requestId: requestId.current || crypto.randomUUID(),
                cycleId,
                categoryId,
                nomineeName,
                awardNomination,
                email,
                phone,
                businessWebsite: website,
              });
              if (result.ok) {
                requestId.current = crypto.randomUUID();
                setAwardNomination("");
                toast.success(
                  result.repeated
                    ? "Winner entry was already saved"
                    : `Winner recorded · ${result.reference}`,
                );
                router.refresh();
              } else {
                setError(result.message);
              }
            } catch {
              setError("The winner record could not be saved. Refresh and retry.");
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <Field>
              <FieldLabel htmlFor="manual-winner-cycle">Award cycle</FieldLabel>
              <select
                id="manual-winner-cycle"
                value={cycleId}
                onChange={(event) => {
                  const nextCycleId = event.target.value;
                  setCycleId(nextCycleId);
                  setCategoryId(
                    categories.find(
                      (category) => category.cycleId === nextCycleId,
                    )?.id ?? "",
                  );
                }}
                required
                className="h-11 min-h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-winner-category">
                Category
              </FieldLabel>
              <select
                id="manual-winner-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                className="h-11 min-h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                {cycleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-winner-name">
                Nominee or organisation
              </FieldLabel>
              <Input
                id="manual-winner-name"
                value={nomineeName}
                onChange={(event) => setNomineeName(event.target.value)}
                maxLength={180}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-winner-award">
                Award title
              </FieldLabel>
              <Textarea
                id="manual-winner-award"
                value={awardNomination}
                onChange={(event) => setAwardNomination(event.target.value)}
                maxLength={4000}
                minLength={10}
                rows={2}
                required
              />
            </Field>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="manual-winner-email">Email</FieldLabel>
                <Input
                  id="manual-winner-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={320}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-winner-phone">Phone</FieldLabel>
                <Input
                  id="manual-winner-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  maxLength={40}
                  minLength={5}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="manual-winner-website">Website</FieldLabel>
              <Input
                id="manual-winner-website"
                type="text"
                inputMode="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                maxLength={500}
                placeholder="https://example.com"
              />
            </Field>
            <FieldDescription>
              Zero-value waived payment. No proof or email notification is
              created.
            </FieldDescription>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="h-11 min-h-11 w-full"
              disabled={busy || cycleCategories.length === 0}
              loading={busy}
            >
              Record winner
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
