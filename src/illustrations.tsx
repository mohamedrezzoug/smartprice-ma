import {useId, type ReactNode} from 'react'
import type {ArtKind} from './art'

/* ------------------------------------------------------------------ *
 * 3D-style SVG illustrations (no external assets → works offline).
 * Every illustration uses gradients + speculars + soft contact shadow
 * to simulate volume. IDs are namespaced with useId so many instances
 * can live on the same page.
 * ------------------------------------------------------------------ */

const useUid = () => 'a' + useId().replace(/[^a-zA-Z0-9]/g, '')

/** Horizontal gradient that makes a flat shape read as a cylinder. */
const Cyl = ({id, dark, base, light}: {id: string; dark: string; base: string; light: string}) => (
  <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stopColor={dark} />
    <stop offset=".22" stopColor={base} />
    <stop offset=".42" stopColor={light} />
    <stop offset=".72" stopColor={base} />
    <stop offset="1" stopColor={dark} />
  </linearGradient>
)

const Lin = ({id, from, to, vertical = true}: {id: string; from: string; to: string; vertical?: boolean}) => (
  <linearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
    <stop offset="0" stopColor={from} />
    <stop offset="1" stopColor={to} />
  </linearGradient>
)

const Shadow = ({u, rx = 30, cy = 108}: {u: string; rx?: number; cy?: number}) => (
  <ellipse cx="60" cy={cy} rx={rx} ry="5.5" fill={`url(#${u}-sh)`} />
)

const ShadowDef = ({u}: {u: string}) => (
  <radialGradient id={`${u}-sh`}>
    <stop offset="0" stopColor="#063b2b" stopOpacity=".38" />
    <stop offset="1" stopColor="#063b2b" stopOpacity="0" />
  </radialGradient>
)

const Gloss = ({u}: {u: string}) => (
  <linearGradient id={`${u}-gl`} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor="#fff" stopOpacity=".85" />
    <stop offset="1" stopColor="#fff" stopOpacity="0" />
  </linearGradient>
)

/** Oblique-projected box: front face + right side + top. */
function Box({x, y, w, h, d, front, side, top, children}: {
  x: number; y: number; w: number; h: number; d: number
  front: string; side: string; top: string; children?: ReactNode
}) {
  const dx = d * 0.7, dy = d * 0.45
  return (
    <g>
      <path d={`M${x + w} ${y} L${x + w + dx} ${y - dy} L${x + w + dx} ${y + h - dy} L${x + w} ${y + h}Z`} fill={side} />
      <path d={`M${x} ${y} L${x + dx} ${y - dy} L${x + w + dx} ${y - dy} L${x + w} ${y}Z`} fill={top} />
      <rect x={x} y={y} width={w} height={h} fill={front} />
      {children}
    </g>
  )
}

