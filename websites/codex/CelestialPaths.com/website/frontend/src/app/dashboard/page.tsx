'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { api, type Domain, type UserDomainsResponse } from '@/lib/api';
import { getStoredAuth, initiateLogin, type User } from '@/lib/auth';
import {
  Globe,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle,
  Settings,
  RefreshCw,
  Loader2,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<UserDomainsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { user, accessToken } = getStoredAuth();

    if (!user || !accessToken) {
      initiateLogin('/dashboard');
      return;
    }

    setUser(user);
    api.setToken(accessToken);

    api.getMyDomains()
      .then(setData)
      .catch((err) => {
        console.error('Failed to load domains:', err);
        if (err.message.includes('unauthorized')) {
          initiateLogin('/dashboard');
        }
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getStatusBadge = (domain: Domain) => {
    const days = getDaysUntilExpiry(domain.expiresAt);

    if (domain.status !== 'active') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          {domain.status}
        </span>
      );
    }

    if (days !== null && days <= 30) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expires in {days} days
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </span>
    );
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-jubilee-600" />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <section className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Domains</h1>
                <p className="text-gray-600 mt-1">
                  Welcome back, {user?.displayName || user?.email}
                </p>
              </div>
              <Link href="/domains" className="btn-primary mt-4 md:mt-0">
                <Plus className="h-4 w-4 mr-2" />
                Register New Domain
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        {data && (
          <section className="max-w-7xl mx-auto px-4 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-lg bg-jubilee-100 flex items-center justify-center">
                    <Globe className="h-6 w-6 text-jubilee-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{data.totalDomains}</p>
                    <p className="text-sm text-gray-500">Total Domains</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{data.activeDomains}</p>
                    <p className="text-sm text-gray-500">Active</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{data.expiringSoon}</p>
                    <p className="text-sm text-gray-500">Expiring Soon</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Domain List */}
        <section className="max-w-7xl mx-auto px-4 py-6">
          {data && data.domains.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Auto-Renew
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.domains.map((domain) => (
                    <tr key={domain.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Globe className="h-5 w-5 text-jubilee-500 mr-3" />
                          <span className="font-medium text-gray-900">{domain.fullDomain}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(domain)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(domain.expiresAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {domain.autoRenew ? (
                          <span className="text-green-600 text-sm">Enabled</span>
                        ) : (
                          <span className="text-gray-400 text-sm">Disabled</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/dashboard/domains/${domain.id}`}
                            className="text-jubilee-600 hover:text-jubilee-700"
                          >
                            <Settings className="h-4 w-4" />
                          </Link>
                          <button className="text-gray-400 hover:text-gray-600">
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No domains yet</h3>
              <p className="text-gray-500 mb-6">
                Register your first Inspire Web Space to get started.
              </p>
              <Link href="/domains" className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Register Your First Domain
              </Link>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}
