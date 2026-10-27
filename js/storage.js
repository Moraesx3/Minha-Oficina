/* ==========================================================
   storage.js — persistência SOMENTE em localStorage
   Os dados são um objeto JSON salvo com JSON.stringify e lidos com JSON.parse.
   As chaves são as mesmas do app anterior, então os dados antigos continuam.
   ========================================================== */
const STORE_KEY = 'fmoraes-painel-db';       // clientes, serviços, orçamentos, materiais...
const DOCS_KEY  = 'fmoraes-painel-docs';     // PDFs salvos (chave separada: arquivos são grandes)
const CACHE_KEY = 'fmoraes-painel-cache';    // cache de APIs (cobre, dólar, clima)

let storageAvailable = true;

// Configurações padrão (todas editáveis na tela Empresa)
const DEFAULT_SETTINGS = {
  cidade: 'Corbélia',
  btuM2: 700,        // BTU por m² (regra do Paraná informada pelo Felipe)
  btuPessoas: 700,   // BTU a mais a cada 2 pessoas fixas no local
  btuEquip: 600,     // BTU por equipamento que gera calor
  btuSol: 100,       // BTU extra por m² com sol da tarde
  cop: 3,            // relação aproximada BTU térmico → potência elétrica
  chaveCobre: '',    // "Chave da API" do cobre (fica só no navegador)
  alertaCobrePct: 5, // alerta se o cobre subir mais de X% desde a última revisão
  cobreManual: 0,    // preço manual do cobre em R$/kg (usado se não houver API)
  refCobre: null     // { preco, data } preço de referência da última revisão de preços
};

// Ficha de inspeção de exemplo (só em instalação nova, dados fictícios)
function fichaExemplo(){
  const dias = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const mensal = ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '3.1', '3.2'];
  return {
    fichas: [{ id: 1, clientId: 3, local: 'Clínica Exemplo – Centro', endereco: 'Rua Exemplo, 100 – Centro, Corbélia/PR', area: 120, ocupantes: 15,
      inicio: dias(40), tecnico: 'Técnico Exemplo', qualificacao: 'Técnico em refrigeração', notes: '' }],
    aparelhos: [
      { id: 1, fichaId: 1, codigo: 'AC-01', ambiente: 'Recepção', tipo: 'Split hi-wall', marca: 'Marca Exemplo', modelo: 'Inverter', serie: '', btu: 18000, fluido: 'R-32', instalacao: '2026-08-20' },
      { id: 2, fichaId: 1, codigo: 'AC-02', ambiente: 'Consultório 1', tipo: 'Split hi-wall', marca: 'Marca Exemplo', modelo: '', serie: '', btu: 12000, fluido: 'R-410A', instalacao: '' },
      { id: 3, fichaId: 1, codigo: 'AC-03', ambiente: 'Consultório 2', tipo: 'Split hi-wall', marca: 'Marca Exemplo', modelo: '', serie: '', btu: 9000, fluido: 'R-410A', instalacao: '' }
    ],
    visitas: [
      { id: 1, fichaId: 1, aparelhoId: 1, date: dias(10), tipo: 'M', feitas: mensal, tensao: '220', corrente: '6.8', tempIns: '12', tempRet: '24', obs: 'Filtros lavados, dreno ok.', executor: 'F.Moraes Instalações' },
      { id: 2, fichaId: 1, aparelhoId: 2, date: dias(38), tipo: 'M', feitas: mensal, tensao: '219', corrente: '4.9', tempIns: '13', tempRet: '25', obs: '', executor: 'F.Moraes Instalações' }
    ]
  };
}

