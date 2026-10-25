import AuditLog from "@/components/AuditLog";
export default function Audit() {
  return (<><h1>Approvals log</h1><p className="sub">Every approval and rejection, with who and when. The prototype keeps this in your browser; production writes it to the agency&apos;s audit store.</p><AuditLog /></>);
}
