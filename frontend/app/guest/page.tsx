import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ChatWorkspace from "@/components/chat-workspace";

export default async function GuestPage() {
  const { userId } = await auth();
  if (userId) redirect("/console");
  return <ChatWorkspace mode="guest" />;
}
