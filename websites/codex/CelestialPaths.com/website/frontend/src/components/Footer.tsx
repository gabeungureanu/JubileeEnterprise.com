'use client';

import Link from 'next/link';
import { Globe, ExternalLink } from 'lucide-react';

const FOOTER_LINKS = {
  product: {
    title: 'Product',
    links: [
      { label: 'Web Spaces', href: '/domains' },
      { label: 'Browse All', href: '/domains/tlds' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Search', href: '/domains/search' },
    ],
  },
  ecosystem: {
    title: 'Ecosystem',
    links: [
      { label: 'Jubilee Browser', href: 'https://JubileeBrowser.com', external: true },
      { label: 'Jubilee Bible', href: '/bible' },
      { label: 'JubileeVerse', href: '#', comingSoon: true },
      { label: 'Round Table', href: '#', comingSoon: true },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'API Reference', href: '/docs/api' },
      { label: 'Help Center', href: '/help' },
      { label: 'Status', href: '/status' },
    ],
  },
  company: {
    title: 'Company',
    links: [
      { label: 'About WWBW', href: '/about' },
      { label: 'Our Vision', href: '/about#vision' },
      { label: 'Ethics', href: '/about#ethics' },
      { label: 'Contact', href: '/contact' },
    ],
  },
};

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-jubilee-600 flex items-center justify-center">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-white">
                Inspire Web Spaces
              </span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed mb-5 max-w-xs">
              Private web spaces on the Worldwide Bible Web. A faith-aligned digital infrastructure for trust, safety, and purpose.
            </p>
            <p className="text-sm text-slate-500">
              Accessible only via{' '}
              <Link
                href="https://JubileeBrowser.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-jubilee-400 hover:text-jubilee-300 transition-colors"
              >
                Jubilee Browser
              </Link>
            </p>
          </div>

          {/* Link Columns */}
          {Object.values(FOOTER_LINKS).map((column) => (
            <div key={column.title}>
              <h3 className="text-white font-semibold mb-4 text-sm">
                {column.title}
              </h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => {
                  const isExternal = 'external' in link && link.external;
                  const isComingSoon = 'comingSoon' in link && link.comingSoon;

                  if (isComingSoon) {
                    return (
                      <li key={link.label}>
                        <span className="text-sm text-slate-600 inline-flex items-center">
                          {link.label}
                          <span className="ml-1.5 text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                            Soon
                          </span>
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        target={isExternal ? '_blank' : undefined}
                        rel={isExternal ? 'noopener noreferrer' : undefined}
                        className="text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
                      >
                        <span>{link.label}</span>
                        {isExternal && <ExternalLink className="h-3 w-3 opacity-50" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm">
              <p className="text-slate-500">
                © 2025 Inspire Web Spaces
              </p>
              <span className="hidden sm:inline text-slate-700">·</span>
              <p className="text-slate-600 text-center md:text-left">
                Part of the Worldwide Bible Web
              </p>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Terms
              </Link>
              <Link href="/contact" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
