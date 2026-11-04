import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { WorkspaceProvider } from "@/components/planner/workspace-context";
import { SiteHeader } from "@/components/site-header";
import { getOptionalUser } from "@/lib/auth";
import "./globals.css";

// Loopless Thai with neo-grotesque Latin: the closest Thai partner to a Swiss sans.
const anuphan = Anuphan({ variable: "--font-anuphan", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "MorPlan · จัดตารางเรียน มช.", template: "%s · MorPlan" },
  description:
    "จัดตารางเรียน มช. แบบลากวาง เตือนเวลาเรียนและวันสอบชน เทียบหลายแผน และถามระเบียบการศึกษาพร้อมอ้างอิงหน้าเอกสาร (ไม่ใช่ระบบทางการ)",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111111" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getOptionalUser();
  return (
    <html lang="th" className={`${anuphan.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <WorkspaceProvider signedIn={!!user}>
          <div className="flex flex-1 flex-col">{children}</div>
        </WorkspaceProvider>
        <footer className="mt-8 border-t-4 border-ink px-4 py-5 text-xs text-muted">
          <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-baseline sm:gap-8">
            <p className="font-bold text-ink">
              Mor<span className="text-accent">Plan</span>
            </p>
            <p>
              <strong className="font-semibold text-ink">ไม่ใช่ระบบทางการของ มช.</strong> โปรเจกต์ของนักศึกษา
              ข้อมูลอาจผิดพลาด ตรวจสอบกับประกาศทางการอีกครั้งเสมอ
            </p>
            <a href="/about" className="font-medium text-ink underline underline-offset-4 hover:text-accent">
              แหล่งข้อมูลและความเป็นส่วนตัว
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
