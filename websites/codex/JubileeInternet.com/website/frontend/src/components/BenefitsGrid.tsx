'use client';

import Link from 'next/link';
import { Shield, BookOpen, Key, Lock, Users, ArrowRight, Zap } from 'lucide-react';

const BENEFITS = [
  {
    id: 'infrastructure',
    icon: 'zap',
    title: 'Global Infrastructure',
    description: 'Built on a distributed network designed for reliability, performance, and scale. Your web space is always available.',
    cta: 'Learn More',
    href: '/about#infrastructure',
  },
  {
    id: 'proactive-safety',
    icon: 'shield',
    title: 'Proactive Safety',
    description: 'Safety is built into the foundation. Category-based allowlists and pre-navigation checks protect every request.',
    cta: 'Learn More',
    href: '/about#safety',
  },
  {
    id: 'privacy-first',
    icon: 'lock',
    title: 'Privacy First',
    description: 'Your data belongs to you. No tracking, no ads, no surveillance. Just a private network you can trust.',
    cta: 'Details',
    href: '/about#privacy',
  },
  {
    id: 'unified-identity',
    icon: 'key',
    title: 'Unified Identity',
    description: 'Single sign-on across the entire Jubilee ecosystem. One account for Browser, Bible, and all your web spaces.',
    cta: 'Get Started',
    href: '/auth/signup',
  },
  {
    id: 'scripture-aligned',
    icon: 'book',
    title: 'Scripture Aligned',
    description: 'Infrastructure designed around biblical principles. Content evaluated with transparent spiritual nutrition ratings.',
    cta: 'Learn More',
    href: '/about#ethics',
  },
  {
    id: 'community',
    icon: 'users',
    title: 'Global Community',
    description: 'Join churches, ministries, and believers worldwide. Build together on a network designed for the Kingdom.',
    cta: 'Explore',
    href: '/domains/tlds',
  },
];

const iconMap: Record<string, React.ReactNode> = {
  shield: <Shield className="h-5 w-5" />,
  book: <BookOpen className="h-5 w-5" />,
  key: <Key className="h-5 w-5" />,
  lock: <Lock className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  zap: <Zap className="h-5 w-5" />,
};

export function BenefitsGrid() {
  return (
    <section className="section bg-white">
      <div className="container-xl">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="badge-primary mb-4">
            <span>Why Inspire Web Spaces</span>
          </div>
          <h2 className="heading-lg mb-4">
            Infrastructure built for purpose
          </h2>
          <p className="text-body-lg max-w-2xl mx-auto">
            A private digital infrastructure designed for faith-based communities.
            Reliable, secure, and aligned with your values.
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.id}
              className="group p-6 rounded-xl border border-slate-200 bg-white hover:border-jubilee-200 hover:shadow-soft transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-lg bg-jubilee-50 text-jubilee-600 flex items-center justify-center mb-4 group-hover:bg-jubilee-100 transition-colors">
                {iconMap[benefit.icon]}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {benefit.title}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                {benefit.description}
              </p>
              <Link
                href={benefit.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-jubilee-600 hover:text-jubilee-700 transition-colors group/link"
              >
                <span>{benefit.cta}</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <div className="inline-flex flex-col sm:flex-row gap-4 items-center">
            <Link
              href="/auth/signup"
              className="btn-primary btn-lg gap-2"
            >
              <span>Create Free Account</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/domains"
              className="btn-secondary btn-lg"
            >
              Search Web Spaces
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            No credit card required · Get started in minutes
          </p>
        </div>
      </div>
    </section>
  );
}
