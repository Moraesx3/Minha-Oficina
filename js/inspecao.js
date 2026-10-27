/* ==========================================================
   inspecao.js — Ficha de Inspeção Técnica (ar-condicionado)

   Registro das inspeções e manutenções feitas pelo técnico.
   Não é PMOC: o PMOC (Lei 13.589/2018) exige responsável técnico
   habilitado com ART/TRT. Esta ficha é assinada pelo técnico que executou.

   Três entidades com CRUD completo, todas no localStorage (DB):
     DB.fichas    → a ficha de cada cliente/local
     DB.aparelhos → os aparelhos de ar-condicionado do local
     DB.visitas   → cada inspeção feita (checklist + medições)
   Fluxo: ficha → aparelhos → visitas pelo celular → PDF para imprimir.
   ========================================================== */

const FREQ = { M: 'Mensal', T: 'Trimestral', S: 'Semestral', A: 'Anual' };
const FREQ_ORDEM = ['M', 'T', 'S', 'A'];   // uma visita anual inclui também as atividades M, T e S
const FREQ_DIAS = { M: 30, T: 90, S: 180, A: 365 };

// Itens verificados na inspeção, com a periodicidade recomendada (boas práticas de manutenção)
const ITENS_INSPECAO = [
  { id: '1.1', grupo: 'Unidade evaporadora (interna)', texto: 'Limpar ou lavar os filtros de ar; substituir se danificados', freq: 'M' },
  { id: '1.2', grupo: 'Unidade evaporadora (interna)', texto: 'Limpar bandeja de condensado e dreno; checar escoamento', freq: 'M' },
  { id: '1.3', grupo: 'Unidade evaporadora (interna)', texto: 'Verificar ruídos e vibrações anormais', freq: 'M' },
  { id: '1.4', grupo: 'Unidade evaporadora (interna)', texto: 'Medir temperatura de insuflamento e de retorno', freq: 'M' },
  { id: '1.5', grupo: 'Unidade evaporadora (interna)', texto: 'Verificar gabinete, aletas e fixação', freq: 'T' },
  { id: '1.6', grupo: 'Unidade evaporadora (interna)', texto: 'Limpar e higienizar a serpentina com bactericida', freq: 'S' },
  { id: '1.7', grupo: 'Unidade evaporadora (interna)', texto: 'Limpar e verificar ventilador (turbina) e motor', freq: 'S' },
  { id: '1.8', grupo: 'Unidade evaporadora (interna)', texto: 'Verificar isolamento térmico das tubulações', freq: 'S' },
  { id: '1.9', grupo: 'Unidade evaporadora (interna)', texto: 'Higienização completa da evaporadora', freq: 'A' },
  { id: '2.1', grupo: 'Unidade condensadora (externa)', texto: 'Verificar obstruções na entrada e saída de ar', freq: 'M' },
  { id: '2.2', grupo: 'Unidade condensadora (externa)', texto: 'Verificar ruídos e vibrações anormais', freq: 'M' },
  { id: '2.3', grupo: 'Unidade condensadora (externa)', texto: 'Limpar a serpentina condensadora', freq: 'S' },
  { id: '2.4', grupo: 'Unidade condensadora (externa)', texto: 'Verificar hélice, motor do ventilador e fixações', freq: 'S' },
  { id: '2.5', grupo: 'Unidade condensadora (externa)', texto: 'Verificar vazamentos de fluido (óleo nas conexões)', freq: 'S' },
  { id: '2.6', grupo: 'Unidade condensadora (externa)', texto: 'Medir pressões de trabalho e superaquecimento', freq: 'S' },
  { id: '2.7', grupo: 'Unidade condensadora (externa)', texto: 'Verificar suportes, base e corrosão', freq: 'A' },
  { id: '3.1', grupo: 'Parte elétrica', texto: 'Medir tensão de alimentação', freq: 'M' },
  { id: '3.2', grupo: 'Parte elétrica', texto: 'Medir corrente do compressor e comparar com a nominal', freq: 'M' },
  { id: '3.3', grupo: 'Parte elétrica', texto: 'Reapertar bornes e conexões elétricas', freq: 'S' },
  { id: '3.4', grupo: 'Parte elétrica', texto: 'Verificar disjuntor, cabos e aterramento', freq: 'S' },
  { id: '3.5', grupo: 'Parte elétrica', texto: 'Verificar capacitores e contatores', freq: 'S' },
  { id: '3.6', grupo: 'Parte elétrica', texto: 'Testar controle remoto, sensores e termostato', freq: 'T' },
  { id: '4.1', grupo: 'Ambiente', texto: 'Verificar tomada de ar externo e renovação de ar', freq: 'T' },
  { id: '4.2', grupo: 'Ambiente', texto: 'Verificar fontes de umidade e mofo no ambiente', freq: 'T' },
  { id: '4.3', grupo: 'Ambiente', texto: 'Avaliação da qualidade do ar interior', freq: 'S' }
];
const TIPOS_APARELHO = ['Split hi-wall', 'Piso-teto', 'Cassete', 'Janela', 'Multi-split', 'VRF', 'Self-contained'];
const FLUIDOS = ['R-410A', 'R-32', 'R-22', 'R-134a', 'Outro'];

// Atividades que entram numa visita do tipo escolhido (filter + ordem das frequências)
function atividadesDoTipo(tipo){
  const limite = FREQ_ORDEM.indexOf(tipo);
  return ITENS_INSPECAO.filter(a => FREQ_ORDEM.indexOf(a.freq) <= limite);
}

/* ---------- Cálculos (funções puras) ---------- */
function aparelhosDaFicha(fichaId){ return DB.aparelhos.filter(a => a.fichaId === fichaId); }
function visitasDaFicha(fichaId){
  return DB.visitas.filter(v => v.fichaId === fichaId).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}
