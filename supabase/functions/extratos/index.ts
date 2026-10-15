// Função "extratos" (Supabase Edge Function)
// Lê extratos bancários (PDF, prints da app do banco, CSV/texto) com o Claude e devolve os movimentos.
// Não grava nada: a app mostra a lista para rever e só depois regista os movimentos.
// - POST { partes: [{ tipo: "imagem"|"pdf"|"texto", nome, dados }], hoje: "YYYY-MM-DD", categorias: { despesa: [], receita: [] } }
//   (imagem = JPEG em base64, pdf = base64, texto = conteúdo do ficheiro) com Authorization: Bearer <sessão>
//   → { movimentos: [{ data, descricao, valor, tipo, categoria }], saldoFinal, observacoes }
// - GET ?estado=1 → { chave: true|false } (só diz se a chave da API está configurada)
// Secrets: ANTHROPIC_API_KEY (obrigatório); EXTRATOS_UTILIZADORES (ids separados por vírgulas; se existir, só esses podem usar).
// Sem EXTRATOS_UTILIZADORES, só podem usar as contas criadas até CONTAS_ATE (o registo está aberto e cada leitura
// gasta crédito da API: uma conta nova criada por um estranho não consegue usar a função).
// Publicar com verify JWT desligado (a sessão é verificada aqui dentro):
//   supabase functions deploy extratos --no-verify-jwt --project-ref putvpneoexwblbbqemer
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "jsr:@supabase/supabase-js@2";

const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, chaveServico, { auth: { persistSession: false } });
const MODELO = "claude-opus-5-5";
const MAX_PARTES = 24;
const CONTAS_ATE = "2026-10-16";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Parte = { tipo: string; nome?: string; dados: string };

const SISTEMA = `Extrais movimentos bancários de extratos e capturas de ecrã de apps de bancos portugueses, para uma app pessoal de finanças.
Regras:
- Inclui cada movimento uma só vez: compras, pagamentos, débitos diretos, levantamentos, transferências, comissões, juros, salários, reembolsos. Não incluas linhas de saldo, totais, cabeçalhos nem movimentos recusados ou anulados.
- Algumas imagens são fatias consecutivas de uma captura comprida e sobrepõem-se um pouco: o mesmo movimento visto em duas fatias conta uma vez.
- data: a data do movimento em YYYY-MM-DD (se houver data de movimento e data-valor, usa a do movimento). Se a data não tiver ano ("12 out", "ontem", "hoje"), usa a data de hoje indicada para a deduzir, escolhendo o ano mais recente que não fique no futuro.
- valor: sempre positivo, em euros. tipo: "despesa" para dinheiro que sai da conta, "receita" para dinheiro que entra.
- descricao: curta e legível, como uma pessoa escreveria (ex.: "Continente", "Netflix", "Transferência para João Silva", "Levantamento MB"), sem códigos, referências nem números de cartão.
- categoria: a mais adequada da lista do tipo correspondente; "Outros" se nenhuma servir.
- saldo_final: o saldo da conta mais recente que aparecer no documento, ou null.
- observacoes: uma frase curta em português de Portugal só se o utilizador precisar de saber algo (ex.: parte ilegível, mais do que uma conta no documento, moeda diferente do euro); senão "".`;

function esquema(categorias: { despesa: string[]; receita: string[] }) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["movimentos", "saldo_final", "observacoes"],
    properties: {
      movimentos: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["data", "descricao", "valor", "tipo", "categoria"],
          properties: {
            data: { type: "string", description: "YYYY-MM-DD" },
            descricao: { type: "string" },
            valor: { type: "number" },
            tipo: { type: "string", enum: ["despesa", "receita"] },
            categoria: { type: "string", enum: [...new Set([...categorias.despesa, ...categorias.receita])] },
          },
        },
      },
      saldo_final: { anyOf: [{ type: "number" }, { type: "null" }] },
      observacoes: { type: "string" },
    },
  };
}

