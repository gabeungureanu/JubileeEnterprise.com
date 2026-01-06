'use client';

import { HeaderNav } from '@/components/HeaderNav';
import { Footer } from '@/components/Footer';
import { DomainSearchHero } from '@/components/DomainSearchHero';
import { TldStrip } from '@/components/TldStrip';
import { BenefitsGrid } from '@/components/BenefitsGrid';
import { SsoServices } from '@/components/SsoServices';
import { ImportantNotice } from '@/components/ImportantNotice';

export default function HomePage() {
  return (
    <>
      <HeaderNav />

      <main>
        {/* Hero with Domain Search */}
        <DomainSearchHero />

        {/* TLD Quick Pricing Strip */}
        <TldStrip />

        {/* Benefits / Why CelestialPaths */}
        <BenefitsGrid />

        {/* SSO Services Section */}
        <SsoServices />

        {/* Important Notice */}
        <ImportantNotice />
      </main>

      <Footer />
    </>
  );
}
