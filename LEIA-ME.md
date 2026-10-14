# Assistente Pessoal (PWA)

Web app para gerir finanças, notas, lembretes e datas, instalável no iPhone.

## Ficheiros
- `index.html` — estrutura da página e barra de navegação
- `style.css` — aspeto (modo claro e escuro automático)
- `db.js` — base de dados local (IndexedDB), os dados ficam no próprio iPhone
- `app.js` — lógica da app (navegação, Início, Notas)
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
- Os dados ficam só neste dispositivo. Se apagares a app do ecrã principal, perdes os dados.
  (Próximo passo sugerido: exportar/importar backup, ou sincronizar com Supabase.)
- Módulos por fazer: Finanças, Lembretes, Datas.
