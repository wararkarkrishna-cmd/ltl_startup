export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full text-center space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-emerald-400">
          LTL Freight Operating System
        </h1>
        <p className="text-lg text-slate-300">
          Production-Grade AI Ingestion Gateway & Sub-Minute RFQ Extraction Engine.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left">
          <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/60">
            <h3 className="font-semibold text-emerald-400">Sub-Phase 1.1</h3>
            <p className="text-sm text-slate-400 mt-1">
              Multi-tenant PostgreSQL DDL, UUIDv7 monotonic primary keys, RLS security policies, and DDL check constraints.
            </p>
          </div>
          <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/60">
            <h3 className="font-semibold text-emerald-400">Sub-Phase 1.2</h3>
            <p className="text-sm text-slate-400 mt-1">
              Multi-modal ingestion gateway for PDFs, Excel/CSVs, raw text, and SendGrid/Mailgun webhook emails with SHA-256 storage integrity.
            </p>
          </div>
          <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/60">
            <h3 className="font-semibold text-emerald-400">Sub-Phase 1.3</h3>
            <p className="text-sm text-slate-400 mt-1">
              LLM structured RFQ extraction pipeline with strict Zod schema enforcement, multipliers, and accessorial resolvers.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
