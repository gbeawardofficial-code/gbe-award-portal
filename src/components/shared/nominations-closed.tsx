import { Mail } from "lucide-react";
import { PublicHeader } from "@/components/shared/public-header";
import { PublicFooter } from "@/components/shared/public-footer";

export function NominationsClosed({
  year = 2026,
  supportEmail = "info@gbeaward.com",
}: {
  year?: number;
  supportEmail?: string;
}) {
  return (
    <div className="flex min-h-svh flex-col pt-12">
      <aside
        aria-label="Nominations closed"
        className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-center bg-[#b42332] px-4 text-center text-sm font-semibold text-white"
      >
        {year} nominations are now closed.
      </aside>
      <PublicHeader compactSignIn belowRibbon />
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-5 py-16 sm:py-24"
      >
        <section className="w-full max-w-2xl text-center">
          <h1 className="page-heading text-balance">
            Congratulations to our {year} winners.
          </h1>
          <a
            className="mt-7 inline-flex min-h-11 max-w-full items-center gap-2 break-all text-sm text-antique-gold underline-offset-4 hover:underline"
            href={`mailto:${supportEmail}`}
          >
            <Mail className="size-4 shrink-0" aria-hidden />
            {supportEmail}
          </a>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
