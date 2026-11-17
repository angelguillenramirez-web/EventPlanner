import { Baby, Building2, Cake, GlassWater, GraduationCap, Heart, Sparkles, type LucideProps } from "lucide-react";
export * from "lucide-react";

const MAP: Record<string, React.ComponentType<LucideProps>> = {
  wedding: Heart, birthday: Cake, babyshower: Baby, graduation: GraduationCap, anniversary: GlassWater, corporate: Building2,
};
export function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const I = MAP[type] ?? Sparkles;
  return <I size={size} aria-hidden />;
}

import { Lock as LockGlyph } from "lucide-react";
/** Small inline "locked by plan" marker. */
export const LockI = () => <LockGlyph size={13} className="lock" style={{ verticalAlign: -2 }} aria-label="locked" />;
