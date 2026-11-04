"use client";

import { useEffect, useState } from "react";

const initialForm = { title: "", description: "", category: "Giải trí", poster_url: "", embed_url: "", rights_holder: "", license_reference: "", license_expires_at: "" };
const labels = { pending_review: "Chờ duyệt", approved: "Đã duyệt", published: "Đang phát hành", rejected: "Từ chối", archived: "Lưu trữ", draft: "Bản nháp" };

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState([{ channel: "txtop18", url: "https://t.me/txtop18", default: true }]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function sourceApi(path = "/api/admin/telegram-sources", options = {}) {
    const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }
  async function api(path = "/api/admin/videos", options = {}) {
    const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }
  async function loadSources() {
    try { const data = await sourceApi(); setSources(data.sources || []); }
    catch (error) { setMessage(error.message); }
  }
  useEffect(() => { loadSources(); }, []);
  async function loadCatalog() {
    setBusy(true); setMessage("");
    try { const data = await api(); setItems(data.results || []); setAuthenticated(true); }
    catch (error) { setAuthenticated(false); setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function addSource(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const data = await sourceApi(undefined, { method: "POST", body: JSON.stringify({ url: sourceUrl }) });
      setSources(data.sources || []); setSourceUrl("");
      setMessage(data.duplicate ? "Nguồn này đã được thêm trước đó." : "Đã thêm nguồn vào TX.TOP Preview.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function syncSource(channel) {
    setBusy(true); setMessage("");
    try { const data = await sourceApi(undefined, { method: "POST", body: JSON.stringify({ action: "sync", channel }) }); setMessage(`Đã đồng bộ ${data.imported} bài video từ @${channel}.`); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function removeSource(channel) {
    setBusy(true); setMessage("");
    try { const data = await sourceApi(`/api/admin/telegram-sources?channel=${encodeURIComponent(channel)}`, { method: "DELETE" }); setSources(data.sources || []); setMessage(`Đã xóa nguồn @${channel} khỏi Preview.`); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await api("/api/admin/videos", { method: "POST", body: JSON.stringify(form) }); setForm(initialForm); setMessage("Đã gửi nội dung vào hàng chờ duyệt."); await loadCatalog(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function transition(id, status) {
    setBusy(true); setMessage("");
    try { await api(`/api/admin/videos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }); await loadCatalog(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return <main className="container min-h-[70vh] py-10">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.25em] text-red-400">TX.TOP / PREVIEW</p><h1 className="mt-2 text-3xl font-black">Admin CMS</h1><p className="mt-2 text-sm text-zinc-500">Quản lý nguồn video công khai và nội dung được cấp quyền.</p></div>
      <a href="/providers" className="text-sm text-zinc-400 hover:text-white">← Provider Sandbox</a>
    </div>

    <section className="mb-8 rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-6">
      <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">TELEGRAM / PUBLIC SOURCES</p><h2 className="mt-2 text-xl font-black">Nguồn video công khai</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Nhập link kênh Telegram công khai. TX.TOP chỉ lấy thông tin bài đăng và nhúng trình phát Telegram; không tải hoặc lưu tệp video. Với nhóm, bot cần quyền quản trị để nhận bài đăng mới.</p></div>
      <form onSubmit={addSource} className="flex flex-col gap-3 sm:flex-row">
        <input type="url" required value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://t.me/ten_kenh_cong_khai" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-500" />
        <button disabled={busy || !sourceUrl.trim()} className="rounded-lg bg-red-600 px-5 py-3 text-sm font-bold disabled:opacity-40">+ Thêm nguồn</button>
      </form>
      <div className="mt-5 space-y-2">
        {sources.map(source => <article key={source.channel} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="font-semibold">@{source.channel} {source.default && <span className="ml-2 rounded-full bg-white/10 px-2 py-1 text-[10px] text-zinc-400">Mặc định</span>}</p><a href={source.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-zinc-500 hover:text-white">{source.url}</a></div>
          <div className="flex shrink-0 gap-2"><button type="button" disabled={busy} onClick={() => syncSource(source.channel)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold disabled:opacity-40">Đồng bộ ngay</button>{!source.default && <button type="button" disabled={busy} onClick={() => removeSource(source.channel)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-red-300 disabled:opacity-40">Xóa nguồn</button>}</div>
        </article>)}
      </div>
      <p className="mt-3 text-xs text-zinc-600">Trình quản lý nguồn chỉ hoạt động trên Deploy Preview; giới hạn 10 nguồn.</p>
    </section>

    {!authenticated ? <section className="max-w-xl rounded-2xl border border-white/10 bg-white/[.03] p-6">
      <h2 className="text-lg font-bold">Đăng nhập quản trị nội dung</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Phần quản lý danh mục yêu cầu ADMIN_CMS_TOKEN. Bạn không cần đăng nhập để thêm và đồng bộ nguồn Telegram trên Preview.</p>
      <label className="mt-5 block text-xs font-semibold text-zinc-400">Admin token</label>
      <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-sm outline-none focus:border-red-500" placeholder="Token CMS (không phải Telegram Bot Token)" />
      <button disabled={!token || busy} onClick={loadCatalog} className="mt-4 rounded-lg bg-red-600 px-5 py-3 text-sm font-bold disabled:opacity-40">{busy ? "Đang kết nối…" : "Kết nối CMS"}</button>
    </section> : <div className="grid gap-8 xl:grid-cols-[minmax(320px,420px)_1fr]">
      <form onSubmit={submit} className="h-fit space-y-4 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div><h2 className="text-lg font-bold">Thêm nội dung có quyền phân phối</h2><p className="mt-1 text-xs text-zinc-500">Mọi nội dung mới sẽ vào trạng thái chờ duyệt.</p></div>
        {[
          ["title","Tiêu đề","text"],["category","Danh mục","text"],["poster_url","Poster URL (HTTPS)","url"],["embed_url","Official player embed URL","url"],["rights_holder","Chủ sở hữu quyền","text"],["license_reference","Mã / đường dẫn giấy phép","text"],["license_expires_at","Ngày hết hạn giấy phép","date"]
        ].map(([key,label,type]) => <label key={key} className="block text-xs font-semibold text-zinc-400">{label}<input required={["title","category","embed_url","rights_holder","license_reference","license_expires_at"].includes(key)} type={type} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-red-500" /></label>)}
        <label className="block text-xs font-semibold text-zinc-400">Mô tả<textarea rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-red-500" /></label>
        <button disabled={busy} className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold disabled:opacity-40">{busy ? "Đang xử lý…" : "Gửi duyệt nội dung"}</button>
      </form>
      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">Danh mục nội dung</h2><p className="mt-1 text-xs text-zinc-500">{items.length} mục · dữ liệu CMS</p></div><button onClick={loadCatalog} disabled={busy} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">Làm mới</button></div>
        <div className="space-y-3">{items.length ? items.map(item => <article key={item.id} className="rounded-xl border border-white/10 bg-white/[.02] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold">{item.title}</h3><p className="mt-1 break-all text-xs text-zinc-500">{item.category} · {item.rights_holder} · hết hạn {item.license_expires_at ? new Date(item.license_expires_at).toLocaleDateString("vi-VN") : "chưa rõ"}</p><p className="mt-2 break-all text-[11px] text-zinc-600">{item.embed_url}</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300">{labels[item.status] || item.status}</span></div>
          <div className="mt-4 flex flex-wrap gap-2">{item.status === "pending_review" && <><button disabled={busy} onClick={() => transition(item.id,"approved")} className="rounded-md bg-emerald-700/80 px-3 py-2 text-xs font-bold">Duyệt</button><button disabled={busy} onClick={() => transition(item.id,"rejected")} className="rounded-md bg-white/10 px-3 py-2 text-xs font-bold">Từ chối</button></>}{item.status === "approved" && <button disabled={busy} onClick={() => transition(item.id,"published")} className="rounded-md bg-red-600 px-3 py-2 text-xs font-bold">Phát hành</button>}{!["archived","rejected"].includes(item.status) && <button disabled={busy} onClick={() => transition(item.id,"archived")} className="rounded-md border border-white/10 px-3 py-2 text-xs">Lưu trữ</button>}</div>
        </article>) : <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">Chưa có nội dung.</div>}</div>
      </section>
    </div>}
    {message && <p role="status" className="mt-5 rounded-lg border border-white/10 bg-white/[.03] p-3 text-sm text-zinc-300">{message}</p>}
  </main>;
}
