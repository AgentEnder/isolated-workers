import { useEffect, useState } from 'react';
import { usePageContext } from 'vike-react/usePageContext';
import logoUrl from '../assets/logo.svg';
import { Link } from '../components/Link';
import { PagefindSearch } from '../components/PagefindSearch';
import {
  EffectsToggle,
  RetroBackground,
  RetroEffectsProvider,
} from '../components/RetroBackground';
import { useNavigationEntries } from '../hooks/useNavigationEntries';
import { useNeonFlicker } from '../hooks/useNeonFlicker';
import { NavigationItem } from '../vike-types';
import './tailwind.css';

export default function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageContext = usePageContext();
  const { urlPathname } = pageContext;
  const navigation = useNavigationEntries();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on the landing page
  const isLandingPage = urlPathname === '/' || urlPathname === '';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize neon flicker effect (triggers every 2-5 minutes)
  const { triggerFlicker } = useNeonFlicker();

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [urlPathname, isMobile]);

  // Trigger a flicker on page navigation
  useEffect(() => {
    // Small delay so the page has rendered
    const timer = setTimeout(() => {
      triggerFlicker();
    }, 100);
    return () => clearTimeout(timer);
  }, [urlPathname, triggerFlicker]);

  const isActive = (href: string): boolean => {
    if (href === '/') {
      return urlPathname === '/';
    }
    return urlPathname === href;
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <RetroEffectsProvider>
      <div className="min-h-screen bg-primary text-gray-100">
        {/* Retrowave Background Effects */}
        <RetroBackground />

        {/* Fixed Top Bar */}
        <TopBar
          logoUrl={logoUrl}
          onMenuClick={toggleSidebar}
          isMobile={isMobile}
        />

        {/* Main layout container */}
        <div className="pt-20">
          {isLandingPage ? (
            // Landing page - no sidebar, full width
            <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
          ) : (
            // Docs pages - sidebar + content layout using flexbox
            <div className="relative flex min-h-[calc(100vh-5rem)] p-4 lg:max-w-9/12 m-auto gap-4">
              {/* Mobile overlay */}
              {isMobile && sidebarOpen && (
                <div
                  className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
                  onClick={toggleSidebar}
                />
              )}

              {/* Sidebar wrapper - provides spacing and contains sticky sidebar */}

              <aside className="hidden lg:block shrink-0 p-4 sticky top-0 self-start w-72 rounded-2xl glass-enhanced border-glow">
                <div className="h-[calc(100vh-6rem)] overflow-y-auto">
                  <NavContent
                    navigation={navigation}
                    activeCheck={isActive}
                    onItemClick={() => isMobile && setSidebarOpen(false)}
                  />
                </div>
              </aside>

              {/* Mobile sidebar - fixed position, slides in */}
              <aside
                className={`
                  lg:hidden left-4 bottom-4 top-24 w-72
                  glass-enhanced border-glow fixed! rounded-2xl
                  z-40 transition-transform duration-300 ease-in-out
                  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                  overflow-clip
                `}
              >
                <div className="h-[calc(100vh-5rem)] overflow-y-auto">
                  <NavContent
                    navigation={navigation}
                    activeCheck={isActive}
                    onItemClick={() => isMobile && setSidebarOpen(false)}
                  />
                </div>
              </aside>

              {/* Main Content */}
              <main className="flex-1 min-w-0 py-4">
                <div className="max-w-4xl rounded-2xl bg-secondary/60 backdrop-blur-sm border border-tertiary/30 px-8 py-8">
                  {children}
                </div>
              </main>
            </div>
          )}
        </div>

        {/* Effects Toggle - Fixed Bottom Right */}
        <div className="fixed bottom-4 right-4 z-50">
          <EffectsToggle />
        </div>
      </div>
    </RetroEffectsProvider>
  );
}

interface TopBarProps {
  logoUrl: string;
  onMenuClick: () => void;
  isMobile: boolean;
}

