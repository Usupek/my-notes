import Link from "next/link";

export default function NotFound() {
  return <div className="center-card"><p className="eyebrow">404</p><h1>Note not found.</h1><Link className="button" href="/">Back to archive</Link></div>;
}
