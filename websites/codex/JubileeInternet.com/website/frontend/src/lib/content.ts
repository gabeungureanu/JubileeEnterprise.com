// Content constants for Inspire Web Spaces Portal
// All text content is centralized here for easy updates

export const SITE_NAME = 'Inspire Web Spaces';
export const SITE_SHORT_NAME = 'IWS';
export const SITE_DOMAIN = 'InspireWebSpaces.com';
export const SITE_TAGLINE = 'A new Worldwide Bible Web for faith-based communities';
export const SITE_TAGLINE_EXTENDED = 'A faith-aligned, private internet architecture for trust, safety, and purpose';

// Executive Summary Content
export const EXECUTIVE_SUMMARY = {
  headline: 'The Worldwide Bible Web',
  subtitle: 'A Faith-Aligned, Private Internet Architecture for Trust, Safety, and Purpose',
  description: `The Worldwide Bible Web (WWBW) is a private, application-layer internet architecture designed to provide a safer, values-aligned digital environment without altering, replacing, or interfering with the public internet. WWBW operates alongside the existing internet rather than in competition with it, offering users a curated, transparent, and consent-based experience that prioritizes spiritual well-being, community trust, and ethical digital stewardship.`,
  keyPoints: [
    'Private routing and allowlisted addressing',
    'Safe-browsing enforcement built-in',
    'Faith-oriented organization and governance',
    'Operates alongside—not against—the public internet',
  ],
};

// Why WWBW Exists
export const MOTIVATION = {
  title: 'Why the Worldwide Bible Web?',
  paragraphs: [
    `The modern internet was designed to be open, neutral, and globally accessible. While this openness has enabled unprecedented innovation and connectivity, it has also produced unintended consequences: pervasive exposure to harmful content, erosion of trust, algorithmic manipulation, and environments that are often hostile to faith-based values.`,
    `For many families, churches, and faith-driven organizations, the challenge is not simply access to information but formation. Digital spaces shape habits, beliefs, attention, and moral imagination. Current tools—such as content filters, DNS blockers, or supervised accounts—offer partial solutions but remain fundamentally reactive and fragmented.`,
    `WWBW emerges from the recognition that faith-based users need more than restriction; they need structure, clarity, and purpose. The Worldwide Bible Web is not an attempt to censor the world or withdraw from society, but to create a parallel, intentional digital space where faith, learning, community, and trust can flourish.`,
  ],
};

// Technical Architecture
export const ARCHITECTURE = {
  title: 'Application-Layer Design',
  description: 'WWBW operates entirely at the application level. This means all behavior—routing, resolution, filtering, and presentation—is controlled by the Jubilee client rather than the operating system, ISP, or global DNS.',
  advantages: [
    { title: 'Legal Clarity', description: 'Full compliance with internet governance standards' },
    { title: 'User Consent', description: 'Transparent, opt-in participation at every level' },
    { title: 'Platform Independence', description: 'Works across devices and operating systems' },
    { title: 'Rapid Iteration', description: 'Governance updates without infrastructure changes' },
  ],
  dualWorld: {
    title: 'Dual-World Model',
    description: 'WWBW intentionally distinguishes between two environments:',
    public: {
      title: 'Public Internet Access',
      points: [
        'Accessed via standard https:// URLs',
        'Subject to safe-browsing enforcement',
        'Clearly labeled as external content',
      ],
    },
    private: {
      title: 'Worldwide Bible Web (WWBW)',
      points: [
        'Accessed via inspire:// protocol',
        'Routed exclusively within Jubilee ecosystem',
        'Governed by explicit allowlists',
      ],
    },
  },
};

