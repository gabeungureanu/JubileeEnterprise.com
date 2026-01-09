'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Globe,
  User,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { getStoredAuth, initiateLogin, logout, type User as UserType } from '@/lib/auth';
import { NAV_LINKS } from '@/lib/content';

export function HeaderNav() {
  const [user, setUser] = useState<UserType | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const { user } = getStoredAuth();
    setUser(user);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogin = () => {
    initiateLogin(window.location.pathname);
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm'
          : 'bg-white border-b border-slate-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-jubilee-600 flex items-center justify-center transition-transform group-hover:scale-105">
              <Globe className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-900 hidden sm:block">
              Inspire Web Spaces
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.primary.map((link) => {
              const isExternal = link.href.startsWith('http');

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <span>{link.label}</span>
                  {isExternal && <ExternalLink className="h-3 w-3 text-slate-400" />}
                </Link>
              );
            })}

            <Link
              href="/domains/tlds"
              className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <span>All Web Spaces</span>
            </Link>
          </nav>

          {/* Desktop Account Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span className="max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {NAV_LINKS.account.signIn}
                </button>
                <Link
                  href="/auth/signup"
                  className="flex items-center gap-1.5 px-4 py-2 bg-jubilee-600 text-white text-sm font-medium rounded-lg hover:bg-jubilee-700 transition-colors shadow-sm"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.primary.map((link) => {
                const isExternal = link.href.startsWith('http');

                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-2 px-3 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <span>{link.label}</span>
                    {isExternal && <ExternalLink className="h-3.5 w-3.5 text-slate-400" />}
                  </Link>
                );
              })}

              <Link
                href="/domains/tlds"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <span>All Web Spaces</span>
              </Link>

              <div className="border-t border-slate-100 my-2 pt-2">
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
                    >
                      <User className="h-4 w-4 text-slate-500" />
                      <span>Dashboard</span>
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 px-3 py-3 text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={() => {
                        handleLogin();
                        setIsMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Sign In
                    </button>
                    <Link
                      href="/auth/signup"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full px-4 py-2.5 text-sm bg-jubilee-600 text-white text-center rounded-lg hover:bg-jubilee-700 transition-colors font-medium"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