function buildSeedDB(){
  return {
    clients: SEED.clients, services: SEED.services, budgets: SEED.budgets, company: SEED.company,
    materials: [], surveys: [], ...fichaExemplo(), settings: { ...DEFAULT_SETTINGS },
    updatedAt: '2000-01-01T00:00:00.000Z',
    nextId: {
      client: Math.max(0, ...SEED.clients.map(c => c.id)) + 1,
      service: Math.max(0, ...SEED.services.map(s => s.id)) + 1,
      budget: Math.max(0, ...SEED.budgets.map(b => b.id)) + 1,
      material: 1, survey: 1, ficha: 2, aparelho: 4, visita: 3
    }
  };
}

// Garante que dados antigos (sem materiais/levantamentos/settings) ganhem os campos novos
function normalizeDB(db){
  db.clients = db.clients || []; db.services = db.services || []; db.budgets = db.budgets || [];
  db.company = db.company || {};
  db.materials = db.materials || []; db.surveys = db.surveys || [];
  db.aparelhos = db.aparelhos || []; db.visitas = db.visitas || [];
  db.fichas = db.fichas || [];   // fichas de inspeção técnica
  db.settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}) };
  db.nextId = db.nextId || {};
  const prox = (lista, atual) => Math.max(atual || 1, Math.max(0, ...lista.map(i => i.id)) + 1);
  db.nextId.client = prox(db.clients, db.nextId.client);
  db.nextId.service = prox(db.services, db.nextId.service);
  db.nextId.budget = prox(db.budgets, db.nextId.budget);
  db.nextId.material = prox(db.materials, db.nextId.material);
  db.nextId.survey = prox(db.surveys, db.nextId.survey);
  db.nextId.ficha = prox(db.fichas, db.nextId.ficha);
  db.nextId.aparelho = prox(db.aparelhos, db.nextId.aparelho);
  db.nextId.visita = prox(db.visitas, db.nextId.visita);
  return db;
}

// LER: localStorage.getItem + JSON.parse
function loadDB(){
  try{
    const raw = window.localStorage.getItem(STORE_KEY);
    if(raw) return normalizeDB(JSON.parse(raw));
  }catch(e){ /* bloqueado ou JSON inválido: cai no padrão */ }
  return normalizeDB(buildSeedDB());
}
// SALVAR: JSON.stringify + localStorage.setItem
function saveDB(){
  DB.updatedAt = new Date().toISOString();
  try{
    window.localStorage.setItem(STORE_KEY, JSON.stringify(DB));
    storageAvailable = true;
  }catch(e){ storageAvailable = false; }
  updateStorageIndicator();
}
function updateStorageIndicator(){
  const pulse = document.querySelector('.pulse');
  if(!pulse) return;
  if(storageAvailable){
    pulse.style.background = ''; pulse.style.boxShadow = '';
    pulse.title = 'Dados salvos neste navegador';
  }else{
    pulse.style.background = 'var(--off)'; pulse.style.boxShadow = '0 0 0 3px var(--off-dim)';
    pulse.title = 'Alterações não estão sendo salvas neste modo';
  }
}

function loadDocs(){
  try{
    const raw = window.localStorage.getItem(DOCS_KEY);
    if(raw){ const d = JSON.parse(raw); d.items = d.items || []; return d; }
  }catch(e){}
  return { items: [], updatedAt: '2000-01-01T00:00:00.000Z' };
}
function saveDocs(){
  DOCS.updatedAt = new Date().toISOString();
  try{ window.localStorage.setItem(DOCS_KEY, JSON.stringify(DOCS)); }catch(e){ toast('Sem espaço para salvar o PDF'); }
}

// Cache simples das APIs: { chave: { t: timestamp, v: valor } }
function cacheGet(chave){
  try{ const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); return c[chave] || null; }catch(e){ return null; }
}
function cacheSet(chave, valor){
  try{
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    c[chave] = { t: Date.now(), v: valor };
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  }catch(e){}
}

let DB = normalizeDB(buildSeedDB());
let DOCS = { items: [], updatedAt: '2000-01-01T00:00:00.000Z' };

// Nome do cliente a partir do id
function clientName(id){
  const c = DB.clients.find(c => c.id === id);
  return c ? c.name : 'Cliente removido';
}