// Inspire Web Spaces
export const INSPIRE_WEB_SPACES = {
  title: 'Inspire Web Spaces',
  subtitle: 'Your Address on the Worldwide Bible Web',
  description: `Within the Worldwide Bible Web, content is organized using Inspire Web Spaces. These are private addressing constructs that function similarly to namespaces. They are not domains, not DNS records, and not publicly resolvable. They exist solely within the WWBW environment and are interpreted only by the Jubilee Browser.`,
  example: {
    format: 'inspire://example.church',
    explanation: 'This address does not point to a public website. Instead, it instructs the Jubilee Browser to resolve the request internally using its directory, policy engine, and routing logic.',
  },
  naming: {
    title: 'Intentional Naming',
    points: [
      'Human-readable and meaningful',
      'Theologically neutral across denominations',
      'Distinct from public TLDs',
      'Non-conflicting with existing standards',
    ],
  },
  governance: {
    title: 'Governance & Trust',
    points: [
      'No public TLD overlap—prevents confusion and trademark risk',
      'Allowlist-only model—undefined spaces fail safely',
      'Clear user feedback when content is restricted',
      'Denominational representation without doctrinal hierarchy',
    ],
  },
};

// Ethical Framework
export const ETHICAL_FRAMEWORK = {
  title: 'Ethical Framework',
  description: 'The Worldwide Bible Web is guided by a clear ethical framework rooted in:',
  principles: [
    { title: 'Truthfulness', description: 'Transparency in all operations and communications' },
    { title: 'Human Dignity', description: 'Respect for every user and their God-given worth' },
    { title: 'Stewardship', description: 'Responsible management of attention and influence' },
    { title: 'Protection', description: 'Safeguarding children and vulnerable users' },
    { title: 'Consent', description: 'Voluntary participation and informed choice' },
  ],
  statement: 'WWBW does not seek to manipulate behavior covertly or replace personal responsibility. Instead, it aims to provide an environment where wise choices are easier to make.',
};

// Modes of Operation
export const OPERATION_MODES = {
  title: 'Modes of Operation',
  modes: [
    {
      name: 'Internet Mode',
      description: 'Access to the public web with safeguards enabled',
      icon: 'globe',
    },
    {
      name: 'Bible Mode',
      description: 'Scripture-first experience with curated resources',
      icon: 'book',
    },
    {
      name: 'Inspire Web Spaces',
      description: 'Fully private, internally resolved content',
      icon: 'sparkles',
    },
  ],
};

// Kingdom Impact
export const KINGDOM_IMPACT = {
  title: 'Why This Matters for the Kingdom',
  subtitle: 'Empowering the Body of Christ',
  description: `One of the most significant benefits of the Worldwide Bible Web is its impact on the kingdom of God. A worldwide private internet designed for Christians has the potential to transform the body of Christ in ways we have never seen before.`,
  benefits: [
    {
      title: 'AI-Powered Ministry',
      description: 'Ministers can register an Inspire Web Space and publish fully functional websites in minutes—websites that might otherwise take months to build.',
    },
    {
      title: 'Instant Publishing',
      description: 'Teachers can create websites and publish books instantly. Content is released with transparent AI-assisted "Spiritual Nutrition" evaluation.',
    },
    {
      title: 'Global Prayer & Fellowship',
      description: 'Virtual prayer rooms with real-time language translation enable believers worldwide to gather and pray together.',
    },
    {
      title: 'Distributed Model',
      description: 'This is not about a single ministry—it\'s about equipping believers everywhere. Each ministry operates independently while benefiting from shared infrastructure.',
    },
  ],
  vision: 'The Worldwide Bible Web represents a new way of thinking about digital space—not as a chaotic stream to be filtered, but as an environment to be intentionally shaped.',
};

// Navigation
export const NAV_LINKS = {
  primary: [
    { label: 'Inspire Web Spaces', href: '/domains', description: 'Register your web space' },
    { label: 'About WWBW', href: '/about', description: 'Learn about our vision' },
    { label: 'Browser', href: 'https://JubileeBrowser.com', description: 'Download Jubilee Browser' },
  ],
  account: {
    signIn: 'Sign In',
    createAccount: 'Create Account',
    dashboard: 'My Account',
    signOut: 'Sign Out',
  },
};

export const HERO_CONTENT = {
  badge: 'The Worldwide Bible Web',
  headline: 'Register Your Inspire Web Space on the',
  headlineHighlight: 'Worldwide Bible Web',
  subheadline: 'A faith-aligned, private internet architecture for trust, safety, and purpose. Claim your ministry, church, or community web space on a network built for believers.',
  searchPlaceholder: {
    register: 'Find your inspire web space (e.g., yourchurch.church)',
    transfer: 'Enter web space to transfer (e.g., ministry.ministry)',
  },
  tabs: {
    register: 'Register',
    transfer: 'Transfer',
  },
  cta: {
    register: 'Search',
    transfer: 'Transfer',
  },
};

