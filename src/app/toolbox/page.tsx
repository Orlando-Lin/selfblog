import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = {
  title: "工具箱 Toolbox",
};

export default function ToolboxPage() {
  return <ComingSoon titleKey="toolbox" />;
}
