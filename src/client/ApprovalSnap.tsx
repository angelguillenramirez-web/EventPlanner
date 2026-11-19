import { useT } from "../i18n";
import { invSandbox, invitationDoc } from "../invitationTemplates";
import type { Snap } from "../store";
import { SeatStatic } from "./Tables";
import Thumb from "./InvThumb";
import { cleanVis, paperBg } from "./agDoc";

const money = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Page({ snap }: { snap: Extract<Snap, { k: "itinerary" | "menu" }> }) {
  const { t } = useT();
  if (snap.k === "itinerary") return (
    <div className="snappage"><h4>{t("tab.itinerary")}</h4>{snap.acts.map((a, i) => <div key={i} className="snaprow"><b>{a.time}</b><span>{a.name}{a.location && <i> · {a.location}</i>}</span><em>{a.when}</em></div>)}</div>
  );
  const cats = [...new Set(snap.items.map((x) => x.category))];
  return (
    <div className="snappage"><h4>{t("tab.menu")}</h4>{cats.map((c) => <div key={c}><div className="snapcat">{t("menuc." + c)}</div>{snap.items.filter((x) => x.category === c).map((x, i) => <div key={i} className="snaprow"><span>{x.name}</span><em>{money(x.price)}</em></div>)}</div>)}
      <div className="snaprow"><b>{t("menu.perperson")}</b><em>{money(snap.perPerson)}</em></div></div>
  );
}

/** Frozen picture of what is being approved. mini = small thumbnail, otherwise the full read-only view. */
export default function SnapView({ snap, mini }: { snap: Snap; mini?: boolean }) {
  if (snap.k === "agreement") { const inner = <div className="snappage agdoc-snap" style={{ background: paperBg(snap.paper) }} dangerouslySetInnerHTML={{ __html: cleanVis(snap.html) }} />; return mini ? <div className="snapmini"><div style={{ width: 430, transform: "scale(.38)", transformOrigin: "0 0" }}>{inner}</div></div> : inner; }
  if (snap.k === "tables") return <SeatStatic rec={snap.rec} guests={[]} />;
  if (snap.k === "invitation") return mini ? <Thumb html={snap.html} css={snap.css} title="" /> : <iframe title="invitation" sandbox={invSandbox(snap.html)} srcDoc={invitationDoc(snap.html, snap.css)} style={{ width: "100%", height: "66vh", border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }} />;
  return mini ? <div className="snapmini"><div style={{ width: 430, transform: "scale(.38)", transformOrigin: "0 0" }}><Page snap={snap} /></div></div> : <Page snap={snap} />;
}
