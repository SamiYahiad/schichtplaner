"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Inbox,
  Send,
  Trash2,
  FolderOpen,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const messageLinks = [
  { key: "inbox", labelKey: "portal.inbox", href: "/portal/inbox", icon: Inbox },
  { key: "sent", labelKey: "portal.sent", href: "/portal/sent", icon: Send },
  { key: "trash", labelKey: "portal.trash", href: "/portal/trash", icon: Trash2 },
];

const portalLinks = [
  { key: "files", labelKey: "portal.files", href: "/portal/files", icon: FolderOpen },
  { key: "topics", labelKey: "portal.topics", href: "/portal/topics", icon: MessageCircle },
];

export function PortalSidebar() {
  const pathname = usePathname();
  const t = useTranslations();

  const { data } = useQuery<{ count: number }>({
    queryKey: ["messages", "unread-count"],
    queryFn: () => fetch("/api/messages/unread-count").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const unreadCount = data?.count ?? 0;

  return (
    <aside className="w-56 shrink-0">
      <nav className="space-y-6">
        {/* Messages section */}
        <div>
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("portal.messages")}
          </h3>
          <ul className="space-y-0.5">
            {messageLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="flex-1">{t(link.labelKey)}</span>
                    {link.key === "inbox" && unreadCount > 0 && (
                      <Badge variant="default" className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Portal section */}
        <div>
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("nav.portal")}
          </h3>
          <ul className="space-y-0.5">
            {portalLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname.startsWith(link.href);
              return (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{t(link.labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
