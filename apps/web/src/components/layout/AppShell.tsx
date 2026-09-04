import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Film, LayoutDashboard, Settings, AlertOctagon, Github, Linkedin, ExternalLink, Menu, X } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="4" stroke="url(#logo-grad)" strokeWidth="2" />
      <rect x="5" y="5" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" />
      <rect x="11" y="5" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" />
      <rect x="17" y="5" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" />
      <rect x="5" y="17" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" />
      <rect x="11" y="17" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" />
      <rect x="17" y="17" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" />
      <path d="M6 12H9L11 9L13 15L15 12H18" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoWordmark({ className = "h-8 w-auto select-none" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 170 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wordmark-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <g transform="translate(0, 3)">
        <rect x="1" y="1" width="22" height="22" rx="4" stroke="url(#wordmark-logo-grad)" strokeWidth="2" />
        <rect x="4" y="4" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" opacity="0.8" />
        <rect x="11" y="4" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" opacity="0.8" />
        <rect x="18" y="4" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" opacity="0.8" />
        <rect x="4" y="18" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" opacity="0.8" />
        <rect x="11" y="18" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" opacity="0.8" />
        <rect x="18" y="18" width="1.5" height="1.5" rx="0.3" fill="#8e8e93" opacity="0.8" />
        <path d="M5 12H8L10 9L12 15L14 12H17" stroke="url(#wordmark-logo-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="32" y="20" fill="#ffffff" fontFamily="'Sofia Sans', sans-serif" fontSize="13" fontWeight="800" letterSpacing="0.08em">FRAME</text>
      <text x="86" y="20" fill="#3b82f6" fontFamily="'Sofia Sans', sans-serif" fontSize="13" fontWeight="400" letterSpacing="0.12em">SENSE</text>
    </svg>
  );
}

