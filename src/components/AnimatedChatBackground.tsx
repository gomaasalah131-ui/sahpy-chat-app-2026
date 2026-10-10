import React from 'react';
import { WallpaperConfig, WallpaperThemeId } from '../types/chat';

interface AnimatedChatBackgroundProps {
  config: WallpaperConfig;
  overrideThemeId?: WallpaperThemeId;
}

export const WALLPAPER_THEMES: {
  id: WallpaperThemeId;
  name: string;
  subtitle: string;
  baseBg: string;
  previewGradient: string;
  orb1: string;
  orb2: string;
  orb3: string;
  accentGlow: string;
}[] = [
  {
    id: 'aurora-borealis',
    name: 'شفق قطبي متموج',
    subtitle: 'تدرجات الزمرد والسيان والبنفسجي الساحر',
    baseBg: 'bg-[#071118]',
    previewGradient: 'from-emerald-500 via-cyan-500 to-indigo-600',
    orb1: 'bg-emerald-500/30',
    orb2: 'bg-cyan-500/25',
    orb3: 'bg-indigo-600/30',
    accentGlow: 'from-emerald-500/15 via-teal-500/5 to-purple-600/15',
  },
  {
    id: 'neon-waves',
    name: 'أمواج نيون متدفقة',
    subtitle: 'طاقة لونية حية بين الفوشيا والأزرق الكهربائي',
    baseBg: 'bg-[#090817]',
    previewGradient: 'from-fuchsia-500 via-violet-600 to-cyan-400',
    orb1: 'bg-fuchsia-600/30',
    orb2: 'bg-violet-600/30',
    orb3: 'bg-cyan-400/25',
    accentGlow: 'from-fuchsia-500/15 via-violet-600/10 to-cyan-500/15',
  },
  {
    id: 'cosmic-nebula',
    name: 'مجرة كونية متلألئة',
    subtitle: 'عمق فضائي مع سحب لونية ونجوم مضيئة',
    baseBg: 'bg-[#060814]',
    previewGradient: 'from-indigo-600 via-purple-600 to-pink-500',
    orb1: 'bg-indigo-500/35',
    orb2: 'bg-purple-600/30',
    orb3: 'bg-pink-500/25',
    accentGlow: 'from-indigo-500/15 via-purple-500/10 to-pink-500/15',
  },
  {
    id: 'sunset-liquid',
    name: 'غروب استوائي متحرك',
    subtitle: 'دفء المرجان والذهب مع تدرج الشفق البنفسجي',
    baseBg: 'bg-[#120912]',
    previewGradient: 'from-rose-500 via-amber-500 to-purple-700',
    orb1: 'bg-rose-500/30',
    orb2: 'bg-amber-500/25',
    orb3: 'bg-purple-600/30',
    accentGlow: 'from-rose-500/15 via-amber-500/10 to-purple-700/15',
  },
  {
    id: 'emerald-matrix',
    name: 'زمرد واتساب الملكي',
    subtitle: 'الهوية الكلاسيكية الداكنة مع إضاءة زمردية متحركة',
    baseBg: 'bg-[#081410]',
    previewGradient: 'from-emerald-600 via-teal-700 to-slate-900',
    orb1: 'bg-emerald-500/25',
    orb2: 'bg-teal-500/25',
    orb3: 'bg-lime-500/15',
    accentGlow: 'from-emerald-600/15 via-teal-600/5 to-emerald-950/20',
  },
  {
    id: 'royal-amethyst',
    name: 'أرجواني مخملي فاخر',
    subtitle: 'تدرجات الكريستال البنفسجي والذهبي الهادئ',
    baseBg: 'bg-[#0e0816]',
    previewGradient: 'from-purple-600 via-fuchsia-700 to-amber-500',
    orb1: 'bg-purple-600/30',
    orb2: 'bg-fuchsia-600/25',
    orb3: 'bg-amber-500/20',
    accentGlow: 'from-purple-600/15 via-fuchsia-600/10 to-amber-500/10',
  },
];

