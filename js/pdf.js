/* ==========================================================
   pdf.js — PDF do orçamento (jsPDF), tela de Arquivos e compartilhamento
   Mantém o layout do app original e acrescenta a lista de materiais
   (quando o orçamento veio do fluxo BTU → cabo → materiais).
   ========================================================== */

// Logo usada no PDF: a que o usuário enviou (Empresa) ou a padrão do app
function logoDataUrl(){
  return (DB.company && DB.company.logo) || `data:image/jpeg;base64,${LOGO_B64}`;
}

// Lê a imagem escolhida, reduz para no máx. 400 px (economiza o localStorage)
// e devolve um data URL JPEG com fundo branco (PNG transparente não fica preto).
function processarLogo(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida'));
      img.onload = () => {
        const escala = Math.min(1, 400 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function generateBudgetPDF(id){
  const b = DB.budgets.find(x => x.id === id);
  if(!b){ toast('Orçamento não encontrado'); return; }
  if(typeof window.jspdf === 'undefined'){
    alert('Não foi possível carregar o gerador de PDF. Recarregue a página.');
    return;
  }
  const client = DB.clients.find(c => c.id === b.clientId);
  const company = DB.company || {};
  const today = new Date();
  const validade = addDays(hojeISO(), 30);
  const statusLabel = b.status === 'completed' ? 'Aprovado' : 'Rascunho';
  const itens = b.items || [];

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, MX = 18, MAXY = 278;
  let y = 22;

  function pageBreak(need){ if(y + need > MAXY){ doc.addPage(); y = 22; } }
  function sectionTitle(t){
    pageBreak(10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(t.toUpperCase(), MX, y); y += 5.5;
  }
  function textLine(t, bold){
    pageBreak(6);
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(10);
    doc.text(String(t), MX, y); y += 5;
  }
  function wrapBlock(t, bold, size){
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size || 10);
    doc.splitTextToSize(String(t || ''), PW - 2 * MX).forEach(l => { pageBreak(5.5); doc.text(l, MX, y); y += 5; });
  }

  // Cabeçalho com logo
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text(`ORÇAMENTO Nº ${b.id}`, MX, y);
  try{ doc.addImage(logoDataUrl(), 'JPEG', PW - MX - 20, 8, 20, 20); }catch(e){}
  y += 9;
  doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.6);
  doc.line(MX, y, PW - MX, y);
  y += 9;

  sectionTitle('Dados da empresa');
  textLine(company.name || '—', true);
  if(company.email) textLine('Email: ' + company.email);
  if(company.phone) textLine('Telefone: ' + company.phone);
  if(company.cnpj) textLine('CNPJ/CPF: ' + company.cnpj);
  if(company.address) textLine(company.address);
  y += 2;

  sectionTitle('Dados do cliente');
  textLine('Nome: ' + (client ? client.name : 'Cliente removido'));
  if(client && client.phone) textLine('Telefone: ' + client.phone);
  if(client && client.address) textLine('Endereço: ' + client.address);
  y += 2;

  sectionTitle('Informações do orçamento');
  textLine('Data de Emissão: ' + fmtDatePt(today));
  textLine('Validade: ' + fmtDatePt(validade));
  textLine('Status: ' + statusLabel);
  y += 2;

  sectionTitle('Descrição do serviço');
  wrapBlock(b.title, true, 10.5);
  y += 1;
  wrapBlock(b.description, false, 10);
  y += 3;

  if(itens.length){
    sectionTitle('Materiais previstos');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    itens.forEach(i => {
      pageBreak(5.5);
      const sub = Number(i.qty) * Number(i.price);
      doc.text(`${i.qty} ${i.unit} · ${i.name}`, MX, y);
      doc.text(fmtMoney(sub), PW - MX, y, { align: 'right' });
      y += 5;
    });
    y += 3;
  }

  // Caixa de valor
  pageBreak(15);
  doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.5);
  doc.rect(MX, y, PW - 2 * MX, 12);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.text('VALOR DO ORÇAMENTO', MX + 4, y + 7.8);
  doc.setFontSize(14);
  doc.text(fmtMoney(b.amount), PW - MX - 4, y + 7.8, { align: 'right' });
  y += 18;

  pageBreak(24);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('OBSERVAÇÕES', MX, y); y += 4.6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  OBS_ORCAMENTO.forEach(t => { pageBreak(4.3); doc.text('• ' + t, MX, y); y += 4.3; });

  y += 14;
  pageBreak(16);
  doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.3);
  doc.line(MX, y, MX + 72, y);
  doc.line(PW - MX - 72, y, PW - MX, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Téc. Responsável', MX + 36, y + 4, { align: 'center' });
  doc.text('Cliente', PW - MX - 36, y + 4, { align: 'center' });

  const safe = (client ? client.name : 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  const filename = `orcamento_${b.id}_${safe}.pdf`;
  const html = buildBudgetHTML(b, client, company, today, validade, statusLabel);

  // Salva dentro do app (tela Arquivos)
  DOCS.items.unshift({
    id: Date.now(), budgetId: b.id, title: b.title,
    clientName: client ? client.name : 'Cliente removido',
    filename, dataUrl: doc.output('datauristring'), html, createdAt: new Date().toISOString()
  });
  saveDocs();
  try{ doc.save(filename); }catch(e){}   // download nativo como bônus
  toast('PDF salvo em Arquivos');
  switchTab('archive');
}

const OBS_ORCAMENTO = [
  'Este orçamento é válido por 30 dias a partir da data de emissão',
  'Sujeito a confirmação das condições no momento da contratação',
  'Pode sofrer alterações mediante apresentação de novo orçamento',
  'Obrigado pela confiança!'
];

// Mesma página em HTML (visualizador dentro do app)
function buildBudgetHTML(b, client, company, today, validade, statusLabel){
  const itens = b.items || [];
  return `
    <div class="doc-header">
      <div class="doc-title">ORÇAMENTO Nº ${b.id}</div>
      <img class="doc-logo" src="${logoDataUrl()}" alt="logo">
    </div>
    <hr class="doc-rule">
    <div class="doc-section">
      <div class="doc-section-title">Dados da empresa</div>
      <div class="doc-line"><b>${esc(company.name) || '—'}</b></div>
      ${company.email ? `<div class="doc-line">Email: ${esc(company.email)}</div>` : ''}
      ${company.phone ? `<div class="doc-line">Telefone: ${esc(company.phone)}</div>` : ''}
      ${company.cnpj ? `<div class="doc-line">CNPJ/CPF: ${esc(company.cnpj)}</div>` : ''}
      ${company.address ? `<div class="doc-line">${esc(company.address)}</div>` : ''}
    </div>
    <div class="doc-section">
      <div class="doc-section-title">Dados do cliente</div>
      <div class="doc-line">Nome: <b>${esc(client ? client.name : 'Cliente removido')}</b></div>
      ${client && client.phone ? `<div class="doc-line">Telefone: ${esc(client.phone)}</div>` : ''}
      ${client && client.address ? `<div class="doc-line">Endereço: ${esc(client.address)}</div>` : ''}
    </div>
    <div class="doc-section">
      <div class="doc-section-title">Informações do orçamento</div>
      <div class="doc-line">Data de Emissão: ${fmtDatePt(today)}</div>
      <div class="doc-line">Validade: ${fmtDatePt(validade)}</div>
      <div class="doc-line">Status: ${statusLabel}</div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">Descrição do serviço</div>
      <div class="doc-service-title">${esc(b.title)}</div>
      <div class="doc-service-desc">${esc(b.description)}</div>
    </div>
    ${itens.length ? `<div class="doc-section"><div class="doc-section-title">Materiais previstos</div>
      ${itens.map(i => `<div class="doc-line">${esc(i.qty)} ${esc(i.unit)} · ${esc(i.name)} — ${fmtMoney(i.qty * i.price)}</div>`).join('')}</div>` : ''}
    <div class="doc-value-box">
      <span class="doc-value-label">VALOR DO ORÇAMENTO</span>
      <span class="doc-value-amount">${fmtMoney(b.amount)}</span>
    </div>
    <div class="doc-obs"><b>OBSERVAÇÕES</b><br>${OBS_ORCAMENTO.map(t => '• ' + t).join('<br>')}</div>
    <div class="doc-sign">
      <div class="doc-sign-line">Téc. Responsável</div>
      <div class="doc-sign-line">Cliente</div>
    </div>`;
}

/* ===================== TELA DE ARQUIVOS ===================== */
function renderArchive(){
  const el = document.getElementById('view-archive');
  const items = DOCS.items || [];
  el.innerHTML = `
    <div class="section-title">Documentos salvos</div>
    <div class="list">
      ${items.length ? items.map(docItem).join('') : emptyState('Nenhum PDF ainda', 'Gere um PDF de orçamento ou uma ficha de inspeção pra ele aparecer aqui.')}
    </div>`;
  el.querySelectorAll('[data-open-doc]').forEach(b => b.onclick = () => openDocViewer(Number(b.dataset.openDoc)));
  el.querySelectorAll('[data-del-doc]').forEach(b => b.onclick = () => {
    if(!confirm('Excluir este PDF salvo?')) return;
    DOCS.items = DOCS.items.filter(d => d.id !== Number(b.dataset.delDoc));
    saveDocs(); renderArchive(); toast('PDF excluído');
  });
}
function docItem(d){
  return `
    <div class="card">
      <div class="card-top"><div>
        <div class="card-title">${esc(d.title)}</div>
        <div class="card-sub">${esc(d.clientName)} · ${fmtDate(d.createdAt.slice(0, 10))}</div>
      </div></div>
      <div class="card-meta">
        <span class="card-sub">${esc(d.filename)}</span>
        <div class="card-actions">
          <button class="mini-btn edit" data-open-doc="${d.id}">Abrir</button>
          <button class="mini-btn danger" data-del-doc="${d.id}">Excluir</button>
        </div>
      </div>
    </div>`;
}
function openDocViewer(id){
  const d = DOCS.items.find(x => x.id === id);
  if(!d) return;
  const overlay = document.createElement('div');
  overlay.className = 'pdf-overlay';
  overlay.innerHTML = `
    <div class="pdf-overlay-bar">
      <span class="pdf-overlay-title">${esc(d.filename)}</span>
      <button class="pdf-overlay-close" id="pdfCloseBtn" type="button">Fechar</button>
    </div>
    <div class="pdf-overlay-actions">
      <button class="btn-primary" id="shareDocBtn" type="button" style="margin-top:0;">📤 Compartilhar / WhatsApp</button>
      <a class="btn-secondary" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box;" href="${d.dataUrl}" download="${esc(d.filename)}">Baixar arquivo PDF</a>
    </div>
    <div class="doc-page">${d.html || '<p>Não foi possível carregar este documento.</p>'}</div>`;
  document.body.appendChild(overlay);
  document.getElementById('pdfCloseBtn').onclick = () => overlay.remove();
  document.getElementById('shareDocBtn').onclick = () => shareDoc(d);
}
function dataUrlToBlob(dataUrl){
  const i = dataUrl.indexOf(',');
  const mime = (dataUrl.slice(0, i).match(/data:(.*?);base64/) || [])[1] || 'application/pdf';
  const bin = atob(dataUrl.slice(i + 1));
  const bytes = new Uint8Array(bin.length);
  for(let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  return new Blob([bytes], { type: mime });
}
function withTimeout(promise, ms){
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
async function shareDoc(d){
  try{
    if(!navigator.share){ toast('Compartilhamento não suportado aqui — use "Baixar arquivo PDF"'); return; }
    const file = new File([dataUrlToBlob(d.dataUrl)], d.filename, { type: 'application/pdf' });
    if(navigator.canShare && !navigator.canShare({ files: [file] })){ toast('Este navegador não compartilha arquivos direto — use "Baixar"'); return; }
    await withTimeout(navigator.share({ files: [file], title: d.filename }), 8000);
  }catch(e){
    if(e && e.name === 'AbortError') return;
    toast('Compartilhar não funcionou aqui — use "Baixar arquivo PDF"');
  }
}
