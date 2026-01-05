'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DomainSearch } from '@/components/DomainSearch';
import { api, type TLD, type DomainSearchResult } from '@/lib/api';
import { getStoredAuth, initiateLogin } from '@/lib/auth';
import { Globe, Check, ArrowRight, CreditCard, Loader2 } from 'lucide-react';

export default function DomainsPage() {
  const searchParams = useSearchParams();
  const [tlds, setTlds] = useState<TLD[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DomainSearchResult | null>(null);
  const [years, setYears] = useState(1);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, accessToken } = getStoredAuth();

  useEffect(() => {
    api.getTLDs(true).then(({ tlds }) => setTlds(tlds)).catch(console.error);

    // Check for pre-selected domain from URL
    const name = searchParams.get('name');
    const tld = searchParams.get('tld');
    if (name && tld) {
      setSelectedDomain({
        name,
        tld,
        fullDomain: `${name}.${tld}`,
        available: true,
        status: 'available',
        pricePerYear: 300,
        requiresVerification: false,
      });
    }
  }, [searchParams]);

  const handleSelect = (domain: DomainSearchResult) => {
    if (!domain.available) return;
    setSelectedDomain(domain);
    setError(null);
  };

  const handleRegister = async () => {
    if (!selectedDomain) return;

    if (!user || !accessToken) {
      initiateLogin(`/domains?name=${selectedDomain.name}&tld=${selectedDomain.tld}`);
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      api.setToken(accessToken);
      const result = await api.registerDomain(
        selectedDomain.name,
        selectedDomain.tld,
        years,
        true
      );

      if (result.payment?.url) {
        window.location.href = result.payment.url;
      } else {
        window.location.href = `/domains/success?domain=${selectedDomain.fullDomain}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setIsRegistering(false);
    }
  };

  const totalPrice = selectedDomain ? (selectedDomain.pricePerYear * years) / 100 : 0;

  return (
    <>
      <Header />

      <main className="min-h-screen">
        {/* Hero */}
        <section className="py-12 px-4 bg-gradient-to-b from-jubilee-50 to-white">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Register Your Inspire Web Space
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Search for your perfect domain name and establish your presence
              on Inspire Web Spaces.
            </p>
          </div>
        </section>

        {/* Search and Registration */}
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto">
            {!selectedDomain ? (
              <DomainSearch onSelect={handleSelect} />
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {/* Selected Domain */}
                <div className="card">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Selected Domain</h2>

                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Check className="h-6 w-6 text-green-500" />
                        <span className="text-2xl font-bold text-gray-900">
                          {selectedDomain.fullDomain}
                        </span>
                      </div>
                      <span className="text-green-600 font-medium">Available</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedDomain(null)}
                    className="text-jubilee-600 hover:text-jubilee-700 text-sm"
                  >
                    ← Search for a different domain
                  </button>
                </div>

                {/* Registration Form */}
                <div className="card">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Complete Registration</h2>

                  {/* Years Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Registration Period
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 5].map((y) => (
                        <button
                          key={y}
                          onClick={() => setYears(y)}
                          className={`py-2 px-4 rounded-lg border-2 transition-colors ${
                            years === y
                              ? 'border-jubilee-500 bg-jubilee-50 text-jubilee-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {y} year{y > 1 ? 's' : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">
                        {selectedDomain.fullDomain} × {years} year{years > 1 ? 's' : ''}
                      </span>
                      <span className="font-medium">${totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="text-2xl font-bold text-jubilee-600">
                          ${totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleRegister}
                    disabled={isRegistering}
                    className="btn-primary w-full py-3 text-lg flex items-center justify-center space-x-2"
                  >
                    {isRegistering ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5" />
                        <span>{user ? 'Continue to Payment' : 'Sign In to Register'}</span>
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>

                  {!user && (
                    <p className="text-sm text-gray-500 text-center mt-3">
                      You&apos;ll be redirected to sign in with your Jubilee account.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Available TLDs */}
        {!selectedDomain && (
          <section className="py-12 px-4 bg-gray-50">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Available Domain Extensions
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {tlds.filter(t => !t.isRestricted).map((tld) => (
                  <div
                    key={tld.id}
                    className="bg-white rounded-lg p-4 border border-gray-200 hover:border-jubilee-300 transition-colors"
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <Globe className="h-4 w-4 text-jubilee-500" />
                      <span className="font-semibold text-gray-900">{tld.displayName}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{tld.description}</p>
                    <span className="text-sm font-medium text-jubilee-600">
                      ${(tld.pricePerYear / 100).toFixed(2)}/year
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
