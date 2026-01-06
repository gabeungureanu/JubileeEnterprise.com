import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  Globe,
  Shield,
  Users,
  Zap,
  BookOpen,
  Church,
  Lock,
  Eye,
  Heart,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Code,
  Home,
  GraduationCap,
  User
} from 'lucide-react';
import Link from 'next/link';
import {
  EXECUTIVE_SUMMARY,
  MOTIVATION,
  ARCHITECTURE,
  INSPIRE_WEB_SPACES,
  ETHICAL_FRAMEWORK,
  OPERATION_MODES,
  KINGDOM_IMPACT,
  USE_CASES,
  LONG_TERM_VISION,
} from '@/lib/content';

export default function AboutPage() {
  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className="py-20 px-4 bg-gradient-to-b from-jubilee-50 to-white">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center space-x-2 bg-jubilee-100 text-jubilee-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              <span>The Worldwide Bible Web</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {EXECUTIVE_SUMMARY.headline}
            </h1>
            <p className="text-xl text-jubilee-600 font-medium mb-4">
              {EXECUTIVE_SUMMARY.subtitle}
            </p>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              {EXECUTIVE_SUMMARY.description}
            </p>
          </div>
        </section>

        {/* Key Points */}
        <section className="py-12 px-4 bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {EXECUTIVE_SUMMARY.keyPoints.map((point, i) => (
                <div key={i} className="flex items-center space-x-3 p-4 rounded-xl bg-gray-50">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why WWBW */}
        <section id="motivation" className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              {MOTIVATION.title}
            </h2>
            <div className="prose prose-lg text-gray-600 space-y-6">
              {MOTIVATION.paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section id="architecture" className="py-16 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {ARCHITECTURE.title}
            </h2>
            <p className="text-lg text-gray-600 mb-12 max-w-3xl">
              {ARCHITECTURE.description}
            </p>

            {/* Advantages */}
            <div className="grid md:grid-cols-4 gap-6 mb-12">
              {ARCHITECTURE.advantages.map((adv, i) => (
                <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-2">{adv.title}</h3>
                  <p className="text-sm text-gray-600">{adv.description}</p>
                </div>
              ))}
            </div>

            {/* Dual World Model */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">{ARCHITECTURE.dualWorld.title}</h3>
                <p className="text-gray-600 mt-1">{ARCHITECTURE.dualWorld.description}</p>
              </div>
              <div className="grid md:grid-cols-2">
                {/* Public */}
                <div className="p-6 border-r border-gray-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">{ARCHITECTURE.dualWorld.public.title}</h4>
                  </div>
                  <ul className="space-y-2">
                    {ARCHITECTURE.dualWorld.public.points.map((point, i) => (
                      <li key={i} className="flex items-start space-x-2 text-sm text-gray-600">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Private */}
                <div className="p-6 bg-jubilee-50/50">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-jubilee-100 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-jubilee-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">{ARCHITECTURE.dualWorld.private.title}</h4>
                  </div>
                  <ul className="space-y-2">
                    {ARCHITECTURE.dualWorld.private.points.map((point, i) => (
                      <li key={i} className="flex items-start space-x-2 text-sm text-gray-600">
                        <span className="text-jubilee-500 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Inspire Web Spaces */}
        <section id="inspire-web-spaces" className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {INSPIRE_WEB_SPACES.title}
              </h2>
              <p className="text-xl text-jubilee-600 font-medium">
                {INSPIRE_WEB_SPACES.subtitle}
              </p>
            </div>

            <div className="prose prose-lg text-gray-600 max-w-3xl mx-auto mb-12">
              <p>{INSPIRE_WEB_SPACES.description}</p>
            </div>

            {/* Example Address */}
            <div className="bg-gray-900 rounded-2xl p-8 text-center mb-12">
              <p className="text-gray-400 text-sm mb-3">Example Inspire Web Space Address</p>
              <code className="text-2xl md:text-3xl text-jubilee-400 font-mono">
                {INSPIRE_WEB_SPACES.example.format}
              </code>
              <p className="text-gray-400 mt-4 text-sm max-w-xl mx-auto">
                {INSPIRE_WEB_SPACES.example.explanation}
              </p>
            </div>

            {/* Naming & Governance */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl p-8 border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {INSPIRE_WEB_SPACES.naming.title}
                </h3>
                <ul className="space-y-3">
                  {INSPIRE_WEB_SPACES.naming.points.map((point, i) => (
                    <li key={i} className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-xl p-8 border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {INSPIRE_WEB_SPACES.governance.title}
                </h3>
                <ul className="space-y-3">
                  {INSPIRE_WEB_SPACES.governance.points.map((point, i) => (
                    <li key={i} className="flex items-start space-x-3">
                      <Shield className="h-5 w-5 text-jubilee-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Modes of Operation */}
        <section className="py-16 px-4 bg-jubilee-900 text-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">{OPERATION_MODES.title}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {OPERATION_MODES.modes.map((mode, i) => {
                const icons: Record<string, React.ReactNode> = {
                  globe: <Globe className="h-8 w-8" />,
                  book: <BookOpen className="h-8 w-8" />,
                  sparkles: <Sparkles className="h-8 w-8" />,
                };
                return (
                  <div key={i} className="bg-jubilee-800/50 rounded-xl p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-jubilee-700 flex items-center justify-center mx-auto mb-4">
                      {icons[mode.icon]}
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{mode.name}</h3>
                    <p className="text-jubilee-200">{mode.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Ethical Framework */}
        <section id="ethics" className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {ETHICAL_FRAMEWORK.title}
            </h2>
            <p className="text-lg text-gray-600 mb-12">
              {ETHICAL_FRAMEWORK.description}
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {ETHICAL_FRAMEWORK.principles.map((principle, i) => {
                const icons = [
                  <Eye key="eye" className="h-6 w-6" />,
                  <Heart key="heart" className="h-6 w-6" />,
                  <Zap key="zap" className="h-6 w-6" />,
                  <Shield key="shield" className="h-6 w-6" />,
                  <Lock key="lock" className="h-6 w-6" />,
                ];
                const colors = [
                  'bg-blue-100 text-blue-600',
                  'bg-pink-100 text-pink-600',
                  'bg-yellow-100 text-yellow-600',
                  'bg-green-100 text-green-600',
                  'bg-purple-100 text-purple-600',
                ];
                return (
                  <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 text-center">
                    <div className={`w-12 h-12 rounded-full ${colors[i]} flex items-center justify-center mx-auto mb-3`}>
                      {icons[i]}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{principle.title}</h3>
                    <p className="text-xs text-gray-500">{principle.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-jubilee-50 rounded-xl p-6 border border-jubilee-100">
              <p className="text-jubilee-800 text-center italic">
                &ldquo;{ETHICAL_FRAMEWORK.statement}&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* Kingdom Impact */}
        <section id="vision" className="py-16 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {KINGDOM_IMPACT.title}
              </h2>
              <p className="text-xl text-jubilee-600 font-medium">
                {KINGDOM_IMPACT.subtitle}
              </p>
            </div>

            <p className="text-lg text-gray-600 text-center max-w-3xl mx-auto mb-12">
              {KINGDOM_IMPACT.description}
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {KINGDOM_IMPACT.benefits.map((benefit, i) => (
                <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                  <p className="text-gray-600">{benefit.description}</p>
                </div>
              ))}
            </div>

            <div className="bg-jubilee-900 rounded-2xl p-8 text-center text-white">
              <p className="text-xl">
                {KINGDOM_IMPACT.vision}
              </p>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
              {USE_CASES.title}
            </h2>
            <p className="text-lg text-gray-600 text-center mb-12">
              {USE_CASES.description}
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {USE_CASES.cases.map((useCase, i) => {
                const icons: Record<string, React.ReactNode> = {
                  family: <Home className="h-6 w-6" />,
                  church: <Church className="h-6 w-6" />,
                  school: <GraduationCap className="h-6 w-6" />,
                  ministry: <Users className="h-6 w-6" />,
                  individual: <User className="h-6 w-6" />,
                };
                return (
                  <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 text-center hover:border-jubilee-300 hover:shadow-md transition-all">
                    <div className="w-12 h-12 rounded-full bg-jubilee-100 text-jubilee-600 flex items-center justify-center mx-auto mb-3">
                      {icons[useCase.icon]}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{useCase.title}</h3>
                    <p className="text-sm text-gray-500">{useCase.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Long-term Vision */}
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {LONG_TERM_VISION.title}
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              {LONG_TERM_VISION.description}
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {LONG_TERM_VISION.items.map((item, i) => (
                <div key={i} className="flex items-center space-x-3 bg-white rounded-lg p-4 border border-gray-200">
                  <ArrowRight className="h-4 w-4 text-jubilee-500 flex-shrink-0" />
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>

            <p className="text-gray-600 italic text-center">
              {LONG_TERM_VISION.statement}
            </p>
          </div>
        </section>

        {/* Legal Notice */}
        <section className="py-12 px-4 bg-white border-t border-gray-100">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Legal & Regulatory Clarity</h3>
            <div className="prose prose-sm text-gray-600">
              <p>
                Because WWBW operates at the application layer and does not interfere with DNS, ISPs, or public routing,
                it avoids many regulatory risks associated with network-level interventions. Key characteristics include:
              </p>
              <ul className="grid sm:grid-cols-2 gap-2 list-none pl-0 mt-4">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>No impersonation of public websites or brands</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>No shadow DNS or alternate root systems</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Clear separation between private and public content</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>User-initiated access and opt-in usage</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-jubilee-900 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Join Inspire Web Spaces?
            </h2>
            <p className="text-xl text-jubilee-200 mb-8">
              Register your Inspire Web Space and become part of the worldwide Bible web.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/domains"
                className="inline-flex items-center justify-center space-x-2 px-8 py-4 bg-white text-jubilee-900 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
              >
                <span>Register an Inspire Web Space</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/browser"
                className="inline-flex items-center justify-center space-x-2 px-8 py-4 bg-jubilee-800 text-white font-semibold rounded-xl hover:bg-jubilee-700 transition-colors border border-jubilee-600"
              >
                <span>Download Jubilee Browser</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
