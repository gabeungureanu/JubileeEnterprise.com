'use client';

import Link from 'next/link';
import { ArrowLeft, Globe, Search, CheckCircle, Clock, Info } from 'lucide-react';
import { HeaderNav } from '@/components/HeaderNav';
import { Footer } from '@/components/Footer';

interface WebSpace {
  space: string;
  shortcut: string | null;
  description: string;
  managed?: boolean;
}

// All web spaces organized by availability status
const UNMANAGED_WEB_SPACES: WebSpace[] = [
  // General Use
  { space: '.church', shortcut: '.chur', description: 'Churches and congregations' },
  { space: '.ministry', shortcut: '.mini', description: 'Ministry organizations' },
  { space: '.community', shortcut: '.comm', description: 'Faith communities' },
  { space: '.group', shortcut: null, description: 'Small groups and gatherings' },
  { space: '.faith', shortcut: null, description: 'Faith-based initiatives' },

  // Outreach & Mission
  { space: '.mission', shortcut: '.miss', description: 'Missions and outreach' },
  { space: '.gospel', shortcut: '.gosp', description: 'Gospel proclamation' },
  { space: '.messianic', shortcut: '.mess', description: 'Messianic communities' },
  { space: '.prayer', shortcut: '.pray', description: 'Prayer initiatives' },
  { space: '.discipleship', shortcut: '.disc', description: 'Discipleship programs' },
  { space: '.pastor', shortcut: '.past', description: 'Pastoral work' },

  // Family & Demographics
  { space: '.family', shortcut: '.faml', description: 'Family-focused content' },
  { space: '.youth', shortcut: null, description: 'Youth and young adults' },
  { space: '.children', shortcut: '.kids', description: 'Children-focused content' },
  { space: '.men', shortcut: null, description: 'Men-focused content' },
  { space: '.women', shortcut: null, description: 'Women-focused content' },

  // Worship & Teaching
  { space: '.worship', shortcut: '.wrsh', description: 'Worship content' },
  { space: '.praise', shortcut: '.praz', description: 'Praise and celebration' },
  { space: '.sermon', shortcut: '.srmn', description: 'Sermon archives' },
  { space: '.teaching', shortcut: '.tchr', description: 'Teaching content' },
  { space: '.music', shortcut: null, description: 'Christian music' },

  // Giving & Service
  { space: '.giving', shortcut: '.give', description: 'Generosity and giving' },
  { space: '.charity', shortcut: '.chty', description: 'Charitable works' },
  { space: '.stewardship', shortcut: '.stwd', description: 'Stewardship resources' },
  { space: '.serve', shortcut: null, description: 'Service and volunteering' },

  // Care & Support
  { space: '.coaching', shortcut: '.coch', description: 'Christian coaching' },
  { space: '.marriage', shortcut: '.marr', description: 'Marriage resources' },
  { space: '.recovery', shortcut: '.recv', description: 'Recovery programs' },
  { space: '.healing', shortcut: '.heal', description: 'Healing resources' },

  // Education
  { space: '.school', shortcut: '.schl', description: 'Christian schools' },
  { space: '.academy', shortcut: '.acad', description: 'Educational academies' },
  { space: '.library', shortcut: '.libr', description: 'Resource libraries' },
  { space: '.resources', shortcut: '.rsrc', description: 'General resources' },

  // Media & Content
  { space: '.media', shortcut: null, description: 'Christian media' },
  { space: '.video', shortcut: null, description: 'Video content' },
  { space: '.movie', shortcut: null, description: 'Christian films and movies' },
  { space: '.show', shortcut: null, description: 'Christian shows and series' },
  { space: '.animation', shortcut: '.anim', description: 'Christian animation' },
  { space: '.podcast', shortcut: '.podc', description: 'Podcasts and audio' },
  { space: '.radio', shortcut: null, description: 'Radio and broadcasting' },
  { space: '.news', shortcut: null, description: 'Faith-based news' },

  // Events
  { space: '.events', shortcut: '.evts', description: 'Events and gatherings' },
  { space: '.conference', shortcut: '.conf', description: 'Conferences' },
  { space: '.retreat', shortcut: '.rtrt', description: 'Retreats' },

  // Community
  { space: '.testimony', shortcut: '.test', description: 'Testimonies and stories' },
  { space: '.fellowship', shortcut: '.fell', description: 'Fellowship groups' },
  { space: '.persona', shortcut: null, description: 'Personal profiles' },

  // Denominational
  { space: '.catholic', shortcut: '.cath', description: 'Catholic churches' },
  { space: '.baptist', shortcut: '.bapt', description: 'Baptist churches' },
  { space: '.sbaptist', shortcut: '.sbap', description: 'Southern Baptist churches' },
  { space: '.methodist', shortcut: '.meth', description: 'Methodist churches' },
  { space: '.lutheran', shortcut: '.luth', description: 'Lutheran churches' },
  { space: '.pentecostal', shortcut: '.pent', description: 'Pentecostal churches' },
  { space: '.presbyterian', shortcut: '.pres', description: 'Presbyterian churches' },
  { space: '.anglican', shortcut: '.angl', description: 'Anglican churches' },
  { space: '.episcopal', shortcut: '.epis', description: 'Episcopal churches' },
  { space: '.reformed', shortcut: '.refo', description: 'Reformed churches' },
  { space: '.assembliesofgod', shortcut: '.aogd', description: 'Assemblies of God' },
  { space: '.churchofgod', shortcut: '.cogd', description: 'Church of God' },
  { space: '.churchofchrist', shortcut: '.coch', description: 'Church of Christ' },
  { space: '.nondenominational', shortcut: '.nden', description: 'Non-denominational' },
  { space: '.mennonite', shortcut: '.menn', description: 'Mennonite churches' },
  { space: '.nazarene', shortcut: '.naze', description: 'Nazarene churches' },
  { space: '.adventist', shortcut: '.advt', description: 'Adventist churches' },
  { space: '.quaker', shortcut: '.quak', description: 'Quaker meetings' },
  { space: '.orthodox', shortcut: '.orth', description: 'Orthodox churches' },
  { space: '.coptic', shortcut: '.copt', description: 'Coptic churches' },
  { space: '.wesleyan', shortcut: '.wesl', description: 'Wesleyan churches' },
  { space: '.foursquare', shortcut: '.fsqr', description: 'Foursquare churches' },
  { space: '.vineyard', shortcut: '.viny', description: 'Vineyard churches' },
  { space: '.calvarychapel', shortcut: '.calv', description: 'Calvary Chapel' },
  { space: '.holiness', shortcut: '.holy', description: 'Holiness churches' },
];

