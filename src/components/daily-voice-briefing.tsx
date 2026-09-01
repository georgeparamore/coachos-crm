"use client";

import { AssistantSpeechControl } from "@/components/assistant-speech-control";
import { useVisiblePriorities } from "@/components/dashboard-priority-queue";

type BriefingItem = { id?: string; title: string; detail: string };
type DailyVoiceBriefingProps = { firstName: string; formattedDate: string; appointments: BriefingItem[]; priorities: (BriefingItem & { id: string })[] };

function makeBriefing({ firstName, formattedDate, appointments, priorities }: DailyVoiceBriefingProps) {
  const parts = [`Good morning, ${firstName}. Here is your Full Circle briefing for ${formattedDate}.`];
  if (appointments.length === 0) parts.push("You have no appointments on the calendar today.");
  else {
    parts.push(`You have ${appointments.length} ${appointments.length === 1 ? "appointment" : "appointments"} on today's schedule.`);
    appointments.forEach((appointment, index) => parts.push(`${index === 0 ? "First" : "Then"}, ${appointment.title}, at ${appointment.detail}.`));
  }
  if (priorities.length === 0) parts.push("Your priority queue is clear, so you are all caught up for today.");
  else {
    parts.push(`You have ${priorities.length} ${priorities.length === 1 ? "priority" : "priorities"} to focus on.`);
    priorities.forEach((priority, index) => parts.push(`Priority ${index + 1}: ${priority.title}. ${priority.detail}.`));
  }
  parts.push("Take it one step at a time. You've got this.");
  return parts.join(" ");
}

export function DailyVoiceBriefing(props: DailyVoiceBriefingProps) {
  const priorities = useVisiblePriorities(props.priorities).slice(0, 3);
  return <AssistantSpeechControl detail="schedule + priorities" idleLabel="Hear today’s briefing" speakingLabel="Stop briefing" text={makeBriefing({ ...props, priorities })} />;
}