function btuTotal(aparelhos){ return aparelhos.reduce((soma, a) => soma + (Number(a.btu) || 0), 0); }

// Situação da inspeção mensal de um aparelho, a partir da última visita
function situacaoAparelho(apId){
  const ultima = DB.visitas.filter(v => v.aparelhoId === apId).map(v => v.date).sort().pop();
  if(!ultima) return { classe: 'warn', texto: 'Sem inspeção', ultima: null };
  const prox = addDays(ultima, FREQ_DIAS.M);
  const dias = Math.round((prox - new Date(hojeISO() + 'T12:00:00')) / 86400000);
  if(dias < 0) return { classe: 'bad', texto: `Vencida há ${-dias} dia(s)`, ultima };
  if(dias <= 7) return { classe: 'warn', texto: `Vence em ${dias} dia(s)`, ultima };
  return { classe: 'ok', texto: 'Em dia', ultima };
}
// Situação da ficha = a pior situação entre os aparelhos
function situacaoFicha(fichaId){
  const sits = aparelhosDaFicha(fichaId).map(a => situacaoAparelho(a.id));
  if(!sits.length) return { classe: '', texto: 'Sem aparelhos' };
  const vencidos = sits.filter(s => s.classe === 'bad').length;
  if(vencidos) return { classe: 'bad', texto: `${vencidos} vencido(s)` };
  if(sits.some(s => s.classe === 'warn')) return { classe: 'warn', texto: 'Atenção' };
  return { classe: 'ok', texto: 'Em dia' };
}

/* ===================== LISTA DE FICHAS (sub-aba Inspeção) ===================== */
let fichaAberta = null;   // id da ficha aberta (null = lista)

function renderInspecao(el){
  if(fichaAberta && DB.fichas.some(p => p.id === fichaAberta)) return renderFichaDetalhe(el);
  fichaAberta = null;
  const lista = DB.fichas.slice().sort((a, b) => clientName(a.clientId).localeCompare(clientName(b.clientId)));
  el.innerHTML = `
    <div class="alert">Cadastre o local e os aparelhos do cliente, registre cada inspeção pelo celular e gere a ficha em PDF para assinar e entregar.</div>
    <div class="list">${lista.length ? lista.map(fichaCard).join('') : emptyState('Nenhuma ficha de inspeção', 'Toque em + para criar a ficha de um cliente.')}</div>`;
  el.querySelectorAll('[data-open-ficha]').forEach(b => b.onclick = () => { fichaAberta = Number(b.dataset.openFicha); renderTech(); window.scrollTo(0, 0); });
  el.querySelectorAll('[data-edit-ficha]').forEach(b => b.onclick = () => openFichaSheet(Number(b.dataset.editFicha)));
  el.querySelectorAll('[data-del-ficha]').forEach(b => b.onclick = () => excluirFicha(Number(b.dataset.delFicha)));
}
function fichaCard(p){
  const aps = aparelhosDaFicha(p.id);
  const ultima = visitasDaFicha(p.id)[0];
  const sit = situacaoFicha(p.id);
  return `
    <div class="card">
      <div class="card-top"><div>
        <div class="card-title">${esc(p.local)}</div>
        <div class="card-sub">${esc(clientName(p.clientId))}</div>
      </div><span class="badge ${sit.classe}">${sit.texto}</span></div>
      <div class="card-sub">${aps.length} aparelho(s) · ${fmtNum(btuTotal(aps), 0)} BTU/h · última visita: ${ultima ? fmtDate(ultima.date) : '—'}</div>
      <div class="card-meta"><span class="card-sub">${p.tecnico ? 'Técnico: ' + esc(p.tecnico) : ''}</span>
        <div class="card-actions">
          <button class="mini-btn ok" data-open-ficha="${p.id}">Abrir</button>
          <button class="mini-btn edit" data-edit-ficha="${p.id}">Editar</button>
          <button class="mini-btn danger" data-del-ficha="${p.id}">Excluir</button>
        </div>
      </div>
    </div>`;
}
function excluirFicha(id){
  const n = aparelhosDaFicha(id).length;
  if(!confirm(n ? `Excluir esta ficha? Os ${n} aparelho(s) e as inspeções dela também serão apagados.` : 'Excluir esta ficha?')) return;
  DB.fichas = DB.fichas.filter(p => p.id !== id);                 // D
  DB.aparelhos = DB.aparelhos.filter(a => a.fichaId !== id);
  DB.visitas = DB.visitas.filter(v => v.fichaId !== id);
  if(fichaAberta === id) fichaAberta = null;
  saveDB(); renderTech(); toast('Ficha excluída');
}