const MANAGED_WEB_SPACES: WebSpace[] = [
  // Core Jubilee
  { space: '.inspire', shortcut: '.insp', description: 'Official Jubilee spaces', managed: true },
  { space: '.jubilee', shortcut: '.jubi', description: 'Jubilee official spaces', managed: true },
  { space: '.verified', shortcut: '.vrfy', description: 'Verified organizations', managed: true },

  // Scripture & Publishing
  { space: '.bible', shortcut: null, description: 'Scripture and study resources', managed: true },
  { space: '.book', shortcut: null, description: 'Books and publishing', managed: true },

  // Leadership Roles
  { space: '.apostle', shortcut: '.apos', description: 'Apostolic leadership', managed: true },
  { space: '.prophet', shortcut: '.prph', description: 'Prophetic leadership', managed: true },
  { space: '.evangelist', shortcut: '.evan', description: 'Evangelistic leadership', managed: true },
  { space: '.shepherd', shortcut: '.shep', description: 'Shepherding leadership', managed: true },
  { space: '.teacher', shortcut: '.tchr', description: 'Teaching leadership', managed: true },

  // Sacred Names & Hebrew Roots
  { space: '.teshuvah', shortcut: '.tshv', description: 'Repentance and renewal', managed: true },
  { space: '.covenant', shortcut: '.covt', description: 'Covenant communities', managed: true },
  { space: '.yeshua', shortcut: null, description: 'Yeshua-centered content', managed: true },
  { space: '.yahuah', shortcut: null, description: 'Sacred name content', managed: true },
  { space: '.shaddai', shortcut: null, description: 'El Shaddai content', managed: true },
];

