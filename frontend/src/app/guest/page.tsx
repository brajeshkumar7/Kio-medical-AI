import ChatWorkspace from "@/features/chat/components/chat-workspace";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function GuestPage() {
  const { userId } = await auth();
  if (userId) redirect("/console");
  return <ChatWorkspace mode="guest" />;
}
