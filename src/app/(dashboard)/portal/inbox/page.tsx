"use client";

import { useSearchParams } from "next/navigation";
import { MessageList } from "@/components/portal/message-list";
import { MessageDetail } from "@/components/portal/message-detail";
import { Suspense } from "react";

function InboxContent() {
  const searchParams = useSearchParams();
  const messageId = searchParams.get("id");

  if (messageId) {
    return <MessageDetail />;
  }

  return <MessageList folder="inbox" />;
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />}>
      <InboxContent />
    </Suspense>
  );
}