function Svg({children, className, label}: {children: ReactNode; className?: string; label?: string}) {
  return (
    <svg viewBox="0 0 120 120" className={className} role={label ? 'img' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </svg>
  )
}

/* ------------------------------ items ------------------------------ */

function Oil({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} /><Gloss u={u} />
      <Cyl id={`${u}-b`} dark="#a7650a" base="#eaa623" light="#ffe39a" />
      <Cyl id={`${u}-c`} dark="#045c40" base="#0d9b6c" light="#5fe0b0" />
    </defs>
    <Shadow u={u} rx={26} />
    <path d="M52 30h16v6q0 6 8 11q7 4 7 13v42q0 6-6 6H43q-6 0-6-6V60q0-9 7-13q8-5 8-11z" fill={`url(#${u}-b)`} />
    <path d="M37 62h46v4H37z" fill="#fff" opacity=".25" />
    <rect x="49" y="15" width="22" height="16" rx="4" fill={`url(#${u}-c)`} />
    <rect x="49" y="15" width="22" height="4" rx="2" fill="#7ff0c7" opacity=".55" />
    <path d="M38 68h44v28H38z" fill="#fff" opacity=".95" />
    <path d="M38 68h44v6H38z" fill="#0d9b6c" />
    <path d="M60 78c-5 6-6 9-6 11a6 6 0 0012 0c0-2-1-5-6-11z" fill="#eaa623" />
    <rect x="44" y="45" width="5" height="57" rx="2.5" fill={`url(#${u}-gl)`} />
  </>
}

function Sugar({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} /><Gloss u={u} />
      <Cyl id={`${u}-b`} dark="#c6d3dc" base="#f2f6f9" light="#ffffff" />
      <Lin id={`${u}-cf`} from="#ffffff" to="#e7edf2" />
    </defs>
    <Shadow u={u} rx={34} />
    <path d="M30 26q30-7 60 0l4 76q-34 8-68 0z" fill={`url(#${u}-b)`} />
    <path d="M30 26q30-7 60 0l.6 7q-30-6-60 0z" fill="#cbd6de" />
    <path d="M28 52q32-6 64 0v24q-32 6-64 0z" fill="#1f6fd1" />
    <path d="M28 52q32-6 64 0v5q-32-6-64 0z" fill="#64a6ff" />
    <text x="60" y="70" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Manrope,sans-serif">SUCRE</text>
    <rect x="37" y="32" width="5" height="64" rx="2.5" fill={`url(#${u}-gl)`} opacity=".7" />
    {/* sugar cubes */}
    <Box x={66} y={94} w={14} h={11} d={9} front={`url(#${u}-cf)`} side="#cfd9e1" top="#ffffff" />
    <Box x={82} y={98} w={11} h={8} d={7} front={`url(#${u}-cf)`} side="#cfd9e1" top="#ffffff" />
  </>
}

function Milk({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} />
      <Lin id={`${u}-f`} from="#ffffff" to="#e6eef7" />
      <Lin id={`${u}-s`} from="#c9d7e6" to="#a9bdd2" />
    </defs>
    <Shadow u={u} rx={30} />
    <path d="M70 52L88 44V98L70 106z" fill={`url(#${u}-s)`} />
    <path d="M53 30L70 52L88 44L71 22z" fill="#dbe6f1" />
    <path d="M36 46L53 30L70 52z" fill="#f4f8fc" />
    <path d="M51 31.5L69 23.5L72 20.5L54 28.5z" fill="#c4d3e2" />
    <path d="M36 46L70 52V106L36 100z" fill={`url(#${u}-f)`} />
    <path d="M36 74q9-6 17 0t17 2V106L36 100z" fill="#1d7be0" />
    <path d="M70 76q9-2 18-8V98L70 106z" fill="#1561b8" />
    <path d="M53 58c-5 6-6 9-6 11a6 6 0 0012 0c0-2-1-5-6-11z" fill="#1d7be0" opacity=".85" />
    <path d="M40 50l3 .6v44l-3-.6z" fill="#fff" opacity=".9" />
  </>
}

function Flour({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} /><Gloss u={u} />
      <Cyl id={`${u}-b`} dark="#b88a4a" base="#e7c58c" light="#f8e5c0" />
    </defs>
    <Shadow u={u} rx={30} />
    <path d="M34 34h52l3 70q-29 5-58 0z" fill={`url(#${u}-b)`} />
    <path d="M32 24h56v12q-28 5-56 0z" fill="#d4ad6f" />
    <path d="M32 24h56v3q-28 4-56 0z" fill="#f4dcae" />
    <g stroke="#9a6a28" strokeWidth="2.2" fill="#c98a2c" strokeLinecap="round">
      <path d="M60 92V52" fill="none" />
      {[56, 64, 72, 80].map(y => <g key={y}>
        <ellipse cx="54.5" cy={y} rx="5" ry="2.6" transform={`rotate(-35 54.5 ${y})`} strokeWidth="0" />
        <ellipse cx="65.5" cy={y} rx="5" ry="2.6" transform={`rotate(35 65.5 ${y})`} strokeWidth="0" />
      </g>)}
      <ellipse cx="60" cy="49" rx="2.6" ry="5" strokeWidth="0" />
    </g>
    <rect x="40" y="38" width="5" height="62" rx="2.5" fill={`url(#${u}-gl)`} opacity=".7" />
  </>
}

function Rice({u}: {u: string}) {
  const grains = Array.from({length: 26}, (_, i) => ({x: 38 + ((i * 37) % 44), y: 40 + ((i * 23) % 56), r: (i * 47) % 180}))
  return <>
    <defs>
      <ShadowDef u={u} /><Gloss u={u} />
      <Cyl id={`${u}-b`} dark="#d8d1bd" base="#f6f2e6" light="#ffffff" />
    </defs>
    <Shadow u={u} rx={32} />
    <path d="M32 28q28-7 56 0l4 74q-32 8-64 0z" fill={`url(#${u}-b)`} />
    {grains.map((g, i) => <ellipse key={i} cx={g.x} cy={g.y} rx="2.6" ry="1.1" fill="#fff" stroke="#e1d8bf" strokeWidth=".5" transform={`rotate(${g.r} ${g.x} ${g.y})`} />)}
    <path d="M30 60q30-6 60 0v22q-30 6-60 0z" fill="#d6332f" />
    <path d="M30 60q30-6 60 0v4q-30-6-60 0z" fill="#ff7a6e" />
    <text x="60" y="76" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ffd65c" fontFamily="Manrope,sans-serif">RIZ</text>
    <path d="M32 28q28-7 56 0l.5 6q-28-6-57 0z" fill="#d6332f" />
    <rect x="38" y="34" width="5" height="62" rx="2.5" fill={`url(#${u}-gl)`} opacity=".8" />
  </>
}

function Pasta({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} />
      <Lin id={`${u}-f`} from="#2a5bd7" to="#173c9c" />
      <Lin id={`${u}-p`} from="#ffd56a" to="#e9a522" />
    </defs>
    <Shadow u={u} rx={34} />
    <Box x={30} y={40} w={48} h={64} d={20} front={`url(#${u}-f)`} side="#122f7b" top="#4b7cf0">
      <rect x="36" y="50" width="36" height="30" rx="7" fill="#fff8e6" />
      {[[42, 58, 30], [52, 56, -25], [62, 60, 40], [46, 70, -40], [57, 71, 20], [66, 70, -15]].map(([x, y, r], i) =>
        <rect key={i} x={x - 5} y={y - 2.6} width="10" height="5.2" rx="2.6" fill={`url(#${u}-p)`} stroke="#c98a14" strokeWidth=".6" transform={`rotate(${r} ${x} ${y})`} />)}
      <text x="54" y="96" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" fontFamily="Manrope,sans-serif">PENNE</text>
      <rect x="32" y="42" width="3" height="60" fill="#fff" opacity=".25" />
    </Box>
  </>
}

function Tea({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} />
      <Lin id={`${u}-f`} from="#13a06e" to="#08603f" />
      <Lin id={`${u}-g`} from="#ffe08a" to="#d39b22" />
    </defs>
    <Shadow u={u} rx={34} />
    <Box x={28} y={46} w={50} h={58} d={22} front={`url(#${u}-f)`} side="#054a30" top="#3cc792">
      <rect x="28" y="88" width="50" height="5" fill={`url(#${u}-g)`} />
      <path d="M53 56c-12 4-16 14-12 24 10 0 18-8 18-22-2 0-4-1-6-2z" fill={`url(#${u}-g)`} />
      <path d="M43 79c3-7 8-13 14-17" stroke="#08603f" strokeWidth="1.6" fill="none" />
      <rect x="30" y="48" width="3" height="54" fill="#fff" opacity=".22" />
    </Box>
  </>
}

function Cleaner({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} /><Gloss u={u} />
      <Cyl id={`${u}-b`} dark="#08707f" base="#16b4c9" light="#8beaf5" />
      <Cyl id={`${u}-c`} dark="#c2410c" base="#fb923c" light="#ffd2a8" />
    </defs>
    <Shadow u={u} rx={28} />
    <path d="M40 46q0-14 14-16V22h14v8q14 2 16 16v56q0 6-6 6H46q-6 0-6-6z" fill={`url(#${u}-b)`} />
    <path d="M70 38q8 2 9 10v8q-5-2-9-2z" fill="#05505b" opacity=".55" />
    <rect x="53" y="12" width="16" height="12" rx="3" fill={`url(#${u}-c)`} />
    <rect x="44" y="62" width="36" height="32" rx="6" fill="#fff" />
    <path d="M62 68l2.4 5 5 2.4-5 2.4-2.4 5-2.4-5-5-2.4 5-2.4z" fill="#16b4c9" />
    <circle cx="71" cy="85" r="3" fill="#8beaf5" /><circle cx="52" cy="86" r="2" fill="#8beaf5" />
    <rect x="45" y="40" width="5" height="62" rx="2.5" fill={`url(#${u}-gl)`} opacity=".8" />
  </>
}

function Detergent({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} />
      <Lin id={`${u}-f`} from="#ff8a2a" to="#e0560b" />
    </defs>
    <Shadow u={u} rx={36} />
    <path d="M40 32q14-12 28 0" stroke="#2b2f36" strokeWidth="4" fill="none" strokeLinecap="round" />
    <Box x={26} y={38} w={54} h={66} d={20} front={`url(#${u}-f)`} side="#b6400a" top="#ffb070">
      <path d="M26 74q14-10 27 0t27 0V104H26z" fill="#1d6fe0" />
      <path d="M26 74q14-10 27 0t27 0v4q-14 10-27 0t-27 0z" fill="#6aaeff" />
      {[[42, 56, 7], [56, 50, 5], [64, 61, 6], [50, 64, 3.5]].map(([x, y, r], i) =>
        <g key={i}><circle cx={x} cy={y} r={r} fill="#fff" opacity=".9" /><circle cx={x - r / 3} cy={y - r / 3} r={r / 3} fill="#fff" /></g>)}
      <rect x="28" y="40" width="3" height="62" fill="#fff" opacity=".25" />
    </Box>
  </>
}

function Diapers({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} /><Gloss u={u} />
      <Cyl id={`${u}-b`} dark="#6f9fd8" base="#a9cdf7" light="#e4f1ff" />
    </defs>
    <Shadow u={u} rx={38} />
    <path d="M24 38q0-12 12-12h48q12 0 12 12v58q0 10-12 10H36q-12 0-12-10z" fill={`url(#${u}-b)`} />
    {[38, 50, 62, 74, 86].map(x => <path key={x} d={`M${x} 30v72`} stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" />)}
    <circle cx="60" cy="64" r="17" fill="#fff" />
    <circle cx="60" cy="64" r="13" fill="#ffd9b8" />
    <circle cx="55" cy="62" r="1.6" fill="#3b3b3b" /><circle cx="65" cy="62" r="1.6" fill="#3b3b3b" />
    <path d="M55 68q5 4 10 0" stroke="#e46a6a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <circle cx="51" cy="67" r="2" fill="#ffaaa0" opacity=".7" /><circle cx="69" cy="67" r="2" fill="#ffaaa0" opacity=".7" />
    <path d="M24 88h72v8q0 10-12 10H36q-12 0-12-10z" fill="#f7a8c4" />
    <text x="60" y="100" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fff" fontFamily="Manrope,sans-serif">4</text>
    <rect x="30" y="32" width="6" height="52" rx="3" fill={`url(#${u}-gl)`} opacity=".8" />
  </>
}

function Water({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} /><Gloss u={u} />
      <Cyl id={`${u}-b`} dark="#5aa7d8" base="#a8daf7" light="#eef9ff" />
      <Cyl id={`${u}-c`} dark="#0b4fa8" base="#1f7ae0" light="#7ab8ff" />
    </defs>
    <Shadow u={u} rx={34} />
    <path d="M30 44q0-12 14-14h32q14 2 14 14v56q0 8-8 8H38q-8 0-8-8z" fill={`url(#${u}-b)`} opacity=".95" />
    <path d="M30 60h60v40q0 8-8 8H38q-8 0-8-8z" fill="#2c8de0" opacity=".28" />
    {[70, 84].map(y => <path key={y} d={`M30 ${y}h60`} stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" />)}
    <path d="M70 30q12-2 14 8" stroke="#3a8fcf" strokeWidth="5" fill="none" strokeLinecap="round" />
    <rect x="47" y="18" width="18" height="13" rx="3" fill={`url(#${u}-c)`} />
    <rect x="40" y="48" width="40" height="14" rx="4" fill="#fff" opacity=".9" />
    <text x="60" y="58.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#1f7ae0" fontFamily="Manrope,sans-serif">5 L</text>
    <rect x="35" y="40" width="5" height="62" rx="2.5" fill={`url(#${u}-gl)`} />
  </>
}

function Towels({u}: {u: string}) {
  const roll = (cx: number) => <g>
    <path d={`M${cx - 18} 40v60a18 6 0 0036 0V40z`} fill={`url(#${u}-r)`} />
    <ellipse cx={cx} cy="40" rx="18" ry="6" fill="#ffffff" />
    <ellipse cx={cx} cy="40" rx="6" ry="2.2" fill="#c7a578" />
    <ellipse cx={cx} cy="40" rx="3.6" ry="1.2" fill="#8a6a40" />
    <path d={`M${cx - 18} 62h36v14h-36z`} fill="#10a36f" />
    <path d={`M${cx - 18} 62h36v3h-36z`} fill="#56dbab" />
  </g>
  return <>
    <defs>
      <ShadowDef u={u} />
      <Cyl id={`${u}-r`} dark="#cbd5d1" base="#f4f7f6" light="#ffffff" />
    </defs>
    <Shadow u={u} rx={40} />
    {roll(42)}{roll(78)}
  </>
}

function Bag({u}: {u: string}) {
  return <>
    <defs>
      <ShadowDef u={u} />
      <Cyl id={`${u}-b`} dark="#b78645" base="#ddb06d" light="#f3d39c" />
      <Lin id={`${u}-bg`} from="#f6d79b" to="#d29a4a" vertical={false} />
    </defs>
    <Shadow u={u} rx={34} />
    <path d="M70 20q4 0 5 3l-14 34-7-3 13-32q1-2 3-2z" fill={`url(#${u}-bg)`} />
    <path d="M44 30q10-10 18 0l-6 24h-10z" fill="#2fbf6d" />
    <path d="M50 26q6-8 14 2l-4 22h-8z" fill="#1d9a52" />
    <circle cx="74" cy="48" r="10" fill="#e53935" /><circle cx="71" cy="45" r="3" fill="#fff" opacity=".5" />
    <path d="M74 38q1-4 4-5" stroke="#5a3a1a" strokeWidth="1.6" fill="none" />
    <path d="M30 50h60l4 50q0 6-6 6H32q-6 0-6-6z" fill={`url(#${u}-b)`} />
    <path d="M30 50h60l.4 5H29.6z" fill="#a8763a" />
    <path d="M48 72l12-4 12 4-12 14z" fill="#0d9b6c" opacity=".85" />
  </>
}

const ART: Record<ArtKind, (p: {u: string}) => ReactNode> = {
  oil: Oil, sugar: Sugar, milk: Milk, flour: Flour, rice: Rice, pasta: Pasta, tea: Tea,
  cleaner: Cleaner, detergent: Detergent, diapers: Diapers, water: Water, towels: Towels, bag: Bag,
}

export function ProductArt({kind, className, label}: {kind: ArtKind; className?: string; label?: string}) {
  const u = useUid()
  const Comp = ART[kind]
  return <Svg className={className} label={label}><Comp u={u} /></Svg>
}

/* ---------------------------- hero basket --------------------------- */

export function Basket3D({className}: {className?: string}) {
  const u = useUid()
  const front = 'M38 146 L282 146 L252 252 Q250 260 242 260 L78 260 Q70 260 68 252 Z'
  return (
    <svg viewBox="0 0 320 290" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${u}-sh`}>
          <stop offset="0" stopColor="#022c1f" stopOpacity=".45" />
          <stop offset="1" stopColor="#022c1f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}-front`} x1="0" x2="1">
          <stop offset="0" stopColor="#047857" />
          <stop offset=".3" stopColor="#10b981" />
          <stop offset=".5" stopColor="#34d399" />
          <stop offset=".75" stopColor="#10b981" />
          <stop offset="1" stopColor="#065f46" />
        </linearGradient>
        <linearGradient id={`${u}-depth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#022c1f" stopOpacity=".35" />
        </linearGradient>
        <linearGradient id={`${u}-inner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#065f46" />
          <stop offset="1" stopColor="#022c1f" />
        </linearGradient>
        <linearGradient id={`${u}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset=".45" stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id={`${u}-handle`} x1="0" x2="1">
          <stop offset="0" stopColor="#065f46" />
          <stop offset=".5" stopColor="#34d399" />
          <stop offset="1" stopColor="#065f46" />
        </linearGradient>
        <linearGradient id={`${u}-bread`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c56f" />
          <stop offset="1" stopColor="#b8742a" />
        </linearGradient>
        <radialGradient id={`${u}-apple`} cx=".35" cy=".3">
          <stop offset="0" stopColor="#ff8a80" />
          <stop offset=".5" stopColor="#e53935" />
          <stop offset="1" stopColor="#8e1b17" />
        </radialGradient>
        <radialGradient id={`${u}-orange`} cx=".35" cy=".3">
          <stop offset="0" stopColor="#ffd08a" />
          <stop offset=".55" stopColor="#fb8c00" />
          <stop offset="1" stopColor="#b45309" />
        </radialGradient>
        <pattern id={`${u}-holes`} width="24" height="20" patternUnits="userSpaceOnUse" x="6" y="4">
          <rect x="3" y="3" width="17" height="11" rx="4" fill="#022c1f" opacity=".55" />
          <rect x="3" y="3" width="17" height="3" rx="1.5" fill="#000" opacity=".25" />
        </pattern>
        <clipPath id={`${u}-clip`}><path d={front} /></clipPath>
      </defs>

      <ellipse cx="160" cy="268" rx="130" ry="14" fill={`url(#${u}-sh)`} />

      {/* back handle */}
      <path d="M78 132 Q160 10 242 132" fill="none" stroke="#04573f" strokeWidth="14" strokeLinecap="round" />
      <path d="M78 132 Q160 10 242 132" fill="none" stroke={`url(#${u}-handle)`} strokeWidth="9" strokeLinecap="round" />

      {/* inner back wall */}
      <path d="M58 122 L262 122 L276 150 L44 150 Z" fill={`url(#${u}-inner)`} />

      {/* groceries */}
      <g>
        {/* baguette */}
        <g transform="rotate(-28 110 100)">
          <rect x="70" y="86" width="96" height="26" rx="13" fill={`url(#${u}-bread)`} />
          {[86, 104, 122, 140].map(x => <path key={x} d={`M${x} 92 q6 6 12 14`} stroke="#fde2a8" strokeWidth="3" fill="none" strokeLinecap="round" />)}
        </g>
        {/* greens */}
        <path d="M196 132 Q186 70 214 60 Q222 92 210 132Z" fill="#16a34a" />
        <path d="M206 134 Q214 66 244 70 Q236 104 222 134Z" fill="#22c55e" />
        <path d="M214 130 Q220 90 236 82" stroke="#bbf7d0" strokeWidth="2" fill="none" />
        {/* milk carton */}
        <g transform="translate(118 64) scale(.78)">
          <path d="M70 52L88 44V98L70 106z" fill="#a9bdd2" />
          <path d="M53 30L70 52L88 44L71 22z" fill="#dbe6f1" />
          <path d="M36 46L53 30L70 52z" fill="#f4f8fc" />
          <path d="M36 46L70 52V106L36 100z" fill="#f3f7fb" />
          <path d="M36 74q9-6 17 0t17 2V106L36 100z" fill="#1d7be0" />
          <path d="M70 76q9-2 18-8V98L70 106z" fill="#1561b8" />
        </g>
        {/* fruit */}
        <circle cx="100" cy="134" r="20" fill={`url(#${u}-apple)`} />
        <path d="M100 115 q2-8 8-10" stroke="#5a3a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M104 112 q10-8 16-2 q-8 6-16 2z" fill="#22c55e" />
        <circle cx="236" cy="136" r="18" fill={`url(#${u}-orange)`} />
        <circle cx="230" cy="130" r="4" fill="#fff" opacity=".35" />
      </g>

      {/* front body */}
      <path d={front} fill={`url(#${u}-front)`} />
      <g clipPath={`url(#${u}-clip)`}>
        <rect x="30" y="160" width="260" height="90" fill={`url(#${u}-holes)`} />
        <rect x="30" y="140" width="260" height="130" fill={`url(#${u}-depth)`} />
        <path d="M70 146 L100 146 L86 260 L62 260Z" fill="#fff" opacity=".18" />
      </g>
      {/* label plate */}
      <rect x="128" y="166" width="64" height="22" rx="11" fill="#ecfdf5" />
      <text x="160" y="181.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#047857" fontFamily="Manrope,sans-serif">SmartPrice</text>
      {/* rim */}
      <rect x="30" y="138" width="260" height="18" rx="9" fill={`url(#${u}-rim)`} />
      <rect x="40" y="141" width="240" height="4" rx="2" fill="#fff" opacity=".55" />
    </svg>
  )
}

/* --------------------------- location icons -------------------------- */

/** Glossy 3D map pin standing on a soft emerald disc. */
export function MapPin3D({className}: {className?: string}) {
  const u = useUid()
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${u}-disc`} cx=".5" cy=".5">
          <stop offset="0" stopColor="#10b981" stopOpacity=".55" />
          <stop offset=".6" stopColor="#10b981" stopOpacity=".18" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}-pin`} cx=".35" cy=".28" r=".85">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset=".45" stopColor="#10b981" />
          <stop offset="1" stopColor="#065f46" />
        </radialGradient>
        <radialGradient id={`${u}-hole`} cx=".4" cy=".35">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d1fae5" />
        </radialGradient>
        <linearGradient id={`${u}-gl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="100" rx="34" ry="9" fill={`url(#${u}-disc)`} />
      <ellipse cx="60" cy="100" rx="9" ry="3" fill="#022c22" opacity=".35" />
      <path d="M60 99C60 99 30 66 30 45a30 30 0 0160 0c0 21-30 54-30 54z" fill={`url(#${u}-pin)`} />
      <path d="M60 99c0 0 30-33 30-54a30 30 0 00-12-24c6 7 8 14 8 22 0 20-26 50-26 56z" fill="#022c22" opacity=".18" />
      <circle cx="60" cy="45" r="12.5" fill={`url(#${u}-hole)`} />
      <circle cx="60" cy="45" r="12.5" fill="none" stroke="#047857" strokeOpacity=".25" strokeWidth="2" />
      <path d="M40 34c4-10 13-15 22-15" stroke={`url(#${u}-gl)`} strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** 3D GPS target with orbit rings and a satellite. */
export function Gps3D({className, active}: {className?: string; active?: boolean}) {
  const u = useUid()
  return (
    <svg viewBox="0 0 120 120" className={`${className || ''} ${active ? 'gps-active' : ''}`} aria-hidden="true">
      <defs>
        <radialGradient id={`${u}-core`} cx=".35" cy=".3">
          <stop offset="0" stopColor="#a7f3d0" />
          <stop offset=".5" stopColor="#10b981" />
          <stop offset="1" stopColor="#065f46" />
        </radialGradient>
        <linearGradient id={`${u}-ring`} x1="0" x2="1">
          <stop offset="0" stopColor="#047857" />
          <stop offset=".5" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id={`${u}-sat`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="104" rx="30" ry="6" fill="#022c22" opacity=".15" />
      <g className="gps-rings">
        <ellipse cx="60" cy="62" rx="46" ry="18" fill="none" stroke={`url(#${u}-ring)`} strokeWidth="3" opacity=".55" />
        <ellipse cx="60" cy="62" rx="32" ry="12" fill="none" stroke={`url(#${u}-ring)`} strokeWidth="3" opacity=".8" />
      </g>
      <circle cx="60" cy="58" r="20" fill={`url(#${u}-core)`} />
      <circle cx="60" cy="58" r="8" fill="#fff" />
      <circle cx="60" cy="58" r="4" fill="#047857" />
      <path d="M47 48a16 16 0 0110-6" stroke="#fff" strokeOpacity=".75" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <g className="gps-sat">
        <g transform="translate(88 20) rotate(35)">
          <rect x="-4" y="-5" width="8" height="10" rx="2" fill="#0369a1" />
          <rect x="-17" y="-4" width="11" height="8" rx="1.5" fill={`url(#${u}-sat)`} stroke="#0284c7" strokeWidth=".8" />
          <rect x="6" y="-4" width="11" height="8" rx="1.5" fill={`url(#${u}-sat)`} stroke="#0284c7" strokeWidth=".8" />
        </g>
        <path d="M80 30q-6 6-6 14M84 34q-3 3-3 7" stroke="#38bdf8" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}
