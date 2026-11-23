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
    { id: 'generator', label: 'Clip Generator', icon: Scissors },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'aiconnect', label: 'AI Connect', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Dynamic collapse arrow based on sidebar position
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
      className={`bg-[#0d0f14] border-rule flex flex-col justify-between transition-all duration-200 ease-in-out z-30 shrink-0 select-none ${
        sidebarPosition === 'right' ? 'border-l' : 'border-r'
      } ${collapsed ? 'w-[72px]' : 'w-[250px]'}`}
    >
      {/* Top Brand Header (Fixed height h-16 = 64px perfectly aligned with main header) */}
      <div>
        <div className="h-16 border-b border-rule flex items-center px-3.5">
          {collapsed ? (
            /* Collapsed Mode: Clean centered expand button, no logo overflow glitch */
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-paper2 hover:bg-paper3 border border-rule text-muted hover:text-ink transition-colors cursor-pointer"
                title="Expand Sidebar"
              >
                <CollapseIcon size={18} />
              </button>
            </div>
          ) : (
            /* Expanded Mode: Full brand title and collapse button with proper alignment */
            <div className="w-full flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ba6238] via-amber-600 to-[#8d421e] flex items-center justify-center text-white shrink-0 font-bold">
                  <Film size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-ink text-sm tracking-tight truncate block max-w-[110px]">
                      Clip Studio
                    </span>
                    <span className="text-[9px] font-mono font-bold bg-[#ba6238]/20 text-[#ba6238] px-1.5 py-0.2 rounded border border-[#ba6238]/30 shrink-0">
                      PRO
                    </span>
                  </div>
                  <span className="text-[9.5px] text-muted tracking-wider block font-mono truncate max-w-[130px]">
                    AI VIDEO SHORTS
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="p-1.5 text-muted hover:text-ink hover:bg-paper3 rounded-lg border border-rule transition-colors shrink-0 cursor-pointer"
                title="Collapse Sidebar"
              >
                <CollapseIcon size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Primary Navigation */}
        <nav className="p-2.5 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-paper3 text-ink border border-rule2 font-semibold'
                    : 'text-muted hover:text-ink hover:bg-paper2/70 border border-transparent'
                } ${collapsed ? 'justify-center !px-0' : ''}`}
              >
                <Icon
                  size={18}
                  className={`shrink-0 transition-colors ${
                    active ? 'text-[#ba6238]' : 'text-muted group-hover:text-ink'
                  }`}
                />
                {!collapsed && <span className="truncate min-w-0">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Links */}
      <div className="p-2.5 border-t border-rule space-y-0.5">
        <a
          href="https://github.com/brijeshyadav2312/clip-studio#readme"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'Landing Page' : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-muted hover:text-ink hover:bg-paper2 transition-colors ${
            collapsed ? 'justify-center !px-0' : ''
          }`}
        >
          <Globe size={15} className="shrink-0 text-muted" />
          {!collapsed && <span className="truncate min-w-0">Landing Page</span>}
        </a>

        <a
          href="https://github.com/brijeshyadav2312/clip-studio"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'Open Source' : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-muted hover:text-ink hover:bg-paper2 transition-colors ${
            collapsed ? 'justify-center !px-0' : ''
          }`}
        >
          <Github size={15} className="shrink-0 text-muted" />
          {!collapsed && <span className="truncate min-w-0">Open Source</span>}
        </a>

        <button
          type="button"
          onClick={() => setActiveTab('aiconnect')}
          title={collapsed ? 'Plans & Pricing' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-muted hover:text-ink hover:bg-paper2 transition-colors cursor-pointer ${
            collapsed ? 'justify-center !px-0' : ''
          }`}
        >
          <Sparkles size={15} className="text-[#ba6238] shrink-0" />
          {!collapsed && <span className="truncate min-w-0">Plans & Pricing</span>}
        </button>

        <a
          href="mailto:info@openshorts.app"
          title={collapsed ? 'info@openshorts.app' : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-muted hover:text-ink hover:bg-paper2 transition-colors ${
            collapsed ? 'justify-center !px-0' : ''
          }`}
        >
          <Mail size={15} className="shrink-0 text-muted" />
          {!collapsed && <span className="truncate min-w-0">info@openshorts.app</span>}
        </a>
      </div>
    </aside>
  );
}
