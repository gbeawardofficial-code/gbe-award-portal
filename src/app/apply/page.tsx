import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { PublicHeader } from "@/components/shared/public-header";
import { PublicFooter } from "@/components/shared/public-footer";
import { NominationForm } from "@/components/forms/nomination-form";
import { ProgrammeDetailsButton } from "@/components/programme/programme-details-button";
import { RecognitionMarquee } from "@/components/recognition/recognition-marquee";
import { brand } from "@/config/brand";
import { getPublicNomination } from "@/server/dal/public-nomination";
import { getPublicPaymentInstructions } from "@/server/dal/settings";
import { genieAvailable } from "@/server/services/genie-client";
import {
  NominationOfferBanner,
  NominationPricingProvider,
} from "@/components/forms/nomination-offer";

const portalUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://access.gbeaward.com";

export async function generateMetadata(): Promise<Metadata> {
  const { cycle, unavailable } = await getPublicNomination();
  const year = cycle?.year ?? 2026;
  const title = unavailable
    ? `Nominations closed for ${year}`
    : `Apply for the ${brand.shortName} ${year}`;
  const description = unavailable
    ? `Nominations are now closed. Congratulations to our ${year} winners.`
    : `Submit a nomination for the ${brand.name} ${year} and showcase outstanding achievement, innovation and impact.`;
  return {
    title,
    description,
    alternates: { canonical: "/apply" },
    openGraph: {
      title,
      description,
      url: "/apply",
      type: "website",
      images: [
        {
          url: "/brand/hero-award-2026.webp",
          width: 800,
          height: 1300,
          alt: `GBE Awards ${year}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/brand/hero-award-2026.webp"],
    },
  };
}
export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const [{ categories, cycle, unavailable, pricing }, paymentInstructions] =
    await Promise.all([getPublicNomination(), getPublicPaymentInstructions()]);
  const supportEmail = cycle?.supportEmail ?? "info@gbeaward.com";
  const year = cycle?.year ?? 2026;
  const pricingCycle = {
    year,
    nominationFeeMinor: cycle?.nominationFeeMinor ?? null,
    currency: cycle?.currency ?? null,
  };
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${brand.officialSite}/#organization`,
        name: brand.name,
        url: brand.officialSite,
        logo: `${portalUrl}/brand/gbe-logo-full.png`,
        email: brand.supportEmail,
      },
      {
        "@type": "WebSite",
        "@id": `${portalUrl}/#website`,
        name: unavailable
          ? `${brand.shortName} ${year} nominations closed`
          : `${brand.shortName} nomination portal`,
        url: portalUrl,
        inLanguage: "en-GB",
        publisher: { "@id": `${brand.officialSite}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${portalUrl}/apply#webpage`,
        name: unavailable
          ? `Nominations closed for the GBE Awards ${year}`
          : `Apply for the GBE Awards ${year}`,
        url: `${portalUrl}/apply`,
        description: unavailable
          ? `Nominations are now closed. Congratulations to our ${year} winners.`
          : `Submit a nomination for the ${brand.name} ${year} and showcase outstanding achievement, innovation and impact.`,
        isPartOf: { "@id": `${portalUrl}/#website` },
        about: { "@id": `${brand.officialSite}/#organization` },
        inLanguage: "en-GB",
      },
    ],
  };
  return (
    <NominationPricingProvider cycle={pricingCycle} initialPricing={pricing}>
      <div className="flex min-h-svh flex-col">
        <PublicHeader compactSignIn />
        <NominationOfferBanner closed={unavailable} year={year} />
        <main id="main-content" className="flex-1">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
            }}
          />
          <section className="mx-auto max-w-[900px] px-5 pb-10 pt-12 md:pb-16 md:pt-18">
            <div className="mb-9 flex flex-col gap-6 border-b border-mist pb-9 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-antique-gold">
                  {unavailable ? `${year} awards` : `${year} nominations`}
                </p>
                <h1 className="page-heading max-w-2xl">
                  {unavailable
                    ? `Thank you for celebrating achievement`
                    : cycle?.heading ?? "GBE Awards Public Nomination"}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-graphite">
                  {unavailable
                    ? `Congratulations to everyone who helped celebrate outstanding achievement in ${year}.`
                    : cycle?.introCopy ??
                      "The nomination window is currently unavailable. Please contact the GBE Awards team for guidance."}
                </p>
                <a
                  className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-antique-gold underline-offset-4 hover:underline"
                  href={`mailto:${supportEmail}`}
                >
                  <Mail aria-hidden /> {supportEmail}
                </a>
              </div>
              {!unavailable ? (
                <div className="shrink-0 sm:pb-1">
                  <ProgrammeDetailsButton />
                </div>
              ) : null}
            </div>
            {!unavailable ? (
              <NominationForm
                cycleId={cycle?.id}
                cardEnabled={genieAvailable()}
                categories={categories}
                unavailable={false}
                paymentInstructions={paymentInstructions ?? undefined}
              />
            ) : null}
            <RecognitionMarquee />
          </section>
        </main>
        <PublicFooter />
      </div>
    </NominationPricingProvider>
  );
}