function LogoText({ className = "h-5 w-auto select-none" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 130 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="15" fill="#ffffff" fontFamily="'Sofia Sans', sans-serif" fontSize="12" fontWeight="800" letterSpacing="0.08em">FRAME</text>
      <text x="54" y="15" fill="#3b82f6" fontFamily="'Sofia Sans', sans-serif" fontSize="12" fontWeight="400" letterSpacing="0.12em">SENSE</text>
    </svg>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      {/* Desktop Sidebar (hidden on mobile, visible md+) */}
      <aside className="hidden md:flex h-full w-64 flex-col border-r bg-studio-950/70 backdrop-blur-sm px-4 py-6 shrink-0">
        {/* Logo */}
        <div className="px-2 mb-8 flex items-center">
          <Link to="/" className="group inline-flex items-center cursor-pointer" title="Return to Dashboard">
            <LogoWordmark className="h-9 w-auto select-none group-hover:opacity-90 transition-opacity" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-studio-900 text-white border-l-2 border-primary pl-2' 
                  : 'text-muted-foreground hover:bg-studio-900/50 hover:text-foreground'
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </NavLink>

          <NavLink
            to="/screenings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-studio-900 text-white border-l-2 border-primary pl-2' 
                  : 'text-muted-foreground hover:bg-studio-900/50 hover:text-foreground'
              }`
            }
          >
            <Film className="h-4 w-4" /> Screenings
          </NavLink>

          <NavLink
            to="/findings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-studio-900 text-white border-l-2 border-primary pl-2' 
                  : 'text-muted-foreground hover:bg-studio-900/50 hover:text-foreground'
              }`
            }
          >
            <AlertOctagon className="h-4 w-4" /> Editorial Findings
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-studio-900 text-white border-l-2 border-primary pl-2' 
                  : 'text-muted-foreground hover:bg-studio-900/50 hover:text-foreground'
              }`
            }
          >
            <Settings className="h-4 w-4" /> Settings
          </NavLink>
        </nav>
      </aside>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-fade-in"
        />
      )}

      {/* Mobile Drawer (slides out when expander clicked) */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-studio-950 border-r border-border p-6 flex flex-col transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-8">
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="group inline-flex items-center cursor-pointer" title="Return to Dashboard">
            <LogoWordmark className="h-8 w-auto select-none group-hover:opacity-90 transition-opacity" />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            aria-label="Close Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5">
          <NavLink
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-semibold transition-all ${
                isActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </NavLink>

          <NavLink
            to="/screenings"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-semibold transition-all ${
                isActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`
            }
          >
            <Film className="h-4 w-4" /> Screenings
          </NavLink>

          <NavLink
            to="/findings"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-semibold transition-all ${
                isActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`
            }
          >
            <AlertOctagon className="h-4 w-4" /> Editorial Findings
          </NavLink>

          <NavLink
            to="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-semibold transition-all ${
                isActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`
            }
          >
            <Settings className="h-4 w-4" /> Settings
          </NavLink>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Mobile Header Bar with Menu Expander Button */}
        <header className="md:hidden flex items-center justify-between border-b border-border/60 bg-studio-950/90 backdrop-blur-md px-4 py-2.5 sticky top-0 z-30 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-studio-900 border border-studio-800 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
          </button>

          <Link to="/" className="group inline-flex items-center cursor-pointer" title="Return to Dashboard">
            <LogoWordmark className="h-6 w-auto opacity-50 group-hover:opacity-100 transition-opacity select-none" />
          </Link>
        </header>

        {/* View container */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-7xl mx-auto flex flex-col min-h-full">
            <div className="flex-1 min-h-[85vh]">
              {children}
            </div>

            {/* Footer */}
            <footer className="mt-12 md:mt-20 border-t border-border/60 pt-8 pb-6 text-xs text-muted-foreground">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 mb-8">
                {/* Column 1: Brand & Developer Info */}
                <div className="space-y-3 col-span-2 md:col-span-1">
                  <Link to="/" className="inline-flex items-center gap-2.5 group cursor-pointer" title="Return to Dashboard">
                    <div className="p-1.5 bg-studio-900 border border-border/80 rounded-lg shadow-sm group-hover:border-primary/50 transition-colors">
                      <Logo className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <LogoText className="h-[16px] w-auto block" />
                      <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">Post-Production Intelligence</div>
                    </div>
                  </Link>

                  <div className="text-[10px] text-muted-foreground/75 font-mono">
                    &copy; {new Date().getFullYear()} Frame Sense. All rights reserved.
                  </div>
                  
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm">
                    Autonomous post-production intelligence workspace. Analyze viewer telemetry &amp; orchestrate agentic workflows.
                  </p>

                  <div className="flex items-center gap-4 pt-1 flex-wrap text-[11px]">
                    <span className="text-muted-foreground/80 font-mono text-[10px]">BY <strong className="text-foreground">Supan Roy</strong></span>
                    <a href="https://github.com/Supan-Roy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1 font-mono">
                      <Github className="h-3.5 w-3.5 text-foreground/80" /> GitHub <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                    <a href="https://linkedin.com/in/supanroy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1 font-mono">
                      <Linkedin className="h-3.5 w-3.5 text-foreground/80" /> LinkedIn <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  </div>
                </div>

                {/* Column 2: Platform */}
                <div className="space-y-2.5 col-span-1">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[10px] font-mono">Platform</div>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <NavLink to="/" className="hover:text-primary transition-colors">Dashboard</NavLink>
                    <NavLink to="/screenings" className="hover:text-primary transition-colors">Screenings</NavLink>
                    <NavLink to="/findings" className="hover:text-primary transition-colors">Findings</NavLink>
                    <NavLink to="/settings" className="hover:text-primary transition-colors">Settings</NavLink>
                  </div>
                </div>

                {/* Column 3: Resources */}
                <div className="space-y-2.5 col-span-1">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[10px] font-mono">Resources</div>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <a href="#" className="hover:text-primary transition-colors">Docs</a>
                    <a href="#" className="hover:text-primary transition-colors">Help Center</a>
                    <a href="#" className="hover:text-primary transition-colors">API Reference</a>
                  </div>
                </div>

                {/* Column 4: Legal */}
                <div className="space-y-2.5 col-span-2 sm:col-span-1">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[10px] font-mono">Legal</div>
                  <div className="flex flex-col sm:flex-col flex-row gap-x-4 gap-y-1.5 text-xs">
                    <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
