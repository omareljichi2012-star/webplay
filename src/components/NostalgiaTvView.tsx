import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tv,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Volume2,
  VolumeX,
  ExternalLink,
  Maximize2,
  Sparkles,
  Play,
  Film,
} from 'lucide-react';
import tvBezelImg from '../assets/images/retro_crt_tv_bezel_1795442336357.jpg';
import {
  NOSTALGIA_CHANNELS,
  NostalgiaChannelId,
  ArchiveBroadcastItem,
  fetchNostalgiaChannel,
  searchNostalgiaArchive,
  resolveArchiveStream,
} from '../services/internetArchive';

interface NostalgiaTvViewProps {
  externalSearch?: string;
}

export const NostalgiaTvView: React.FC<NostalgiaTvViewProps> = ({
  externalSearch = '',
}) => {
  const [activeChannelId, setActiveChannelId] =
    useState<NostalgiaChannelId>('nick-90s');
  const [searchInput, setSearchInput] = useState(externalSearch);
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  const [items, setItems] = useState<ArchiveBroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // Playback stream state inside the CRT TV bezel
  const [streamInfo, setStreamInfo] = useState<{
    mp4Url: string | null;
    embedUrl: string;
  } | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [playerMode, setPlayerMode] = useState<'video' | 'embed'>('video');
  const [muted, setMuted] = useState(false);
  const [crtScanlines, setCrtScanlines] = useState(true);
  const [channelStatic, setChannelStatic] = useState(false);
  const [osdVisible, setOsdVisible] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tvStageRef = useRef<HTMLDivElement | null>(null);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeChannel =
    NOSTALGIA_CHANNELS.find((c) => c.id === activeChannelId) ||
    NOSTALGIA_CHANNELS[0];

  const triggerChannelOsd = useCallback(() => {
    setOsdVisible(true);
    setChannelStatic(true);
    setTimeout(() => setChannelStatic(false), 320);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => setOsdVisible(false), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    };
  }, []);

  // Load channel catalog or Archive.org search results
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActiveIndex(0);

    const load = async () => {
      const list = activeSearchTerm.trim()
        ? await searchNostalgiaArchive(activeSearchTerm.trim(), 24)
        : await fetchNostalgiaChannel(activeChannelId, 24);
      if (cancelled) return;
      setItems(list);
      setLoading(false);
      triggerChannelOsd();
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeChannelId, activeSearchTerm, triggerChannelOsd]);

  const currentItem = items[activeIndex] || null;

  // Resolve direct MP4 stream + Archive embed URL whenever current broadcast changes
  useEffect(() => {
    if (!currentItem) {
      setStreamInfo(null);
      return;
    }
    let cancelled = false;
    setStreamLoading(true);

    resolveArchiveStream(currentItem.identifier)
      .then((res) => {
        if (cancelled) return;
        setStreamInfo(res);
        setPlayerMode(res.mp4Url ? 'video' : 'embed');
        setStreamLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setStreamInfo({ mp4Url: null, embedUrl: currentItem.embedUrl });
        setPlayerMode('embed');
        setStreamLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentItem]);

  // Sync mute state cleanly on direct video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  const handleSelectChannel = (chId: NostalgiaChannelId) => {
    setActiveSearchTerm('');
    setSearchInput('');
    setActiveChannelId(chId);
  };

  const handleStepChannel = (dir: -1 | 1) => {
    const idx = NOSTALGIA_CHANNELS.findIndex((c) => c.id === activeChannelId);
    const nextIdx =
      (idx + dir + NOSTALGIA_CHANNELS.length) % NOSTALGIA_CHANNELS.length;
    handleSelectChannel(NOSTALGIA_CHANNELS[nextIdx].id);
  };

  const handleNextProgram = () => {
    if (items.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % items.length);
    triggerChannelOsd();
  };

  const handlePrevProgram = () => {
    if (items.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
    triggerChannelOsd();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearchTerm(searchInput.trim());
  };

  const handleFullscreenTv = () => {
    const el = tvStageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="w-full max-w-[1320px] mx-auto px-3 sm:px-6 pt-3 pb-16 text-white space-y-6">
      {/* Top Broadcast Guide Header + Archive Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/10 pb-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <Tv size={20} className="text-amber-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Nostalgia TV
            </h1>
            <span className="text-xs font-medium text-neutral-400">
              · Internet Archive Broadcasts
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400">
            Tune through 90s cartoons &amp; Nickelodeon bumpers, 1920s silent comedy, 1990s/2000s vaults, movie trailers, and archived films.
          </p>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 w-full lg:w-auto lg:min-w-[340px]"
        >
          <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg bg-[#11151d] border border-white/15 focus-within:border-amber-400/70">
            <Search size={14} className="text-neutral-400 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Archive.org (e.g. Back to the Future, Chaplin)..."
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-neutral-500 outline-none"
            />
            {(searchInput || activeSearchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setActiveSearchTerm('');
                }}
                aria-label="Clear Archive search"
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Tune Archive
          </button>
        </form>
      </div>

      {/* Channel Guide Selector */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
        role="tablist"
        aria-label="Nostalgia TV channels"
      >
        {NOSTALGIA_CHANNELS.map((ch) => {
          const active = !activeSearchTerm && activeChannelId === ch.id;
          return (
            <button
              key={ch.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleSelectChannel(ch.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-amber-400 text-black border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                  : 'bg-[#10141c] text-neutral-300 border-white/10 hover:text-white hover:border-white/25'
              }`}
            >
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  active ? 'text-black/75' : 'text-amber-400'
                }`}
              >
                {ch.channelNumber}
              </span>
              <span>{ch.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Hero Stage: Physical CRT TV Bezel Set + Program Guide Drawer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left/Center: Authentic Vintage CRT Television Bezel Player */}
        <div className="xl:col-span-8 flex flex-col items-center">
          <div
            ref={tvStageRef}
            className="relative w-full max-w-[820px] aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.9)] select-none"
          >
            {/* Generated High-Fidelity CRT TV Set with Thick Bezel & Front Knobs */}
            <img
              src={tvBezelImg}
              alt="Vintage CRT Television Set Bezel"
              className="w-full h-full object-contain pointer-events-none select-none"
              draggable={false}
            />

            {/* Recessed CRT Glass Viewport aligned cleanly inside the TV bezel opening */}
            <div
              className="absolute overflow-hidden bg-[#040608]"
              style={{
                left: '20.1%',
                top: '15.2%',
                width: '59.8%',
                height: '55.2%',
                borderRadius: '18px',
                boxShadow:
                  'inset 0 0 28px rgba(0,0,0,0.95), inset 0 2px 10px rgba(255,255,255,0.06)',
              }}
            >
              {loading || streamLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#070b10] text-center p-4">
                  <div className="w-7 h-7 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                  <span className="font-mono text-xs text-emerald-400 tracking-wider uppercase">
                    Tuning {activeSearchTerm ? 'Archive' : activeChannel.channelNumber}...
                  </span>
                </div>
              ) : !currentItem ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#070b10] text-center p-4">
                  <Tv size={28} className="text-neutral-500" />
                  <p className="font-mono text-xs text-neutral-300">
                    NO SIGNAL — TRY ANOTHER CHANNEL OR SEARCH
                  </p>
                </div>
              ) : playerMode === 'video' && streamInfo?.mp4Url ? (
                <video
                  ref={videoRef}
                  key={streamInfo.mp4Url}
                  src={streamInfo.mp4Url}
                  poster={currentItem.thumbUrl}
                  autoPlay
                  controls
                  playsInline
                  muted={muted}
                  onEnded={handleNextProgram}
                  onError={() => setPlayerMode('embed')}
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <iframe
                  key={streamInfo?.embedUrl || currentItem.embedUrl}
                  src={streamInfo?.embedUrl || currentItem.embedUrl}
                  title={currentItem.title}
                  className="w-full h-full border-0 bg-black"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              )}

              {/* Toggleable Subtle CRT Scanline + Curved Glass Reflection Overlay */}
              {crtScanlines && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 3px), radial-gradient(circle at 50% 45%, transparent 62%, rgba(0,0,0,0.48) 100%)',
                  }}
                />
              )}

              {/* Brief Analog Snow burst on channel flip */}
              {channelStatic && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-65 mix-blend-screen"
                  style={{
                    backgroundImage:
                      'repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,0.45) 0, rgba(0,0,0,0.9) 2px, rgba(255,255,255,0.25) 4px)',
                  }}
                />
              )}

              {/* Classic Green CRT On-Screen Channel Stamp (OSD) */}
              {osdVisible && currentItem && (
                <div className="absolute top-3 right-3.5 pointer-events-none px-2.5 py-1 rounded bg-black/65 font-mono text-xs sm:text-sm font-bold text-[#39ff6a] drop-shadow-[0_0_8px_rgba(57,255,106,0.75)]">
                  {activeSearchTerm ? 'SEARCH' : activeChannel.channelNumber} · VIDEO
                </div>
              )}
            </div>

            {/* Interactive Hotspots mapped onto the physical TV bezel dial & buttons */}
            <button
              type="button"
              onClick={() => handleStepChannel(1)}
              title="Click Channel Dial (Next Channel)"
              aria-label="Channel dial next"
              className="absolute cursor-pointer rounded-full hover:ring-2 hover:ring-amber-400/60 transition-all"
              style={{ left: '44.5%', top: '79.5%', width: '6.8%', height: '9.2%' }}
            />
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              title="Toggle Mute on Volume Knob"
              aria-label="Toggle TV mute"
              className="absolute cursor-pointer rounded-full hover:ring-2 hover:ring-amber-400/60 transition-all"
              style={{ left: '54.4%', top: '80.5%', width: '5.8%', height: '8%' }}
            />
            <button
              type="button"
              onClick={() => handleStepChannel(1)}
              title="CH Up"
              aria-label="Channel up"
              className="absolute cursor-pointer rounded-full hover:ring-2 hover:ring-amber-400/60 transition-all"
              style={{ left: '68.6%', top: '82.8%', width: '2.6%', height: '3.6%' }}
            />
            <button
              type="button"
              onClick={() => handleStepChannel(-1)}
              title="CH Down"
              aria-label="Channel down"
              className="absolute cursor-pointer rounded-full hover:ring-2 hover:ring-amber-400/60 transition-all"
              style={{ left: '71.4%', top: '82.8%', width: '2.6%', height: '3.6%' }}
            />
          </div>

          {/* Below-TV Console Deck Controls + Now Playing Info */}
          <div className="w-full max-w-[820px] mt-3 px-4 py-3.5 rounded-xl bg-[#0e121a] border border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2 text-xs text-amber-400 font-bold tabular-nums">
                <span>
                  {activeSearchTerm
                    ? `Archive Search: "${activeSearchTerm}"`
                    : `${activeChannel.channelNumber} · ${activeChannel.label}`}
                </span>
                {currentItem?.year && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-neutral-300">{currentItem.year}</span>
                  </>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {currentItem ? currentItem.title : 'Waiting for signal...'}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handlePrevProgram}
                disabled={items.length <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#171d29] hover:bg-[#222b3d] border border-white/10 text-xs font-bold text-white cursor-pointer"
                title="Previous tape on this channel"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={handleNextProgram}
                disabled={items.length <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#171d29] hover:bg-[#222b3d] border border-white/10 text-xs font-bold text-white cursor-pointer"
                title="Next tape on this channel"
              >
                <span>Next Tape</span>
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={() =>
                  setPlayerMode((m) => (m === 'video' ? 'embed' : 'video'))
                }
                disabled={!streamInfo?.mp4Url}
                className="px-2.5 py-1.5 rounded-lg bg-[#171d29] hover:bg-[#222b3d] border border-white/10 text-xs font-semibold text-neutral-200 cursor-pointer"
                title="Switch between direct MP4 TV stream and Archive.org embed"
              >
                {playerMode === 'video' ? 'IA Embed' : 'Direct TV'}
              </button>

              <button
                type="button"
                onClick={() => setCrtScanlines((s) => !s)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                  crtScanlines
                    ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                    : 'bg-[#171d29] border-white/10 text-neutral-400'
                }`}
                title="Toggle CRT Glass Scanlines"
              >
                <Sparkles size={12} />
                <span>CRT</span>
              </button>

              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute TV' : 'Mute TV'}
                className="p-1.5 rounded-lg bg-[#171d29] hover:bg-[#222b3d] border border-white/10 text-white cursor-pointer"
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>

              <button
                type="button"
                onClick={handleFullscreenTv}
                aria-label="Fullscreen TV bezel"
                className="p-1.5 rounded-lg bg-[#171d29] hover:bg-[#222b3d] border border-white/10 text-white cursor-pointer"
              >
                <Maximize2 size={15} />
              </button>

              {currentItem && (
                <a
                  href={currentItem.detailsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View source record on Archive.org"
                  className="p-1.5 rounded-lg bg-[#171d29] hover:bg-[#222b3d] border border-white/10 text-neutral-300 hover:text-white"
                >
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Broadcast Tape Lineup for Selected Channel */}
        <div className="xl:col-span-4 rounded-xl bg-[#0c1017] border border-white/10 overflow-hidden flex flex-col max-h-[680px]">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 bg-[#101620]">
            <div>
              <h3 className="text-sm font-extrabold text-white">
                {activeSearchTerm ? 'Archive Search Results' : 'Channel Lineup'}
              </h3>
              <p className="text-[11px] text-neutral-400">
                {loading
                  ? 'Fetching reels from archive.org...'
                  : `${items.length} archived broadcasts ready`}
              </p>
            </div>
            {items.length > 1 && (
              <button
                type="button"
                onClick={handleNextProgram}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/15 text-[11px] font-bold text-amber-300 cursor-pointer"
              >
                <SkipForward size={12} />
                <span>Surf</span>
              </button>
            )}
          </div>

          <div className="overflow-y-auto divide-y divide-white/5 p-2 space-y-1">
            {loading ? (
              Array.from({ length: 7 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 p-2 rounded-lg bg-white/[0.03] animate-pulse"
                >
                  <div className="w-24 aspect-video rounded bg-white/10 shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-white/10 rounded w-4/5" />
                    <div className="h-2.5 bg-white/10 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <Film size={24} className="mx-auto text-neutral-500" />
                <p className="text-xs font-semibold text-neutral-300">
                  No matching archived videos found.
                </p>
                <p className="text-[11px] text-neutral-500">
                  Try another keyword or switch channels above.
                </p>
              </div>
            ) : (
              items.map((item, idx) => {
                const isPlaying = idx === activeIndex;
                return (
                  <button
                    key={`${item.identifier}-${idx}`}
                    type="button"
                    onClick={() => {
                      setActiveIndex(idx);
                      triggerChannelOsd();
                    }}
                    className={`w-full text-left flex items-start gap-3 p-2 rounded-lg border transition-colors cursor-pointer ${
                      isPlaying
                        ? 'bg-amber-400/12 border-amber-400/50'
                        : 'bg-transparent border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className="relative w-24 aspect-video rounded overflow-hidden bg-black border border-white/10 shrink-0">
                      <img
                        src={item.thumbUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.opacity = '0';
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                        {isPlaying && (
                          <span className="w-6 h-6 rounded-full bg-amber-400 text-black grid place-items-center shadow">
                            <Play size={11} fill="currentColor" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div
                        className={`text-xs font-bold leading-snug line-clamp-2 ${
                          isPlaying ? 'text-amber-300' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate tabular-nums">
                        {[item.year, item.runtime || item.creator]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NostalgiaTvView;
