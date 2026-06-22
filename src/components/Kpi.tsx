import { deltaLabel } from "@/lib/format";

function DeltaBadge({ d, goodWhenUp = true }: { d?: number; goodWhenUp?: boolean }) {
  if (d === undefined) return null;
  const up = d > 0;
  const good = up === goodWhenUp;
  const cls = d === 0 ? "flat" : good ? "up" : "down";
  return <span className={`delta ${cls}`}>{deltaLabel(d)}</span>;
}

export default function Kpi({
  label,
  value,
  icon,
  iconBg,
  delta,
  goodWhenUp = true,
  highlight = false,
  tag,
}: {
  label: string;
  value: string;
  icon: string;
  iconBg: string;
  delta?: number;
  goodWhenUp?: boolean;
  highlight?: boolean;
  tag?: string;
}) {
  return (
    <div className={`card${highlight ? " profit" : ""}`}>
      <div className="ic" style={{ background: iconBg }}>{icon}</div>
      <div className="lbl">{label}</div>
      <div className="val">
        {value}
        <DeltaBadge d={delta} goodWhenUp={goodWhenUp} />
        {tag ? <span className="tag">{tag}</span> : null}
      </div>
    </div>
  );
}