/* ----- Formulário da ficha (C/U) ----- */
function openFichaSheet(id){
  if(!DB.clients.length){ alert('Cadastre um cliente antes de criar uma ficha de inspeção.'); switchTab('clients'); return; }
  const ultima = DB.fichas[DB.fichas.length - 1];   // repete o técnico da última ficha
  const p = id ? DB.fichas.find(x => x.id === id)
    : { clientId: DB.clients[0].id, local: '', endereco: '', area: '', ocupantes: '', inicio: hojeISO(),
        tecnico: ultima ? ultima.tecnico : '', qualificacao: ultima ? ultima.qualificacao : '', notes: '' };
  const form = openForm(`
    <div class="sheet-title">${id ? 'Editar ficha' : 'Nova ficha de inspeção'}</div>
    <div class="field"><label for="p_client">Cliente</label><select id="p_client" name="clientId" required>${clientOptions(p.clientId)}</select></div>
    <div class="field"><label for="p_local">Local</label><input id="p_local" name="local" required minlength="2" value="${esc(p.local)}" placeholder="Ex: Clínica Exemplo – unidade Centro"></div>
    <div class="field"><label for="p_end">Endereço do local</label><input id="p_end" name="endereco" value="${esc(p.endereco)}" placeholder="Rua, nº, bairro, cidade"></div>
    <div class="field-row3">
      <div class="field"><label for="p_area">Área (m²)</label><input id="p_area" name="area" type="number" min="0" step="0.1" value="${p.area}"></div>
      <div class="field"><label for="p_ocup">Ocupantes</label><input id="p_ocup" name="ocupantes" type="number" min="0" step="1" value="${p.ocupantes}"></div>
      <div class="field"><label for="p_ini">Início</label><input id="p_ini" name="inicio" type="date" required value="${p.inicio}"></div>
    </div>
    <div class="form-card" style="padding:12px 14px">
      <b style="font-size:12.5px">Técnico responsável (assina a ficha)</b>
      <div class="field" style="margin-top:10px"><label for="p_tec">Nome</label><input id="p_tec" name="tecnico" required minlength="3" value="${esc(p.tecnico)}" placeholder="Seu nome completo"></div>
      <div class="field"><label for="p_qual">Qualificação</label><input id="p_qual" name="qualificacao" value="${esc(p.qualificacao)}" placeholder="Ex: Técnico em refrigeração · NR-10"></div>
    </div>
    <div class="field"><label for="p_notes">Observações</label><textarea id="p_notes" name="notes" placeholder="Opcional">${esc(p.notes)}</textarea></div>
    <button class="btn-primary" type="submit">${id ? 'Salvar alterações' : 'Criar ficha'}</button>
    <button class="btn-secondary" type="button" data-cancel>Cancelar</button>
  `, (fd) => {
    const data = {
      clientId: Number(fd.get('clientId')), local: fd.get('local').trim(), endereco: fd.get('endereco').trim(),
      area: fd.get('area'), ocupantes: fd.get('ocupantes'), inicio: fd.get('inicio'),
      tecnico: fd.get('tecnico').trim(), qualificacao: fd.get('qualificacao').trim(), notes: fd.get('notes').trim()
    };
    if(id) Object.assign(p, data);                                          // U
    else { const novo = { id: DB.nextId.ficha++, ...data }; DB.fichas.push(novo); fichaAberta = novo.id; }   // C
    saveDB(); closeSheet(); renderTech(); toast('Ficha salva');
  });
  // Ao escolher o cliente, sugere o endereço dele
  const sel = form.querySelector('#p_client'), end = form.querySelector('#p_end');
  const sugerir = () => { const c = DB.clients.find(x => x.id === Number(sel.value)); if(c && c.address && !end.value) end.value = c.address; };
  sel.addEventListener('change', () => { end.value = ''; sugerir(); });
  if(!id) sugerir();
}

