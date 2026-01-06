'use client';

import Link from 'next/link';
import { Globe, ArrowRight } from 'lucide-react';

export function ImportantNotice() {
  return (
    <section className="section-tight bg-slate-900 text-white">
      <div className="container-lg">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-jubilee-600/20 mb-6">
            <Globe className="h-6 w-6 text-jubilee-400" />
          </div>
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            The Worldwide Bible Web
          </h3>
          <p className="text-slate-300 leading-relaxed max-w-2xl mx-auto mb-6">
            Inspire Web Spaces exist exclusively within the Worldwide Bible Web ecosystem.
            They are not public internet domains—they are accessible only through Jubilee Browser,
            ensuring a private, faith-aligned digital environment separate from the public web.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="https://JubileeBrowser.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-jubilee-600 text-white font-medium rounded-lg hover:bg-jubilee-500 transition-colors"
            >
              <span>Download Jubilee Browser</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-600 text-slate-300 font-medium rounded-lg hover:bg-slate-800 hover:border-slate-500 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
