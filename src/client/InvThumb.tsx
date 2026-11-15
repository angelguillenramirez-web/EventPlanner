import { useEffect, useRef } from "react";
import { invitationDoc } from "../invitationTemplates";

/** Scaled, non-interactive miniature of an invitation (the 640px-wide document shrunk to the card width). */
export default function Thumb({ html, css, title }: { html: string; css: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const set = () => el.style.setProperty("--sc", String(el.clientWidth / 640));
    set(); const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect();
  }, []);
  return <div className="invthumb" ref={ref}><iframe title={title} srcDoc={invitationDoc(html, css)} sandbox="" tabIndex={-1} /></div>;
}