export const AnimatedChatBackground: React.FC<AnimatedChatBackgroundProps> = ({
  config,
  overrideThemeId,
}) => {
  const activeThemeId = overrideThemeId || config.themeId;
  const theme =
    WALLPAPER_THEMES.find((t) => t.id === activeThemeId) || WALLPAPER_THEMES[0];

  const isPaused = config.animationSpeed === 'paused';
  const isFast = config.animationSpeed === 'dynamic';

  const animClass1 = isPaused
    ? ''
    : isFast
    ? 'animate-aurora-fast-1'
    : 'animate-aurora-1';
  const animClass2 = isPaused
    ? ''
    : isFast
    ? 'animate-aurora-fast-2'
    : 'animate-aurora-2';
  const animClass3 = isPaused
    ? ''
    : isFast
    ? 'animate-aurora-fast-3'
    : 'animate-aurora-3';

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${theme.baseBg} transition-colors duration-700`}
      aria-hidden="true"
    >
      {/* Ambient multi-stop radial mesh */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${theme.accentGlow} opacity-80`}
      />

      {/* Animated Colorful Fluid Orbs (GPU Composited transform/opacity only) */}
      <div
        className={`absolute -top-24 -right-20 h-[420px] w-[420px] rounded-full ${theme.orb1} blur-[95px] ${animClass1}`}
      />
      <div
        className={`absolute top-1/3 -left-24 h-[460px] w-[460px] rounded-full ${theme.orb2} blur-[110px] ${animClass2}`}
      />
      <div
        className={`absolute -bottom-28 right-1/4 h-[400px] w-[400px] rounded-full ${theme.orb3} blur-[100px] ${animClass3}`}
      />

      {/* Animated Flowing Wave Ribbons for Neon Waves / Sunset / Aurora */}
      <svg
        className={`absolute inset-0 h-full w-full opacity-25 ${
          isPaused ? '' : 'animate-wave-flow'
        }`}
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chatWaveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="chatWaveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path
          d="M-100 220 C 320 80, 620 420, 1020 200 C 1280 60, 1420 260, 1560 180 L 1560 900 L -100 900 Z"
          fill="url(#chatWaveGrad1)"
        />
        <path
          d="M-100 540 C 260 690, 740 330, 1140 560 C 1340 670, 1460 490, 1560 540 L 1560 900 L -100 900 Z"
          fill="url(#chatWaveGrad2)"
        />
      </svg>

      {/* Floating Luminous Particles */}
      {config.showFloatingParticles && (
        <div className="absolute inset-0">
          <div
            className={`absolute top-[14%] right-[18%] h-24 w-24 rounded-full bg-white/10 blur-2xl ${
              isPaused ? '' : 'animate-glow-slow'
            }`}
          />
          <div
            className={`absolute bottom-[22%] left-[24%] h-32 w-32 rounded-full bg-white/10 blur-2xl ${
              isPaused ? '' : 'animate-glow-slow'
            }`}
          />
          <svg className="h-full w-full opacity-35" viewBox="0 0 800 600">
            <circle cx="120" cy="95" r="2" fill="#34d399" />
            <circle cx="680" cy="140" r="2.5" fill="#38bdf8" />
            <circle cx="420" cy="75" r="1.8" fill="#c084fc" />
            <circle cx="240" cy="320" r="2.2" fill="#f472b6" />
            <circle cx="590" cy="290" r="1.6" fill="#fbbf24" />
            <circle cx="160" cy="490" r="2.4" fill="#2dd4bf" />
            <circle cx="710" cy="460" r="2" fill="#a78bfa" />
            <circle cx="390" cy="510" r="1.8" fill="#34d399" />
          </svg>
        </div>
      )}

      {/* Subtle WhatsApp-inspired Chat Doodle SVG Pattern Overlay */}
      {config.showDoodlePattern && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: config.patternOpacity }}
        >
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="whatsapp-doodle-pattern"
                width="120"
                height="120"
                patternUnits="userSpaceOnUse"
              >
                {/* Chat bubble outline */}
                <path
                  d="M20 24h22a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H28l-8 6V30a6 6 0 0 1 6-6z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  className="text-white"
                />
                {/* Sparkle / Star */}
                <path
                  d="M84 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  fill="none"
                  className="text-white"
                />
                {/* Heart icon */}
                <path
                  d="M34 86c-4-4-10-4-13 0-3 4-3 10 0 14l13 12 13-12c3-4 3-10 0-14-3-4-9-4-13 0z"
                  transform="scale(0.55) translate(25, 65)"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  fill="none"
                  className="text-white"
                />
                {/* Music / Voice wave */}
                <path
                  d="M78 78v16M84 72v28M90 76v20M96 82v8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  className="text-white"
                />
                {/* Geometric Hexagon */}
                <polygon
                  points="60,52 68,57 68,66 60,71 52,66 52,57"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  fill="none"
                  className="text-white"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#whatsapp-doodle-pattern)" />
          </svg>
        </div>
      )}

      {/* Soft vignette contrast scrim to guarantee WCAG AA legibility on all bubbles */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/55" />
    </div>
  );
};
