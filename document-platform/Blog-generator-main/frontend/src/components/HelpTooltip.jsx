import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

// A small "?" help icon that reveals `text` on hover (desktop) and on tap/click (touch).
// Tapping toggles it; tapping/clicking outside closes it.
export default function HelpTooltip({ text, label = 'More info', align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const alignClass = align === 'left' ? 'left-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0';

  return (
    <span ref={ref} className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          // Don't trigger any parent/row action when toggling the tooltip.
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <span
        className={`pointer-events-none absolute top-full z-50 mt-1.5 w-60 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-lg ${alignClass} ${
          open ? 'block' : 'hidden group-hover:block'
        }`}
      >
        {text}
      </span>
    </span>
  );
}
