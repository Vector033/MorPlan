import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { WorkspaceProvider } from "@/components/planner/workspace-context";
import { SiteBackdrop } from "@/components/site-backdrop";
import { SiteHeader } from "@/components/site-header";
import { getOptionalUser } from "@/lib/auth";
import "./globals.css";

// Loopless Thai with a clean Latin: friendly at small sizes, still crisp for codes and times.
const anuphan = Anuphan({ variable: "--font-anuphan", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "MorPlan · จัดตารางเรียน", template: "%s · MorPlan" },
  description:
    "จัดตารางเรียนแบบลากวาง เตือนเวลาเรียนและวันสอบชน เทียบหลายแผน ดูหลักสูตร และถามระเบียบการศึกษาพร้อมอ้างอิงหน้าเอกสาร (ไม่ใช่ระบบทางการ)",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getOptionalUser();
  return (
    <html lang="th" className={`${anuphan.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-24 sm:pb-0">
        <SiteHeader />
        <WorkspaceProvider userId={user?.id ?? null}>
          <SiteBackdrop />
          <div className="relative z-10 flex flex-1 flex-col">{children}</div>
        </WorkspaceProvider>
        <footer className="relative z-10 mt-10 border-t border-line bg-white px-4 py-6 text-xs text-muted">
          <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-baseline sm:gap-8">
            <p className="font-bold text-ink">
              Mor<span className="text-accent">Plan</span>
            </p>
            <p>
              <strong className="font-semibold text-ink">
                ไม่ใช่ระบบทางการ<span className="whitespace-nowrap">ของมหาวิทยาลัยใดๆ</span>
              </strong>{" "}
              โปรเจกต์ของนักศึกษา ข้อมูลอาจผิดพลาด{" "}
              <span className="inline-block">ตรวจสอบกับประกาศทางการอีกครั้งเสมอ</span>
            </p>
            <a href="/about" className="link whitespace-nowrap">
              แหล่งข้อมูลและความเป็นส่วนตัว
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
