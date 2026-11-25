import React, { useEffect, useState } from 'react';
import {
  X,
  Settings,
  Monitor,
  Grid3X3,
  Layers,
  Tv,
  Gamepad2,
  RotateCcw,
  Trash2,
  Check,
} from 'lucide-react';
import {
  useTheme,
  PosterLabelMode,
  PosterDensity,
  StartupSection,
  ShaderPresetId,
  UiTheme,
} from '../context/ThemeContext';
import { ConsoleBoxOverlay } from './ConsoleBoxOverlay';
import { clearSteamGridCache } from '../steamgridApi';
import { clearRawgCache } from '../rawgApi';
import { SERVERS } from '../utils/movieServers';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateSection?: (tab: StartupSection) => void;
}

const PREVIEW_PS1_LABELED =
  'https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Boxarts/Crash%20Bandicoot%20(USA).png';
const PREVIEW_PS1_CLEAN =
  'https://cdn2.steamgriddb.com/grid/8282b546dda9ec05515966ba0fe3e5d1.png';
const PREVIEW_SNES_LABELED =
  'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Super_Nintendo_Entertainment_System/master/Named_Boxarts/Super%20Mario%20World%20(USA).png';
const PREVIEW_SNES_CLEAN =
  'https://images.launchbox-app.com/e1b184b1-6e29-4e11-889c-a2c0c4f8f547.jpg';

const SHADER_OPTIONS: { id: ShaderPresetId; label: string }[] = [
  { id: 'none', label: 'Smooth (Default)' },
  { id: 'crt', label: 'CRT Monitor' },
  { id: 'scanlines', label: 'Scanlines (240p)' },
  { id: 'pixel-perfect', label: 'Pixel-Perfect' },
  { id: 'crt-curved', label: 'CRT Curved' },
];

const STARTUP_OPTIONS: { id: StartupSection; label: string }[] = [
  { id: 'games', label: 'Games' },
  { id: 'movies', label: 'Movies' },
  { id: 'tv', label: 'TV Shows' },
  { id: 'anime', label: 'Anime' },
  { id: 'cartoons', label: 'Cartoons' },
  { id: 'nostalgia', label: 'Nostalgia TV' },
];

