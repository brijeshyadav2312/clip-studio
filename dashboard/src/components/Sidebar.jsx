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
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  sidebarPosition = 'right',
  setSidebarPosition,
}) {
  const navItems = [
    { id: 'generator', label: 'clip generator', icon: Scissors },
    { id: 'history', label: 'history', icon: Clock },
    { id: 'aiconnect', label: 'ai connect', icon: Bot },
    { id: 'settings', label: 'settings', icon: Settings },
  ];

  return (
    <aside
      className={`bg-paper border-rule flex flex-col justify-between transition-all duration-300 z-30 shrink-0 ${
        sidebarPosition === 'right' ? 'border-l' : 'border-r'
      } ${collapsed ? 'w-[68px]' : 'w-[240px]'}`}
    >
      {/* Top Brand Header */}
      <div>
        <div className="h-16 px-4 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-input bg-gradient-to-br from-brass to-amber-600 flex items-center justify-center text-brassink shrink-0 shadow-md shadow-brass/20 font-bold">
              <Film size={16} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-semibold text-ink text-sm tracking-tight block truncate">Clip Studio</span>
                <span className="readout text-[9px] text-muted block -mt-0.5">OPEN SOURCE PRO</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-muted hover:text-ink hover:bg-paper3 rounded-input transition-colors shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="p-2 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-input text-xs font-medium lowercase transition-all ${
                  active
                    ? 'bg-paper3 text-ink border border-rule2 shadow-sm font-semibold'
                    : 'text-muted hover:text-ink hover:bg-paper2 border border-transparent'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon size={17} className={active ? 'text-brass shrink-0' : 'text-muted shrink-0'} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Links (Matching Image 2 exactly) */}
      <div className="p-3 border-t border-rule space-y-1">
        <a
          href="https://github.com/brijeshyadav2312/clip-studio#readme"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'landing page' : undefined}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-input text-xs text-muted hover:text-ink hover:bg-paper2 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Globe size={15} className="shrink-0" />
          {!collapsed && <span className="truncate lowercase">landing page</span>}
        </a>

        <a
          href="https://github.com/brijeshyadav2312/clip-studio"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'open source' : undefined}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-input text-xs text-muted hover:text-ink hover:bg-paper2 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Github size={15} className="shrink-0" />
          {!collapsed && <span className="truncate lowercase">open source</span>}
        </a>

        <button
          type="button"
          onClick={() => setActiveTab('aiconnect')}
          title={collapsed ? 'plans & pricing' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-input text-xs text-muted hover:text-ink hover:bg-paper2 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Sparkles size={15} className="text-brass shrink-0" />
          {!collapsed && <span className="truncate lowercase">plans & pricing</span>}
        </button>

        <a
          href="mailto:info@openshorts.app"
          title={collapsed ? 'info@openshorts.app' : undefined}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-input text-xs text-muted hover:text-ink hover:bg-paper2 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Mail size={15} className="shrink-0" />
          {!collapsed && <span className="truncate lowercase">info@openshorts.app</span>}
        </a>
      </div>
    </aside>
  );
}
