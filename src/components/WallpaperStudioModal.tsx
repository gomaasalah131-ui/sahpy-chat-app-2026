import React from 'react';
import {
  Sparkles,
  Check,
  X,
  Palette,
  Sliders,
  Play,
  Pause,
  Zap,
  RotateCcw,
} from 'lucide-react';
import {
  AnimationSpeed,
  BubbleAccentId,
  WallpaperConfig,
  WallpaperThemeId,
} from '../types/chat';
import { WALLPAPER_THEMES } from './AnimatedChatBackground';
import { DEFAULT_WALLPAPER_CONFIG } from '../data/initialChats';

interface WallpaperStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WallpaperConfig;
  onUpdateConfig: (newConfig: WallpaperConfig) => void;
  activeContactName?: string;
  contactCustomWallpaper?: WallpaperThemeId;
  onSetContactCustomWallpaper: (themeId: WallpaperThemeId | undefined) => void;
}

export const BUBBLE_ACCENTS: {
  id: BubbleAccentId;
  name: string;
  swatchClass: string;
  myBubbleClass: string;
  buttonClass: string;
}[] = [
  {
    id: 'emerald',
    name: 'زمردي واتساب',
    swatchClass: 'bg-gradient-to-tr from-emerald-600 to-teal-500',
    myBubbleClass:
      'bg-gradient-to-br from-emerald-600/95 to-teal-700/95 text-white border-emerald-400/25',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
  {
    id: 'violet',
    name: 'بنفسجي ملكي',
    swatchClass: 'bg-gradient-to-tr from-violet-600 to-indigo-500',
    myBubbleClass:
      'bg-gradient-to-br from-violet-600/95 to-indigo-700/95 text-white border-violet-400/25',
    buttonClass: 'bg-violet-600 hover:bg-violet-500 text-white',
  },
  {
    id: 'cyan',
    name: 'أزرق محيطي',
    swatchClass: 'bg-gradient-to-tr from-cyan-600 to-blue-600',
    myBubbleClass:
      'bg-gradient-to-br from-cyan-600/95 to-blue-700/95 text-white border-cyan-400/25',
    buttonClass: 'bg-cyan-600 hover:bg-cyan-500 text-white',
  },
  {
    id: 'rose',
    name: 'وردي متدرج',
    swatchClass: 'bg-gradient-to-tr from-rose-600 to-pink-600',
    myBubbleClass:
      'bg-gradient-to-br from-rose-600/95 to-pink-700/95 text-white border-rose-400/25',
    buttonClass: 'bg-rose-600 hover:bg-rose-500 text-white',
  },
  {
    id: 'amber',
    name: 'ذهبي دافئ',
    swatchClass: 'bg-gradient-to-tr from-amber-600 to-orange-600',
    myBubbleClass:
      'bg-gradient-to-br from-amber-600/95 to-orange-700/95 text-white border-amber-400/25',
    buttonClass: 'bg-amber-600 hover:bg-amber-500 text-white',
  },
];

export const WallpaperStudioModal: React.FC<WallpaperStudioModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  activeContactName,
  contactCustomWallpaper,
  onSetContactCustomWallpaper,
}) => {
  if (!isOpen) return null;

  const speedOptions: { id: AnimationSpeed; label: string; icon: React.ReactNode }[] = [
    { id: 'dynamic', label: 'حيوية ونشطة', icon: <Zap className="h-3.5 w-3.5" /> },
    { id: 'calm', label: 'هادئة وانسيابية', icon: <Play className="h-3.5 w-3.5" /> },
    { id: 'paused', label: 'ثابتة بدون حركة', icon: <Pause className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                استوديو الخلفيات المتحركة والألوان
              </h2>
              <p className="text-xs text-slate-400">
                اختر خلفية الشات التفاعلية، سرعة التموجات اللونية، ولون فقاعات الرسائل
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Section 1: Animated Wallpaper Themes */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">
                1. الخلفيات المتحركة الملونة (Live Animated Wallpapers)
              </h3>
              {activeContactName && (
                <span className="text-xs text-slate-400">
                  المحادثة الحالية: <strong className="text-slate-200">{activeContactName}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {WALLPAPER_THEMES.map((theme) => {
                const isSelectedGlobal = config.themeId === theme.id && !contactCustomWallpaper;
                const isSelectedContact = contactCustomWallpaper === theme.id;
                const isSelected = isSelectedGlobal || isSelectedContact;

                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      onSetContactCustomWallpaper(undefined);
                      onUpdateConfig({ ...config, themeId: theme.id });
                    }}
                    className={`group relative flex items-center gap-3.5 rounded-xl border p-3 text-right transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-slate-800/90 shadow-lg'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Live Mini Swatch Preview */}
                    <div
                      className={`relative h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br ${theme.previewGradient}`}
                    >
                      <div className="absolute inset-0 bg-black/15" />
                      <div className="animate-aurora-fast-1 absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white/35 blur-md" />
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white">
                          {theme.name}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                        {theme.subtitle}
                      </p>
                      {activeContactName && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetContactCustomWallpaper(
                                contactCustomWallpaper === theme.id ? undefined : theme.id
                              );
                            }}
                            className={`inline-block rounded px-2 py-0.5 text-[11px] transition-colors ${
                              contactCustomWallpaper === theme.id
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {contactCustomWallpaper === theme.id
                              ? `مخصصة لـ ${activeContactName} ✓`
                              : `تخصيص لـ ${activeContactName} فقط`}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Message Bubble Accent Color */}
          <div className="border-t border-slate-800 pt-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">
              2. لون فقاعات الرسائل والأزرار (Message Bubble Accent)
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              {BUBBLE_ACCENTS.map((accent) => {
                const active = config.bubbleAccent === accent.id;
                return (
                  <button
                    key={accent.id}
                    type="button"
                    onClick={() =>
                      onUpdateConfig({ ...config, bubbleAccent: accent.id })
                    }
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-white bg-slate-800 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full ${accent.swatchClass}`}
                    />
                    <span>{accent.name}</span>
                    {active && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Animation Speed & Pattern Controls */}
          <div className="grid grid-cols-1 gap-4 border-t border-slate-800 pt-5 sm:grid-cols-2">
            {/* Speed selector */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>سرعة حركة الخلفية الملونة</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {speedOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      onUpdateConfig({ ...config, animationSpeed: opt.id })
                    }
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      config.animationSpeed === opt.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {opt.icon}
                      {opt.label}
                    </span>
                    {config.animationSpeed === opt.id && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Doodle Pattern & Particles */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Sliders className="h-4 w-4 text-cyan-400" />
                  <span>تفاصيل النقش والجزيئات المضيئة</span>
                </div>

                <label className="flex cursor-pointer items-center justify-between text-xs text-slate-300">
                  <span>إظهار نقش رسومات الشات (Doodle)</span>
                  <input
                    type="checkbox"
                    checked={config.showDoodlePattern}
                    onChange={(e) =>
                      onUpdateConfig({
                        ...config,
                        showDoodlePattern: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-emerald-500"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between text-xs text-slate-300">
                  <span>إظهار الجزيئات المضيئة العائمة</span>
                  <input
                    type="checkbox"
                    checked={config.showFloatingParticles}
                    onChange={(e) =>
                      onUpdateConfig({
                        ...config,
                        showFloatingParticles: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-emerald-500"
                  />
                </label>
              </div>

              {config.showDoodlePattern && (
                <div className="mt-3 border-t border-slate-800/80 pt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>شفافية نقش الخلفية</span>
                    <span className="font-mono tabular-nums">
                      {Math.round(config.patternOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.03"
                    max="0.24"
                    step="0.01"
                    value={config.patternOpacity}
                    onChange={(e) =>
                      onUpdateConfig({
                        ...config,
                        patternOpacity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-6 py-3.5">
          <button
            type="button"
            onClick={() => {
              onSetContactCustomWallpaper(undefined);
              onUpdateConfig(DEFAULT_WALLPAPER_CONFIG);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>استعادة الإعدادات الافتراضية</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 whitespace-nowrap shrink-0"
          >
            حفظ وتطبيق المظهر
          </button>
        </div>
      </div>
    </div>
  );
};
