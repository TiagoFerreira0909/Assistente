// Base de dados local (IndexedDB) — os dados ficam sempre no aparelho,
// e cada alteração fica marcada como "pendente" para ser enviada para a nuvem.
const DB = (() => {
  const NOME = 'assistente';
  const VERSAO = 5;
  // 'financas' guarda os movimentos (despesas, receitas, transferências, juros)
  // 'recorrentes' guarda as subscrições (pagamentos que se repetem)
  // 'definicoes' guarda preferências que passam entre aparelhos (ex.: link do Google Calendar)
  const TABELAS = ['notas', 'financas', 'contas', 'recorrentes', 'lembretes', 'datas', 'definicoes'];
  let ligacao;
  const ouvintes = [];

  function abrir() {
    if (ligacao) return Promise.resolve(ligacao);
    return new Promise((resolve, reject) => {
      const pedido = indexedDB.open(NOME, VERSAO);
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        for (const t of [...TABELAS, 'pendentes']) {
          if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: t === 'pendentes' ? 'chave' : 'id' });
        }
      };
      pedido.onsuccess = () => { ligacao = pedido.result; resolve(ligacao); };
      pedido.onerror = () => reject(pedido.error);
    });
  }

  async function operar(tabelas, modo, fn) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(tabelas, modo);
      const pedido = fn(tx);
      tx.oncomplete = () => resolve(pedido && pedido.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Grava e marca como pendente (para sincronizar)
  async function guardar(tabela, obj) {
    obj._t = Date.now();
    await operar([tabela, 'pendentes'], 'readwrite', (tx) => {
      tx.objectStore('pendentes').put({ chave: `${tabela}:${obj.id}`, tabela, id: obj.id, apagado: false, atualizado: obj._t });
      return tx.objectStore(tabela).put(obj);
    });
    ouvintes.forEach((f) => f());
  }
  async function apagar(tabela, id) {
    await operar([tabela, 'pendentes'], 'readwrite', (tx) => {
      tx.objectStore('pendentes').put({ chave: `${tabela}:${id}`, tabela, id, apagado: true, atualizado: Date.now() });
      return tx.objectStore(tabela).delete(id);
    });
    ouvintes.forEach((f) => f());
  }

  return {
    TABELAS,
    todos: (tabela) => operar(tabela, 'readonly', (tx) => tx.objectStore(tabela).getAll()),
    um: (tabela, id) => operar(tabela, 'readonly', (tx) => tx.objectStore(tabela).get(id)),
    guardar,
    apagar,
    // Usado pela sincronização: grava/apaga sem criar pendentes
    gravarLocal: (tabela, obj) => operar(tabela, 'readwrite', (tx) => tx.objectStore(tabela).put(obj)),
    apagarLocal: (tabela, id) => operar(tabela, 'readwrite', (tx) => tx.objectStore(tabela).delete(id)),
    pendentes: () => operar('pendentes', 'readonly', (tx) => tx.objectStore('pendentes').getAll()),
    tirarPendente: (chave) => operar('pendentes', 'readwrite', (tx) => tx.objectStore('pendentes').delete(chave)),
    marcarTudoPendente: async () => {
      for (const t of TABELAS) {
        const todos = await DB.todos(t);
        await operar('pendentes', 'readwrite', (tx) => {
          for (const o of todos) tx.objectStore('pendentes').put({ chave: `${t}:${o.id}`, tabela: t, id: o.id, apagado: false, atualizado: o._t || 1 });
        });
      }
    },
    limparTudo: () => operar([...TABELAS, 'pendentes'], 'readwrite', (tx) => {
      for (const t of [...TABELAS, 'pendentes']) tx.objectStore(t).clear();
    }),
    aoMudar: (f) => ouvintes.push(f),
    novoId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
  };
})();
