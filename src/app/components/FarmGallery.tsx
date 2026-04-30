import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

interface FarmGalleryProps {
  photos: string[];
}

export function FarmGallery({ photos }: FarmGalleryProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [lbDirection, setLbDirection] = useState(0);

  // Pinch-zoom state
  const [lbScale, setLbScale] = useState(1);
  const pinchDist = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  const swipeStartX = useRef<number | null>(null);
  const isMultiTouch = useRef(false);
  // Swipe for main gallery
  const mainSwipeStartX = useRef<number | null>(null);

  const count = photos.length;
  if (count === 0) return null;

  const go = useCallback((idx: number, dir: number) => {
    setDirection(dir);
    setCurrent(idx);
  }, []);

  const prev = () => go((current - 1 + count) % count, -1);
  const next = () => go((current + 1) % count, 1);

  const openLightbox = (idx: number) => {
    setLbDirection(0);
    setLbScale(1);
    setLightbox(idx);
  };

  const closeLightbox = () => {
    setLightbox(null);
    setLbScale(1);
  };

  const lbPrev = useCallback(() => {
    setLbDirection(-1);
    setLbScale(1);
    setLightbox(l => l !== null ? (l - 1 + count) % count : null);
  }, [count]);

  const lbNext = useCallback(() => {
    setLbDirection(1);
    setLbScale(1);
    setLightbox(l => l !== null ? (l + 1) % count : null);
  }, [count]);

  // Keyboard navigation
  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') lbPrev();
      else if (e.key === 'ArrowRight') lbNext();
      else if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, lbPrev, lbNext]);

  // Prevent body scroll when lightbox open
  useEffect(() => {
    if (lightbox !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  // ── Touch handlers ──────────────────────────────────────────────
  const getPinchDist = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Main gallery swipe handlers
  const handleMainTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      mainSwipeStartX.current = e.touches[0].clientX;
    }
  };

  const handleMainTouchEnd = (e: React.TouchEvent) => {
    if (mainSwipeStartX.current !== null && e.changedTouches.length >= 1 && count > 1) {
      const diff = mainSwipeStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        diff > 0 ? next() : prev();
      }
      mainSwipeStartX.current = null;
    }
  };

  const handleLbTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isMultiTouch.current = true;
      swipeStartX.current = null;
      pinchDist.current = getPinchDist(e.touches);
      pinchStartScale.current = lbScale;
    } else if (e.touches.length === 1) {
      isMultiTouch.current = false;
      if (lbScale <= 1) {
        swipeStartX.current = e.touches[0].clientX;
      }
    }
  };

  const handleLbTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDist.current !== null) {
      e.preventDefault();
      const dist = getPinchDist(e.touches);
      const newScale = Math.max(1, Math.min(5, pinchStartScale.current * (dist / pinchDist.current)));
      setLbScale(newScale);
    }
  };

  const handleLbTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchDist.current = null;
      // Snap back to 1x if barely pinched
      if (lbScale < 1.15) {
        setLbScale(1);
      }
    }
    // Swipe navigation (only when not zoomed and single touch)
    if (
      !isMultiTouch.current &&
      swipeStartX.current !== null &&
      e.changedTouches.length >= 1 &&
      lbScale <= 1 &&
      count > 1
    ) {
      const diff = swipeStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 48) {
        diff > 0 ? lbNext() : lbPrev();
      }
      swipeStartX.current = null;
    }
    if (e.touches.length === 0) {
      isMultiTouch.current = false;
    }
  };
  // ────────────────────────────────────────────────────────────────

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  const transition = { duration: 0.38, ease: [0.32, 0, 0.67, 0] as any };

  return (
    <>
      {/* ─── Gallery block ─── */}
      <div className="pt-6 mt-2 border-t border-[#222222]/10">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#222222]/40 mb-4">
          Ферма
        </p>

        {/* Main slider */}
        <div
          className="relative w-full overflow-hidden rounded-2xl bg-[#1a1a1a] select-none group"
          style={{ height: 320 }}
          onTouchStart={handleMainTouchStart}
          onTouchEnd={handleMainTouchEnd}
        >
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={current}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="absolute inset-0 flex items-center justify-center cursor-zoom-in"
              onClick={() => openLightbox(current)}
            >
              <img
                src={photos[current]}
                alt={`Ферма ${current + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
              />

              {/* Zoom hint - desktop only */}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-full">
                  <ZoomIn className="w-3 h-3" />
                  Увеличить
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Prev / Next arrows - desktop only */}
          {count > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 backdrop-blur-sm text-white hidden md:flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 backdrop-blur-sm text-white hidden md:flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Counter pill */}
          {count > 1 && (
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full pointer-events-none">
              {current + 1} / {count}
            </div>
          )}
        </div>

        {/* Dot indicators */}
        {count > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i, i > current ? 1 : -1)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: i === current ? 20 : 6,
                  height: 6,
                  background: '#FF90A1',
                  opacity: i === current ? 1 : 0.35,
                }}
              />
            ))}
          </div>
        )}

        {/* Thumbnail strip */}
        {count > 1 && (
          <div className="overflow-x-auto mt-3 scrollbar-hide py-3 px-2">
            <div className="flex gap-2" style={{ width: 'max-content' }}>
              {photos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => go(i, i > current ? 1 : -1)}
                  className={`flex-none rounded-xl transition-all duration-200 ${
                    i === current
                      ? 'border-2 border-[#FF90A1] opacity-100'
                      : 'border-2 border-transparent opacity-55 hover:opacity-80'
                  }`}
                  style={{ width: 64, height: 64 }}
                >
                  <div className="w-full h-full rounded-[10px] overflow-hidden">
                    <img
                      src={url}
                      alt={`thumb ${i + 1}`}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Lightbox ─── */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            key="lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Counter */}
            {count > 1 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 text-white text-sm px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none z-20">
                {lightbox + 1} / {count}
              </div>
            )}

            {/* Scale indicator when zoomed */}
            {lbScale > 1.1 && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none md:hidden">
                <div className="bg-white/10 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
                  {lbScale.toFixed(1)}×
                </div>
              </div>
            )}

            {/* Image container with pinch zoom + swipe */}
            <div
              className="relative w-full h-full flex items-center justify-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleLbTouchStart}
              onTouchMove={handleLbTouchMove}
              onTouchEnd={handleLbTouchEnd}
              style={{ touchAction: 'none' }}
            >
              <AnimatePresence initial={false} custom={lbDirection} mode="popLayout">
                <motion.div
                  key={`lb-${lightbox}`}
                  custom={lbDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={transition}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <img
                    src={photos[lightbox]}
                    alt={`Ферма ${lightbox + 1}`}
                    // Mobile: full width, no rounding. Desktop: auto size with rounding
                    className="block w-full h-auto md:w-auto md:max-h-[85vh] md:max-w-[90vw] md:rounded-xl md:shadow-2xl object-contain"
                    style={{
                      transform: `scale(${lbScale})`,
                      transition: lbScale === 1 ? 'transform 0.2s ease' : 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                    }}
                    draggable={false}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Lightbox prev/next arrows — desktop only */}
            {count > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); lbPrev(); }}
                  className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-sm text-white items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); lbNext(); }}
                  className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-sm text-white items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Lightbox thumbnails */}
            {count > 1 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 max-w-[95vw] overflow-x-auto py-1">
                <div className="flex gap-2 px-2">
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLbDirection(i > lightbox ? 1 : -1);
                        setLbScale(1);
                        setLightbox(i);
                      }}
                      className={`flex-none rounded-lg transition-all duration-200 ${
                        i === lightbox
                          ? 'border-2 border-[#FF90A1] opacity-100'
                          : 'border-2 border-transparent opacity-50 hover:opacity-75'
                      }`}
                      style={{ width: 44, height: 44 }}
                    >
                      <div className="w-full h-full rounded-[6px] overflow-hidden">
                        <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}