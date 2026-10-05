import { PublicNominationSkeleton } from "@/components/shared/loading-skeletons";
import { getPublicNomination } from "@/server/dal/public-nomination";
import { NominationsClosed } from "@/components/shared/nominations-closed";

export default async function Loading() {
  const { pricing, unavailable, cycle } = await getPublicNomination();
  if (unavailable)
    return (
      <NominationsClosed
        year={cycle?.year ?? 2026}
        supportEmail={cycle?.supportEmail ?? "info@gbeaward.com"}
      />
    );
  return (
    <PublicNominationSkeleton
      offerActive={pricing.phase === "active"}
      closed={unavailable}
    />
  );
}
