/** Simple flat illustrations in the 1Plan palette (no photos). Used on the landing page and supplier covers. */
const N = "#14203A", T = "#46C8B2", C = "#FF7A59", Y = "#F0B429", B = "#6FA8FF", L = "#9B87F5", W = "#FFFFFF", CR = "#FFFBF5", TS = "#E6F7F4", CS = "#FFE9E2", YS = "#FFF3C4";

const Spark = ({ x, y, s = 1, c = Y }: { x: number; y: number; s?: number; c?: string }) => <path d={`M${x} ${y - 7 * s}L${x + 2 * s} ${y - 2 * s}L${x + 7 * s} ${y}L${x + 2 * s} ${y + 2 * s}L${x} ${y + 7 * s}L${x - 2 * s} ${y + 2 * s}L${x - 7 * s} ${y}L${x - 2 * s} ${y - 2 * s}Z`} fill={c} />;

const EVENT: Record<string, React.ReactNode> = {
  wedding: <>
    <circle cx="86" cy="72" r="24" fill="none" stroke={N} strokeWidth="6" /><circle cx="114" cy="72" r="24" fill="none" stroke={C} strokeWidth="6" />
    <path d="M100 30l9 10-9 12-9-12z" fill={T} /><path d="M100 30l9 10h-18z" fill={W} opacity=".5" />
    <Spark x={44} y={36} /><Spark x={158} y={44} s={.8} c={L} /><Spark x={150} y={100} s={.6} />
  </>,
  birthday: <>
    <rect x="58" y="72" width="84" height="32" rx="8" fill={C} /><rect x="70" y="52" width="60" height="22" rx="7" fill={Y} />
    <path d="M58 82q10 8 21 0t21 0 21 0 21 0" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" />
    {[84, 100, 116].map((x) => <g key={x}><rect x={x - 2} y="34" width="4" height="18" rx="2" fill={N} /><circle cx={x} cy="30" r="4.5" fill={Y} /></g>)}
    <circle cx="30" cy="46" r="15" fill={T} /><path d="M30 61v36" stroke={N} strokeWidth="2" /><circle cx="172" cy="40" r="13" fill={L} /><path d="M172 53v40" stroke={N} strokeWidth="2" />
  </>,
  babyshower: <>
    <circle cx="68" cy="40" r="13" fill={Y} /><circle cx="132" cy="40" r="13" fill={Y} /><circle cx="68" cy="40" r="6" fill={CS} /><circle cx="132" cy="40" r="6" fill={CS} />
    <circle cx="100" cy="62" r="34" fill={Y} /><ellipse cx="100" cy="74" rx="15" ry="11" fill={YS} />
    <circle cx="87" cy="56" r="4" fill={N} /><circle cx="113" cy="56" r="4" fill={N} /><ellipse cx="100" cy="70" rx="5" ry="3.6" fill={N} /><path d="M100 74v4M94 79q6 5 12 0" fill="none" stroke={N} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M100 98l-16-6v14zM100 98l16-6v14z" fill={C} /><circle cx="100" cy="98" r="4.5" fill={C} />
    <Spark x={38} y={34} c={B} /><Spark x={166} y={30} s={.8} c={L} /><Spark x={160} y={92} s={.7} c={T} /><Spark x={42} y={88} s={.7} c={C} />
  </>,
  graduation: <>
    <path d="M100 32L162 58 100 84 38 58z" fill={N} /><path d="M66 72v18q34 20 68 0V72l-34 14z" fill={T} />
    <path d="M150 63v24" stroke={Y} strokeWidth="4" strokeLinecap="round" /><circle cx="150" cy="92" r="6" fill={Y} />
    <rect x="22" y="84" width="34" height="14" rx="7" fill={CR} stroke={N} strokeWidth="3" /><path d="M32 91h14" stroke={C} strokeWidth="3" strokeLinecap="round" />
    <Spark x={166} y={28} s={.9} c={C} />
  </>,
  anniversary: <>
    <g transform="rotate(-14 78 70)"><path d="M66 30h24l-3 40q-9 10-18 0z" fill={W} stroke={N} strokeWidth="3" strokeLinejoin="round" /><path d="M68 48h20l-1.4 22q-8.6 8-17.2 0z" fill={Y} /><path d="M78 78v22M68 102h20" stroke={N} strokeWidth="3" strokeLinecap="round" /></g>
    <g transform="rotate(14 122 70)"><path d="M110 30h24l-3 40q-9 10-18 0z" fill={W} stroke={N} strokeWidth="3" strokeLinejoin="round" /><path d="M112 48h20l-1.4 22q-8.6 8-17.2 0z" fill={C} /><path d="M122 78v22M112 102h20" stroke={N} strokeWidth="3" strokeLinecap="round" /></g>
    <Spark x={100} y={30} s={1.1} /><Spark x={44} y={52} s={.7} c={L} /><Spark x={158} y={56} s={.7} c={T} />
  </>,
  corporate: <>
    <rect x="34" y="58" width="36" height="46" rx="4" fill={T} /><rect x="76" y="34" width="46" height="70" rx="4" fill={N} /><rect x="128" y="50" width="38" height="54" rx="4" fill={C} />
    {[[44, 68], [56, 68], [44, 82], [56, 82]].map(([x, y]) => <rect key={x + "-" + y} x={x} y={y} width="8" height="8" rx="2" fill={TS} />)}
    {[[86, 44], [102, 44], [86, 60], [102, 60], [86, 76], [102, 76]].map(([x, y]) => <rect key={x + "-" + y} x={x} y={y} width="10" height="9" rx="2" fill={YS} />)}
    {[[138, 60], [152, 60], [138, 76], [152, 76]].map(([x, y]) => <rect key={x + "-" + y} x={x} y={y} width="9" height="9" rx="2" fill={CS} />)}
    <path d="M22 104h156" stroke={N} strokeWidth="3" strokeLinecap="round" />
  </>,
};

