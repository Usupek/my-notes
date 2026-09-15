import Link from "next/link";

export default function NotFound() {
  return <div className="center-card"><p className="eyebrow">404</p><h1>Catatan tidak ditemukan.</h1><Link className="button" href="/">Kembali ke arsip</Link></div>;
}