// Complete Inspire Web Spaces Registry
export const INSPIRE_WEB_SPACES_REGISTRY = {
  core: [
    { space: '.inspire', shortcut: '.insp', description: 'Official Jubilee spaces', restricted: true },
    { space: '.jubilee', shortcut: '.jubi', description: 'Jubilee official spaces', restricted: true },
    { space: '.community', shortcut: '.comm', description: 'Faith communities' },
    { space: '.group', shortcut: null, description: 'Small groups & gatherings' },
  ],
  fivefold: [
    { space: '.apostle', shortcut: '.apos', description: 'Apostolic ministries', restricted: true },
    { space: '.prophet', shortcut: '.prph', description: 'Prophetic voices', restricted: true },
    { space: '.evangelist', shortcut: '.evan', description: 'Evangelistic outreach', restricted: true },
    { space: '.pastor', shortcut: '.past', description: 'Pastoral ministries' },
    { space: '.shepherd', shortcut: '.shep', description: 'Pastoral care', restricted: true },
    { space: '.teacher', shortcut: '.tchr', description: 'Teaching ministries', restricted: true },
  ],
  ministry: [
    { space: '.church', shortcut: '.chur', description: 'Churches & congregations' },
    { space: '.ministry', shortcut: '.mini', description: 'Ministry organizations' },
    { space: '.mission', shortcut: '.miss', description: 'Missions & outreach' },
    { space: '.gospel', shortcut: '.gosp', description: 'Gospel proclamation' },
    { space: '.messianic', shortcut: '.mess', description: 'Messianic communities' },
    { space: '.bible', shortcut: null, description: 'Scripture & study', restricted: true },
    { space: '.book', shortcut: null, description: 'Christian books & publishing', restricted: true },
    { space: '.prayer', shortcut: '.pray', description: 'Prayer ministries' },
    { space: '.discipleship', shortcut: '.disc', description: 'Discipleship programs' },
    { space: '.teshuvah', shortcut: '.tshv', description: 'Repentance & renewal', restricted: true },
    { space: '.covenant', shortcut: '.covt', description: 'Covenant communities', restricted: true },
    { space: '.yeshua', shortcut: null, description: 'Yeshua-centered ministries', restricted: true },
    { space: '.yahuah', shortcut: null, description: 'Sacred name ministries', restricted: true },
    { space: '.shaddai', shortcut: null, description: 'El Shaddai ministries', restricted: true },
  ],
  family: [
    { space: '.family', shortcut: '.faml', description: 'Family ministries' },
    { space: '.youth', shortcut: null, description: 'Youth & young adults' },
    { space: '.children', shortcut: '.kids', description: 'Children\'s ministry' },
    { space: '.men', shortcut: null, description: 'Men\'s ministry' },
    { space: '.women', shortcut: null, description: 'Women\'s ministry' },
  ],
  worship: [
    { space: '.worship', shortcut: '.wrsh', description: 'Worship ministries' },
    { space: '.praise', shortcut: '.praz', description: 'Praise & celebration' },
    { space: '.sermon', shortcut: '.srmn', description: 'Sermon archives' },
    { space: '.teaching', shortcut: '.tchr', description: 'Teaching content' },
    { space: '.music', shortcut: null, description: 'Christian music' },
  ],
  giving: [
    { space: '.giving', shortcut: '.give', description: 'Generosity & giving' },
    { space: '.charity', shortcut: '.chty', description: 'Charitable works' },
    { space: '.stewardship', shortcut: '.stwd', description: 'Stewardship resources' },
  ],
  care: [
    { space: '.coaching', shortcut: '.coch', description: 'Christian coaching' },
    { space: '.marriage', shortcut: '.marr', description: 'Marriage ministry' },
    { space: '.recovery', shortcut: '.recv', description: 'Recovery programs' },
    { space: '.healing', shortcut: '.heal', description: 'Healing ministry' },
  ],
  education: [
    { space: '.school', shortcut: '.schl', description: 'Christian schools' },
    { space: '.academy', shortcut: '.acad', description: 'Educational academies' },
    { space: '.library', shortcut: '.libr', description: 'Resource libraries' },
    { space: '.resources', shortcut: '.rsrc', description: 'Ministry resources' },
  ],
  media: [
    { space: '.media', shortcut: null, description: 'Christian media' },
    { space: '.video', shortcut: null, description: 'Video content' },
    { space: '.movie', shortcut: null, description: 'Christian films & movies' },
    { space: '.show', shortcut: null, description: 'Christian shows & series' },
    { space: '.animation', shortcut: '.anim', description: 'Christian animation' },
    { space: '.podcast', shortcut: '.podc', description: 'Podcasts & audio' },
    { space: '.radio', shortcut: null, description: 'Christian radio & broadcasting' },
    { space: '.news', shortcut: null, description: 'Faith-based news' },
  ],
  events: [
    { space: '.events', shortcut: '.evts', description: 'Ministry events' },
    { space: '.conference', shortcut: '.conf', description: 'Conferences' },
    { space: '.retreat', shortcut: '.rtrt', description: 'Retreats & gatherings' },
  ],
  community: [
    { space: '.serve', shortcut: null, description: 'Service & volunteering' },
    { space: '.testimony', shortcut: '.test', description: 'Testimonies & stories' },
    { space: '.fellowship', shortcut: '.fell', description: 'Fellowship groups' },
    { space: '.persona', shortcut: null, description: 'Personal ministry profiles' },
    { space: '.verified', shortcut: '.vrfy', description: 'Verified ministries', restricted: true },
  ],
  denominational: [
    { space: '.catholic', shortcut: '.cath', description: 'Catholic churches' },
    { space: '.baptist', shortcut: '.bapt', description: 'Baptist churches' },
    { space: '.sbaptist', shortcut: '.sbap', description: 'Southern Baptist' },
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
  ],
};

