/* ==========================================================
   telas-tecnico.js — módulos novos
   Materiais (CRUD) · Calculadora de BTU · Dimensionamento de cabos ·
   Levantamento técnico (CRUD) e fluxo: BTU → aparelho → corrente →
   cabo/disjuntor → lista de materiais → orçamento em PDF.
   ========================================================== */

const CATEGORIAS = { eletrica: 'Elétrica', arcondicionado: 'Ar-condicionado' };
const UNIDADES = ['un', 'm', 'kg', 'rolo', 'barra', 'pç', 'cx'];

/* ===================== MATERIAIS (CRUD) ===================== */
let materialFilter = 'all';
let materialSearch = '';
function renderMaterials(){
  const el = document.getElementById('view-materials');
  let list = DB.materials.slice().sort((a, b) => a.name.localeCompare(b.name));
  if(materialFilter !== 'all') list = list.filter(m => m.category === materialFilter);
  if(materialSearch) list = list.filter(m => m.name.toLowerCase().includes(materialSearch.toLowerCase()));
  // reduce: valor total parado em estoque (qtd × preço pago)
  const totalEstoque = totalMateriais(list);
  const chips = [{ id: 'all', label: 'Todos' }, { id: 'eletrica', label: 'Elétrica' }, { id: 'arcondicionado', label: 'Ar-condicionado' }];
  const cobreAviso = COBRE && COBRE.brlKg ? `<div class="alert">Cobre hoje: <b>${fmtMoney(COBRE.brlKg)}/kg</b>. Compare com o preço pago nos materiais de cobre.</div>` : '';
  el.innerHTML = `
    ${cobreAviso}
    <div class="filter-row"><input class="search-input" id="matSearch" type="search" placeholder="Buscar material..." value="${esc(materialSearch)}"></div>
    <div class="chip-row">${chips.map(c => `<button class="chip ${materialFilter === c.id ? 'active' : ''}" type="button" data-mfilter="${c.id}">${c.label}</button>`).join('')}</div>
    <div class="card-sub" style="margin-bottom:10px">${list.length} item(ns) · valor em estoque: <b>${fmtMoney(totalEstoque)}</b></div>
    <div class="list">${list.length ? list.map(materialCard).join('') : emptyState('Nenhum material', 'Toque em + para cadastrar (cabos, disjuntores, tubos de cobre...).')}</div>`;
  document.getElementById('matSearch').oninput = e => { materialSearch = e.target.value; renderMaterials(); };
  el.querySelectorAll('[data-mfilter]').forEach(c => c.onclick = () => { materialFilter = c.dataset.mfilter; renderMaterials(); });
  el.querySelectorAll('[data-edit-material]').forEach(b => b.onclick = () => openMaterialSheet(Number(b.dataset.editMaterial)));
  el.querySelectorAll('[data-del-material]').forEach(b => b.onclick = () => {
    if(!confirm('Excluir este material?')) return;
    DB.materials = DB.materials.filter(m => m.id !== Number(b.dataset.delMaterial));
    saveDB(); renderMaterials(); toast('Material excluído');
  });
}
function materialCard(m){
  return `
    <div class="card">
      <div class="card-top"><div>
        <div class="card-title">${esc(m.name)}</div>
        <div class="card-sub">${CATEGORIAS[m.category] || m.category} · ${fmtNum(m.qty, m.qty % 1 ? 2 : 0)} ${esc(m.unit)} em estoque</div>
      </div><div class="card-amount">${fmtMoney(m.price)}<span class="card-sub">/${esc(m.unit)}</span></div></div>
      <div class="card-meta">
        <span class="card-sub">Total: ${fmtMoney(m.qty * m.price)}</span>
        <div class="card-actions">
          <button class="mini-btn edit" data-edit-material="${m.id}">Editar</button>
          <button class="mini-btn danger" data-del-material="${m.id}">Excluir</button>
        </div>
      </div>
    </div>`;
}
function openMaterialSheet(id){
  const m = id ? DB.materials.find(x => x.id === id) : { name: '', category: 'eletrica', unit: 'un', qty: '', price: '' };
  openForm(`
    <div class="sheet-title">${id ? 'Editar material' : 'Novo material'}</div>
    <div class="field"><label for="m_name">Material</label><input id="m_name" name="name" required value="${esc(m.name)}" placeholder="Ex: Cabo flexível 2,5 mm² azul"></div>
    <div class="field-row">
      <div class="field"><label for="m_cat">Categoria</label><select id="m_cat" name="category" required>
        ${Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}" ${m.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label for="m_unit">Unidade</label><select id="m_unit" name="unit" required>
        ${UNIDADES.map(u => `<option ${m.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="m_qty">Quantidade em estoque</label><input id="m_qty" name="qty" type="number" min="0" step="0.01" required value="${m.qty}"></div>
      <div class="field"><label for="m_price">Preço pago (R$ por unid.)</label><input id="m_price" name="price" type="number" min="0" step="0.01" required value="${m.price}"></div>
    </div>
    <button class="btn-primary" type="submit">${id ? 'Salvar alterações' : 'Adicionar material'}</button>
    <button class="btn-secondary" type="button" data-cancel>Cancelar</button>
  `, (fd) => {
    const data = { name: fd.get('name').trim(), category: fd.get('category'), unit: fd.get('unit'), qty: Number(fd.get('qty')), price: Number(fd.get('price')) };
    if(id) Object.assign(m, data); else DB.materials.push({ id: DB.nextId.material++, ...data });
    saveDB(); closeSheet(); renderMaterials(); toast('Material salvo');
  });
}

/* Seletor de materiais dentro do formulário de orçamento (usa o cadastro de materiais) */
function materialPickerHTML(){
  if(!DB.materials.length) return '';
  return `<details class="form-card" style="padding:10px 14px">
    <summary style="cursor:pointer;font-weight:600;font-size:13px">+ Adicionar materiais cadastrados</summary>
    <div class="field-row" style="margin-top:10px">
      <div class="field"><label for="pk_mat">Material</label><select id="pk_mat">${DB.materials.map(m => `<option value="${m.id}">${esc(m.name)} (${fmtMoney(m.price)}/${esc(m.unit)})</option>`).join('')}</select></div>
      <div class="field"><label for="pk_qty">Quantidade</label><input id="pk_qty" type="number" min="0.01" step="0.01" value="1"></div>
    </div>
    <button class="btn-inline" type="button" id="pk_add">Adicionar ao orçamento</button>
  </details><div id="itemsBox"></div>`;
}
function renderItemsBox(form, itens){
  const box = form.querySelector('#itemsBox');
  if(!box) return;
  box.innerHTML = itens.length ? `<div class="form-card" style="padding:10px 14px"><b style="font-size:12px">Materiais deste orçamento</b>
    ${itens.map((i, k) => `<div class="config-row"><span>${esc(i.qty)} ${esc(i.unit)} · ${esc(i.name)}</span>
      <span>${fmtMoney(i.qty * i.price)} <button type="button" class="link-btn" data-rm-item="${k}">remover</button></span></div>`).join('')}
    <div class="card-sub">Total de materiais: ${fmtMoney(totalMateriais(itens))}</div></div>` : '';
}
function bindMaterialPicker(form, itens){
  renderItemsBox(form, itens);
  const add = form.querySelector('#pk_add');
  const amount = form.querySelector('#f_amount');
  if(add) add.onclick = () => {
    const m = DB.materials.find(x => x.id === Number(form.querySelector('#pk_mat').value));
    const qty = Number(form.querySelector('#pk_qty').value);
    if(!m || !(qty > 0)) return;
    itens.push({ name: m.name, unit: m.unit, qty, price: m.price });
    amount.value = (Number(amount.value || 0) + qty * m.price).toFixed(2);   // soma no valor do orçamento
    renderItemsBox(form, itens);
  };
  form.addEventListener('click', e => {
    const k = e.target.dataset && e.target.dataset.rmItem;
    if(k === undefined) return;
    const it = itens.splice(Number(k), 1)[0];
    amount.value = Math.max(0, Number(amount.value || 0) - it.qty * it.price).toFixed(2);
    renderItemsBox(form, itens);
  });
}

/* ===================== TELA TÉCNICA (sub-abas) ===================== */
let techTab = 'btu';
function renderTech(){
  const el = document.getElementById('view-tech');
  const subs = [{ id: 'btu', l: '❄ BTU' }, { id: 'cabos', l: '⚡ Cabos' }, { id: 'surveys', l: '📋 Levantamentos' }, { id: 'inspecao', l: '📝 Inspeção' }];
  el.innerHTML = `
    <div class="subtabs">${subs.map(s => `<button type="button" class="chip ${techTab === s.id ? 'active' : ''}" data-sub="${s.id}">${s.l}</button>`).join('')}</div>
    <div id="techBody"></div>`;
  el.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { techTab = b.dataset.sub; renderTech(); });
  ({ btu: renderBTU, cabos: renderCabos, surveys: renderSurveys, inspecao: renderInspecao })[techTab](el.querySelector('#techBody'));
  document.getElementById('fabBtn').style.display = ['surveys', 'inspecao'].includes(techTab) ? 'flex' : 'none';
}

/* ----- Calculadora de BTU ----- */
function resultadoBTUHTML(r){
  return `<div class="result-box">
    Carga estimada: <span class="big">${fmtNum(r.total, 0)} BTU/h</span><br>
    Aparelho recomendado: <b>${r.comercial ? fmtNum(r.comercial, 0) + ' BTU' : 'acima de 60.000 BTU — avaliar mais de um aparelho'}</b>
    <div class="result-grid">
      <div>Área (${fmtNum(r.porM2, 0)} BTU/m²)<b>${fmtNum(r.base, 0)}</b></div>
      <div>Pessoas<b>${fmtNum(r.dePessoas, 0)}</b></div>
      <div>Equipamentos<b>${fmtNum(r.deEquip, 0)}</b></div>
      <div>Total<b>${fmtNum(r.total, 0)}</b></div>
    </div>
    <div class="warn-line">⚠ Isto é uma <b>estimativa</b>. Pé-direito, janelas, insolação e isolamento mudam o resultado. Confirme no local.</div>
  </div>`;
}
function renderBTU(el){
  el.innerHTML = `<form class="form-card" id="formBTU">
    <h2>Calculadora de BTU</h2>
    <div class="field"><label for="b_area">Área do ambiente (m²)</label><input id="b_area" name="area" type="number" min="1" max="1000" step="0.1" required placeholder="Ex: 20"></div>
    <div class="field-row">
      <div class="field"><label for="b_pes">Pessoas fixas no local</label><input id="b_pes" name="pessoas" type="number" min="0" max="100" step="1" value="2" required></div>
      <div class="field"><label for="b_eq">Equipamentos de calor</label><input id="b_eq" name="equip" type="number" min="0" max="50" step="1" value="0" required></div>
    </div>
    <div class="field"><label><input type="checkbox" name="sol" style="width:auto;margin-right:6px">Sol da tarde (+${DB.settings.btuSol} BTU/m²)</label></div>
    <button class="btn-primary" type="submit">Calcular</button>
    <div id="btuOut"></div>
    <div class="hint" style="margin-top:8px">Regra usada: ${DB.settings.btuM2} BTU/m² + ${DB.settings.btuPessoas} BTU a cada 2 pessoas + ${DB.settings.btuEquip} BTU por equipamento (editável em Empresa).</div>
  </form>`;
  document.getElementById('formBTU').addEventListener('submit', (event) => {
    event.preventDefault();
    const fd = new FormData(event.target);
    const r = calcularBTU({ area: Number(fd.get('area')), pessoas: Number(fd.get('pessoas')), equip: Number(fd.get('equip')), sol: fd.get('sol') === 'on' }, DB.settings);
    document.getElementById('btuOut').innerHTML = resultadoBTUHTML(r);
  });
}

/* ----- Dimensionador de cabos ----- */
function resultadoCaboHTML(r, corrente, tensao, tipo){
  if(r.erro) return `<div class="alert bad"><b>Atenção:</b> ${esc(r.erro)}</div>`;
  return `<div class="result-box">
    Cabo de cobre: <span class="big">${fmtNum(r.secao, r.secao % 1 ? 1 : 0)} mm²</span> · Disjuntor: <span class="big">${r.disjuntor} A</span>
    <div class="result-grid">
      <div>Corrente do circuito<b>${fmtNum(corrente, 1)} A</b></div>
      <div>Capacidade corrigida<b>${fmtNum(r.iz, 1)} A</b></div>
      <div>Queda de tensão<b>${fmtNum(r.queda, 2)}% (${fmtNum(r.queda * tensao / 100, 1)} V)</b></div>
      <div>Mínimo p/ o circuito<b>${r.minimo} mm²</b></div>
    </div>
    <div class="warn-line">⚠ Estimativa de apoio — base: ${esc(CABOS.fonte)}. Fator de agrupamento ${r.fator}. Confirme na NBR 5410 / catálogo do fabricante; não substitui projeto de um responsável técnico.</div>
  </div>`;
}
function renderCabos(el){
  el.innerHTML = `<form class="form-card" id="formCabo">
    <h2>Dimensionar cabo e disjuntor</h2>
    <div class="field"><label for="c_modo">Informar por</label>
      <select id="c_modo" name="modo"><option value="w">Potência (W)</option><option value="a">Corrente (A)</option></select></div>
    <div class="field" id="boxW"><label for="c_w">Potência (W)</label><input id="c_w" name="potencia" type="number" min="1" max="50000" step="1" required placeholder="Ex: 2200"></div>
    <div class="field" id="boxA" hidden><label for="c_a">Corrente (A)</label><input id="c_a" name="corrente" type="number" min="0.1" max="100" step="0.1" placeholder="Ex: 10"></div>
    <div class="field-row">
      <div class="field"><label for="c_v">Tensão</label><select id="c_v" name="tensao"><option value="127">127 V (fase-neutro)</option><option value="220" selected>220 V (bifásico/monofásico)</option><option value="380">380 V (trifásico)</option></select></div>
      <div class="field"><label for="c_d">Distância até o quadro (m)</label><input id="c_d" name="distancia" type="number" min="1" max="300" step="1" required value="15"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="c_t">Tipo de circuito</label><select id="c_t" name="tipo"><option value="ac">Ar-condicionado (mín. 2,5 mm²)</option><option value="tomadas">Tomadas (mín. 2,5 mm²)</option><option value="iluminacao">Iluminação (mín. 1,5 mm²)</option><option value="outro">Outro (mín. 1,5 mm²)</option></select></div>
      <div class="field"><label for="c_g">Circuitos no mesmo eletroduto</label><select id="c_g" name="agrupados">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">${n}</option>`).join('')}</select></div>
    </div>
    <div class="hint" style="margin-bottom:8px">Instalação de referência: eletroduto embutido em parede (método B1). Mais circuitos juntos reduzem a capacidade do cabo.</div>
    <button class="btn-primary" type="submit">Dimensionar</button>
    <div id="caboOut"></div>
  </form>
  <div class="form-card"><h2>Tabela de referência</h2>
    <div class="table-wrap"><table class="cabos-table"><thead><tr><th>Seção</th><th>Corrente máx.</th><th>Disjuntor máx.*</th></tr></thead><tbody>
      ${CABOS.secoes.map(([s, i]) => `<tr><td>${fmtNum(s, s % 1 ? 1 : 0)} mm²</td><td>${fmtNum(i, 1)} A</td><td>${[...CABOS.disjuntores].reverse().find(d => d <= i) || '—'} A</td></tr>`).join('')}
    </tbody></table></div>
    <div class="hint">*Maior disjuntor padrão que não ultrapassa a corrente do cabo. Fonte: ${esc(CABOS.fonte)}. ⚠ Confirme com a norma.</div></div>`;

  const form = document.getElementById('formCabo');
  const modo = form.querySelector('#c_modo'), boxW = form.querySelector('#boxW'), boxA = form.querySelector('#boxA');
  modo.addEventListener('change', () => {          // só um dos campos é obrigatório por vez
    const porW = modo.value === 'w';
    boxW.hidden = !porW; boxA.hidden = porW;
    form.querySelector('#c_w').required = porW; form.querySelector('#c_a').required = !porW;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const tensao = Number(fd.get('tensao'));
    const fases = tensao === 380 ? 3 : 1;
    const corrente = fd.get('modo') === 'w'
      ? Number(fd.get('potencia')) / (fases === 3 ? tensao * Math.sqrt(3) : tensao)     // I = P / V
      : Number(fd.get('corrente'));
    const r = dimensionarCabo({ corrente, tensao, distancia: Number(fd.get('distancia')), fases, tipo: fd.get('tipo'), agrupados: Number(fd.get('agrupados')) });
    document.getElementById('caboOut').innerHTML = resultadoCaboHTML(r, corrente, tensao, fd.get('tipo'));
  });
}

/* ===================== LEVANTAMENTO TÉCNICO (CRUD + fluxo) ===================== */
// Procura no cadastro de materiais um item parecido para preencher o preço
function achaPreco(...termos){
  const m = DB.materials.find(x => termos.every(t => x.name.toLowerCase().includes(t)));
  return m ? m.price : 0;
}
// Calcula tudo de um levantamento: BTU → aparelho → corrente → cabo/disjuntor → materiais
function calcularLevantamento(s){
  const btu = calcularBTU({ area: s.area, pessoas: s.pessoas, equip: s.equip, sol: s.sol }, DB.settings);
  const fases = s.tensao === 380 ? 3 : 1;
  const base = btu.comercial || BTU_COMERCIAIS[BTU_COMERCIAIS.length - 1];
  const ac = correnteAC(base, s.tensao, DB.settings);
  const corrente = fases === 3 ? ac.watts / (s.tensao * Math.sqrt(3)) : ac.amperes;
  const cabo = dimensionarCabo({ corrente, tensao: s.tensao, distancia: s.distancia, fases, tipo: 'ac', agrupados: s.agrupados });
  let itens = [];
  if(!cabo.erro){
    const condutores = fases === 3 ? 4 : 3;                         // fases + (neutro) + terra
    const secTxt = String(cabo.secao).replace('.', ',');
    itens = [
      { name: `Cabo flexível ${secTxt} mm²`, unit: 'm', qty: Math.ceil(s.distancia * condutores), price: achaPreco('cabo', secTxt) },
      { name: `Disjuntor ${cabo.disjuntor} A`, unit: 'un', qty: fases === 3 ? 3 : 1, price: achaPreco('disjuntor', String(cabo.disjuntor)) }
    ];
  }
  return { btu, corrente, cabo, itens, totalItens: totalMateriais(itens) };
}
function renderSurveys(el){
  const lista = DB.surveys.slice().sort((a, b) => b.id - a.id);
  el.innerHTML = `<div class="list">${lista.length ? lista.map(surveyCard).join('') : emptyState('Nenhum levantamento', 'Toque em + para registrar a visita técnica de um cliente.')}</div>`;
  el.querySelectorAll('[data-edit-survey]').forEach(b => b.onclick = () => openSurveySheet(Number(b.dataset.editSurvey)));
  el.querySelectorAll('[data-del-survey]').forEach(b => b.onclick = () => {
    if(!confirm('Excluir este levantamento?')) return;
    DB.surveys = DB.surveys.filter(x => x.id !== Number(b.dataset.delSurvey));
    saveDB(); renderTech(); toast('Levantamento excluído');
  });
  el.querySelectorAll('[data-budget-survey]').forEach(b => b.onclick = () => budgetFromSurvey(Number(b.dataset.budgetSurvey)));
}
function surveyCard(s){
  const r = calcularLevantamento(s);
  const resumo = r.cabo.erro ? `<span class="badge bad">${esc(r.cabo.erro)}</span>`
    : `${r.btu.comercial ? fmtNum(r.btu.comercial, 0) + ' BTU' : '> 60.000 BTU'} · ${fmtNum(r.corrente, 1)} A · cabo ${String(r.cabo.secao).replace('.', ',')} mm² · disj. ${r.cabo.disjuntor} A`;
  return `
    <div class="card">
      <div class="card-top"><div>
        <div class="card-title">${esc(s.local)}</div>
        <div class="card-sub">${esc(clientName(s.clientId))} · ${fmtDate(s.date)} · ${fmtNum(s.area, 1)} m²</div>
      </div><div class="card-amount">${fmtMoney(r.totalItens)}</div></div>
      <div class="card-sub">${resumo}</div>
      <div class="card-meta"><span class="card-sub">Materiais estimados</span>
        <div class="card-actions">
          <button class="mini-btn ok" data-budget-survey="${s.id}">Orçamento</button>
          <button class="mini-btn edit" data-edit-survey="${s.id}">Editar</button>
          <button class="mini-btn danger" data-del-survey="${s.id}">Excluir</button>
        </div>
      </div>
    </div>`;
}
function openSurveySheet(id){
  if(!DB.clients.length){ alert('Cadastre um cliente antes de criar um levantamento.'); switchTab('clients'); return; }
  const s = id ? DB.surveys.find(x => x.id === id)
    : { clientId: DB.clients[0].id, local: '', date: hojeISO(), area: '', pessoas: 2, equip: 0, sol: false, tensao: 220, distancia: 10, agrupados: 1, notes: '' };
  openForm(`
    <div class="sheet-title">${id ? 'Editar levantamento' : 'Novo levantamento técnico'}</div>
    <div class="field"><label for="s_client">Cliente</label><select id="s_client" name="clientId" required>${clientOptions(s.clientId)}</select></div>
    <div class="field-row">
      <div class="field"><label for="s_local">Ambiente</label><input id="s_local" name="local" required value="${esc(s.local)}" placeholder="Ex: Sala / Escritório"></div>
      <div class="field"><label for="s_date">Data da visita</label><input id="s_date" name="date" type="date" required value="${s.date}"></div>
    </div>
    <div class="field-row3">
      <div class="field"><label for="s_area">Área (m²)</label><input id="s_area" name="area" type="number" min="1" max="1000" step="0.1" required value="${s.area}"></div>
      <div class="field"><label for="s_pes">Pessoas</label><input id="s_pes" name="pessoas" type="number" min="0" max="100" required value="${s.pessoas}"></div>
      <div class="field"><label for="s_eq">Equip.</label><input id="s_eq" name="equip" type="number" min="0" max="50" required value="${s.equip}"></div>
    </div>
    <div class="field"><label><input type="checkbox" name="sol" style="width:auto;margin-right:6px" ${s.sol ? 'checked' : ''}>Sol da tarde</label></div>
    <div class="field-row3">
      <div class="field"><label for="s_v">Tensão</label><select id="s_v" name="tensao">${[127, 220, 380].map(v => `<option ${s.tensao === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label for="s_d">Dist. quadro (m)</label><input id="s_d" name="distancia" type="number" min="1" max="300" required value="${s.distancia}"></div>
      <div class="field"><label for="s_g">Circuitos juntos</label><select id="s_g" name="agrupados">${[1, 2, 3, 4, 5, 6].map(n => `<option ${s.agrupados === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="s_n">Observações</label><textarea id="s_n" name="notes">${esc(s.notes)}</textarea></div>
    <button class="btn-primary" type="submit">${id ? 'Salvar alterações' : 'Salvar levantamento'}</button>
    <button class="btn-secondary" type="button" data-cancel>Cancelar</button>
  `, (fd) => {
    const data = {
      clientId: Number(fd.get('clientId')), local: fd.get('local').trim(), date: fd.get('date'),
      area: Number(fd.get('area')), pessoas: Number(fd.get('pessoas')), equip: Number(fd.get('equip')), sol: fd.get('sol') === 'on',
      tensao: Number(fd.get('tensao')), distancia: Number(fd.get('distancia')), agrupados: Number(fd.get('agrupados')), notes: fd.get('notes').trim()
    };
    if(id) Object.assign(s, data); else DB.surveys.push({ id: DB.nextId.survey++, ...data });
    saveDB(); closeSheet(); renderCurrent(); toast('Levantamento salvo');
  });
}
// Última etapa do fluxo: levantamento → orçamento já preenchido (depois vira PDF)
function budgetFromSurvey(id){
  const s = DB.surveys.find(x => x.id === id);
  const r = calcularLevantamento(s);
  if(r.cabo.erro){ alert(r.cabo.erro); return; }
  const descricao = `Instalação de ar-condicionado — ${s.local} (${fmtNum(s.area, 1)} m²).\n` +
    `Aparelho: ${r.btu.comercial ? fmtNum(r.btu.comercial, 0) + ' BTU' : 'a definir'} (carga estimada ${fmtNum(r.btu.total, 0)} BTU/h).\n` +
    `Circuito: cabo ${String(r.cabo.secao).replace('.', ',')} mm², disjuntor ${r.cabo.disjuntor} A, ${s.distancia} m até o quadro.\n` +
    (s.notes ? 'Obs.: ' + s.notes : '');
  switchTab('budgets');
  openBudgetSheet(null, {
    clientId: s.clientId, title: `Instalação de ar-condicionado — ${s.local}`, description: descricao,
    amount: r.totalItens.toFixed(2), items: r.itens
  });
  const semPreco = r.itens.filter(i => !i.price).length;
  toast(semPreco ? semPreco + ' item(ns) sem preço no cadastro de Materiais — confira o valor' : 'Some a mão de obra ao valor antes de salvar');
}
