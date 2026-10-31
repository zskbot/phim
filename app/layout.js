import "./globals.css";
import AgeGate from "@/components/AgeGate";
import Header from "@/components/Header";

export const metadata = {
  title: { default: "PHIM. — Xem phim trực tuyến", template: "%s | PHIM." },
  description: "Khám phá phim nổi bật, phim mới và nội dung giải trí trực tuyến.",
  applicationName: "PHIM."
};

export default function RootLayout({ children }) {
  return <html lang="vi"><body><AgeGate /><Header />{children}<footer className="mt-24 border-t border-white/5 py-8 text-center text-xs text-zinc-600"><p>© {new Date().getFullYear()} PHIM. — Nền tảng streaming thử nghiệm.</p><p className="mt-2">Chỉ phát nội dung bạn sở hữu hoặc có quyền phân phối.</p></footer></body></html>;
}