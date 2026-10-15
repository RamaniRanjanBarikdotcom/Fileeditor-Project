'use client';

import { useEffect, useRef, useState } from 'react';

/** Width of an A4 page at 96 dpi (210 mm) plus the preview's own margin. */
const PAGE_WIDTH = 830;

/**
 * Shows a rendered document scaled to the available width, so the whole page
 * is visible (like a print preview) instead of being cropped. The document is
 * sandboxed: no scripts, no navigation, no network (its own CSP).
 */
export default function DocumentFrame({ html, title, maxHeight = '80vh' }: { html: string; title: string; maxHeight?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const update = () => setScale(Math.min(1, element.clientWidth / PAGE_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The iframe is drawn at full page size and scaled down; its height is set
  // so the visible (scaled) height matches the container.
  const visibleHeight = `min(${maxHeight}, ${Math.round(1200 * scale)}px)`;
  return (
    <div
      ref={container}
      className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-800"
      style={{ height: visibleHeight }}
    >
      <iframe
        title={title}
        sandbox=""
        srcDoc={html}
        style={{
          width: PAGE_WIDTH,
          height: `calc(${visibleHeight} / ${scale})`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          border: 0,
          display: 'block',
        }}
      />
    </div>
  );
}