function TopBar({ logoUrl, onMenuClick, isMobile }: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-20 z-50 glass-enhanced border-b border-neon-cyan/10">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative neon-flicker-slow">
            <img
              src={logoUrl}
              height={40}
              width={40}
              alt="isolated-workers logo"
              className="transition-all duration-300 group-hover:drop-shadow-[0_0_12px_rgba(0,240,255,0.6)]"
            />
          </div>
          <span className="text-xl font-bold bg-linear-to-r from-neon-cyan to-neon-purple bg-clip-text text-transparent neon-flicker-alt neon-flicker-delay-1">
            isolated-workers
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLink href="/docs/getting-started">Getting Started</NavLink>
          <NavLink href="/docs/guides">Guides</NavLink>
          <NavLink href="/examples">Examples</NavLink>
          <NavLink href="/api">API Reference</NavLink>
        </nav>

        {/* Search */}
        <div className="hidden md:block">
          <PagefindSearch />
        </div>

        {/* Mobile Menu Button */}
        {isMobile && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg hover:bg-neon-cyan/10 border border-transparent hover:border-neon-cyan/30 transition-all"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-neon-cyan"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

interface NavLinkProps {
  href: string;
  children: string;
}

function NavLink({ href, children }: NavLinkProps) {
  const pageContext = usePageContext();
  const { urlPathname } = pageContext;
  const active =
    href === '/' ? urlPathname === '/' : urlPathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`
        text-sm font-medium transition-all duration-200 relative link-underline
        ${
          active
            ? 'text-neon-cyan text-glow-cyan'
            : 'text-gray-400 hover:text-gray-200'
        }
      `}
    >
      {children}
      {active && (
        <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-linear-to-r from-neon-cyan to-neon-purple shadow-neon-sm" />
      )}
    </Link>
  );
}

interface NavContentProps {
  navigation: NavigationItem[];
  activeCheck: (href: string) => boolean;
  onItemClick?: () => void;
}

function NavContent({ navigation, activeCheck, onItemClick }: NavContentProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

  const toggleSection = (title: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  return (
    <nav className="p-4 h-full overflow-y-auto space-y-6">
      {navigation.map((section, sectionIndex) => {
        const isCollapsed = collapsedSections.has(section.title);
        return (
          <div key={section.title}>
            {/* Section divider (except for first section) */}
            {sectionIndex > 0 && <div className="divider-glow mb-4" />}

            <div className="flex items-center justify-between mb-2 px-3">
              {section.path ? (
                <Link
                  href={section.path}
                  onClick={onItemClick}
                  className="text-xs font-semibold text-gray-500 uppercase tracking-wider neon-flicker-slow neon-flicker-delay-2 hover:text-neon-cyan transition-colors duration-200"
                >
                  {section.title}
                </Link>
              ) : (
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider neon-flicker-slow neon-flicker-delay-2">
                  {section.title}
                </span>
              )}
              <button
                onClick={(e) => toggleSection(section.title, e)}
                className="shrink-0 ml-2 hover:text-neon-cyan transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isCollapsed ? '-rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            {!isCollapsed && (
              <ul className="space-y-1 list-none">
                {section.children?.map(
                  (item) =>
                    item.path && (
                      <li key={item.path}>
                        <NavItem
                          href={item.path}
                          title={item.title}
                          active={activeCheck(item.path)}
                          onClick={onItemClick}
                        />
                      </li>
                    )
                )}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

interface NavItemProps {
  href: string;
  title: string;
  active: boolean;
  onClick?: () => void;
}

function NavItem({ href, title, active, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        block px-3 py-2 rounded-lg text-sm transition-all duration-200
        ${
          active
            ? 'bg-neon-cyan/10 text-neon-cyan border-l-2 border-neon-cyan shadow-neon-sm active-pulse'
            : 'text-gray-400 hover:text-gray-200 hover:bg-tertiary/30 hover:border-l-2 hover:border-neon-cyan/30'
        }
      `}
    >
      {title}
    </Link>
  );
}
