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
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
