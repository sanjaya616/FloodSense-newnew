/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

/**
 * Subtle intersection-based reveal that remains completely visible under
 * prefers-reduced-motion or if an element starts near/above the fold.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  delayMs = 0,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      style={{
        transitionDuration: '650ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: `${delayMs}ms`,
      }}
      className={`transition-[opacity,transform] ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } ${className}`}
    >
      {children}
    </div>
  );
};

interface EditorialImageProps {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  caption?: string;
  darkSurface?: boolean;
}

/**
 * Renders a local asset from public/assets/images/ with graceful error handling
 * so missing user-supplied media falls back cleanly to bundled local photography
 * or an architectural monochrome canvas without broken image frames.
 */
export const EditorialImage: React.FC<EditorialImageProps> = ({
  src,
  fallbackSrc,
  alt,
  className = 'w-full h-full object-cover',
  caption,
  darkSurface = true,
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [exhausted, setExhausted] = useState<boolean>(false);

  useEffect(() => {
    setCurrentSrc(src);
    setExhausted(false);
  }, [src]);

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setExhausted(true);
    }
  };

  if (exhausted) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative overflow-hidden flex items-end p-6 ${
          darkSurface
            ? 'bg-[#181818] text-white'
            : 'bg-[#EEEEEB] text-[#171717]'
        } ${className}`}
      >
        {/* Subtle topographic architectural contour lines */}
        <svg
          aria-hidden="true"
          viewBox="0 0 800 500"
          className="absolute inset-0 w-full h-full opacity-[0.14] pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
        >
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M-40 120 Q 180 60, 420 140 T 860 110" />
            <path d="M-40 190 Q 210 130, 450 210 T 860 180" />
            <path d="M-40 260 Q 240 200, 470 280 T 860 250" />
            <path d="M-40 330 Q 220 270, 460 350 T 860 320" />
            <path d="M-40 400 Q 200 340, 430 420 T 860 390" />
          </g>
        </svg>
        {caption && (
          <p className="relative z-10 text-xs font-mono tracking-wide uppercase opacity-75">
            {caption}
          </p>
        )}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={handleError}
      referrerPolicy="no-referrer"
      className={className}
    />
  );
};
