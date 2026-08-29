import React from 'react';
import { NavLink } from 'react-router-dom';
import { Film, LayoutDashboard, Settings, AlertOctagon } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      {/* Sidebar */}
      <aside className="flex h-full w-64 flex-col border-r bg-studio-950/70 backdrop-blur-sm px-4 py-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <Film className="h-6 w-6 text-primary" />
          <span className="font-semibold tracking-wider text-md uppercase">Frame Sense</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-2' 
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
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-2' 
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
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-2' 
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
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-2' 
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
            <div className="flex-1">
              {children}
            </div>

            {/* Footer */}
            <footer className="mt-20 border-t border-border/60 pt-10 pb-6 text-xs text-muted-foreground">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                {/* Column 1: Developed by */}
                <div className="space-y-3">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Developer</div>
                  <div className="text-sm font-medium text-foreground">Supan Roy</div>
                  <div className="flex flex-col gap-2">
                    <a href="https://github.com/Supan-Roy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                      GitHub: Supan-Roy
                    </a>
                    <a href="https://linkedin.com/in/supanroy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                      LinkedIn: supanroy
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

              <div className="flex flex-col md:flex-row items-center justify-between border-t border-border/40 pt-6 text-[11px] text-muted-foreground/70">
                <div>
                  &copy; {new Date().getFullYear()} Frame Sense. All rights reserved.
                </div>
                <div className="mt-2 md:mt-0">
                  Autonomous Post-Production Intelligence System
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
