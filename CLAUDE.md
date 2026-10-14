# Assistente Pessoal — notas para o Claude Code

App pessoal do Tiago (iPhone, sem Mac) feita como **PWA** em HTML/CSS/JS puro, sem framework nem build.
Publicada em GitHub Pages: https://tiagoferreira0909.github.io/Assistente/ (ramo `main`, pasta raiz).
Tudo em **português de Portugal**: interface, nomes de variáveis/funções e comentários.

## Ficheiros
- `index.html` — esqueleto; carrega os scripts por esta ordem: `db.js`, `app.js`, `financas.js`, `nuvem.js`, `copia.js`, `arranque.js`
- `app.js` — núcleo: navegação (`VISTAS`, `irPara`, `redesenhar`), utilitários (`el`, `euro`, `campo`, `segmentos`, `lerNumero`), folhas (`abrirFolha`), Início e Notas
- `financas.js` — contas, movimentos, depósitos a prazo (`verificarDepositos`), subscrições (`verificarSubscricoes`), resumo
- `nuvem.js` — login Supabase (REST/fetch, sem biblioteca), sincronização, notificações push, ecrãs de conta
- `copia.js` — cópia de segurança: exportar todos os dados para um ficheiro JSON (partilhar → Guardar em Ficheiros) e repor a partir dele, sem apagar nem duplicar (fica a versão mais recente de cada registo, pelo `_t`)
- `db.js` — IndexedDB local; cada `DB.guardar/apagar` cria um "pendente" para sincronizar. Tabelas: notas, financas (movimentos), contas, recorrentes (subscrições), lembretes, datas
- `sw.js` — service worker (rede primeiro, cache como reserva) + push
- `supabase/` — SQL aplicado e código da Edge Function `avisos`

## Regras ao alterar
- **Sempre que mudares ficheiros da app**: incrementar `VERSAO` em `sw.js` (`assistente-vN`) e `VERSAO_APP` em `app.js` (mesmo N). A app recarrega sozinha quando deteta versão nova; o número aparece em Conta.
- Se acrescentares uma tabela local: incrementar `VERSAO` em `db.js` e adicioná-la a `TABELAS` (é sincronizada automaticamente).
- Formulários usam sempre `abrirFolha({ titulo, corpo, guardar, apagar })` — tem topo fixo e botão Guardar fixo em baixo (problemas de scroll/teclado no iPhone já resolvidos aqui; não criar janelas próprias).
- Ações automáticas (juros, cobranças) usam **ids determinísticos** (ex.: `sub-<id>-<data>`, `juros-<id>-<data>`) para nunca duplicar entre aparelhos e a função na nuvem.
- Datas guardadas como texto `YYYY-MM-DD` (hora local). Valores em euros arredondados a 2 casas.
- Testar num browser com tamanho de iPhone (ex.: 390×844 e 375×667) antes de publicar; servir com `python -m http.server`.

## Supabase (projeto "assistente", ref `putvpneoexwblbbqemer`, região UE)
- Chave pública (publishable) está em `nuvem.js` — pode estar no código. **Nunca** pôr chaves secretas/service_role no repositório.
- Tabela `registos` (user_id, tabela, id, dados jsonb, atualizado, apagado, servidor_em) com RLS: cada utilizador só vê os seus.
- Tabelas `subscricoes` (aparelhos com push), `notificacoes_enviadas` e `config_privada` (chaves VAPID, só a função acede).
- Edge Function `avisos` (verify JWT desligado), corre diariamente às 08:00 UTC via pg_cron:
  depósitos a prazo (avisos 7d/1d/fim) e subscrições (regista a cobrança e notifica se `notificar`).
  O código-fonte está em `supabase/functions/avisos/index.ts`; ao alterá-lo é preciso voltar a publicar a função
  (Supabase CLI: `supabase functions deploy avisos --no-verify-jwt --project-ref putvpneoexwblbbqemer`, ou pelo dashboard).

## Por fazer / ideias
- Módulos Lembretes e Datas (ainda mostram "Ainda por fazer")
- Juros automáticos mensais para contas poupança (ex.: Revolut, taxa em RPA)
- Lembrete periódico para fazer cópia de segurança (a data da última fica em `localStorage.ultimaCopia`)
- Desligar novos registos no Supabase depois de o Tiago ter conta (só ele usa a app)
