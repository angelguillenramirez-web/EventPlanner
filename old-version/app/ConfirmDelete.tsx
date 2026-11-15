"use client";
export default function ConfirmDelete({ label, msg, small }: { label: string; msg: string; small?: boolean }) {
  return (
    <button type="submit" className={`danger${small ? " sm" : ""}`} onClick={(e) => { if (!confirm(msg)) e.preventDefault(); }}>
      {label}
    </button>
  );
}
