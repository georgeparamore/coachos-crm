"use client";

export function LocalDateTime({ value }: { value: string }) {
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

  return <time dateTime={value} suppressHydrationWarning>{formatted}</time>;
}