export const TLD_PRICING = [
  { tld: '.church', price: 300, label: 'Churches', popular: true },
  { tld: '.ministry', price: 300, label: 'Ministries', popular: true },
  { tld: '.community', price: 300, label: 'Communities' },
  { tld: '.prayer', price: 300, label: 'Prayer' },
  { tld: '.worship', price: 300, label: 'Worship' },
  { tld: '.apostle', price: 300, label: 'Fivefold' },
];

export const BENEFITS = [
  {
    id: 'proactive-safety',
    icon: 'shield',
    title: 'Proactive Safety Model',
    description: 'Unlike reactive filters, WWBW integrates safe browsing as a foundational feature. Safety is enforced through category-based allowlists and pre-navigation checks.',
    cta: 'Learn More',
    href: '/about#safety',
  },
  {
    id: 'scripture-first',
    icon: 'book',
    title: 'Scripture-First Community',
    description: 'Infrastructure designed around biblical principles. Content is evaluated with AI-assisted "Spiritual Nutrition" ratings for transparency.',
    cta: 'Explore',
    href: '/about#community',
  },
  {
    id: 'sso',
    icon: 'key',
    title: 'One Identity, All Services',
    description: 'Single sign-on across Jubilee Browser, Jubilee Bible, and all your Inspire Web Spaces. One account for everything.',
    cta: 'Get Started',
    href: '/auth/signup',
  },
  {
    id: 'transparency',
    icon: 'lock',
    title: 'Ethical Transparency',
    description: 'When content is blocked, WWBW provides plain-language explanations. Users are never silently redirected or misled.',
    cta: 'Details',
    href: '/about#ethics',
  },
  {
    id: 'ai-empowerment',
    icon: 'users',
    title: 'AI-Powered Ministry',
    description: 'With Jubilee\'s AI assistance, create websites in minutes, publish books instantly, and reach the world with the gospel.',
    cta: 'View Tools',
    href: '/tools',
  },
];

