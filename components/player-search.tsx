'use client';
import {useEffect,useRef,useState,type CSSProperties,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {useIsMobile} from '@/hooks/use-mobile';
import {rankingPlayers,type RankingPlayer} from '@/lib/ranking-data';
import {Input} from '@/components/ui/input';
import {Badge} from '@/components/ui/badge';
import {Command,CommandEmpty,CommandItem,CommandList} from '@/components/ui/command';
const fmt=(value:number)=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(Math.round(value));
function playerSearchTokens(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function playerSearchScore(name: string, query: string) {
  const queryTokens = playerSearchTokens(query);
  if (!queryTokens.length) return 0;

  const nameTokens = playerSearchTokens(name);
  const normalizedName = nameTokens.join(' ');
  const normalizedQuery = queryTokens.join(' ');
  if (normalizedName.startsWith(normalizedQuery)) return 0;
  if (normalizedName.includes(normalizedQuery)) return 1;
  if (!queryTokens.every((queryToken) => nameTokens.some((nameToken) => nameToken.startsWith(queryToken)))) return Number.POSITIVE_INFINITY;
  return queryTokens.every((queryToken) => nameTokens.includes(queryToken)) ? 2 : 3;
}

type FloatingMenuPosition = CSSProperties & { maxHeight: number };

export function FloatingMenu({ anchorRef, open, children, minWidth = 0 }: {
  anchorRef: RefObject<HTMLInputElement | null>;
  open: boolean;
  children: (maxHeight: number) => ReactNode;
  minWidth?: number;
}) {
  const [position, setPosition] = useState<FloatingMenuPosition | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open || isMobile) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const spaceBelow = viewportTop + viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - viewportTop - 8;
      const placeBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
      const available = Math.max(96, placeBelow ? spaceBelow : spaceAbove);
      const maxHeight = Math.min(320, available);
      const width = Math.min(Math.max(rect.width, minWidth), viewportWidth - 16);
      const left = Math.min(Math.max(8, rect.left), viewportWidth - width - 8);

      setPosition({
        position: 'fixed',
        zIndex: 1000,
        left,
        width,
        maxHeight,
        ...(placeBelow
          ? { top: rect.bottom + 6 }
          : { bottom: window.innerHeight - rect.top + 6 }),
      });
    };

    updatePosition();
    const viewport = window.visualViewport;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    viewport?.addEventListener('resize', updatePosition);
    viewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      viewport?.removeEventListener('resize', updatePosition);
      viewport?.removeEventListener('scroll', updatePosition);
    };
  }, [anchorRef, isMobile, minWidth, open]);

  if (!open) return null;
  if (isMobile) {
    return (
      <div className="mt-1.5 overflow-hidden rounded-xl border bg-popover shadow-xl">
        {children(192)}
      </div>
    );
  }
  if (!position || typeof document === 'undefined') return null;
  return createPortal(
    <div style={position} className="overflow-hidden rounded-xl border bg-popover shadow-xl">
      {children(position.maxHeight)}
    </div>,
    document.body,
  );
}

export function PlayerSearch({ player, onChange, onSelect, index, disciplineCode, ariaLabel }: {
  player: { name: string };
  onChange: (value: string) => void;
  onSelect: (candidate: RankingPlayer) => void;
  index: number;
  disciplineCode?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = player.name.trim();
  const suggestions = rankingPlayers
    .filter(candidate => !disciplineCode || candidate.code === disciplineCode)
    .map((candidate) => ({ candidate, searchScore: playerSearchScore(candidate.name, query) }))
    .filter(({ searchScore }) => Number.isFinite(searchScore))
    .sort((a, b) => a.searchScore - b.searchScore || a.candidate.rank - b.candidate.rank)
    .map(({ candidate }) => candidate)
    .slice(0, 12);

  return (
    <div className="min-w-0">
      <Input autoCorrect="off" autoCapitalize="none" spellCheck={false} autoComplete="off"
        ref={inputRef}
        value={player.name}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 300)}
        onChange={(event) => { onChange(event.target.value); setOpen(true); }}
        aria-label={ariaLabel ?? `Player ${index + 1} name`}
        aria-autocomplete="list"
        aria-expanded={open}
        className="font-medium text-foreground"
        placeholder="Start typing player’s name here"
      />
      <FloatingMenu anchorRef={inputRef} open={open} minWidth={360}>
        {(maxHeight) => (
          <Command shouldFilter={false}>
            <CommandList
              className="max-h-none overscroll-contain [scrollbar-width:thin]"
              style={{ maxHeight, WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
              <CommandEmpty>No top 200 player or pair found.</CommandEmpty>
              {suggestions.map((candidate) => (
                <CommandItem
                  key={`${candidate.code}-${candidate.rank}-${candidate.name}`}
                  value={`${candidate.code}-${candidate.rank}-${candidate.name}`}
                  onSelect={() => { onSelect(candidate); setOpen(false); }}
                  className="grid grid-cols-[38px_minmax(0,1fr)_auto] gap-2 px-3 py-2.5 [&>svg:last-child]:hidden"
                >
                  <Badge variant="secondary">{candidate.code}</Badge>
                  <span className="min-w-0"><span className="block truncate font-medium">{candidate.name}</span><span className="block text-[11px] text-muted-foreground">World No. {candidate.rank} · {candidate.tournaments} tournaments</span></span>
                  <span className="text-xs tabular-nums text-muted-foreground">{fmt(candidate.points)}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        )}
      </FloatingMenu>
    </div>
  );
}

