# Assistente Pessoal — notas para o Claude Code

App pessoal do Tiago (iPhone, sem Mac) feita como **PWA** em HTML/CSS/JS puro, sem framework nem build.
Publicada em GitHub Pages: https://tiagoferreira0909.github.io/Assistente/ (ramo `main`, pasta raiz).
Tudo em **português de Portugal**: interface, nomes de variáveis/funções e comentários.

## Ficheiros
- `index.html` — esqueleto; carrega os scripts por esta ordem: `db.js`, `app.js`, `financas.js`, `importar.js`, `lembretes.js`, `datas.js`, `nuvem.js`, `copia.js`, `arranque.js`
- `app.js` — núcleo: navegação (`VISTAS`, `irPara`, `redesenhar`), utilitários (`el`, `euro`, `campo`, `segmentos`, `lerNumero`), folhas (`abrirFolha`), Início e Notas
- `financas.js` — contas, movimentos, depósitos a prazo (`verificarDepositos`), subscrições (`verificarSubscricoes`), resumo
- `importar.js` — importar extratos (Finanças → Movimentos → Importar): CSV lido no aparelho; PDF/prints (e CSV que não se perceba) lidos pela função `extratos`. Mostra a lista para rever antes de gravar; ids determinísticos `imp-<conta>-<data>-<cêntimos>-<hash descrição>-<n>`; marca como já registado o que tem o mesmo valor na mesma conta a ±3 dias
- `lembretes.js` — Lembretes (estilo iPhone: data/hora opcionais, repetir, prioridade, aviso por lembrete); notificações locais enquanto a app está aberta (`agendarLembretesLocais`)
- `datas.js` — datas importantes (aniversários, prazos, pagamentos; repetição anual/mensal) e ligação ao Google Calendar por link de calendário (.ics)
- `nuvem.js` — login Supabase (REST/fetch, sem biblioteca), sincronização, notificações push, ecrãs de conta
- `copia.js` — cópia de segurança: exportar todos os dados para um ficheiro JSON (partilhar → Guardar em Ficheiros) e repor a partir dele, sem apagar nem duplicar (fica a versão mais recente de cada registo, pelo `_t`)
- `db.js` — IndexedDB local; cada `DB.guardar/apagar` cria um "pendente" para sincronizar. Tabelas: notas, financas (movimentos), contas, recorrentes (subscrições), lembretes, datas, definicoes (ex.: token do calendário)
- `sw.js` — service worker (rede primeiro, cache como reserva) + push
- `supabase/` — SQL aplicado e código das Edge Functions `avisos` e `calendario`

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
  Com `?lembretes=1` (pg_cron a cada 5 min, `supabase/lembretes.sql`) notifica os lembretes que chegaram à hora (hora de Lisboa; sem hora → 09:00).
  A notificação usa `tag` `lem-<id>-<data>-<hora|dia>`, igual à local, para o iPhone não mostrar duas.
  O código-fonte está em `supabase/functions/avisos/index.ts`; ao alterá-lo é preciso voltar a publicar a função
  (Supabase CLI: `supabase functions deploy avisos --no-verify-jwt --project-ref putvpneoexwblbbqemer`, ou pelo dashboard).
- Edge Function `calendario` (verify JWT desligado): `GET ?t=<token>` devolve as datas do utilizador em `.ics`, para o
  Google Calendar subscrever "a partir do URL". O token vem de `registos` (tabela `definicoes`, id `calendario`),
  criado na app em Datas → Google Calendar. Não precisa de SQL novo. Publicar como a `avisos` (trocar o nome).

- Edge Function `extratos` (verify JWT desligado, verifica a sessão no código): `POST` com imagens/PDF/texto em base64 → movimentos
  extraídos pelo Claude (`claude-opus-5-5`, saída em JSON com esquema). Não grava nada. Precisa do secret `ANTHROPIC_API_KEY`
  (tem custo por uso). Só contas criadas até 2026-10-16 a podem usar (ou as do secret `EXTRATOS_UTILIZADORES`).
  `GET ?estado=1` diz se a chave está configurada. Publicar como a `avisos` (trocar o nome).

## Por fazer / ideias
- Juros automáticos mensais para contas poupança (ex.: Revolut, taxa em RPA)
- Lembrete periódico para fazer cópia de segurança (a data da última fica em `localStorage.ultimaCopia`)
- Desligar novos registos no Supabase depois de o Tiago ter conta (só ele usa a app)
