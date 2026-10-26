"use client";

import {
  HeartPulse,
  MoonStar,
  ShieldCheck,
  Stethoscope,
  Thermometer,
} from "lucide-react";

import { starterPrompts } from "../constants";
import type { ChatController } from "../hooks/use-chat-controller";

type Props = Pick<
  ChatController,
  "user" | "isGuest" | "guestToken" | "submitMessage"
> & { guestBlocked: boolean };

export default function WelcomePanel({
  user,
  isGuest,
  guestToken,
  submitMessage,
  guestBlocked,
}: Props) {
  return (
    <div className="welcome-panel">
      <h1>
        How can I help,{" "}
        {user?.firstName || user?.fullName?.split(" ")[0] || "there"}?
      </h1>
      <p className="welcome-copy">
        Share what you are experiencing. Kio will organize the details and offer
        a clear, evidence-grounded next step.
      </p>
      <div className="prompt-grid">
        {starterPrompts.map((prompt, index) => {
          const PromptIcon =
            [HeartPulse, MoonStar, Thermometer, ShieldCheck][index] ||
            Stethoscope;
          return (
            <button
              className="prompt-card"
              key={prompt}
              disabled={guestBlocked || (isGuest && !guestToken)}
              onClick={() => void submitMessage(prompt)}
            >
              <span className={`prompt-icon prompt-icon-${index}`}>
                <PromptIcon size={17} />
              </span>
              <span>{prompt}</span>
            </button>
          );
        })}
      </div>
      <div className="medical-assurance">
        <span>
          <ShieldCheck size={14} /> Private by design
        </span>
        <span>
          <Stethoscope size={14} /> Built for informed care conversations
        </span>
      </div>
    </div>
  );
}
