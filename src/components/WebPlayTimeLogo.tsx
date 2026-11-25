import React from 'react';

interface WebPlayTimeLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Exact Popcorn Time two-tone wordmark recreated for "WEBPLAY time":
 * Bold white uppercase geometric sans ("WEBPLAY") + glowing sky-blue cursive ("time")
 * tucked and tilted beneath the right tail.
 */
export const WebPlayTimeLogo: React.FC<WebPlayTimeLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const scaleClasses =
    size === 'sm'
      ? 'text-[17px] sm:text-[19px]'
      : size === 'lg'
      ? 'text-[26px] sm:text-[32px]'
      : 'text-[20px] sm:text-[24px]';

  const scriptSizeClasses =
    size === 'sm'
      ? 'text-[17px] sm:text-[19px] -mt-2.5 mr-0.5'
      : size === 'lg'
      ? 'text-[26px] sm:text-[31px] -mt-3.5 mr-1'
      : 'text-[21px] sm:text-[24px] -mt-3 mr-0.5';

  return (
    <span
      className={`inline-flex flex-col items-end leading-none select-none shrink-0 ${className}`}
      aria-label="WebPlay Time"
    >
      <span
        className={`font-popcorn-brand font-black uppercase tracking-[-0.04em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] ${scaleClasses}`}
      >
        WEBPLAY
      </span>
      <span
        className={`font-popcorn-script font-normal lowercase popcorn-time-glow -rotate-6 origin-center leading-none ${scriptSizeClasses}`}
      >
        time
      </span>
    </span>
  );
};

/**
 * Classic Popcorn Time slanted film clapperboard icon (Movies tab)
 */
export const PopcornClapperIcon: React.FC<{ active?: boolean; className?: string }> = ({
  active = false,
  className = '',
}) => (
  <svg
    viewBox="0 0 28 28"
    className={`w-6 h-6 transition-all ${active ? 'popcorn-nav-glow' : 'text-neutral-300'} ${className}`}
    fill="none"
    aria-hidden="true"
  >
    {/* Slanted top clapper */}
    <path
      d="M4.5 9.2 L21.5 4.4 L22.6 8.1 L5.6 12.9 Z"
      fill="currentColor"
      opacity={active ? 1 : 0.88}
    />
    <path d="M8 8.2 L9.8 11.7 M13.2 6.7 L15 10.2 M18.4 5.2 L20.2 8.7" stroke="#0c0e14" strokeWidth="1.5" />
    {/* Bottom slate body */}
    <rect
      x="5"
      y="12"
      width="18"
      height="11.5"
      rx="1.6"
      fill="currentColor"
      opacity={active ? 1 : 0.88}
    />
    <path d="M7.5 15.5 H20.5" stroke="#0c0e14" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M7.5 18.8 H15.5" stroke="#0c0e14" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

/**
 * Classic Popcorn Time rabbit-ear CRT TV icon (TV shows tab)
 */
export const PopcornRetroTvIcon: React.FC<{ active?: boolean; className?: string }> = ({
  active = false,
  className = '',
}) => (
  <svg
    viewBox="0 0 28 28"
    className={`w-6 h-6 transition-all ${active ? 'popcorn-nav-glow' : 'text-neutral-300'} ${className}`}
    fill="none"
    aria-hidden="true"
  >
    {/* Bunny-ear antennas */}
    <path
      d="M10 4.5 L14 9 L18 4.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Retro CRT TV frame */}
    <rect
      x="4"
      y="9"
      width="20"
      height="14.5"
      rx="2.6"
      stroke="currentColor"
      strokeWidth="1.9"
      fill={active ? 'rgba(63, 169, 245, 0.16)' : 'none'}
    />
    {/* Screen area */}
    <rect
      x="6.8"
      y="11.6"
      width="11.8"
      height="9.2"
      rx="1.2"
      stroke="currentColor"
      strokeWidth="1.3"
    />
    {/* Dial knobs on right */}
    <circle cx="21.2" cy="14" r="1.05" fill="currentColor" />
    <circle cx="21.2" cy="17.8" r="1.05" fill="currentColor" />
  </svg>
);

export default WebPlayTimeLogo;