const listaTexto = (v: unknown, reserva: string[]) =>
  Array.isArray(v) && v.length && v.every((x) => typeof x === "string" && x.length < 40) ? (v as string[]).slice(0, 30) : reserva;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const temChave = !!Deno.env.get("ANTHROPIC_API_KEY");
  const url = new URL(req.url);
  if (url.searchParams.has("estado")) return json({ chave: temChave });
  if (req.method !== "POST") return json({ erro: "Método não suportado" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data } = await sb.auth.getUser(jwt);
    if (!data?.user) return json({ erro: "A sessão expirou. Entra outra vez na tua conta." }, 401);
    const permitidos = (Deno.env.get("EXTRATOS_UTILIZADORES") || "").split(",").map((s) => s.trim()).filter(Boolean);
    const permitido = permitidos.length ? permitidos.includes(data.user.id) : (data.user.created_at ?? "9999") < CONTAS_ATE;
    if (!permitido) return json({ erro: "Esta conta não pode usar a leitura de extratos." }, 403);
    if (!temChave) return json({ erro: "A leitura de PDF e prints ainda não está configurada (falta a chave da API do Claude)." }, 503);

    const corpo = await req.json();
    const partes: Parte[] = Array.isArray(corpo?.partes) ? corpo.partes : [];
    if (!partes.length) return json({ erro: "Não chegou nenhum ficheiro." }, 400);
    if (partes.length > MAX_PARTES) return json({ erro: `Demasiados ficheiros de uma vez (máximo ${MAX_PARTES}).` }, 400);
    const hoje = /^\d{4}-\d{2}-\d{2}$/.test(corpo?.hoje ?? "") ? corpo.hoje
      : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
    const categorias = {
      despesa: listaTexto(corpo?.categorias?.despesa, ["Outros"]),
      receita: listaTexto(corpo?.categorias?.receita, ["Outros"]),
    };

    // deno-lint-ignore no-explicit-any
    const conteudo: any[] = [];
    for (const p of partes) {
      if (typeof p?.dados !== "string" || !p.dados) continue;
      if (p.tipo === "imagem") conteudo.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.dados } });
      else if (p.tipo === "pdf") conteudo.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: p.dados } });
      else if (p.tipo === "texto") conteudo.push({ type: "text", text: `Ficheiro ${String(p.nome || "").slice(0, 80)}:\n${p.dados.slice(0, 300000)}` });
    }
    if (!conteudo.length) return json({ erro: "Os ficheiros chegaram vazios." }, 400);
    conteudo.push({
      type: "text",
      text: `Hoje é ${hoje}.\nCategorias de despesa: ${categorias.despesa.join(", ")}.\nCategorias de receita: ${categorias.receita.join(", ")}.\nExtrai os movimentos destes ficheiros.`,
    });

    const cliente = new Anthropic();
    const resposta = await cliente.beta.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      // @ts-ignore: "fallbacks" pode ainda não estar nos tipos do SDK
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: esquema(categorias) } },
      system: SISTEMA,
      messages: [{ role: "user", content: conteudo }],
    }).finalMessage();

    if (resposta.stop_reason === "refusal") return json({ erro: "O Claude não conseguiu ler estes ficheiros. Experimenta outros prints ou o PDF." }, 422);
    if (resposta.stop_reason === "max_tokens") return json({ erro: "O extrato é demasiado grande para ler de uma vez. Envia menos páginas ou prints de cada vez." }, 422);
    const texto = resposta.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const r = JSON.parse(texto);
    return json({
      movimentos: Array.isArray(r.movimentos) ? r.movimentos : [],
      saldoFinal: typeof r.saldo_final === "number" ? r.saldo_final : null,
      observacoes: typeof r.observacoes === "string" ? r.observacoes : "",
    });
  } catch (e) {
    // Não registar o conteúdo dos ficheiros (dados bancários), só o erro
    const msg = e instanceof Error ? e.message : String(e);
    console.error("extratos:", msg.slice(0, 300));
    if (e instanceof Anthropic.RateLimitError) return json({ erro: "Muitos pedidos seguidos. Espera um minuto e tenta outra vez." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ erro: "A chave da API do Claude não é válida." }, 503);
    if (e instanceof Anthropic.BadRequestError && /credit|billing/i.test(msg)) return json({ erro: "A conta da API do Claude está sem crédito." }, 503);
    return json({ erro: "A leitura falhou. Tenta outra vez daqui a pouco." }, 500);
  }
});
