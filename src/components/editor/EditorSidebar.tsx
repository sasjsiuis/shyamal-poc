import React from 'react';
import {
  BadgeCheck,
  Download,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  Type,
} from 'lucide-react';

export type EditorTabId = 'text' | 'style' | 'photo' | 'logo' | 'template' | 'export';

export const EDITOR_TABS: Array<{
  id: EditorTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'text', label: 'টেক্সট', icon: Type },
  { id: 'style', label: 'স্টাইল', icon: Palette },
  { id: 'photo', label: 'ছবি', icon: ImageIcon },
  { id: 'logo', label: 'লোগো', icon: BadgeCheck },
  { id: 'template', label: 'টেমপ্লেট', icon: LayoutGrid },
  { id: 'export', label: 'এক্সপোর্ট', icon: Download },
];

interface EditorSidebarProps {
  activeTab: EditorTabId | null;
  onSelectTab: (tab: EditorTabId) => void;
  onShowShortcuts?: () => void;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  activeTab,
  onSelectTab,
  onShowShortcuts,
}) => {
  return (
    <>
      {/* Desktop Left Icon Rail (72px) */}
      <aside
        aria-label="এডিটর টুলস"
        className="hidden w-[72px] shrink-0 flex-col items-center justify-between border-r border-[#E5E7EB] bg-white py-3 md:flex dark:border-[#1F2937] dark:bg-[#111827]"
      >
        <div className="flex w-full flex-col items-center gap-1.5 px-1.5">
          {EDITOR_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/50 ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold dark:bg-indigo-950/70 dark:text-indigo-300'
                    : 'text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A] dark:text-slate-400 dark:hover:bg-gray-800 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {onShowShortcuts && (
          <button
            type="button"
            onClick={onShowShortcuts}
            title="কীবোর্ড শর্টকাট"
            aria-label="কীবোর্ড শর্টকাট"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-slate-100 hover:text-[#0F172A] dark:text-slate-400 dark:hover:bg-gray-800 dark:hover:text-slate-100"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        )}
      </aside>

      {/* Mobile Bottom Tab Bar (<768px) */}
      <nav
        aria-label="মোবাইল এডিটর ট্যাব"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-[#E5E7EB] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-[#1F2937] dark:bg-[#111827]/95"
      >
        {EDITOR_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex min-h-[54px] cursor-pointer flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-[#4F46E5] font-semibold dark:text-indigo-400'
                  : 'text-[#64748B] dark:text-slate-400'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="truncate max-w-full whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