export const SSO_SERVICES = {
  title: 'Your Gateway to the Jubilee Ecosystem',
  description: 'InspireWebSpaces.com is the central identity and services portal for the Worldwide Bible Web. One account gives you access to everything.',
  services: [
    {
      name: 'Jubilee Browser',
      description: 'The secure gateway to both public internet (with safeguards) and the Worldwide Bible Web',
      status: 'available',
      href: 'https://JubileeBrowser.com',
    },
    {
      name: 'Jubilee Bible',
      description: 'Scripture study with community insights and Bible Mode integration',
      status: 'available',
      href: '/bible',
    },
    {
      name: 'JubileeVerse',
      description: 'Your ministry presence in the Jubilee metaverse',
      status: 'coming-soon',
      href: '/jubileeverse',
    },
    {
      name: 'Round Table',
      description: 'Faith-based discussions and community forums',
      status: 'coming-soon',
      href: '/roundtable',
    },
    {
      name: 'Inspire Web Spaces',
      description: 'Register and manage your private web spaces',
      status: 'available',
      href: '/domains',
    },
    {
      name: 'Jubilee Email',
      description: 'Secure email for your ministry',
      status: 'coming-soon',
      href: '/email',
    },
  ],
};

export const FOOTER_CONTENT = {
  tagline: 'A new Worldwide Bible Web for faith-based communities.',
  browserMessage: 'The Worldwide Bible Web is accessible through the Jubilee Browser.',
  columns: [
    {
      title: 'Products',
      links: [
        { label: 'Inspire Web Spaces', href: '/domains' },
        { label: 'Jubilee Browser', href: 'https://JubileeBrowser.com' },
        { label: 'Jubilee Bible', href: '/bible' },
        { label: 'JubileeVerse', href: '/jubileeverse', comingSoon: true },
      ],
    },
    {
      title: 'Services',
      links: [
        { label: 'Email', href: '/email', comingSoon: true },
        { label: 'Hosting', href: '/hosting', comingSoon: true },
        { label: 'AI Publishing', href: '/publishing', comingSoon: true },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Help Center', href: '/help' },
        { label: 'API Documentation', href: '/docs/api' },
        { label: 'Contact Us', href: '/contact' },
      ],
    },
    {
      title: 'About',
      links: [
        { label: 'About WWBW', href: '/about' },
        { label: 'Our Vision', href: '/about#vision' },
        { label: 'Ethical Framework', href: '/about#ethics' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
      ],
    },
  ],
  legal: {
    copyright: '2025 Inspire Web Spaces. All rights reserved.',
    notice: 'Inspire Web Spaces are private and accessible only through Jubilee Browser. WWBW operates alongside—not in place of—the public internet.',
  },
};

export const IMPORTANT_NOTICE = {
  title: 'The Worldwide Bible Web',
  subtitle: 'The Worldwide Bible Web is accessible through the Jubilee Browser.',
  message: 'Inspire Web Spaces registered on the Worldwide Bible Web are not part of the public Internet or ICANN DNS. They exist exclusively within the WWBW ecosystem and are accessible only through Jubilee Browser. This is not an attempt to replace the internet, but to create an intentional, faith-aligned digital space where the kingdom of God can flourish.',
};

// Use Cases
export const USE_CASES = {
  title: 'Who Is WWBW For?',
  description: 'The Worldwide Bible Web is designed to support a wide range of use cases:',
  cases: [
    {
      title: 'Families',
      description: 'A safer digital environment where parents can trust the content their children access.',
      icon: 'family',
    },
    {
      title: 'Churches',
      description: 'Host online communities, sermons, and resources in a dedicated faith-based space.',
      icon: 'church',
    },
    {
      title: 'Schools',
      description: 'Faith-based schools and homeschool networks with curated educational content.',
      icon: 'school',
    },
    {
      title: 'Ministries',
      description: 'Distribute content, tools, and resources to your community without algorithmic interference.',
      icon: 'ministry',
    },
    {
      title: 'Individuals',
      description: 'Those seeking intentional digital formation and spiritual growth online.',
      icon: 'individual',
    },
  ],
};

// Long-term Vision
export const LONG_TERM_VISION = {
  title: 'Long-Term Vision',
  description: 'WWBW is designed to grow responsibly. Future expansions include:',
  items: [
    'Verified ministry directories',
    'Secure identity and SSO services',
    'Educational and discipleship pathways',
    'Global community hubs',
    'Cross-language and cross-culture support',
    'RadioGPT for worldwide broadcasting',
    'Full video distribution platform',
  ],
  statement: 'All growth is governed by the same core principles: clarity, consent, trust, and stewardship.',
};
