'use client';

import Link from 'next/link';
import {
  Globe,
  BookOpen,
  Sparkles,
  MessageCircle,
  Mail,
  ExternalLink,
  Check,
  Clock
} from 'lucide-react';

const SERVICES = [
  {
    name: 'Jubilee Browser',
    description: 'Secure gateway to both public internet (with safeguards) and the Worldwide Bible Web',
    status: 'available' as const,
    href: 'https://JubileeBrowser.com',
    icon: Globe,
  },
  {
    name: 'Jubilee Bible',
    description: 'Scripture study with community insights and Bible Mode integration',
    status: 'available' as const,
    href: '/bible',
    icon: BookOpen,
  },
  {
    name: 'Inspire Web Spaces',
    description: 'Register and manage your private web spaces on the Worldwide Bible Web',
    status: 'available' as const,
    href: '/domains',
    icon: Globe,
  },
  {
    name: 'JubileeVerse',
    description: 'AI-powered ministry tools and content creation',
    status: 'coming-soon' as const,
    href: '#',
    icon: Sparkles,
  },
  {
    name: 'Round Table',
    description: 'Private community discussions and fellowship',
    status: 'coming-soon' as const,
    href: '#',
    icon: MessageCircle,
  },
  {
    name: 'Jubilee Email',
    description: 'Secure email at your Inspire Web Space domain',
    status: 'coming-soon' as const,
    href: '#',
    icon: Mail,
  },
];

export function SsoServices() {
  return (
    <section className="section bg-slate-50">
      <div className="container-xl">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="badge-primary mb-4">
            <span>One Account, Everything</span>
          </div>
          <h2 className="heading-lg mb-4">
            Your gateway to the Jubilee ecosystem
          </h2>
          <p className="text-body-lg max-w-2xl mx-auto">
            InspireWebSpaces.com is the central identity portal for the Worldwide Bible Web.
            One account gives you access to everything.
          </p>
        </div>

        {/* Services grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((service) => {
            const isAvailable = service.status === 'available';
            const isExternal = service.href.startsWith('http');
            const Icon = service.icon;

            const content = (
              <div className={`
                relative flex items-start gap-4 p-5 rounded-xl border transition-all
                ${isAvailable
                  ? 'bg-white border-slate-200 hover:border-jubilee-200 hover:shadow-soft cursor-pointer'
                  : 'bg-slate-100/50 border-slate-100 cursor-default'
                }
              `}>
                <div className={`
                  w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isAvailable ? 'bg-jubilee-50 text-jubilee-600' : 'bg-slate-200 text-slate-400'}
                `}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold text-sm ${isAvailable ? 'text-slate-900' : 'text-slate-500'}`}>
                      {service.name}
                    </h3>
                    {isExternal && isAvailable && (
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${isAvailable ? 'text-slate-600' : 'text-slate-400'}`}>
                    {service.description}
                  </p>
                  <div className="mt-2.5">
                    {isAvailable ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <Check className="h-3 w-3" />
                        Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
                        <Clock className="h-3 w-3" />
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );

            if (!isAvailable) {
              return <div key={service.name}>{content}</div>;
            }

            return (
              <Link
                key={service.name}
                href={service.href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
              >
                {content}
              </Link>
            );
          })}
        </div>

        {/* Architecture info */}
        <div className="mt-16 bg-white rounded-2xl border border-slate-200 p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="heading-sm mb-4">
                How Inspire Web Spaces work
              </h3>
              <p className="text-body mb-4">
                Inspire Web Spaces are private addressing constructs that exist exclusively within
                the Worldwide Bible Web. They are not DNS domains and are not publicly resolvable.
              </p>
              <p className="text-body mb-6">
                When you register a web space like <code className="text-sm bg-slate-100 px-2 py-0.5 rounded font-mono text-jubilee-600">inspire://yourchurch.church</code>,
                it becomes accessible only through Jubilee Browser, ensuring a safe, controlled environment.
              </p>
              <Link
                href="/about"
                className="link text-sm font-medium inline-flex items-center gap-1"
              >
                Learn more about the architecture
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-jubilee-100 text-jubilee-600 flex items-center justify-center">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Protocol</div>
                    <div className="font-mono text-sm text-slate-900">inspire://</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Network</div>
                    <div className="font-mono text-sm text-slate-900">Private (WWBW)</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Starting Price</div>
                    <div className="font-mono text-sm text-slate-900">$3/year</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
