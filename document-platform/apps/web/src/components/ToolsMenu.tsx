'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { listToolDefinitions } from '@docconv/tool-registry';
import { groupTools } from '../lib/tool-groups';
import { toolGroupIcon } from '../lib/tool-group-icons';
import { getToolPresentation } from '../lib/tools-registry';

const SECTIONS = groupTools(listToolDefinitions());
const TOOL_COUNT = listToolDefinitions().length;

/** Desktop "Tools" navigation item with a task-grouped dropdown. */
export function ToolsMenu({ active }: { active: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    // Navigating from the menu should never leave it covering the new page.
    // oxlint-disable-next-line react/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>('.tools-menu-trigger')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => cancelClose, []);

  return (
    <div
      ref={rootRef}
      className="tools-menu"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        cancelClose();
        setOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleClose();
      }}
    >
      <Link
        href="/tools"
        className={`tools-menu-trigger${active ? ' is-active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Tools <ChevronDown aria-hidden="true" />
      </Link>

      {open && (
        <div
          className="tools-menu-panel"
          role="region"
          aria-label="Tools by task"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setOpen(false);
          }}
        >
          <div className="tools-menu-grid">
            {SECTIONS.map(({ group, tools }) => {
              const GroupIcon = toolGroupIcon(group.id);
              return (
                <div key={group.id} className="tools-menu-group">
                  <Link href={`/tools?group=${group.id}`} className="tools-menu-group-title">
                    <GroupIcon aria-hidden="true" />
                    {group.title}
                  </Link>
                  <ul>
                    {tools.map((tool) => (
                      <li key={tool.slug}>
                        <Link href={`/tools/${tool.slug}`}>
                          {getToolPresentation(tool.slug).name || tool.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="tools-menu-footer">
            <span>
              Organize and edit tools run privately in your browser — files are never uploaded.
            </span>
            <Link href="/tools">
              View all {TOOL_COUNT} tools <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
