import React from 'react';
import {
  Scissors,
  Clock,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  Globe,
  Github,
  Sparkles,
  Mail,
  Film,
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  sidebarPosition = 'left',
  setSidebarPosition,
}) {
  const navItems = [
    { id: 'generator', label: 'clip generator', icon: Scissors },
    { id: 'history', label: 'history', icon: Clock },
    { id: 'aiconnect', label: 'ai connect', icon: Bot },
    { id: 'settings', label: 'settings', icon: Settings },
  ];

  // Correct collapse/expand arrow direction depending on sidebar position
  const CollapseIcon =
    sidebarPosition === 'left'
      ? collapsed
        ? ChevronRight
        : ChevronLeft
      : collapsed
      ? ChevronLeft
      : ChevronRight;

  return (
    <aside
      className={`bg-[#0d0f14] border-rule flex flex-col justify-between transition-all duration-300 ease-in-out z-30 shrink-0 ${
        sidebarPosition === 'right' ? 'border-l' : 'border-r'
      } ${collapsed ? 'w-[76px]' : 'w-[260px]'}`}
    >
      {/* Top Brand Header */}
      <div>
        <div className="h-18 px-4 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-card bg-gradient-to-br from-brass via-amber-600 to-[#8d421e] flex items-center justify-center text-brassink shrink-0 shadow-lg shadow-brass/20 font-bold transition-transform hover:scale-105 duration-200">
              <Film size={18} />
            </div>
            {!collapsed && (
              <div className="min-w-0 animate-fade">
                <span className="font-semibold text-ink text-sm sm:text-base tracking-tight block truncate">
                  Clip Studio
                </span>
                <span className="readout text-[9.5px] text-muted tracking-wider block -mt-0.5">
                  OPEN SOURCE PRO
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 text-muted hover:text-ink hover:bg-paper3 rounded-input transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
            title={
              collapsed
                ? sidebarPosition === 'left'
                  ? 'Expand sidebar (Right)'
                  : 'Expand sidebar (Left)'
                : 'Collapse sidebar'
            }
          >
            <CollapseIcon size={18} />
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-card text-sm font-medium lowercase transition-all duration-200 ${
                  active
                    ? 'bg-paper3 text-ink border border-brass/40 shadow-md shadow-brass/5 font-semibold translate-x-0.5'
                    : 'text-muted hover:text-ink hover:bg-paper2/80 border border-transparent hover:translate-x-0.5'
                } ${collapsed ? 'justify-center !px-0' : ''}`}
              >
                <Icon
                  size={19}
                  className={`transition-colors shrink-0 ${
                    active ? 'text-brass' : 'text-muted group-hover:text-ink'
                  }`}
                />
                {!collapsed && <span className="truncate tracking-wide">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Links (Matching Reference Image 2) */}
      <div className="p-3 border-t border-rule space-y-1">
        <a
          href="https://github.com/brijeshyadav2312/clip-studio#readme"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'landing page' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-card text-xs text-muted hover:text-ink hover:bg-paper2 transition-all duration-200 ${
            collapsed ? 'justify-center !px-0' : ''
          }`}
        >
          <Globe size={16} className="shrink-0" />
          {!collapsed && <span className="truncate lowercase tracking-wide">landing page</span>}
        </a>

        <a
          href="https://github.com/brijeshyadav2312/clip-studio"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'open source' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-card text-xs text-muted hover:text-ink hover:bg-paper2 transition-all duration-200 ${
            collapsed ? 'justify-center !px-0' : ''
          }`}
        >
          <Github size={16} className="shrink-0" />
          {!collapsed && <span className="truncate lowercase tracking-wide">open source</span>}
        </a>

        <button
          type="button"
          onClick={() => setActiveTab('aiconnect')}
          title={collapsed ? 'plans & pricing' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-card text-xs text-muted hover:text-ink hover:bg-paper2 transition-all duration-200 ${
            collapsed ? 'justify-center !px-0' : ''
          }`}
        >
          <Sparkles size={16} className="text-brass shrink-0" />
          {!collapsed && <span className="truncate lowercase tracking-wide">plans & pricing</span>}
        </button>

        <a
          href="mailto:info@openshorts.app"
          title={collapsed ? 'info@openshorts.app' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-card text-xs text-muted hover:text-ink hover:bg-paper2 transition-all duration-200 ${
            collapsed ? 'justify-center !px-0' : ''
          }`}
        >
          <Mail size={16} className="shrink-0" />
          {!collapsed && <span className="truncate lowercase tracking-wide">info@openshorts.app</span>}
        </a>
      </div>
    </aside>
  );
}
