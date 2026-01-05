'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const POPULAR_WEB_SPACES = [
  { tld: '.church', price: 300 },
  { tld: '.ministry', price: 300 },
  { tld: '.faith', price: 300 },
  { tld: '.community', price: 300 },
  { tld: '.prayer', price: 300 },
  { tld: '.worship', price: 300 },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function TldStrip() {
  return (
    <section className="py-6 px-4 bg-slate-50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
          <span className="text-sm text-slate-500 font-medium mr-1">Popular:</span>
          {POPULAR_WEB_SPACES.map((item) => (
            <Link
              key={item.tld}
              href={`/domains/search?query=${item.tld.slice(1)}&tld=${item.tld.slice(1)}`}
              className="group"
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-jubilee-300 hover:bg-jubilee-50 transition-all text-sm">
                <span className="font-semibold text-slate-700 group-hover:text-jubilee-700">
                  {item.tld}
                </span>
                <span className="text-slate-400">
                  {formatPrice(item.price)}/yr
                </span>
              </div>
            </Link>
          ))}
          <Link
            href="/domains/tlds"
            className="inline-flex items-center gap-1 text-sm text-jubilee-600 hover:text-jubilee-700 font-medium ml-1"
          >
            <span>View all 84+</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
