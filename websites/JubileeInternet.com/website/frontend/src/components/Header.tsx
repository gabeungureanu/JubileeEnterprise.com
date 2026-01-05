'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Globe, User, LogOut, Menu, X } from 'lucide-react';
import { getStoredAuth, initiateLogin, logout, type User as UserType } from '@/lib/auth';

export function Header() {
  const [user, setUser] = useState<UserType | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const { user } = getStoredAuth();
    setUser(user);
  }, []);

  const handleLogin = () => {
    initiateLogin(window.location.pathname);
  };

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Globe className="h-8 w-8 text-jubilee-600" />
            <span className="text-xl font-bold text-gray-900">
              Inspire<span className="text-jubilee-600">WebSpaces</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/domains" className="text-gray-600 hover:text-jubilee-600 transition-colors">
              Register Domain
            </Link>
            <Link href="/domains/search" className="text-gray-600 hover:text-jubilee-600 transition-colors">
              Search
            </Link>
            <Link href="/about" className="text-gray-600 hover:text-jubilee-600 transition-colors">
              About
            </Link>
          </nav>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-jubilee-600 transition-colors flex items-center space-x-1"
                >
                  <User className="h-4 w-4" />
                  <span>{user.displayName || user.email}</span>
                </Link>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button onClick={handleLogin} className="btn-primary">
                Sign In
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-gray-600"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <nav className="flex flex-col space-y-4">
              <Link href="/domains" className="text-gray-600 hover:text-jubilee-600">
                Register Domain
              </Link>
              <Link href="/domains/search" className="text-gray-600 hover:text-jubilee-600">
                Search
              </Link>
              <Link href="/about" className="text-gray-600 hover:text-jubilee-600">
                About
              </Link>
              {user ? (
                <>
                  <Link href="/dashboard" className="text-gray-600 hover:text-jubilee-600">
                    Dashboard
                  </Link>
                  <button onClick={logout} className="text-left text-gray-600 hover:text-jubilee-600">
                    Sign Out
                  </button>
                </>
              ) : (
                <button onClick={handleLogin} className="btn-primary w-full">
                  Sign In
                </button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
