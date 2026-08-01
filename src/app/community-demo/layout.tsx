import { CommunityDemoProvider } from "@/lib/community-demo-store";

export default function CommunityDemoLayout({ children }: { children: React.ReactNode }) {
  return <CommunityDemoProvider>{children}</CommunityDemoProvider>;
}
