// Função "avisos" (Supabase Edge Function)
// - Todos os dias (pg_cron) verifica os depósitos a prazo e envia notificações:
//   7 dias antes, 1 dia antes e quando terminam.
// - ?chave=1  → devolve a chave pública para a app ativar as notificações
// - ?teste=1  → envia uma notificação de teste para quem a pediu (precisa de sessão)
// As chaves das notificações (VAPID) são criadas aqui na primeira vez e ficam guardadas
// na tabela config_privada, à qual só esta função tem acesso.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, chaveServico, { auth: { persistSession: false } });
const APP = "https://tiagoferreira0909.github.io/Assistente/";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function chaves(): Promise<{ publicKey: string; privateKey: string }> {
  const ler = async () => (await sb.from("config_privada").select("valor").eq("chave", "vapid").maybeSingle()).data;
  let linha = await ler();
  if (!linha) {
    const k = webpush.generateVAPIDKeys();
    await sb.from("config_privada").upsert({ chave: "vapid", valor: JSON.stringify(k) }, { onConflict: "chave", ignoreDuplicates: true });
    linha = await ler();
  }
  return JSON.parse(linha!.valor);
}

async function enviar(userId: string, msg: Record<string, string>) {
  const { data: subs } = await sb.from("subscricoes").select("endpoint,dados").eq("user_id", userId);
  let n = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(s.dados, JSON.stringify(msg), { TTL: 86400 });
      n++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("subscricoes").delete().eq("endpoint", s.endpoint);
      else console.error("Falhou o envio:", e);
    }
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const k = await chaves();
    webpush.setVapidDetails(APP, k.publicKey, k.privateKey);

    if (url.searchParams.has("chave")) return json({ publica: k.publicKey });

    if (url.searchParams.has("teste")) {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data } = await sb.auth.getUser(jwt);
      if (!data?.user) return json({ erro: "Sem sessão" }, 401);
      const n = await enviar(data.user.id, {
        titulo: "Notificações ativadas ✓",
        corpo: "Vais ser avisado quando um depósito a prazo estiver a terminar.",
        url: APP,
      });
      return json({ enviadas: n });
    }

    // Rotina diária
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
    const { data: contas, error } = await sb.from("registos")
      .select("user_id,id,dados").eq("tabela", "contas").eq("apagado", false).eq("dados->>tipo", "deposito");
    if (error) throw error;

    let enviadas = 0;
    for (const c of contas ?? []) {
      const d = c.dados as { nome: string; dataFim?: string; terminado?: boolean };
      if (!d?.dataFim || d.terminado) continue;
      const dias = Math.round((Date.parse(d.dataFim) - Date.parse(hoje)) / 86400000);
      const data = d.dataFim.split("-").reverse().join("/");
      let marca = "", msg: Record<string, string> | null = null;
      if (dias === 7) {
        marca = "7d";
        msg = { titulo: "⏳ Depósito a terminar", corpo: `${d.nome} termina daqui a 7 dias (${data}). Vê se a taxa da renovação compensa.` };
      } else if (dias === 1) {
        marca = "1d";
        msg = { titulo: "⏳ Depósito termina amanhã", corpo: `${d.nome} termina amanhã (${data}).` };
      } else if (dias <= 0 && dias > -30) {
        marca = "fim";
        msg = { titulo: "🔔 Depósito terminou", corpo: `${d.nome} terminou${dias === 0 ? " hoje" : ` a ${data}`}. Abre a app para registar os juros e confirmar a nova taxa.` };
      }
      if (!msg) continue;
      const { error: jaEnviada } = await sb.from("notificacoes_enviadas").insert({ chave: `${c.user_id}:${c.id}:${d.dataFim}:${marca}` });
      if (jaEnviada) continue;
      enviadas += await enviar(c.user_id, { ...msg, url: APP });
    }
    return json({ ok: true, hoje, enviadas });
  } catch (e) {
    console.error(e);
    return json({ erro: String((e as Error)?.message || e) }, 500);
  }
});