const THEME_OPTIONS: { id: UiTheme; label: string }[] = [
  { id: 'obsidian', label: 'Obsidian' },
  { id: 'netflix', label: 'Netflix' },
  { id: 'popcorn', label: 'WebPlay Time' },
  { id: 'gamonl', label: 'GAM.ONL' },
  { id: 'kaleidescape', label: 'Kaleidescape' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onNavigateSection,
}) => {
  const {
    theme,
    setTheme,
    isNetflix,
    isPopcorn,
    isGamOnl,
    isKaleidescape,
    settings,
    updateSettings,
    resetSettings,
  } = useTheme();
  const [cacheClearedNotice, setCacheClearedNotice] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accentActiveClass = isNetflix
    ? 'bg-[#E50914] text-white border-[#E50914]'
    : isPopcorn
    ? 'bg-[#3fa9f5] text-white border-[#3fa9f5]'
    : isGamOnl
    ? 'bg-[#22c55e] text-[#06110a] border-[#22c55e]'
    : isKaleidescape
    ? 'bg-[#f2c94c] text-[#05070b] border-[#f2c94c]'
    : 'bg-white text-black border-white';

  const inactiveBtnClass = isNetflix
    ? 'bg-[#1f1f1f] text-neutral-300 border-[#333333] hover:text-white hover:border-[#555555]'
    : isPopcorn
    ? 'bg-[#131926] text-neutral-300 border-[#28334d] hover:text-white hover:border-[#3fa9f5]/60'
    : isGamOnl
    ? 'bg-[#161a24] text-neutral-300 border-[#273045] hover:text-white hover:border-[#22c55e]/60'
    : isKaleidescape
    ? 'bg-[#0d1726] text-neutral-200 border-[#1f3b5c] hover:text-white hover:border-[#f2c94c]/70'
    : 'bg-[#16161b] text-neutral-300 border-[#292932] hover:text-white hover:border-[#3f3f4d]';

  const surfacePanelClass = isNetflix
    ? 'bg-[#141414] border-[#2c2c2c]'
    : isPopcorn
    ? 'bg-[#0e131e] border-[#25314a]'
    : isGamOnl
    ? 'bg-[#11141c] border-[#242b3d]'
    : isKaleidescape
    ? 'bg-[#070b12] border-[#1f3b5c]'
    : 'bg-[#101014] border-[#272730]';

  const sectionDividerClass = isNetflix
    ? 'border-[#252525]'
    : isPopcorn
    ? 'border-[#1f293d]'
    : isGamOnl
    ? 'border-[#1f2636]'
    : isKaleidescape
    ? 'border-[#152840]'
    : 'border-[#22222a]';

  const accentIconColor = isPopcorn
    ? 'text-[#3fa9f5]'
    : isNetflix
    ? 'text-[#E50914]'
    : isGamOnl
    ? 'text-[#22c55e]'
    : isKaleidescape
    ? 'text-[#f2c94c]'
    : 'text-white';

  const handleClearArtworkCache = () => {
    clearSteamGridCache();
    clearRawgCache();
    try {
      localStorage.removeItem('launchbox_3d_cache_v2');
    } catch {}
    setCacheClearedNotice(true);
    setTimeout(() => setCacheClearedNotice(false), 2600);
  };

  const serverEntries = Object.values(SERVERS).filter((s) => s.group !== 'language');

  const previewPs1Src =
    settings.posterLabelMode === 'labeled' ? PREVIEW_PS1_LABELED : PREVIEW_PS1_CLEAN;
  const previewSnesSrc =
    settings.posterLabelMode === 'labeled' ? PREVIEW_SNES_LABELED : PREVIEW_SNES_CLEAN;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-[0_28px_80px_rgba(0,0,0,0.85)] text-white ${surfacePanelClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-b backdrop-blur-md ${
            isNetflix
              ? 'bg-[#141414]/95 border-[#262626]'
              : isPopcorn
              ? 'bg-[#0e131e]/95 border-[#25314a]'
              : isGamOnl
              ? 'bg-[#11141c]/95 border-[#242b3d]'
              : isKaleidescape
              ? 'bg-[#070b12]/95 border-[#1f3b5c]'
              : 'bg-[#101014]/95 border-[#22222a]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                isNetflix
                  ? 'bg-[#E50914]/15 border-[#E50914]/40 text-[#E50914]'
                  : isPopcorn
                  ? 'bg-[#3fa9f5]/15 border-[#3fa9f5]/40 text-[#3fa9f5]'
                  : isGamOnl
                  ? 'bg-[#22c55e]/15 border-[#22c55e]/40 text-[#22c55e]'
                  : isKaleidescape
                  ? 'bg-[#f2c94c]/15 border-[#f2c94c]/40 text-[#f2c94c]'
                  : 'bg-white/10 border-white/15 text-white'
              }`}
            >
              <Settings size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                Settings
              </h2>
              <p className="text-xs text-neutral-400 truncate">
                Customize SteamGridDB console-labeled posters, layout, theme &amp; playback
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className={`w-9 h-9 rounded-full border grid place-items-center transition-colors cursor-pointer shrink-0 ${inactiveBtnClass}`}
          >
            <X size={17} />
          </button>
        </div>

        {/* Settings Sections */}
        <div className="p-6 space-y-7">
          {/* 1. Interface Theme & Startup Section */}
          <section className={`pb-6 border-b space-y-5 ${sectionDividerClass}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-white">Interface Theme</h3>
                <p className="text-xs text-neutral-400">
                  Switch between Obsidian, Netflix, WebPlay Time, GAM.ONL, and Kaleidescape.
                </p>
                <div className="flex flex-wrap gap-2">
                  {THEME_OPTIONS.map((opt) => {
                    const active = theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-setting-theme={opt.id}
                        onClick={() => setTheme(opt.id)}
                        className={`px-3.5 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active ? accentActiveClass : inactiveBtnClass
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-white">Default Startup Section</h3>
                <p className="text-xs text-neutral-400">
                  Choose which catalog opens automatically when visiting the site.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STARTUP_OPTIONS.map((opt) => {
                    const active = settings.defaultSection === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          updateSettings({ defaultSection: opt.id });
                          if (onNavigateSection) onNavigateSection(opt.id);
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active ? accentActiveClass : inactiveBtnClass
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 2. SteamGridDB Console-Labeled vs. Clean Posters */}
          <section className={`pb-6 border-b ${sectionDividerClass}`}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-7 space-y-4">
                <div className="flex items-center gap-2">
                  <Layers size={15} className={accentIconColor} />
                  <h3 className="text-sm font-bold text-white">Game Poster Style (SteamGridDB)</h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Choose real SteamGridDB &amp; retail cover photos that already have the console box label in the artwork (like the PlayStation PS1 label), clean SteamGridDB posters without labels, or clean posters with a subtle corner badge.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'labeled' as PosterLabelMode,
                        title: 'Labeled Posters',
                        desc: 'SteamGridDB / Retail console box art',
                      },
                      {
                        id: 'clean' as PosterLabelMode,
                        title: 'Clean Posters',
                        desc: 'SteamGridDB art without box labels',
                      },
                      {
                        id: 'overlay' as PosterLabelMode,
                        title: 'Corner Badge',
                        desc: 'Clean art + subtle top-left mark',
                      },
                    ] as const
                  ).map((opt) => {
                    const active = settings.posterLabelMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-setting-poster-mode={opt.id}
                        onClick={() => updateSettings({ posterLabelMode: opt.id })}
                        className={`text-left px-3.5 py-2.5 rounded-lg border transition-all cursor-pointer ${
                          active ? accentActiveClass : inactiveBtnClass
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-extrabold">{opt.title}</span>
                          {active && <Check size={13} className="shrink-0" />}
                        </div>
                        <p
                          className={`text-[10.5px] mt-0.5 leading-snug ${
                            active
                              ? theme === 'obsidian' || isGamOnl || isKaleidescape
                                ? 'text-neutral-900'
                                : 'text-white/90'
                              : 'text-neutral-400'
                          }`}
                        >
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Visual Preview comparing Real Console Box Scan vs Clean Artwork */}
              <div className="md:col-span-5 flex flex-col items-center md:items-end">
                <div className="w-full max-w-[240px]">
                  <div className="text-[11px] font-semibold text-neutral-400 mb-2 flex items-center justify-between">
                    <span>Live Artwork Preview</span>
                    <span className="text-neutral-300">
                      {settings.posterLabelMode === 'labeled'
                        ? 'Labeled Box'
                        : settings.posterLabelMode === 'overlay'
                        ? 'Corner Badge'
                        : 'No Labels'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="relative aspect-[2/3] rounded-md overflow-hidden border border-white/15 bg-black shadow-lg">
                      <img
                        src={previewPs1Src}
                        alt="PS1 Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (img.src !== PREVIEW_PS1_CLEAN) img.src = PREVIEW_PS1_CLEAN;
                        }}
                      />
                      <ConsoleBoxOverlay
                        consoleType="PS1"
                        mode={settings.posterLabelMode}
                        compact
                      />
                    </div>
                    <div className="relative aspect-[2/3] rounded-md overflow-hidden border border-white/15 bg-black shadow-lg">
                      <img
                        src={previewSnesSrc}
                        alt="SNES Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (img.src !== PREVIEW_SNES_CLEAN) img.src = PREVIEW_SNES_CLEAN;
                        }}
                      />
                      <ConsoleBoxOverlay
                        consoleType="SNES"
                        mode={settings.posterLabelMode}
                        compact
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Poster Grid Density & Card Details */}
          <section className={`pb-6 border-b space-y-5 ${sectionDividerClass}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Grid3X3 size={15} className={accentIconColor} />
                  <h3 className="text-sm font-bold text-white">Poster Grid Size</h3>
                </div>
                <p className="text-xs text-neutral-400">
                  Adjust how many game posters appear per row across the library.
                </p>
                <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-black/40 border border-white/10">
                  {(
                    [
                      { id: 'compact' as PosterDensity, label: 'Compact' },
                      { id: 'standard' as PosterDensity, label: 'Standard' },
                      { id: 'large' as PosterDensity, label: 'Large' },
                    ] as const
                  ).map((d) => {
                    const active = settings.posterDensity === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        data-setting-density={d.id}
                        onClick={() => updateSettings({ posterDensity: d.id })}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                          active ? accentActiveClass : 'border-transparent text-neutral-300 hover:text-white'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Monitor size={15} className={accentIconColor} />
                  <h3 className="text-sm font-bold text-white">Card Metadata Overlay</h3>
                </div>
                <p className="text-xs text-neutral-400">
                  Show or hide genre tags, card numbers, and release details on game cards.
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showCardMetadata}
                  data-setting-metadata-toggle="true"
                  onClick={() => updateSettings({ showCardMetadata: !settings.showCardMetadata })}
                  className={`inline-flex items-center gap-3 px-4 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    settings.showCardMetadata ? accentActiveClass : inactiveBtnClass
                  }`}
                >
                  <span>
                    {settings.showCardMetadata ? 'Card Details Visible' : 'Poster Artwork Only'}
                  </span>
                  <span
                    className={`w-8 h-4 rounded-full relative transition-colors ${
                      settings.showCardMetadata ? 'bg-black/25' : 'bg-white/15'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-current transition-transform ${
                        settings.showCardMetadata ? 'translate-x-4 left-0.5' : 'left-0.5'
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* 4. Emulator Shaders & Preferred Cinema Server */}
          <section className={`pb-6 border-b space-y-5 ${sectionDividerClass}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Gamepad2 size={15} className={accentIconColor} />
                  <h3 className="text-sm font-bold text-white">Retro Emulator Display Shader</h3>
                </div>
                <p className="text-xs text-neutral-400">
                  Applied automatically when launching classic console cartridges.
                </p>
                <select
                  value={settings.shaderPreset}
                  onChange={(e) => updateSettings({ shaderPreset: e.target.value as ShaderPresetId })}
                  aria-label="Retro Emulator Display Shader"
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-xs font-semibold outline-none cursor-pointer ${inactiveBtnClass}`}
                >
                  {SHADER_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#121218] text-white">
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Tv size={15} className={accentIconColor} />
                  <h3 className="text-sm font-bold text-white">Default Cinema Video Server</h3>
                </div>
                <p className="text-xs text-neutral-400">
                  Preferred streaming provider selected when opening a movie or series.
                </p>
                <select
                  value={settings.defaultVideoServer}
                  onChange={(e) => updateSettings({ defaultVideoServer: e.target.value })}
                  aria-label="Default Cinema Video Server"
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-xs font-semibold outline-none cursor-pointer ${inactiveBtnClass}`}
                >
                  {serverEntries.map((srv) => (
                    <option key={srv.key} value={srv.key} className="bg-[#121218] text-white">
                      {srv.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 5. Cache & Reset Footer Actions */}
          <section className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleClearArtworkCache}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${inactiveBtnClass}`}
              >
                {cacheClearedNotice ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-emerald-300">Poster Cache Cleared</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Clear Poster Art Cache</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetSettings}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${inactiveBtnClass}`}
              >
                <RotateCcw size={14} />
                <span>Reset Defaults</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2 rounded-lg border text-xs font-extrabold transition-colors cursor-pointer ${accentActiveClass}`}
            >
              Done
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
