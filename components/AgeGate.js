"use client";
import { useEffect, useState } from "react";

export default function AgeGate() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { setVisible(localStorage.getItem("phim-age-confirmed") !== "yes"); }
    catch { setVisible(true); }
  }, []);
  if (!visible) return null;
  function confirm() {
    try { localStorage.setItem("phim-age-confirmed", "yes"); } catch {}
    setVisible(false);
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="age-title">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-red-600/15 text-2xl text-red-500">18+</div>
        <h2 id="age-title" className="text-2xl font-black tracking-wide">XÁC NHẬN ĐỘ TUỔI</h2>
        <p className="mt-4 text-sm leading-6 text-zinc-400">Một số nội dung trên nền tảng có thể không phù hợp với người dưới 18 tuổi. Xác nhận rằng bạn đã đủ tuổi theo quy định tại nơi bạn sinh sống.</p>
        <div className="mt-7 flex gap-3">
          <a href="https://www.google.com" className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-700">Rời khỏi</a>
          <button onClick={confirm} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-500">Tôi đã đủ 18 tuổi</button>
        </div>
        <p className="mt-4 text-[11px] text-zinc-600">Đây là xác nhận tự khai, không thay thế hệ thống xác minh danh tính.</p>
      </div>
    </div>
  );
}