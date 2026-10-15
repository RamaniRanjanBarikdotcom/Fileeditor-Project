import {
  Minimize2,
  Scissors,
  ShieldCheck,
  FileInput,
  FileOutput,
  FilePen,
  Globe,
  Image,
  Layers,
  LucideIcon,
  PenLine,
  Wrench,
} from 'lucide-react';

export const TOOL_GROUP_ICONS: Record<string, LucideIcon> = {
  'organize-pdf': Layers,
  'split-pdf': Scissors,
  'optimize-pdf': Minimize2,
  'pdf-security': ShieldCheck,
  'edit-pdf': PenLine,
  'convert-to-pdf': FileInput,
  'convert-from-pdf': FileOutput,
  image: Image,
  web: Globe,
  editors: FilePen,
  more: Wrench,
};

export function toolGroupIcon(groupId: string): LucideIcon {
  return TOOL_GROUP_ICONS[groupId] ?? Wrench;
}
