import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-8xl font-bold text-slate-200 dark:text-slate-800">
          404
        </h1>
        <h2 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t("notFoundTitle")}
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t("notFoundDescription")}
        </p>
        <Link
          href="/schedule/flexible"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          {t("goToDashboard")}
        </Link>
      </div>
    </div>
  );
}
