import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Thai } from "next/font/google";
import { WorkspaceProvider } from "@/components/planner/workspace-context";
import { SiteHeader } from "@/components/site-header";
import { getOptionalUser } from "@/lib/auth";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "MorPlan · จัดตารางเรียน มช.", template: "%s · MorPlan" },
  description:
    "จัดตารางเรียน มช. แบบลากวาง เตือนเวลาเรียนและวันสอบชน เทียบหลายแผน และถามระเบียบการศึกษาพร้อมอ้างอิงหน้าเอกสาร (ไม่ใช่ระบบทางการ)",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f5f0" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getOptionalUser();
  return (
    <html lang="th" className={`${plexThai.variable} ${plex.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <WorkspaceProvider signedIn={!!user}>
          <div className="flex flex-1 flex-col">{children}</div>
        </WorkspaceProvider>
        <footer className="border-t border-line px-4 py-4 text-xs text-muted">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <p>
              <strong className="font-semibold text-ink">ไม่ใช่ระบบทางการของ มช.</strong> MorPlan เป็นโปรเจกต์ของนักศึกษา
              ข้อมูลอาจผิดพลาด ตรวจสอบกับประกาศทางการอีกครั้งเสมอ
            </p>
            <a href="/about" className="underline underline-offset-2 hover:text-ink">
              แหล่งข้อมูลและความเป็นส่วนตัว
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
