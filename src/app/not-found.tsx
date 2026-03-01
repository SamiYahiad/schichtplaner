import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-8xl font-bold text-slate-200 dark:text-slate-800">
          404
        </h1>
        <h2 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Seite nicht gefunden
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <Link
          href="/schedule/flexible"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
