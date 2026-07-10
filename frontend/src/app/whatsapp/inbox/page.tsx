import InboxPanel from "../InboxPanel";

export default function InboxPage() {
  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Shared Inbox</h1>
        <InboxPanel />
      </div>
    </div>
  );
}
