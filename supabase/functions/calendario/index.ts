// Função "calendario" (Supabase Edge Function)
// Devolve as datas importantes de uma pessoa em formato de calendário (.ics),
// para o Google Calendar (ou o Calendário do iPhone) subscrever por link.
// - GET ?t=<token>  → o token é criado pela app (ecrã Datas → Google Calendar) e fica
//   guardado em registos (tabela "definicoes", id "calendario"). Sem token válido: 404.
// Publicar com verify JWT desligado (o Google não envia sessão):
//   supabase functions deploy calendario --no-verify-jwt --project-ref putvpneoexwblbbqemer
import { createClient } from "jsr:@supabase/supabase-js@2";

const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, chaveServico, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type Data = {
  nome?: string; data?: string; tipo?: string; repetir?: string;
  notas?: string; noCalendario?: boolean;
};
const ICONES: Record<string, string> = { aniversario: "🎂", prazo: "⏳", pagamento: "💳", outro: "📌" };

// Texto dentro do .ics: escapar \ ; , e mudanças de linha
const escapar = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Linhas com mais de 75 bytes são partidas (a continuação começa com um espaço)
function dobrar(linha: string) {
  const enc = new TextEncoder();
  const partes: string[] = [];
  let atual = "", bytes = 0;
  for (const c of linha) {
    const n = enc.encode(c).length;
    if (bytes + n > (partes.length ? 74 : 75)) { partes.push(atual); atual = ""; bytes = 0; }
    atual += c; bytes += n;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

function diaSeguinte(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// Igual à app: dias 29–31 caem no último dia nos meses mais curtos
function regra(d: Data) {
  const [, m, dia] = d.data!.split("-").map(Number);
  if (d.repetir === "anual") {
    return m === 2 && dia === 29 ? "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1" : "RRULE:FREQ=YEARLY";
  }
  if (d.repetir === "mensal") {
    if (dia <= 28) return "RRULE:FREQ=MONTHLY";
    const dias = []; for (let x = 28; x <= dia; x++) dias.push(x);
    return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dias.join(",")};BYSETPOS=-1`;
  }
  return "";
}

function gerarICS(datas: { id: string; dados: Data }[], agora = new Date()) {
  const carimbo = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const l = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Assistente//Datas//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Assistente — Datas", "X-WR-TIMEZONE:Europe/Lisbon",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
  ];
  for (const { id, dados: d } of datas) {
    if (!d || !d.nome || !/^\d{4}-\d{2}-\d{2}$/.test(d.data ?? "") || d.noCalendario === false) continue;
    const r = regra(d);
    l.push(
      "BEGIN:VEVENT",
      `UID:data-${id}@assistente`,
      `DTSTAMP:${carimbo}`,
      `DTSTART;VALUE=DATE:${d.data!.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${diaSeguinte(d.data!).replace(/-/g, "")}`,
      `SUMMARY:${escapar(`${ICONES[d.tipo ?? ""] ?? "📌"} ${d.nome}`)}`,
      ...(d.notas ? [`DESCRIPTION:${escapar(d.notas)}`] : []),
      ...(r ? [r] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  l.push("END:VCALENDAR");
  return l.map(dobrar).join("\r\n") + "\r\n";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const naoExiste = () => new Response("Link inválido", { status: 404, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
  if (!/^[A-Za-z0-9_-]{20,}$/.test(t)) return naoExiste();

  const { data: def, error } = await sb.from("registos").select("user_id")
    .eq("tabela", "definicoes").eq("id", "calendario").eq("apagado", false).eq("dados->>token", t).maybeSingle();
  if (error) { console.error(error); return new Response("Erro", { status: 500, headers: cors }); }
  if (!def) return naoExiste();

  const { data: datas, error: e2 } = await sb.from("registos").select("id,dados")
    .eq("user_id", def.user_id).eq("tabela", "datas").eq("apagado", false);
  if (e2) { console.error(e2); return new Response("Erro", { status: 500, headers: cors }); }

  return new Response(gerarICS((datas ?? []) as { id: string; dados: Data }[]), {
    headers: {
      ...cors,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="assistente-datas.ics"',
      "Cache-Control": "no-cache, max-age=0",
    },
  });
});
