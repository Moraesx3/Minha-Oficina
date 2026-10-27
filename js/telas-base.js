/* ==========================================================
   telas-base.js — telas do app original + integração das APIs
   Painel, Clientes (ViaCEP), Serviços (alerta de clima), Orçamentos,
   Empresa/Configurações e Backup.
   Padrão do CRUD:  C = push no array · R = render*() · U = openForm com dados
   · D = filter() pelo id único · e depois saveDB() grava no localStorage.
   ========================================================== */

let CLIMA = null;          // último clima carregado (API ou cache)
let COBRE = null;          // último preço do cobre
let ultimaCargaExternos = 0;

async function carregarExternos(forcar){
  ultimaCargaExternos = Date.now();
  const [clima, cobre] = await Promise.all([obterClima(forcar), obterCobre(forcar)]);
  CLIMA = clima; COBRE = cobre;
  if(['dashboard', 'services'].includes(currentTab)) renderCurrent();
}

/* ===================== PAINEL ===================== */
function cardCobreHTML(){
  if(!COBRE){
    return `<div class="info-card"><h3>Cobre hoje</h3>
      <div class="info-small">${ultimaCargaExternos && !COBRE && externosTerminou ? 'Sem preço disponível. Em <b>Empresa → Cobre e APIs</b> informe a Chave da API ou um preço manual (R$/kg).' : 'Carregando…'}</div></div>`;
  }
  const ref = DB.settings.refCobre;
  let variacao = '', alerta = '';
  if(ref && ref.preco > 0 && COBRE.brlKg){
    const pct = (COBRE.brlKg - ref.preco) / ref.preco * 100;
    variacao = `<div class="info-small">Desde a revisão de ${fmtDate(ref.data)}: <b class="${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${fmtNum(Math.abs(pct), 1)}%</b></div>`;
    if(pct > DB.settings.alertaCobrePct){
      alerta = `<div class="alert bad"><b>Cobre subiu ${fmtNum(pct, 1)}%</b> desde a última revisão de preços (limite: ${DB.settings.alertaCobrePct}%). Reveja os preços dos orçamentos.</div>`;
    }
  }
  const origem = { api: 'ao vivo', cache: 'cache (≤ 1 h)', 'cache-antigo': 'último valor salvo (sem conexão)', manual: 'preço manual' }[COBRE.origem];
  return alerta + `<div class="info-card"><h3>Cobre hoje</h3>
    <div class="info-big">${COBRE.brlKg ? fmtMoney(COBRE.brlKg) + '/kg' : '—'}</div>
    <div class="info-small">${COBRE.usdLb ? 'US$ ' + fmtNum(COBRE.usdLb, 3) + '/lb' : ''}${COBRE.dolar ? ' · dólar R$ ' + fmtNum(COBRE.dolar, 3) : ''}</div>
    ${variacao}
    <div class="info-small">${COBRE.t ? fmtDateTime(new Date(COBRE.t).toISOString()) + ' · ' : ''}${origem}</div>
    <div class="row-actions">
      <button class="btn-inline" type="button" id="btnRevisaoCobre">Marcar revisão de preços</button>
      <button class="btn-inline" type="button" id="btnAtualizaCobre">↻ Atualizar</button>
    </div>
    <div class="info-small">Preço de referência de bolsa (COMEX), não é o preço de venda no balcão.</div></div>`;
}
function cardClimaHTML(){
  if(!CLIMA){
    return `<div class="info-card"><h3>Clima — ${esc(DB.settings.cidade)}</h3><div class="info-small">${externosTerminou ? 'Clima indisponível (sem internet?).' : 'Carregando…'}</div></div>`;
  }
  const hoje = CLIMA.dias[0];
  const aviso = alertaClima(hoje);
  return `<div class="info-card"><h3>Clima — ${esc(CLIMA.cidade)}</h3>
    <div class="info-big">${Math.round(hoje.tmax)}° <span class="info-small">/ ${Math.round(hoje.tmin)}°</span></div>
    <div class="info-small">Chuva ${hoje.chuva ?? 0}% · vento ${Math.round(hoje.vento)} km/h
      ${aviso ? '<br><span class="badge warn">⚠ ' + esc(aviso) + '</span>' : ''}</div>
    <div class="info-small">Próx. dias: ${CLIMA.dias.slice(1, 4).map(d => `${fmtDate(d.data).slice(0, 5)} ${Math.round(d.tmax)}°/${d.chuva ?? 0}%`).join(' · ')}</div>
    <div class="info-small">${CLIMA.origem === 'cache-antigo' ? 'Último valor salvo (sem conexão)' : 'Atualizado ' + fmtDateTime(new Date(CLIMA.t).toISOString())}</div></div>`;
}
let externosTerminou = false;

