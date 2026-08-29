import React from 'react';
import { NavLink } from 'react-router-dom';
import { Film, LayoutDashboard, Settings, AlertOctagon, Github, Linkedin, ExternalLink } from 'lucide-react';

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

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      {/* Sidebar */}
      <aside className="flex h-full w-64 flex-col border-r bg-studio-950/70 backdrop-blur-sm px-4 py-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <Logo className="h-6 w-6" />
          <span className="font-semibold tracking-wider text-md uppercase">Frame Sense</span>
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">


        {/* View container */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-7xl mx-auto flex flex-col min-h-full">
            <div className="flex-1 min-h-[85vh]">
              {children}
            </div>

            {/* Footer */}
            <footer className="mt-20 border-t border-border/60 pt-10 pb-6 text-xs text-muted-foreground">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                {/* Column 1: Brand & Developer Info */}
                <div className="space-y-4 col-span-1 md:col-span-1">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-studio-900 border border-border/80 rounded-lg shadow-sm">
                      <Logo className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold tracking-wider text-sm text-foreground uppercase">Frame Sense</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">Post-Production Intelligence</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground/75">
                    &copy; {new Date().getFullYear()} Frame Sense. All rights reserved.
                  </div>
                  
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                    Next-generation autonomous post-production intelligence workspace. Analyze viewer telemetry, inspect media, and orchestrate editorial workflows with agents.
                  </p>

                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Developed by</div>
                    <div className="text-xs font-semibold text-foreground">Supan Roy</div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <a href="https://github.com/Supan-Roy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2 text-xs">
                      <Github className="h-4 w-4 text-foreground/80" /> GitHub <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                    <a href="https://linkedin.com/in/supanroy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2 text-xs">
                      <Linkedin className="h-4 w-4 text-foreground/80" /> LinkedIn <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </div>
                </div>

                {/* Column 2: Platform */}
                <div className="space-y-3">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Platform</div>
                  <div className="flex flex-col gap-2">
                    <NavLink to="/" className="hover:text-primary transition-colors">Dashboard</NavLink>
                    <NavLink to="/screenings" className="hover:text-primary transition-colors">Screenings</NavLink>
                    <NavLink to="/findings" className="hover:text-primary transition-colors">Findings</NavLink>
                    <NavLink to="/settings" className="hover:text-primary transition-colors">Settings</NavLink>
                  </div>
                </div>

                {/* Column 3: Resources */}
                <div className="space-y-3">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Resources</div>
                  <div className="flex flex-col gap-2">
                    <a href="#" className="hover:text-primary transition-colors">Documentation</a>
                    <a href="#" className="hover:text-primary transition-colors">Help Center</a>
                    <a href="#" className="hover:text-primary transition-colors">API Reference</a>
                  </div>
                </div>

                {/* Column 4: Legal */}
                <div className="space-y-3">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Legal</div>
                  <div className="flex flex-col gap-2">
                    <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                    <a href="#" className="hover:text-primary transition-colors">License Agreement</a>
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
