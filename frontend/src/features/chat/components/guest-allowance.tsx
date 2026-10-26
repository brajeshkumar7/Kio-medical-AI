"use client";

import Link from "next/link";

import type { ChatController } from "../hooks/use-chat-controller";

type Props = Pick<ChatController, "guestUsage">;

export default function GuestAllowance({ guestUsage }: Props) {
  return (
    <div className="guest-allowance" role="status">
      <span>
        {guestUsage
          ? `${guestUsage.remaining} of ${guestUsage.limit} guest questions left today`
          : "Preparing guest access..."}
      </span>
      <Link href="/">Sign in to keep your chats</Link>
    </div>
  );
}
