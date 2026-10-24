import React from 'react';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  /** 'white' sets the logo on a cream chip so it stays legible on dark backgrounds. */
  variant?: 'color' | 'white';
}

const HEIGHTS = {
  xs: 'h-5',
  sm: 'h-7',
  md: 'h-10',
  lg: 'h-14',
};

export function Logo({ size = 'md', className = '', variant = 'color' }: LogoProps) {
  const onDark = variant === 'white';
  return (
    <span
      className={`inline-flex select-none items-center ${onDark ? 'rounded-full bg-cream px-3 py-1' : ''} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-kulittea.png" alt="KulitYea" draggable={false} className={`${HEIGHTS[size]} w-auto`} />
    </span>
  );
}
