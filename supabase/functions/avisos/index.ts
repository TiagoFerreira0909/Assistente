// Função "avisos" (Supabase Edge Function)
// - Todos os dias (pg_cron):
//   · depósitos a prazo: notifica 7 dias antes, 1 dia antes e quando terminam;
//   · subscrições: regista a cobrança (retira da conta) no dia certo e notifica, se pedido.
// - ?lembretes=1 (pg_cron, a cada 5 minutos) → notifica os lembretes que chegaram à hora
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

const euro = (v: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
function lerData(iso: string) { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function paraISO(d: Date) { return d.toISOString().slice(0, 10); }
function proximaCobranca(iso: string, freq: string, dia?: number) {
  const d = lerData(iso);
  if (freq === "semanal") { d.setUTCDate(d.getUTCDate() + 7); return paraISO(d); }
  const meses = freq === "anual" ? 12 : freq === "trimestral" ? 3 : 1;
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1));
  const ultimo = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).getUTCDate();
  n.setUTCDate(Math.min(dia || d.getUTCDate(), ultimo));
  return paraISO(n);
}
async function jaEnviada(chave: string) {
  const { error } = await sb.from("notificacoes_enviadas").insert({ chave });
  return !!error;
}

// Cobra as subscrições que chegaram ao dia e notifica (se pedido)
async function processarSubscricoes(hoje: string) {
  const { data: recs, error } = await sb.from("registos")
    .select("user_id,id,dados").eq("tabela", "recorrentes").eq("apagado", false);
  if (error) throw error;
  const { data: contas, error: e2 } = await sb.from("registos").select("user_id,id,dados").eq("tabela", "contas").eq("apagado", false);
  if (e2) throw e2;
  const nomeConta = new Map((contas ?? []).map((c) => [`${c.user_id}:${c.id}`, (c.dados as { nome?: string })?.nome || "conta"]));
  const tresDiasAtras = paraISO(new Date(lerData(hoje).getTime() - 3 * 86400000));
  let cobradas = 0, enviadas = 0;

  for (const r of recs ?? []) {
    const d = { ...(r.dados as Record<string, any>) };
    if (!d || d.ativa === false || !d.proximaData) continue;
    // Conta já apagada: não cobra (o movimento ficava numa conta que não existe)
    if (!nomeConta.has(`${r.user_id}:${d.contaId}`)) continue;
    const datas: string[] = [];
    let voltas = 0;
    while (d.proximaData <= hoje && voltas++ < 120) {
      const id = `sub-${r.id}-${d.proximaData}`;
      const agora = Date.now();
      await sb.from("registos").upsert({
        user_id: r.user_id, tabela: "financas", id, atualizado: agora, apagado: false,
        dados: { id, tipo: "despesa", valor: d.valor, contaId: d.contaId, contaDestinoId: null,
          categoria: d.categoria || "Subscrições", data: d.proximaData, descricao: d.nome,
          criado: agora, automatico: true, subscricaoId: r.id, _t: agora },
      }, { onConflict: "user_id,tabela,id", ignoreDuplicates: true });
      datas.push(d.proximaData);
      d.proximaData = proximaCobranca(d.proximaData, d.frequencia, d.dia);
      cobradas++;
    }
    if (datas.length) {
      const agora = Date.now(); d._t = agora;
      await sb.from("registos").update({ dados: d, atualizado: agora })
        .eq("user_id", r.user_id).eq("tabela", "recorrentes").eq("id", r.id);
    }
    if (!d.notificar) continue;
    // Notifica a cobrança mais recente (feita agora ou já registada pela app hoje)
    const candidata = datas.length ? datas[datas.length - 1] : hoje;
    if (candidata < tresDiasAtras) continue;
    const { data: mov } = await sb.from("registos").select("apagado")
      .eq("user_id", r.user_id).eq("tabela", "financas").eq("id", `sub-${r.id}-${candidata}`).maybeSingle();
    if (!mov || mov.apagado) continue;
    if (await jaEnviada(`${r.user_id}:sub:${r.id}:${candidata}`)) continue;
    enviadas += await enviar(r.user_id, {
      titulo: `💳 ${d.nome}`,
      corpo: `${euro(d.valor)} retirados de ${nomeConta.get(`${r.user_id}:${d.contaId}`) || "conta"}.`,
      url: APP,
    });
  }
  return { cobradas, enviadas };
}

// Lembretes com aviso cuja hora já chegou (hora de Lisboa). Sem hora → avisa às 09:00.
// Cada lembrete/data/hora só é notificado uma vez (notificacoes_enviadas); só avisa até 1h depois (não avisa lembretes antigos).
async function processarLembretes() {
  const fmt = (d: Date) => new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(d); // "2026-10-14 21:30"
  const agora = fmt(new Date());
  const limite = fmt(new Date(Date.now() - 3600000));
  const { data: lems, error } = await sb.from("registos")
    .select("user_id,id,dados").eq("tabela", "lembretes").eq("apagado", false)
    .eq("dados->>notificar", "true").eq("dados->>concluido", "false");
  if (error) throw error;
  let enviadas = 0;
  for (const l of lems ?? []) {
    const d = l.dados as { titulo: string; notas?: string; data?: string; hora?: string };
    if (!d?.data) continue;
    const quando = `${d.data} ${d.hora || "09:00"}`;
    if (quando > agora || quando < limite) continue;
    if (await jaEnviada(`${l.user_id}:lem:${l.id}:${d.data}:${d.hora || "dia"}`)) continue;
    enviadas += await enviar(l.user_id, {
      titulo: `⏰ ${d.titulo}`,
      corpo: d.notas || (d.hora ? `Hoje às ${d.hora}` : "Hoje"),
      tag: `lem-${l.id}-${d.data}-${d.hora || "dia"}`,
      url: APP,
    });
  }
  return { enviadas };
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
        corpo: "Vais receber aqui os lembretes, as cobranças das subscrições e os avisos dos depósitos a prazo.",
        url: APP,
      });
      return json({ enviadas: n });
    }

    if (url.searchParams.has("lembretes")) return json({ ok: true, lembretes: await processarLembretes() });

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
    const subs = await processarSubscricoes(hoje);
    return json({ ok: true, hoje, enviadas, subscricoes: subs });
  } catch (e) {
    console.error(e);
    return json({ erro: String((e as Error)?.message || e) }, 500);
  }
});
