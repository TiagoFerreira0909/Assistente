# Assistente Pessoal (PWA)

Web app para gerir finanças, notas, lembretes e datas, instalável no iPhone.

## Ficheiros
- `index.html` — estrutura da página e barra de navegação
- `style.css` — aspeto (modo claro e escuro automático)
- `db.js` — base de dados local (IndexedDB), os dados ficam no próprio iPhone
- `app.js` — núcleo da app (navegação, folhas, Início, Notas)
- `financas.js` — contas, movimentos, juros e resumo mensal
- `nuvem.js` — login e sincronização com o Supabase
- `arranque.js` — arranca a app
- `supabase/esquema.sql` — estrutura da base de dados (já aplicada no projeto Supabase "assistente")
- `supabase/notificacoes.sql` — tabelas das notificações e agendamento diário (já aplicado)
- `supabase/functions/avisos/` — função que envia as notificações dos depósitos (já publicada)
- `sw.js` — permite funcionar sem internet
- `manifest.json` + `icons/` — nome e ícone quando instalada

## Testar no PC
Abre uma consola na pasta e corre:

    python -m http.server 8000

Depois abre http://localhost:8000 no browser.
(Abrir o index.html com duplo clique não funciona bem, precisa de servidor.)

## Publicar e instalar no iPhone (GitHub Pages, grátis)
1. Cria conta em github.com e um repositório novo (ex.: `assistente`), público.
2. "Add file → Upload files" e arrasta todos os ficheiros e a pasta `icons`.
3. Settings → Pages → Branch: `main` → Save.
4. Passado 1–2 minutos fica em `https://<utilizador>.github.io/assistente/`.
5. No iPhone, abre esse endereço no **Safari** → Partilhar → **Adicionar ao ecrã principal**.

## Atualizar
Depois de alterar ficheiros, muda `VERSAO` em `sw.js` (ex.: `assistente-v2`) e volta a enviar.
Fecha e abre a app no iPhone (às vezes duas vezes) para apanhar a versão nova.

## Notas importantes
- Com conta iniciada, os dados ficam guardados no Supabase e sincronizam entre aparelhos.
  Funciona sem internet: as alterações são enviadas quando houver rede.
- Sem conta ("Continuar sem conta"), os dados ficam só neste aparelho.
- Módulos por fazer: Lembretes, Datas.
- Depósitos a prazo: com data de início e fim. Quando terminam, a app regista os juros, renova o prazo (se escolheres "Renova sozinho") e mostra um aviso para confirmares a nova taxa.
- Notificações: ativam-se em Conta (círculo no topo). Chegam 7 dias antes, 1 dia antes e quando um depósito termina (por volta das 9h).
- Juros: a estimativa usa a taxa anual que indicares e desconta 28% de IRS (podes escolher valor bruto por conta).