const SUPPLIER: Record<string, React.ReactNode> = {
  venue: <><path d="M44 104V58l56-28 56 28v46z" fill={CS} stroke={N} strokeWidth="3" strokeLinejoin="round" /><path d="M86 104V80a14 14 0 0 1 28 0v24z" fill={C} /><path d="M100 30V14l14 5-14 5" fill={Y} stroke={N} strokeWidth="2" /><rect x="54" y="68" width="14" height="14" rx="3" fill={W} /><rect x="132" y="68" width="14" height="14" rx="3" fill={W} /></>,
  catering: <><path d="M44 92a56 50 0 0 1 112 0z" fill={Y} stroke={N} strokeWidth="3" strokeLinejoin="round" /><circle cx="100" cy="40" r="6" fill={N} /><rect x="32" y="92" width="136" height="9" rx="4.5" fill={N} /><path d="M70 66q8-12 20-14" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" /></>,
  photo: <><rect x="40" y="46" width="120" height="62" rx="12" fill={N} /><path d="M78 46l7-12h30l7 12z" fill={N} /><circle cx="100" cy="77" r="22" fill={W} /><circle cx="100" cy="77" r="14" fill={B} /><circle cx="95" cy="72" r="4" fill={W} opacity=".7" /><circle cx="142" cy="58" r="5" fill={C} /></>,
  music: <><rect x="64" y="28" width="72" height="84" rx="12" fill={N} /><circle cx="100" cy="86" r="20" fill={L} /><circle cx="100" cy="86" r="8" fill={W} /><circle cx="100" cy="50" r="8" fill={T} /><path d="M158 48V30l16-4v18" fill="none" stroke={C} strokeWidth="4" strokeLinecap="round" /><circle cx="154" cy="50" r="5" fill={C} /><circle cx="170" cy="46" r="5" fill={C} /></>,
  decor: <><path d="M82 62h36l-6 46H88z" fill={T} /><path d="M100 62V34" stroke={N} strokeWidth="3" strokeLinecap="round" /><circle cx="100" cy="28" r="11" fill={C} /><circle cx="80" cy="42" r="10" fill={Y} /><circle cx="120" cy="42" r="10" fill={L} /><circle cx="100" cy="28" r="4" fill={YS} /><path d="M100 50q-22 2-26 14M100 50q22 2 26 14" fill="none" stroke={N} strokeWidth="3" strokeLinecap="round" /></>,
  cake: <><path d="M40 100h120v8H40z" fill={N} /><path d="M52 62h96v38H52z" fill={C} rx="8" /><path d="M52 74q12 10 24 0t24 0 24 0 24 0" fill="none" stroke={W} strokeWidth="5" strokeLinecap="round" /><rect x="68" y="40" width="64" height="22" rx="8" fill={Y} /><rect x="98" y="24" width="4" height="16" rx="2" fill={N} /><circle cx="100" cy="20" r="5" fill={Y} /></>,
  entertainment: <><path d="M70 110L90 30h20l20 80z" fill={YS} opacity=".9" /><rect x="86" y="22" width="28" height="14" rx="4" fill={N} /><circle cx="100" cy="82" r="16" fill={L} /><path d="M100 70l4 9 10 1-8 6 3 10-9-6-9 6 3-10-8-6 10-1z" fill={W} /></>,
  rentals: <><rect x="40" y="62" width="64" height="8" rx="4" fill={N} /><path d="M52 70v34M92 70v34" stroke={N} strokeWidth="5" strokeLinecap="round" /><rect x="116" y="56" width="40" height="8" rx="4" fill={C} /><path d="M120 64v40M152 64v40M120 36h4v20h-4zM152 36h4v20h-4z" stroke={C} strokeWidth="5" strokeLinecap="round" /><path d="M122 38h32" stroke={C} strokeWidth="6" strokeLinecap="round" /></>,
  beauty: <><rect x="82" y="64" width="36" height="42" rx="6" fill={N} /><rect x="86" y="44" width="28" height="22" rx="4" fill={C} /><path d="M90 44q10-22 20 0z" fill={C} /><circle cx="150" cy="58" r="22" fill={TS} stroke={N} strokeWidth="4" /><path d="M150 80v26" stroke={N} strokeWidth="4" strokeLinecap="round" /><path d="M142 50q4-6 10-4" fill="none" stroke={W} strokeWidth="3" strokeLinecap="round" /></>,
  transport: <><path d="M38 86V68q0-8 8-8h12l12-18h56l16 18h8q12 0 12 12v14z" fill={B} /><path d="M72 46h26v14H64zM104 46h22l12 14h-34z" fill={W} opacity=".85" /><circle cx="68" cy="90" r="14" fill={N} /><circle cx="68" cy="90" r="5" fill={W} /><circle cx="134" cy="90" r="14" fill={N} /><circle cx="134" cy="90" r="5" fill={W} /><circle cx="170" cy="80" r="5" fill={Y} /></>,
};

const Frame = ({ children, size, label }: { children: React.ReactNode; size?: number | string; label?: string }) => (
  <svg viewBox="0 0 200 120" width={size ?? "100%"} height={size ? undefined : "100%"} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="xMidYMid meet">{children}</svg>
);

export const EventArt = ({ type, size, label }: { type: string; size?: number | string; label?: string }) => <Frame size={size} label={label}>{EVENT[type] ?? EVENT.birthday}</Frame>;
export const SupplierArt = ({ cat, size, label }: { cat: string; size?: number | string; label?: string }) => <Frame size={size} label={label}>{SUPPLIER[cat] ?? SUPPLIER.decor}</Frame>;
