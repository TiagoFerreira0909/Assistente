// Pequena camada sobre o IndexedDB (base de dados do próprio browser/iPhone).
// Cada módulo tem a sua "tabela": notas, financas, lembretes, datas.
const DB = (() => {
  const NOME = 'assistente';
  const VERSAO = 1;
  const TABELAS = ['notas', 'financas', 'lembretes', 'datas'];
  let ligacao;

  function abrir() {
    if (ligacao) return Promise.resolve(ligacao);
    return new Promise((resolve, reject) => {
      const pedido = indexedDB.open(NOME, VERSAO);
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        for (const t of TABELAS) {
          if (!db.objectStoreNames.contains(t)) {
            db.createObjectStore(t, { keyPath: 'id' });
          }
        }
      };
      pedido.onsuccess = () => { ligacao = pedido.result; resolve(ligacao); };
      pedido.onerror = () => reject(pedido.error);
    });
  }

  async function operar(tabela, modo, fn) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(tabela, modo);
      const pedido = fn(tx.objectStore(tabela));
      tx.oncomplete = () => resolve(pedido && pedido.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    todos: (tabela) => operar(tabela, 'readonly', (s) => s.getAll()),
    guardar: (tabela, obj) => operar(tabela, 'readwrite', (s) => s.put(obj)),
    apagar: (tabela, id) => operar(tabela, 'readwrite', (s) => s.delete(id)),
    novoId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
  };
})();