export default function TldsPage() {
  const totalSpaces = UNMANAGED_WEB_SPACES.length + MANAGED_WEB_SPACES.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-jubilee-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-jubilee-100 text-jubilee-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Globe className="h-4 w-4" />
            <span>The Worldwide Bible Web</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Available Web Spaces
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-4">
            Browse all {totalSpaces} available web spaces. Choose from self-service options
            or request access to Jubilee-managed spaces.
          </p>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            All web spaces start at just <span className="font-semibold text-jubilee-600">$3/year</span> and
            are accessible exclusively through Jubilee Browser.
          </p>
        </div>

        {/* Search CTA */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-10 max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-semibold text-gray-900 mb-1">Ready to register?</h3>
              <p className="text-sm text-gray-600">Search for your perfect Inspire Web Space</p>
            </div>
            <Link
              href="/domains"
              className="inline-flex items-center gap-2 px-6 py-3 bg-jubilee-600 text-white font-medium rounded-lg hover:bg-jubilee-700 transition-colors"
            >
              <Search className="h-4 w-4" />
              Search Now
            </Link>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <CheckCircle className="h-3 w-3" />
              Instant
            </span>
            <span className="text-gray-600">Register immediately</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              <Clock className="h-3 w-3" />
              Request
            </span>
            <span className="text-gray-600">Requires approval</span>
          </div>
        </div>

        {/* Section 1: Unmanaged Web Spaces */}
        <section className="mb-12">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Section Header */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Unmanaged Web Spaces
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Self-service registration. No approval required. You manage your own space.
                  </p>
                </div>
                <span className="text-sm text-gray-500 bg-white px-4 py-2 rounded-full border border-gray-200 font-medium">
                  {UNMANAGED_WEB_SPACES.length} available
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Web Space
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                      Shortcut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                      Access
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {UNMANAGED_WEB_SPACES.map((space) => (
                    <tr key={space.space} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-jubilee-600">
                          {space.space}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        {space.shortcut ? (
                          <span className="font-mono text-sm text-gray-500">{space.shortcut}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {space.description}
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <CheckCircle className="h-3 w-3" />
                          Instant
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/domains?tld=${space.space.slice(1)}`}
                          className="text-sm font-medium text-jubilee-600 hover:text-jubilee-700 transition-colors"
                        >
                          Register →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 2: Managed Web Spaces */}
        <section className="mb-12">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Section Header */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                    Managed Web Spaces
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Jubilee-approved, supported, and maintained. Request submission required.
                  </p>
                </div>
                <span className="text-sm text-gray-500 bg-white px-4 py-2 rounded-full border border-gray-200 font-medium">
                  {MANAGED_WEB_SPACES.length} available
                </span>
              </div>
            </div>

            {/* Info Banner */}
            <div className="bg-amber-50/50 px-6 py-4 border-b border-amber-100 flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>What does "Managed" mean?</strong> Managed web spaces are Jubilee-approved,
                actively supported, and maintained by Jubilee. Access requires submitting a request
                for review and approval. This ensures quality and alignment with community standards.
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Web Space
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                      Shortcut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                      Access
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {MANAGED_WEB_SPACES.map((space) => (
                    <tr key={space.space} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-amber-700">
                          {space.space}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        {space.shortcut ? (
                          <span className="font-mono text-sm text-gray-500">{space.shortcut}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {space.description}
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                          <Clock className="h-3 w-3" />
                          Request
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/domains/request?tld=${space.space.slice(1)}`}
                          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
                        >
                          Request →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-jubilee-600 to-jubilee-700 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-2">Ready to claim your web space?</h3>
            <p className="text-jubilee-100 mb-6 max-w-lg mx-auto">
              Join the Worldwide Bible Web and establish your presence on Inspire Web Spaces.
            </p>
            <Link
              href="/domains"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-jubilee-700 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Search className="h-5 w-5" />
              Search for Your Web Space
            </Link>
          </div>
        </div>

        {/* Info Notice */}
        <div className="mt-8 p-6 bg-gray-100 rounded-xl border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-jubilee-100 flex items-center justify-center text-jubilee-600 flex-shrink-0">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">About Inspire Web Spaces</h4>
              <p className="text-sm text-gray-600">
                Inspire Web Spaces are private addressing constructs that exist exclusively within the Worldwide Bible Web.
                They are not public DNS domains and are accessible only through Jubilee Browser using the <code className="bg-gray-200 px-1.5 py-0.5 rounded text-jubilee-700 font-mono text-xs">inspire://</code> protocol.
                This ensures a safe, faith-aligned digital environment separate from the public internet.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