/* ===================== DETALHE DA FICHA ===================== */
function renderFichaDetalhe(el){
  const p = DB.fichas.find(x => x.id === fichaAberta);
  const aps = aparelhosDaFicha(p.id).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  const vis = visitasDaFicha(p.id);
  el.innerHTML = `
    <button class="link-btn" type="button" id="fichaVoltar">‹ Todas as fichas</button>
    <div class="card" style="margin:8px 0 14px">
      <div class="card-top"><div>
        <div class="card-title">${esc(p.local)}</div>
        <div class="card-sub">${esc(clientName(p.clientId))}${p.endereco ? ' · ' + esc(p.endereco) : ''}</div>
      </div><span class="badge ${situacaoFicha(p.id).classe}">${situacaoFicha(p.id).texto}</span></div>
      <div class="card-sub">Técnico: ${p.tecnico ? esc(p.tecnico) : 'não informado'} · ${aps.length} aparelho(s) · ${fmtNum(btuTotal(aps), 0)} BTU/h</div>
      <div class="ficha-acoes">
        <button class="btn-primary" type="button" id="fichaPdf">📄 Gerar PDF da ficha</button>
        <button class="btn-secondary" type="button" id="fichaEditar">Editar ficha</button>
      </div>
    </div>

    <div class="section-title">Aparelhos</div>
    <div class="list">${aps.length ? aps.map(aparelhoCard).join('') : emptyState('Nenhum aparelho', 'Cadastre os aparelhos de ar-condicionado deste local.')}</div>
    <button class="btn-inline" type="button" id="apNovo" style="margin:10px 0 4px">+ Adicionar aparelho</button>

    <div class="section-title">Inspeções registradas</div>
    <div class="list">${vis.length ? vis.map(visitaCard).join('') : emptyState('Nenhuma inspeção', 'Toque em "Inspecionar" em um aparelho, ou no +, para preencher.')}</div>`;

  el.querySelector('#fichaVoltar').onclick = () => { fichaAberta = null; renderTech(); };
  el.querySelector('#fichaEditar').onclick = () => openFichaSheet(p.id);
  el.querySelector('#fichaPdf').onclick = () => gerarFichaPDF(p.id);
  el.querySelector('#apNovo').onclick = () => openAparelhoSheet(null);
  el.querySelectorAll('[data-visit-ap]').forEach(b => b.onclick = () => openVisitaSheet(null, Number(b.dataset.visitAp)));
  el.querySelectorAll('[data-edit-ap]').forEach(b => b.onclick = () => openAparelhoSheet(Number(b.dataset.editAp)));
  el.querySelectorAll('[data-del-ap]').forEach(b => b.onclick = () => {
    const apId = Number(b.dataset.delAp);
    const n = DB.visitas.filter(v => v.aparelhoId === apId).length;
    if(!confirm(n ? `Excluir este aparelho e as ${n} inspeção(ões) dele?` : 'Excluir este aparelho?')) return;
    DB.aparelhos = DB.aparelhos.filter(a => a.id !== apId);
    DB.visitas = DB.visitas.filter(v => v.aparelhoId !== apId);
    saveDB(); renderTech(); toast('Aparelho excluído');
  });
  el.querySelectorAll('[data-edit-vis]').forEach(b => b.onclick = () => openVisitaSheet(Number(b.dataset.editVis)));
  el.querySelectorAll('[data-del-vis]').forEach(b => b.onclick = () => {
    if(!confirm('Excluir esta inspeção?')) return;
    DB.visitas = DB.visitas.filter(v => v.id !== Number(b.dataset.delVis));
    saveDB(); renderTech(); toast('Inspeção excluída');
  });
}
function aparelhoCard(a){
  const sit = situacaoAparelho(a.id);
  return `
    <div class="card">
      <div class="card-top"><div>
        <div class="card-title">${esc(a.codigo)} · ${esc(a.ambiente)}</div>
        <div class="card-sub">${esc(a.tipo)}${a.marca ? ' · ' + esc(a.marca) : ''}${a.modelo ? ' ' + esc(a.modelo) : ''}</div>
      </div><div class="card-amount">${fmtNum(a.btu, 0)}<span class="card-sub"> BTU</span></div></div>
      <div class="card-meta">
        <span class="badge ${sit.classe}">${sit.texto}</span>
        <div class="card-actions">
          <button class="mini-btn ok" data-visit-ap="${a.id}">Inspecionar</button>
          <button class="mini-btn edit" data-edit-ap="${a.id}">Editar</button>
          <button class="mini-btn danger" data-del-ap="${a.id}">Excluir</button>
        </div>
      </div>
    </div>`;
}
function visitaCard(v){
  const ap = DB.aparelhos.find(a => a.id === v.aparelhoId);
  const medidas = [v.tensao && v.tensao + ' V', v.corrente && v.corrente + ' A', v.tempIns && 'ins. ' + v.tempIns + ' °C', v.tempRet && 'ret. ' + v.tempRet + ' °C'].filter(Boolean).join(' · ');
  return `
    <div class="card">
      <div class="card-top"><div>
        <div class="card-title">${fmtDate(v.date)} · ${ap ? esc(ap.codigo) : 'Aparelho removido'}</div>
        <div class="card-sub">Inspeção ${FREQ[v.tipo].toLowerCase()} · ${v.feitas.length} item(ns)${medidas ? ' · ' + medidas : ''}</div>
        ${v.obs ? `<div class="card-sub">${esc(v.obs)}</div>` : ''}
      </div></div>
      <div class="card-meta"><span class="card-sub">${esc(v.executor || '')}</span>
        <div class="card-actions">
          <button class="mini-btn edit" data-edit-vis="${v.id}">Editar</button>
          <button class="mini-btn danger" data-del-vis="${v.id}">Excluir</button>
        </div>
      </div>
    </div>`;
}

