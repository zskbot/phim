import "./globals.css";
import AgeGate from "@/components/AgeGate";
import Header from "@/components/Header";

export const metadata = {
  title: { default: "TX.TOP 18+ — Video Streaming", template: "%s | TX.TOP 18+" },
  description: "TX.TOP 18+ — Khám phá danh mục video giải trí dành cho người trưởng thành.",
  applicationName: "TX.TOP 18+"
};

export default function RootLayout({ children }) {
  return <html lang="vi"><body><AgeGate /><Header />{children}<footer className="mt-24 border-t border-white/5 py-8 text-center text-xs text-zinc-600"><p>© {new Date().getFullYear()} TX.TOP — Nền tảng streaming thử nghiệm.</p><p className="mt-2">Chỉ phát nội dung bạn sở hữu hoặc có quyền phân phối.</p></footer></body></html>;
}
