import { TopicDetail } from "@/components/portal/topic-detail";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TopicDetail topicId={id} />;
}
