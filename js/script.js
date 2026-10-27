/* ==========================================================
   script.js — navegação (SPA), botão "+" e inicialização
   Carrega por último: usa tudo que os outros módulos definiram.
   ========================================================== */
const TABS = [
  { id: 'dashboard', label: 'Painel', icon: '<path d="M4 13h6V4H4v9zM4 20h6v-5H4v5zM14 20h6V11h-6v9zM14 4v5h6V4h-6z"/>' },
  { id: 'services', label: 'Serviços', icon: '<path d="M12 2l1.6 4.9L19 8l-4.4 3.2L16 16l-4-3-4 3 1.4-4.8L5 8l5.4-1.1L12 2z"/>' },
  { id: 'clients', label: 'Clientes', icon: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>' },
  { id: 'budgets', label: 'Orçam.', icon: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h6M9 15h6M9 7h3"/>' },
  { id: 'materials', label: 'Materiais', icon: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>' },
  { id: 'tech', label: 'Técnico', icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>' },
  { id: 'config', label: 'Empresa', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 000-3l1.2-1.7-2.1-2.1-1.7 1.2a1.7 1.7 0 00-3 0L12.5 4.3h-3l-1.3 2.6a1.7 1.7 0 00-3 0L3.5 5.7 1.4 7.8l1.2 1.7a1.7 1.7 0 000 3L1.4 14.2l2.1 2.1 1.7-1.2a1.7 1.7 0 003 0l1.3 2.6h3l1.3-2.6a1.7 1.7 0 003 0l1.7 1.2 2.1-2.1z"/>' }
];
let currentTab = 'dashboard';

function renderTabbar(){
  const el = document.getElementById('tabbarInner');
  // a tela "archive" é aberta por botões; mantém a aba de origem destacada
  const ativo = currentTab === 'archive' ? arquivoOrigem : currentTab;
  el.innerHTML = TABS.map(t => `
    <button class="tab ${t.id === ativo ? 'active' : ''}" type="button" data-tab="${t.id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${t.icon}</svg>
      <span>${t.label}</span>
    </button>`).join('');
  el.querySelectorAll('.tab').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
}
let arquivoOrigem = 'budgets';   // aba que fica destacada enquanto a tela Arquivos está aberta
function switchTab(id){
  if(id === 'archive' && currentTab !== 'archive') arquivoOrigem = currentTab === 'tech' ? 'tech' : 'budgets';
  currentTab = id;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));   // classList
  document.getElementById('view-' + id).classList.add('active');
  renderTabbar();
  renderCurrent();
  window.scrollTo(0, 0);
}
function renderCurrent(){
  const fab = document.getElementById('fabBtn');
  fab.style.display = ['config', 'archive', 'tech'].includes(currentTab) ? 'none' : 'flex';
  if(currentTab === 'dashboard') renderDashboard();
  if(currentTab === 'clients') renderClients();
  if(currentTab === 'services') renderServices();
  if(currentTab === 'budgets') renderBudgets();
  if(currentTab === 'materials') renderMaterials();
  if(currentTab === 'tech') renderTech();      // ajusta o "+" conforme a sub-aba
  if(currentTab === 'archive') renderArchive();
  if(currentTab === 'config') renderConfig();
}

// Botão "+" muda de função conforme a tela
document.getElementById('fabBtn').addEventListener('click', () => {
  if(currentTab === 'clients') openClientSheet(null);
  else if(currentTab === 'services' || currentTab === 'dashboard') openServiceSheet(null);
  else if(currentTab === 'budgets') openBudgetSheet(null);
  else if(currentTab === 'materials') openMaterialSheet(null);
  else if(currentTab === 'tech' && techTab === 'inspecao') fichaAberta ? openVisitaSheet(null) : openFichaSheet(null);
  else if(currentTab === 'tech') openSurveySheet(null);
});

/* ===================== INÍCIO ===================== */
(function init(){
  DB = loadDB();            // lê do localStorage (JSON.parse)
  saveDB();
  DOCS = loadDocs();
  document.getElementById('brandName').textContent = DB.company.name || 'Minha Oficina';
  renderTabbar();
  switchTab('dashboard');
  updateStorageIndicator();

  if(!storageAvailable){
    const banner = document.createElement('div');
    banner.className = 'alert bad';
    banner.innerHTML = '<b>Alterações não estão sendo salvas</b><br>Este navegador/modo bloqueou o localStorage (aba anônima?). Abra em uma aba normal.';
    document.querySelector('main').prepend(banner);
  }
})();