/* ----- Formulário do aparelho (C/U) ----- */
function openAparelhoSheet(id){
  const proximoCodigo = 'AC-' + String(aparelhosDaFicha(fichaAberta).length + 1).padStart(2, '0');
  const a = id ? DB.aparelhos.find(x => x.id === id)
    : { codigo: proximoCodigo, ambiente: '', tipo: TIPOS_APARELHO[0], marca: '', modelo: '', serie: '', btu: 12000, fluido: 'R-410A', instalacao: '' };
  openForm(`
    <div class="sheet-title">${id ? 'Editar aparelho' : 'Novo aparelho'}</div>
    <div class="field-row">
      <div class="field"><label for="a_cod">Código (etiqueta)</label><input id="a_cod" name="codigo" required maxlength="12" value="${esc(a.codigo)}"></div>
      <div class="field"><label for="a_amb">Ambiente</label><input id="a_amb" name="ambiente" required value="${esc(a.ambiente)}" placeholder="Ex: Recepção"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="a_tipo">Tipo</label><select id="a_tipo" name="tipo">${TIPOS_APARELHO.map(t => `<option ${a.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label for="a_btu">Capacidade (BTU/h)</label><input id="a_btu" name="btu" type="number" required min="5000" max="400000" step="1000" value="${a.btu}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="a_marca">Marca</label><input id="a_marca" name="marca" value="${esc(a.marca)}"></div>
      <div class="field"><label for="a_mod">Modelo</label><input id="a_mod" name="modelo" value="${esc(a.modelo)}"></div>
    </div>
    <div class="field-row3">
      <div class="field"><label for="a_serie">Nº de série</label><input id="a_serie" name="serie" value="${esc(a.serie)}"></div>
      <div class="field"><label for="a_fluido">Fluido</label><select id="a_fluido" name="fluido">${FLUIDOS.map(f => `<option ${a.fluido === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
      <div class="field"><label for="a_inst">Instalação</label><input id="a_inst" name="instalacao" type="date" value="${a.instalacao}"></div>
    </div>
    <button class="btn-primary" type="submit">${id ? 'Salvar alterações' : 'Adicionar aparelho'}</button>
    <button class="btn-secondary" type="button" data-cancel>Cancelar</button>
  `, (fd) => {
    const data = {
      codigo: fd.get('codigo').trim().toUpperCase(), ambiente: fd.get('ambiente').trim(), tipo: fd.get('tipo'),
      btu: Number(fd.get('btu')), marca: fd.get('marca').trim(), modelo: fd.get('modelo').trim(),
      serie: fd.get('serie').trim(), fluido: fd.get('fluido'), instalacao: fd.get('instalacao')
    };
    const repetido = DB.aparelhos.some(x => x.fichaId === fichaAberta && x.codigo === data.codigo && x.id !== id);
    if(repetido){ toast('Já existe um aparelho com o código ' + data.codigo); return; }
    if(id) Object.assign(a, data); else DB.aparelhos.push({ id: DB.nextId.aparelho++, fichaId: fichaAberta, ...data });
    saveDB(); closeSheet(); renderTech(); toast('Aparelho salvo');
  });
}

/* ----- Inspeção (C/U): checklist + medições, pensada para o celular ----- */
function checklistHTML(tipo, marcadas){
  const grupos = {};
  atividadesDoTipo(tipo).forEach(a => { (grupos[a.grupo] = grupos[a.grupo] || []).push(a); });
  return Object.entries(grupos).map(([grupo, lista]) => `
    <div class="check-grupo">${esc(grupo)}</div>
    ${lista.map(a => `
      <label class="check-item">
        <input type="checkbox" name="ativ" value="${a.id}" ${marcadas.includes(a.id) ? 'checked' : ''}>
        <span>${a.texto}</span><em>${a.freq}</em>
      </label>`).join('')}`).join('');
}
function openVisitaSheet(id, aparelhoId){
  const aps = aparelhosDaFicha(fichaAberta);
  if(!aps.length){ toast('Cadastre um aparelho antes de registrar a inspeção'); openAparelhoSheet(null); return; }
  const novo = !id;
  const v = id ? DB.visitas.find(x => x.id === id)
    : { aparelhoId: aparelhoId || aps[0].id, date: hojeISO(), tipo: 'M', feitas: atividadesDoTipo('M').map(a => a.id),
        tensao: '', corrente: '', tempIns: '', tempRet: '', obs: '', executor: (DB.company && DB.company.name) || '' };
  const form = openForm(`
    <div class="sheet-title">${id ? 'Editar inspeção' : 'Nova inspeção'}</div>
    <div class="field-row">
      <div class="field"><label for="v_ap">Aparelho</label><select id="v_ap" name="aparelhoId" required>
        ${aps.map(a => `<option value="${a.id}" ${a.id === v.aparelhoId ? 'selected' : ''}>${esc(a.codigo)} · ${esc(a.ambiente)}</option>`).join('')}</select></div>
      <div class="field"><label for="v_date">Data</label><input id="v_date" name="date" type="date" required max="${hojeISO()}" value="${v.date}"></div>
    </div>
    <div class="field"><label>Periodicidade</label>
      ${segHTML('tipo', v.tipo, FREQ_ORDEM.map(k => ({ v: k, l: FREQ[k] })))}</div>
    <div class="field"><label>Itens verificados <button type="button" class="link-btn" id="v_todas" style="float:right;text-transform:none;letter-spacing:0">marcar todas</button></label>
      <div class="checklist" id="v_check">${checklistHTML(v.tipo, v.feitas)}</div></div>
    <div class="field-row">
      <div class="field"><label for="v_v">Tensão (V)</label><input id="v_v" name="tensao" type="number" inputmode="decimal" min="0" max="500" step="0.1" value="${v.tensao}"></div>
      <div class="field"><label for="v_a">Corrente (A)</label><input id="v_a" name="corrente" type="number" inputmode="decimal" min="0" max="200" step="0.1" value="${v.corrente}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="v_ti">Temp. insuflamento (°C)</label><input id="v_ti" name="tempIns" type="number" inputmode="decimal" min="-10" max="40" step="0.1" value="${v.tempIns}"></div>
      <div class="field"><label for="v_tr">Temp. retorno (°C)</label><input id="v_tr" name="tempRet" type="number" inputmode="decimal" min="-10" max="50" step="0.1" value="${v.tempRet}"></div>
    </div>
    <div class="field"><label for="v_obs">Observações / peças trocadas</label><textarea id="v_obs" name="obs" placeholder="Opcional">${esc(v.obs)}</textarea></div>
    <div class="field"><label for="v_exec">Executado por</label><input id="v_exec" name="executor" required value="${esc(v.executor)}"></div>
    <button class="btn-primary" type="submit">${id ? 'Salvar alterações' : 'Salvar inspeção'}</button>
    <button class="btn-secondary" type="button" data-cancel>Cancelar</button>
  `, (fd) => {
    const feitas = fd.getAll('ativ');
    if(!feitas.length){ toast('Marque pelo menos um item verificado'); return; }
    const data = {
      aparelhoId: Number(fd.get('aparelhoId')), date: fd.get('date'), tipo: fd.get('tipo'), feitas,
      tensao: fd.get('tensao'), corrente: fd.get('corrente'), tempIns: fd.get('tempIns'), tempRet: fd.get('tempRet'),
      obs: fd.get('obs').trim(), executor: fd.get('executor').trim()
    };
    if(id) Object.assign(v, data); else DB.visitas.push({ id: DB.nextId.visita++, fichaId: fichaAberta, ...data });
    saveDB(); closeSheet(); renderTech(); toast('Inspeção salva');
  });
  bindSeg(form, 'tipo');
  const box = form.querySelector('#v_check');
  // Trocar o tipo refaz o checklist; numa ficha nova, já vem tudo do tipo marcado
  form.querySelectorAll('.seg[data-seg="tipo"] button').forEach(b => b.addEventListener('click', () => {
    const marcadas = novo ? atividadesDoTipo(b.dataset.v).map(a => a.id)
      : [...box.querySelectorAll('input:checked')].map(i => i.value);
    box.innerHTML = checklistHTML(b.dataset.v, marcadas);
  }));
  form.querySelector('#v_todas').onclick = () => box.querySelectorAll('input').forEach(i => i.checked = true);
}

/* ===================== PDF DA FICHA (jsPDF) ===================== */
function cronogramaMeses(inicio){
  const d = new Date(inicio + 'T12:00:00');
  return Array.from({ length: 12 }, (_, k) => {
    const m = new Date(d.getFullYear(), d.getMonth() + k, 1);
    return { ano: m.getFullYear(), mes: m.getMonth(), rotulo: m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(m.getFullYear()).slice(2) };
  });
}
// Em quais meses (0 a 11, contados a partir do início) cada frequência acontece
const CRONOGRAMA_REGRA = { M: k => true, T: k => k % 3 === 0, S: k => k % 6 === 0, A: k => k === 0 };

function gerarFichaPDF(fichaId){
  const p = DB.fichas.find(x => x.id === fichaId);
  if(typeof window.jspdf === 'undefined'){ alert('Não foi possível carregar o gerador de PDF. Recarregue a página.'); return; }
  const client = DB.clients.find(c => c.id === p.clientId);
  const company = DB.company || {};
  const aps = aparelhosDaFicha(p.id).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  const vis = visitasDaFicha(p.id).slice().reverse();   // mais antiga primeiro
  const meses = cronogramaMeses(p.inicio);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, MX = 14, LW = PW - 2 * MX, MAXY = 282;
  let y = 16;
  const quebra = need => { if(y + need > MAXY){ doc.addPage(); y = 16; return true; } return false; };
  const fonte = (estilo, tam) => { doc.setFont('helvetica', estilo); doc.setFontSize(tam); };

  function titulo(t){
    quebra(14); y += 3;
    doc.setFillColor(28, 33, 45); doc.rect(MX, y - 4.2, LW, 6.4, 'F');
    fonte('bold', 9.5); doc.setTextColor(255, 255, 255); doc.text(t.toUpperCase(), MX + 2.5, y);
    doc.setTextColor(0, 0, 0); y += 6;
  }
  function campos(lista){   // pares "rótulo: valor" em duas colunas
    const col = LW / 2;
    for(let i = 0; i < lista.length; i += 2){
      quebra(6);
      [lista[i], lista[i + 1]].forEach((par, k) => {
        if(!par) return;
        fonte('bold', 8); doc.text(par[0] + ':', MX + k * col, y);
        fonte('normal', 9); doc.text(String(par[1] || '—'), MX + k * col + doc.getTextWidth(par[0] + ':  ') * 1.05, y, { maxWidth: col - 30 });
      });
      y += 5.4;
    }
  }
  // Tabela simples: colunas com largura em mm, quebra de linha e de página
  function tabela(cols, linhas, opt = {}){
    const tam = opt.tam || 8, pad = 1.6, lh = tam * 0.42;
    const cabecalho = () => {
      quebra(8);
      doc.setFillColor(232, 235, 241); doc.rect(MX, y - 4, LW, 6, 'F');
      fonte('bold', tam); let x = MX;
      cols.forEach(c => { doc.text(c.t, c.al === 'c' ? x + c.w / 2 : x + pad, y, { align: c.al === 'c' ? 'center' : 'left' }); x += c.w; });
      y += 3.6;
    };
    cabecalho();
    linhas.forEach((ln, idx) => {
      if(ln.grupo){ quebra(7); fonte('bold', tam); doc.setTextColor(90, 90, 90); doc.text(ln.grupo, MX + pad, y + 3); doc.setTextColor(0, 0, 0); y += 4.6; return; }
      fonte('normal', tam);
      const partes = ln.map((v, k) => doc.splitTextToSize(String(v == null || v === '' ? '—' : v), cols[k].w - 2 * pad));
      const h = Math.max(...partes.map(pt => pt.length)) * lh + 2.6;
      if(quebra(h + 1)){ cabecalho(); fonte('normal', tam); }
      if(idx % 2 === 1){ doc.setFillColor(248, 249, 251); doc.rect(MX, y - 0.6, LW, h, 'F'); }
      let x = MX;
      partes.forEach((pt, k) => { doc.text(pt, cols[k].al === 'c' ? x + cols[k].w / 2 : x + pad, y + 2.8, { align: cols[k].al === 'c' ? 'center' : 'left' }); x += cols[k].w; });
      doc.setDrawColor(220, 223, 230); doc.setLineWidth(0.2); doc.line(MX, y + h - 0.6, MX + LW, y + h - 0.6);
      y += h;
    });
    y += 2;
  }

  // ---- Cabeçalho
  try{ doc.addImage(logoDataUrl(), 'JPEG', PW - MX - 20, 9, 20, 20); }catch(e){}
  fonte('bold', 16); doc.text('FICHA DE INSPEÇÃO TÉCNICA', MX, y + 2);
  fonte('bold', 10.5); doc.text('Ar-condicionado · Manutenção preventiva', MX, y + 8);
  fonte('normal', 8.5); doc.setTextColor(90, 90, 90);
  doc.text('Registro das inspeções e manutenções realizadas nos equipamentos do local', MX, y + 13);
  doc.setTextColor(0, 0, 0); y += 19;
  doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.6); doc.line(MX, y, PW - MX, y); y += 4;

  titulo('1. Identificação do local');
  campos([
    ['Local', p.local], ['Cliente', client ? client.name : 'Cliente removido'],
    ['Endereço', p.endereco || (client && client.address) || ''], ['Telefone', client ? client.phone : ''],
    ['Área climatizada', p.area ? fmtNum(p.area, 1) + ' m²' : ''], ['Ocupantes', p.ocupantes || ''],
    ['Aparelhos', aps.length], ['Capacidade total', fmtNum(btuTotal(aps), 0) + ' BTU/h']
  ]);

  titulo('2. Técnico responsável e empresa');
  campos([['Técnico', p.tecnico || ''], ['Qualificação', p.qualificacao || ''],
    ['Empresa', company.name || ''], ['CNPJ/CPF', company.cnpj || ''], ['Telefone', company.phone || ''], ['E-mail', company.email || '']]);

  titulo('3. Equipamentos inspecionados');
  tabela([{ t: 'Código', w: 18 }, { t: 'Ambiente', w: 36 }, { t: 'Tipo', w: 28 }, { t: 'Marca / modelo', w: 42 }, { t: 'Nº série', w: 24 }, { t: 'BTU/h', w: 18, al: 'c' }, { t: 'Fluido', w: 16, al: 'c' }],
    aps.length ? aps.map(a => [a.codigo, a.ambiente, a.tipo, [a.marca, a.modelo].filter(Boolean).join(' '), a.serie, fmtNum(a.btu, 0), a.fluido]) : [['', 'Nenhum aparelho cadastrado', '', '', '', '', '']]);

  titulo('4. Itens de inspeção');
  fonte('normal', 7.5); doc.setTextColor(90, 90, 90);
  doc.text('Periodicidade recomendada: M = mensal · T = trimestral · S = semestral · A = anual.', MX, y); y += 4;
  doc.setTextColor(0, 0, 0);
  const linhasItens = [];
  [...new Set(ITENS_INSPECAO.map(a => a.grupo))].forEach(g => {
    linhasItens.push({ grupo: g });
    ITENS_INSPECAO.filter(a => a.grupo === g).forEach(a => linhasItens.push([a.id, a.texto, a.freq]));
  });
  tabela([{ t: 'Nº', w: 12 }, { t: 'Item verificado', w: 150 }, { t: 'Per.', w: 20, al: 'c' }], linhasItens);

  titulo('5. Cronograma recomendado (12 meses)');
  const feitasNoMes = meses.map(m => vis.some(v => { const d = new Date(v.date + 'T12:00:00'); return d.getFullYear() === m.ano && d.getMonth() === m.mes; }));
  const wRot = 34, wMes = (LW - wRot) / 12;
  tabela([{ t: 'Inspeção', w: wRot }, ...meses.map(m => ({ t: m.rotulo, w: wMes, al: 'c' }))].map(c => ({ ...c })),
    [...FREQ_ORDEM.map(f => [FREQ[f] + ' (' + f + ')', ...meses.map((_, k) => CRONOGRAMA_REGRA[f](k) ? 'X' : ' ')]),
     ['Realizado', ...feitasNoMes.map(ok => ok ? 'OK' : ' ')]], { tam: 7 });

  titulo('6. Registro das inspeções');
  tabela([{ t: 'Data', w: 18 }, { t: 'Aparelho', w: 18 }, { t: 'Tipo', w: 20 }, { t: 'Itens verificados', w: 46 }, { t: 'V', w: 12, al: 'c' }, { t: 'A', w: 12, al: 'c' }, { t: 'Ins./Ret. °C', w: 20, al: 'c' }, { t: 'Observações', w: 36 }],
    vis.length ? vis.map(v => {
      const ap = DB.aparelhos.find(a => a.id === v.aparelhoId);
      return [fmtDate(v.date), ap ? ap.codigo : '—', FREQ[v.tipo], v.feitas.join(', '), v.tensao, v.corrente,
        (v.tempIns || '—') + ' / ' + (v.tempRet || '—'), v.obs];
    }) : [['', '', '', 'Nenhuma inspeção registrada', '', '', '', '']], { tam: 7.5 });
  // Linhas em branco para preencher à mão no local
  fonte('normal', 7.5); doc.setTextColor(90, 90, 90);
  quebra(8); doc.text('Linhas para registro manual:', MX, y + 1); y += 3;
  doc.setTextColor(0, 0, 0);
  for(let k = 0; k < 4; k++){ quebra(7); doc.setDrawColor(190, 190, 190); doc.line(MX, y + 5, MX + LW, y + 5); y += 6.5; }

  titulo('7. Em caso de falha do equipamento');
  fonte('normal', 8.5);
  ['Desligar o aparelho pelo controle; havendo cheiro de queimado ou faísca, desligar o disjuntor.',
   'Não abrir o equipamento nem tentar reparar.',
   `Chamar o técnico: ${company.name || ''}${company.phone ? ' · ' + company.phone : ''}.`,
   'Em vazamento de fluido refrigerante, ventilar o ambiente e afastar as pessoas.']
    .forEach((t, k) => { doc.splitTextToSize(`${k + 1}. ${t}`, LW).forEach(l => { quebra(5); doc.text(l, MX, y); y += 4.4; }); });

  titulo('8. Observação importante');
  fonte('normal', 7.8); doc.setTextColor(70, 70, 70);
  doc.splitTextToSize('Esta ficha registra as inspeções e manutenções realizadas pelo técnico nos equipamentos listados. Ela não é um PMOC (Plano de Manutenção, Operação e Controle) e não substitui o PMOC exigido pela Lei nº 13.589/2018 para ambientes climatizados de uso público e coletivo, que deve ter responsável técnico habilitado (com ART/TRT).', LW)
    .forEach(l => { quebra(5); doc.text(l, MX, y); y += 4; });
  doc.setTextColor(0, 0, 0);

  quebra(56);   // declaração e assinaturas ficam sempre na mesma página
  titulo('9. Declaração');
  fonte('normal', 8.5);
  doc.splitTextToSize('Declaro que realizei as inspeções e os serviços registrados nesta ficha, nas datas e nos equipamentos indicados.', LW)
    .forEach(l => { quebra(5); doc.text(l, MX, y); y += 4.4; });
  y += 2;
  if(p.notes){ fonte('bold', 8.5); quebra(6); doc.text('Observações:', MX, y); y += 4.4; fonte('normal', 8.5);
    doc.splitTextToSize(p.notes, LW).forEach(l => { quebra(5); doc.text(l, MX, y); y += 4.4; }); y += 2; }
  fonte('normal', 8.5); quebra(8); doc.text(`${(company.address || 'Corbélia/PR')}, ${fmtDatePt(new Date())}.`, MX, y); y += 4;
  // Três assinaturas lado a lado
  quebra(30);
  const colA = (LW - 20) / 2;
  [['Técnico responsável', [p.tecnico, p.qualificacao].filter(Boolean).join(' · ') || 'Nome'],
   ['Cliente / responsável pelo local', client ? client.name : '']].forEach(([rotulo, sub], k) => {
    const x = MX + k * (colA + 20), yy = y + 18, cx = x + colA / 2;
    doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.3); doc.line(x, yy, x + colA, yy);
    fonte('bold', 8); doc.text(rotulo, cx, yy + 4, { align: 'center' });
    fonte('normal', 7); doc.text(doc.splitTextToSize(sub, colA), cx, yy + 8, { align: 'center' });
  });
  y += 30;


  // Rodapé com número da página
  const total = doc.getNumberOfPages();
  for(let i = 1; i <= total; i++){
    doc.setPage(i); fonte('normal', 7); doc.setTextColor(120, 120, 120);
    doc.text(`Ficha de inspeção técnica · ${p.local}`, MX, 291);
    doc.text(`Página ${i} de ${total}`, PW - MX, 291, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  const safe = p.local.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  const filename = `Ficha_Inspecao_${safe}.pdf`;
  DOCS.items.unshift({
    id: Date.now(), fichaId: p.id, title: 'Ficha de inspeção · ' + p.local, clientName: client ? client.name : 'Cliente removido',
    filename, dataUrl: doc.output('datauristring'), html: fichaHTML(p, client, company, aps, vis, meses, feitasNoMes),
    createdAt: new Date().toISOString()
  });
  saveDocs();
  try{ doc.save(filename); }catch(e){}
  toast('Ficha salva em Arquivos');
  switchTab('archive');
}

// Versão em HTML do mesmo documento (visualizador da tela Arquivos)
function fichaHTML(p, client, company, aps, vis, meses, feitasNoMes){
  const tab = (cab, linhas) => `<div class="doc-table-wrap"><table class="doc-table"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${esc(c == null || c === '' ? '—' : c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `
    <div class="doc-header"><div><div class="doc-title">Ficha de Inspeção Técnica</div><div class="doc-line"><b>Ar-condicionado · Manutenção preventiva</b></div></div>
      <img class="doc-logo" src="${logoDataUrl()}" alt="logo"></div>
    <hr class="doc-rule">
    <div class="doc-section"><div class="doc-section-title">1. Identificação do local</div>
      <div class="doc-line">Local: <b>${esc(p.local)}</b></div>
      <div class="doc-line">Cliente: ${esc(client ? client.name : 'Cliente removido')}</div>
      ${p.endereco ? `<div class="doc-line">Endereço: ${esc(p.endereco)}</div>` : ''}
      <div class="doc-line">${aps.length} aparelho(s) · ${fmtNum(btuTotal(aps), 0)} BTU/h${p.area ? ' · ' + fmtNum(p.area, 1) + ' m²' : ''}</div></div>
    <div class="doc-section"><div class="doc-section-title">2. Técnico responsável e empresa</div>
      <div class="doc-line">${esc(p.tecnico) || '—'}${p.qualificacao ? ' · ' + esc(p.qualificacao) : ''}</div>
      <div class="doc-line">${esc(company.name) || '—'}${company.phone ? ' · ' + esc(company.phone) : ''}</div></div>
    <div class="doc-section"><div class="doc-section-title">3. Equipamentos</div>
      ${tab(['Código', 'Ambiente', 'Tipo', 'BTU/h', 'Fluido'], aps.map(a => [a.codigo, a.ambiente, a.tipo, fmtNum(a.btu, 0), a.fluido]))}</div>
    <div class="doc-section"><div class="doc-section-title">4. Itens de inspeção</div>
      ${tab(['Nº', 'Item verificado', 'Per.'], ITENS_INSPECAO.map(a => [a.id, a.texto, a.freq]))}</div>
    <div class="doc-section"><div class="doc-section-title">5. Cronograma recomendado</div>
      ${tab(['', ...meses.map(m => m.rotulo)], [...FREQ_ORDEM.map(f => [FREQ[f], ...meses.map((_, k) => CRONOGRAMA_REGRA[f](k) ? 'X' : ' ')]), ['Realizado', ...feitasNoMes.map(ok => ok ? 'OK' : ' ')]])}</div>
    <div class="doc-section"><div class="doc-section-title">6. Registro das inspeções</div>
      ${vis.length ? tab(['Data', 'Aparelho', 'Tipo', 'V', 'A', 'Obs.'], vis.map(v => {
        const ap = DB.aparelhos.find(a => a.id === v.aparelhoId);
        return [fmtDate(v.date), ap ? ap.codigo : '—', FREQ[v.tipo], v.tensao, v.corrente, v.obs];
      })) : '<div class="doc-line">Nenhuma inspeção registrada.</div>'}</div>
    <div class="doc-obs">Esta ficha registra as inspeções realizadas e não substitui o PMOC exigido pela Lei 13.589/2018.</div>
    <div class="doc-sign"><div class="doc-sign-line">Técnico responsável</div><div class="doc-sign-line">Cliente</div></div>`;
}