function renderDashboard(){
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const monthServices = DB.services.filter(s => (s.scheduledDate || '').startsWith(ym) && s.status === 'completed');
  // reduce: soma o faturamento do mês
  const revenue = monthServices.reduce((a, s) => a + Number(s.amount || 0), 0);
  const completed = DB.services.filter(s => s.status === 'completed').length;
  const scheduled = DB.services.filter(s => s.status === 'scheduled').length;
  const pendingBudgets = DB.budgets.filter(b => b.status === 'draft').length;
  const upcoming = DB.services
    .filter(s => s.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
    .slice(0, 5);

  const el = document.getElementById('view-dashboard');
  el.innerHTML = `
    <div class="section-title">Cobre e clima</div>
    <div class="info-grid">${cardCobreHTML()}${cardClimaHTML()}</div>

    <div class="section-title">Este mês</div>
    <div class="stat-grid">
      <div class="stat-card" style="--stat-color:var(--accent)">
        <div class="stat-label">Faturamento (concluídos)</div>
        <div class="stat-value">${fmtMoney(revenue)}</div>
        <div class="stat-sub">${monthServices.length} serviço${monthServices.length === 1 ? '' : 's'} finalizado${monthServices.length === 1 ? '' : 's'}</div>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-card" style="--stat-color:var(--live)"><div class="stat-label">Concluídos</div><div class="stat-value">${completed}</div></div>
      <div class="stat-card" style="--stat-color:var(--accent)"><div class="stat-label">Agendados</div><div class="stat-value">${scheduled}</div></div>
    </div>
    <div class="stat-row">
      <div class="stat-card" style="--stat-color:var(--muted)"><div class="stat-label">Clientes</div><div class="stat-value">${DB.clients.length}</div></div>
      <div class="stat-card" style="--stat-color:var(--off)"><div class="stat-label">Orçam. pendentes</div><div class="stat-value">${pendingBudgets}</div></div>
    </div>

    <div class="section-title">Faturamento por mês</div>
    <div class="month-list">${monthlyRevenueList()}</div>

    <div class="section-title">Próximos agendamentos</div>
    <div class="list">
      ${upcoming.length ? upcoming.map(serviceCard).join('') : emptyState('Tudo em dia', 'Nenhum serviço agendado no momento.')}
    </div>`;
  bindServiceCardEvents(el);

  const bAtu = document.getElementById('btnAtualizaCobre');
  if(bAtu) bAtu.onclick = () => { toast('Atualizando…'); carregarExternos(true); };
  const bRev = document.getElementById('btnRevisaoCobre');
  if(bRev) bRev.onclick = () => {
    if(!COBRE || !COBRE.brlKg) return;
    DB.settings.refCobre = { preco: COBRE.brlKg, data: hojeISO() };
    saveDB(); renderDashboard(); toast('Preço de referência salvo');
  };
  // Busca APIs no máximo a cada 5 min (o cache de 1 h evita chamadas repetidas)
  if(Date.now() - ultimaCargaExternos > 5 * 60 * 1000){
    carregarExternos(false).finally(() => { externosTerminou = true; if(currentTab === 'dashboard') renderDashboard(); });
  }
}

function monthlyRevenueList(){
  const byMonth = {};
  DB.services.filter(s => s.status === 'completed').forEach(s => {
    const key = (s.scheduledDate || '').slice(0, 7);
    if(!key) return;
    byMonth[key] = (byMonth[key] || 0) + Number(s.amount || 0);
  });
  const months = Object.keys(byMonth).sort().reverse();
  if(!months.length) return emptyState('Sem histórico', 'Conclua serviços pra ver o faturamento mês a mês.');
  const max = Math.max(...Object.values(byMonth));
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return months.map(key => {
    const [y, m] = key.split('-');
    const pct = max > 0 ? Math.max(6, Math.round((byMonth[key] / max) * 100)) : 0;
    return `
      <div class="month-row">
        <div class="month-row-top"><span class="month-label">${nomes[Number(m) - 1]} ${y}</span><span class="month-value">${fmtMoney(byMonth[key])}</span></div>
        <div class="month-bar-track"><div class="month-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

/* ===================== CLIENTES ===================== */
let clientSearch = '';
function renderClients(){
  const el = document.getElementById('view-clients');
  const filtered = DB.clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  el.innerHTML = `
    <div class="filter-row"><input class="search-input" id="clientSearchInput" type="search" placeholder="Buscar cliente..." value="${esc(clientSearch)}"></div>
    <div class="list">
      ${filtered.length ? filtered.map(clientCard).join('') : emptyState('Nenhum cliente', clientSearch ? 'Nenhum resultado pra essa busca.' : 'Toque em + para adicionar seu primeiro cliente.')}
    </div>`;
  document.getElementById('clientSearchInput').oninput = e => { clientSearch = e.target.value; renderClients(); };
  bindClientCardEvents(el);
}
function clientCard(c){
  const mine = DB.services.filter(s => s.clientId === c.id);
  const total = mine.filter(s => s.status === 'completed').reduce((a, s) => a + Number(s.amount || 0), 0);
  return `
    <div class="card">
      <div class="card-top"><div>
        <div class="card-title">${esc(c.name)}</div>
        <div class="card-sub">${esc(c.phone) || 'Sem telefone'}${c.address ? ' · ' + esc(c.address) : ''}</div>
      </div><div class="card-amount">${fmtMoney(total)}</div></div>
      <div class="card-meta">
        <span class="card-sub">${mine.length} serviço${mine.length === 1 ? '' : 's'}</span>
        <div class="card-actions">
          <button class="mini-btn edit" data-edit-client="${c.id}">Editar</button>
          <button class="mini-btn danger" data-del-client="${c.id}">Excluir</button>
        </div>
      </div>
    </div>`;
}
function bindClientCardEvents(el){
  el.querySelectorAll('[data-edit-client]').forEach(b => b.onclick = () => openClientSheet(Number(b.dataset.editClient)));
  el.querySelectorAll('[data-del-client]').forEach(b => b.onclick = () => {
    const id = Number(b.dataset.delClient);
    const vinculado = DB.services.some(s => s.clientId === id) || DB.budgets.some(x => x.clientId === id) || DB.fichas.some(p => p.clientId === id);
    const msg = vinculado ? 'Este cliente tem serviços, orçamentos ou fichas de inspeção vinculados. Excluir mesmo assim? (os registros permanecem, sem cliente associado)' : 'Excluir este cliente?';
    if(!confirm(msg)) return;
    DB.clients = DB.clients.filter(c => c.id !== id);   // D: filter remove pelo id
    saveDB(); renderClients(); toast('Cliente excluído');
  });
}
function openClientSheet(id){
  const c = id ? DB.clients.find(c => c.id === id) : { name: '', phone: '', email: '', cep: '', address: '' };
  const form = openForm(`
    <div class="sheet-title">${id ? 'Editar cliente' : 'Novo cliente'}</div>
    <div class="field"><label for="f_name">Nome</label><input id="f_name" name="name" required minlength="2" value="${esc(c.name)}" placeholder="Nome completo"></div>
    <div class="field-row">
      <div class="field"><label for="f_phone">Telefone</label><input id="f_phone" name="phone" type="tel" pattern="[0-9 ()+\\-]{8,20}" title="Somente números, espaço, ( ) + -" value="${esc(c.phone)}" placeholder="(00) 00000-0000"></div>
      <div class="field"><label for="f_email">E-mail</label><input id="f_email" name="email" type="email" value="${esc(c.email)}" placeholder="opcional"></div>
    </div>
    <div class="field"><label for="f_cep">CEP (preenche o endereço)</label>
      <input id="f_cep" name="cep" inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" title="CEP com 8 números" maxlength="9" value="${esc(c.cep || '')}" placeholder="00000-000">
      <div class="cep-status" id="cepStatus"></div></div>
    <div class="field"><label for="f_addr">Endereço</label><input id="f_addr" name="address" value="${esc(c.address || '')}" placeholder="Rua, nº, bairro, cidade"></div>
    <button class="btn-primary" type="submit">${id ? 'Salvar alterações' : 'Adicionar cliente'}</button>
    <button class="btn-secondary" type="button" data-cancel>Cancelar</button>
  `, (fd) => {
    const data = {
      name: fd.get('name').trim(), phone: fd.get('phone').trim(), email: fd.get('email').trim(),
      cep: fd.get('cep').trim(), address: fd.get('address').trim()
    };
    if(id) Object.assign(c, data);                                        // U
    else DB.clients.push({ id: DB.nextId.client++, ...data });            // C
    saveDB(); closeSheet(); renderCurrent(); toast('Cliente salvo');
  });

  // Bônus: ao sair do campo CEP, consulta a API ViaCEP e preenche o endereço
  const cep = form.querySelector('#f_cep'), status = form.querySelector('#cepStatus');
  cep.addEventListener('blur', async () => {
    if(cep.value.replace(/\D/g, '').length !== 8) return;
    status.textContent = 'Buscando CEP…';
    try{
      const d = await buscarCEP(cep.value);
      form.querySelector('#f_addr').value = [d.logradouro, d.bairro, d.localidade + '/' + d.uf].filter(Boolean).join(', ');
      status.textContent = '✔ Endereço preenchido (complete com o número)';
    }catch(e){ status.textContent = '✖ ' + (e.message || 'Não foi possível consultar o CEP'); }
  });
}

/* ===================== SERVIÇOS ===================== */
let serviceFilter = 'all';
let serviceSearch = '';
function renderServices(){
  const el = document.getElementById('view-services');
  let list = DB.services.slice().sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
  if(serviceFilter !== 'all') list = list.filter(s => s.status === serviceFilter);
  if(serviceSearch) list = list.filter(s => (s.title + clientName(s.clientId)).toLowerCase().includes(serviceSearch.toLowerCase()));
  const chips = [{ id: 'all', label: 'Todos' }, { id: 'scheduled', label: 'Agendados' }, { id: 'completed', label: 'Concluídos' }, { id: 'cancelled', label: 'Cancelados' }];
  el.innerHTML = `
    <div class="filter-row"><input class="search-input" id="serviceSearchInput" type="search" placeholder="Buscar serviço ou cliente..." value="${esc(serviceSearch)}"></div>
    <div class="chip-row">${chips.map(c => `<button class="chip ${serviceFilter === c.id ? 'active' : ''}" type="button" data-filter="${c.id}">${c.label}</button>`).join('')}</div>
    <div class="list">${list.length ? list.map(serviceCard).join('') : emptyState('Nenhum serviço', 'Toque em + para agendar um serviço.')}</div>`;
  document.getElementById('serviceSearchInput').oninput = e => { serviceSearch = e.target.value; renderServices(); };
  el.querySelectorAll('[data-filter]').forEach(c => c.onclick = () => { serviceFilter = c.dataset.filter; renderServices(); });
  bindServiceCardEvents(el);
}
function serviceCard(s){
  const stateMap = { scheduled: 'pending', completed: 'on', cancelled: 'off' };
  const labelMap = { scheduled: 'Agendado', completed: 'Concluído', cancelled: 'Cancelado' };
  // Alerta de chuva/vento para serviços agendados (usa o clima já carregado)
  const aviso = s.status === 'scheduled' ? alertaClima(climaDoDia(CLIMA, s.scheduledDate)) : '';
  return `
    <div class="card">
      <div class="card-top"><div>
        <div class="card-title">${esc(s.title)}</div>
        <div class="card-sub">${esc(clientName(s.clientId))} · ${fmtDate(s.scheduledDate)}</div>
        ${aviso ? `<div class="service-alert">⚠ Previsão: ${esc(aviso)} — avalie reagendar</div>` : ''}
      </div><div class="card-amount">${fmtMoney(s.amount)}</div></div>
      <div class="card-meta">
        <span class="breaker" data-state="${stateMap[s.status] || 'pending'}"><span class="nub"></span>${labelMap[s.status] || s.status}</span>
        <div class="card-actions">
          ${s.status !== 'completed' ? `<button class="mini-btn ok" data-complete-service="${s.id}">Concluir</button>` : ''}
          <button class="mini-btn edit" data-edit-service="${s.id}">Editar</button>
          <button class="mini-btn danger" data-del-service="${s.id}">Excluir</button>
        </div>
      </div>
    </div>`;
}
function bindServiceCardEvents(el){
  el.querySelectorAll('[data-edit-service]').forEach(b => b.onclick = () => openServiceSheet(Number(b.dataset.editService)));
  el.querySelectorAll('[data-complete-service]').forEach(b => b.onclick = () => {
    DB.services.find(s => s.id === Number(b.dataset.completeService)).status = 'completed';
    saveDB(); renderCurrent(); toast('Serviço marcado como concluído');
  });
  el.querySelectorAll('[data-del-service]').forEach(b => b.onclick = () => {
    if(!confirm('Excluir este serviço?')) return;
    DB.services = DB.services.filter(s => s.id !== Number(b.dataset.delService));
    saveDB(); renderCurrent(); toast('Serviço excluído');
  });
}
function openServiceSheet(id){
  if(!DB.clients.length){ alert('Cadastre um cliente antes de criar um serviço.'); switchTab('clients'); return; }
  const s = id ? DB.services.find(s => s.id === id)
    : { clientId: DB.clients[0].id, title: '', description: '', scheduledDate: hojeISO(), status: 'scheduled', amount: '', notes: '' };
  const form = openForm(`
    <div class="sheet-title">${id ? 'Editar serviço' : 'Novo serviço'}</div>
    <div class="field"><label for="f_client">Cliente</label><select id="f_client" name="clientId" required>${clientOptions(s.clientId)}</select></div>
    <div class="field"><label for="f_title">Título do serviço</label><input id="f_title" name="title" required value="${esc(s.title)}" placeholder="Ex: Instalação de disjuntores"></div>
    <div class="field"><label for="f_desc">Descrição</label><textarea id="f_desc" name="description" placeholder="Detalhes (opcional)">${esc(s.description)}</textarea></div>
    <div class="field-row">
      <div class="field"><label for="f_date">Data</label><input type="date" id="f_date" name="date" required value="${(s.scheduledDate || '').slice(0, 10)}"></div>
      <div class="field"><label for="f_amount">Valor (R$)</label><input type="number" id="f_amount" name="amount" step="0.01" min="0" max="9999999" value="${s.amount}" placeholder="0,00"></div>
    </div>
    <div class="field"><label>Status</label>${segHTML('status', s.status, [{ v: 'scheduled', l: 'Agendado' }, { v: 'completed', l: 'Concluído' }, { v: 'cancelled', l: 'Cancelado' }])}</div>
    <div class="field"><label for="f_notes">Observações</label><textarea id="f_notes" name="notes" placeholder="Notas internas (opcional)">${esc(s.notes)}</textarea></div>
    <button class="btn-primary" type="submit">${id ? 'Salvar alterações' : 'Agendar serviço'}</button>
    ${id ? '<button class="btn-danger-text" type="button" id="deleteServiceBtn">Excluir serviço</button>' : ''}
    <button class="btn-secondary" type="button" data-cancel>Cancelar</button>
  `, (fd) => {
    const data = {
      clientId: Number(fd.get('clientId')), title: fd.get('title').trim(), description: fd.get('description').trim(),
      scheduledDate: fd.get('date'), amount: Number(fd.get('amount')) || 0, status: fd.get('status'), notes: fd.get('notes').trim()
    };
    if(id) Object.assign(s, data); else DB.services.push({ id: DB.nextId.service++, ...data });
    saveDB(); closeSheet(); renderCurrent(); toast('Serviço salvo');
  });
  bindSeg(form, 'status');
  if(id) form.querySelector('#deleteServiceBtn').onclick = () => {
    if(!confirm('Excluir este serviço?')) return;
    DB.services = DB.services.filter(x => x.id !== id);
    saveDB(); closeSheet(); renderCurrent(); toast('Serviço excluído');
  };
}
function clientOptions(selectedId){
  return DB.clients.slice().sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}

/* ===================== ORÇAMENTOS ===================== */
let budgetFilter = 'all';
function renderBudgets(){
  const el = document.getElementById('view-budgets');
  let list = DB.budgets.slice().sort((a, b) => b.id - a.id);
  if(budgetFilter !== 'all') list = list.filter(b => b.status === budgetFilter);
  const chips = [{ id: 'all', label: 'Todos' }, { id: 'draft', label: 'Em aberto' }, { id: 'completed', label: 'Aprovados' }];
  el.innerHTML = `
    <div class="chip-row">${chips.map(c => `<button class="chip ${budgetFilter === c.id ? 'active' : ''}" type="button" data-bfilter="${c.id}">${c.label}</button>`).join('')}
      <button class="chip" type="button" id="goArchive">📁 PDFs salvos (${(DOCS.items || []).length})</button></div>
    <div class="list">${list.length ? list.map(budgetCard).join('') : emptyState('Nenhum orçamento', 'Toque em + para criar um orçamento.')}</div>`;
  el.querySelectorAll('[data-bfilter]').forEach(c => c.onclick = () => { budgetFilter = c.dataset.bfilter; renderBudgets(); });
  document.getElementById('goArchive').onclick = () => switchTab('archive');
  bindBudgetCardEvents(el);
}
function budgetCard(b){
  const stateMap = { draft: 'pending', completed: 'on' };
  const labelMap = { draft: 'Em aberto', completed: 'Aprovado' };
  return `
    <div class="card">
      <div class="card-top"><div>
        <div class="card-title">${esc(b.title)}</div>
        <div class="card-sub">${esc(clientName(b.clientId))}${b.billingMonth ? ' · ' + esc(b.billingMonth) : ''}${b.items && b.items.length ? ' · ' + b.items.length + ' materiais' : ''}</div>
      </div><div class="card-amount">${fmtMoney(b.amount)}</div></div>
      <div class="card-meta">
        <span class="breaker" data-state="${stateMap[b.status] || 'pending'}"><span class="nub"></span>${labelMap[b.status] || b.status}</span>
        <div class="card-actions">
          <button class="mini-btn ok" data-pdf-budget="${b.id}">PDF</button>
          <button class="mini-btn edit" data-edit-budget="${b.id}">Editar</button>
          <button class="mini-btn danger" data-del-budget="${b.id}">Excluir</button>
        </div>
      </div>
    </div>`;
}
function bindBudgetCardEvents(el){
  el.querySelectorAll('[data-edit-budget]').forEach(b => b.onclick = () => openBudgetSheet(Number(b.dataset.editBudget)));
  el.querySelectorAll('[data-pdf-budget]').forEach(b => b.onclick = () => generateBudgetPDF(Number(b.dataset.pdfBudget)));
  el.querySelectorAll('[data-del-budget]').forEach(b => b.onclick = () => {
    if(!confirm('Excluir este orçamento?')) return;
    DB.budgets = DB.budgets.filter(x => x.id !== Number(b.dataset.delBudget));
    saveDB(); renderBudgets(); toast('Orçamento excluído');
  });
}
// dados opcionais: usado pelo fluxo técnico para já abrir o orçamento preenchido
function openBudgetSheet(id, preset){
  if(!DB.clients.length){ alert('Cadastre um cliente antes de criar um orçamento.'); switchTab('clients'); return; }
  const b = id ? DB.budgets.find(b => b.id === id)
    : { clientId: DB.clients[0].id, title: '', description: '', amount: '', status: 'draft', billingMonth: '', ...(preset || {}) };
  const itens = (b.items || []).map(i => ({ ...i }));   // cópia: só grava ao salvar
  const form = openForm(`
    <div class="sheet-title">${id ? 'Editar orçamento' : 'Novo orçamento'}</div>
    <div class="field"><label for="f_client">Cliente</label><select id="f_client" name="clientId" required>${clientOptions(b.clientId)}</select></div>
    <div class="field"><label for="f_title">Título</label><input id="f_title" name="title" required value="${esc(b.title)}" placeholder="Ex: Instalação elétrica da cozinha"></div>
    <div class="field"><label for="f_desc">Descrição</label><textarea id="f_desc" name="description" rows="5" placeholder="Escopo do orçamento">${esc(b.description)}</textarea></div>
    <div class="field-row">
      <div class="field"><label for="f_amount">Valor (R$)</label><input type="number" id="f_amount" name="amount" step="0.01" min="0" required value="${b.amount}" placeholder="0,00"></div>
      <div class="field"><label for="f_month">Mês ref.</label><input id="f_month" name="month" pattern="(0[1-9]|1[0-2])/[0-9]{4}" title="Formato MM/AAAA" value="${esc(b.billingMonth)}" placeholder="MM/AAAA"></div>
    </div>
    ${materialPickerHTML()}
    <div class="field"><label>Status</label>${segHTML('status', b.status, [{ v: 'draft', l: 'Em aberto' }, { v: 'completed', l: 'Aprovado' }])}</div>
    <button class="btn-primary" type="submit">${id ? 'Salvar alterações' : 'Criar orçamento'}</button>
    ${id ? '<button class="btn-secondary" type="button" id="pdfBudgetBtn">📄 Baixar PDF do orçamento</button>' : ''}
    ${id ? '<button class="btn-danger-text" type="button" id="deleteBudgetBtn">Excluir orçamento</button>' : ''}
    <button class="btn-secondary" type="button" data-cancel>Cancelar</button>
  `, (fd) => {
    const data = {
      clientId: Number(fd.get('clientId')), title: fd.get('title').trim(), description: fd.get('description').trim(),
      amount: Number(fd.get('amount')) || 0, status: fd.get('status'), billingMonth: fd.get('month').trim(),
      items: itens
    };
    if(id) Object.assign(b, data); else DB.budgets.push({ id: DB.nextId.budget++, ...data });
    saveDB(); closeSheet(); switchTab('budgets'); toast('Orçamento salvo');
  });
  bindSeg(form, 'status');
  bindMaterialPicker(form, itens);
  if(id){
    form.querySelector('#pdfBudgetBtn').onclick = () => { closeSheet(); generateBudgetPDF(id); };
    form.querySelector('#deleteBudgetBtn').onclick = () => {
      if(!confirm('Excluir este orçamento?')) return;
      DB.budgets = DB.budgets.filter(x => x.id !== id);
      saveDB(); closeSheet(); renderBudgets(); toast('Orçamento excluído');
    };
  }
}

/* ===================== EMPRESA / CONFIGURAÇÕES / BACKUP ===================== */
function renderConfig(){
  const el = document.getElementById('view-config');
  const c = DB.company, s = DB.settings;
  const num = (id, label, val, attrs, hint) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="number" ${attrs} value="${val}">${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  el.innerHTML = `
    <div class="section-title">Dados da empresa</div>
    <div class="config-card">
      <div class="config-row"><span>Logo do PDF</span><span><img src="${logoDataUrl()}" alt="Logo" style="width:40px;height:40px;object-fit:contain;background:#fff;border-radius:6px"></span></div>
      <div class="config-row"><span>Nome</span><span>${esc(c.name) || '—'}</span></div>
      <div class="config-row"><span>CNPJ</span><span>${esc(c.cnpj) || '—'}</span></div>
      <div class="config-row"><span>Telefone</span><span>${esc(c.phone) || '—'}</span></div>
      <div class="config-row"><span>E-mail</span><span>${esc(c.email) || '—'}</span></div>
      <div class="config-row"><span>Endereço</span><span style="text-align:right;max-width:60%">${esc(c.address) || '—'}</span></div>
    </div>
    <button class="mini-btn edit" type="button" id="editCompanyBtn" style="width:100%;padding:10px;">Editar dados da empresa</button>

    <div class="section-title">Cobre, clima e BTU</div>
    <form class="form-card" id="formSettings">
      <div class="field"><label for="cidade">Cidade (clima)</label><input id="cidade" name="cidade" required value="${esc(s.cidade)}"></div>
      <div class="field"><label for="chaveCobre">Chave da API do cobre (MetalCharts)</label>
        <input id="chaveCobre" name="chaveCobre" type="password" autocomplete="off" value="${esc(s.chaveCobre)}" placeholder="opcional">
        <div class="hint">Fica salva só neste navegador. Sem chave, o app usa o último valor salvo ou o preço manual abaixo.</div></div>
      ${num('cobreManual', 'Preço manual do cobre (R$/kg)', s.cobreManual || '', 'min="0" step="0.01"', 'Usado quando não há API.')}
      ${num('alertaCobrePct', 'Alertar se o cobre subir mais de (%)', s.alertaCobrePct, 'min="0.1" max="100" step="0.1" required', 'Comparado com a última “revisão de preços” marcada no Painel.')}
      <div class="field-row">
        ${num('btuM2', 'BTU por m²', s.btuM2, 'min="100" max="2000" required', 'Regra do Paraná: 700')}
        ${num('btuPessoas', 'BTU a cada 2 pessoas', s.btuPessoas, 'min="0" max="3000" required')}
      </div>
      <div class="field-row">
        ${num('btuEquip', 'BTU por equipamento', s.btuEquip, 'min="0" max="3000" required')}
        ${num('btuSol', 'BTU extra/m² (sol da tarde)', s.btuSol, 'min="0" max="1000" required')}
      </div>
      <button class="btn-primary" type="submit">Salvar configurações</button>
    </form>

    <div class="section-title">Backup</div>
    <button class="backup-btn primary" type="button" id="exportBtn">⬇ Baixar backup (.json)</button>
    <button class="backup-btn" type="button" id="importBtn">⬆ Restaurar de um backup</button>
    <div class="card-sub" style="padding:0 4px;line-height:1.5;">Seus dados ficam salvos neste navegador. Baixe um backup regularmente — principalmente antes de trocar de celular ou limpar o navegador.</div>
    <div class="section-title">Arquivos</div>
    <button class="backup-btn" type="button" id="goArchive2">📁 Ver PDFs salvos</button>`;
  document.getElementById('editCompanyBtn').onclick = openCompanySheet;
  document.getElementById('exportBtn').onclick = exportBackup;
  document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
  document.getElementById('goArchive2').onclick = () => switchTab('archive');
  document.getElementById('formSettings').addEventListener('submit', (event) => {
    event.preventDefault();
    const fd = new FormData(event.target);
    const n = k => Number(fd.get(k));
    Object.assign(DB.settings, {
      cidade: fd.get('cidade').trim(), chaveCobre: fd.get('chaveCobre').trim(), cobreManual: n('cobreManual') || 0,
      alertaCobrePct: n('alertaCobrePct'), btuM2: n('btuM2'), btuPessoas: n('btuPessoas'), btuEquip: n('btuEquip'), btuSol: n('btuSol')
    });
    saveDB(); ultimaCargaExternos = 0; externosTerminou = false; toast('Configurações salvas');
  });
}
function exportBackup(){
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `backup_minha_oficina_${hojeISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Backup baixado');
}
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed.clients || !parsed.services) throw new Error('formato inválido');
      if(confirm('Isso vai substituir todos os dados atuais pelos do backup. Continuar?')){
        DB = normalizeDB(parsed); saveDB(); renderCurrent(); toast('Backup restaurado');
      }
    }catch(err){ alert('Não foi possível ler esse arquivo de backup.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});
function openCompanySheet(){
  const c = DB.company;
  let novaLogo = c.logo || '';     // '' = usar a logo padrão
  const form = openForm(`
    <div class="sheet-title">Dados da empresa</div>
    <div class="field"><label for="f_cname">Nome</label><input id="f_cname" name="name" required value="${esc(c.name)}"></div>
    <div class="field"><label for="f_cnpj">CNPJ / CPF</label><input id="f_cnpj" name="cnpj" value="${esc(c.cnpj)}"></div>
    <div class="field-row">
      <div class="field"><label for="f_cphone">Telefone</label><input id="f_cphone" name="phone" type="tel" value="${esc(c.phone)}"></div>
      <div class="field"><label for="f_cemail">E-mail</label><input id="f_cemail" name="email" type="email" value="${esc(c.email)}"></div>
    </div>
    <div class="field"><label for="f_caddr">Endereço</label><textarea id="f_caddr" name="address">${esc(c.address)}</textarea></div>
    <div class="field"><label for="f_logo">Logo do PDF</label>
      <div style="display:flex;align-items:center;gap:12px">
        <img id="logoPreview" src="${logoDataUrl()}" alt="Logo atual" style="width:64px;height:64px;object-fit:contain;background:#fff;border-radius:8px">
        <div style="flex:1">
          <input id="f_logo" type="file" accept="image/*" style="display:block;font-size:12.5px">
          <button class="link-btn" type="button" id="logoReset">Voltar para a logo padrão</button>
        </div>
      </div>
      <div class="hint" id="logoStatus">Escolha uma imagem (JPG ou PNG). Ela aparece no PDF dos orçamentos.</div></div>
    <button class="btn-primary" type="submit">Salvar</button>
    <button class="btn-secondary" type="button" data-cancel>Cancelar</button>
  `, (fd) => {
    DB.company = { logo: novaLogo, name: fd.get('name').trim(), cnpj: fd.get('cnpj').trim(), phone: fd.get('phone').trim(), email: fd.get('email').trim(), address: fd.get('address').trim() };
    saveDB(); closeSheet(); renderConfig();
    document.getElementById('brandName').textContent = DB.company.name || 'Minha Oficina';
    toast('Dados da empresa atualizados');
  });
  // Troca de logo: lê o arquivo, reduz e mostra a prévia (só grava ao clicar em Salvar)
  const prev = form.querySelector('#logoPreview'), st = form.querySelector('#logoStatus');
  form.querySelector('#f_logo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    try{
      novaLogo = await processarLogo(file);
      prev.src = novaLogo; st.textContent = '✔ Logo carregada — toque em Salvar.';
    }catch(err){ st.textContent = '✖ ' + err.message; }
  });
  form.querySelector('#logoReset').addEventListener('click', () => {
    novaLogo = ''; prev.src = `data:image/jpeg;base64,${LOGO_B64}`; st.textContent = 'Logo padrão selecionada — toque em Salvar.';
  });
}
