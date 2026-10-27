/* ==========================================================
   utils.js — funções utilitárias (formatação, toast, escape, sheet/form)
   ========================================================== */

// Formata número como moeda brasileira
function fmtMoney(v){
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// Formata número com casas decimais (pt-BR)
function fmtNum(v, casas = 2){
  return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function fmtDate(d){
  if(!d) return '—';
  const date = new Date(d.length <= 10 ? d + 'T12:00:00' : d);
  if(isNaN(date)) return d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function addDays(dateStr, days){
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d;
}
function fmtDatePt(d){
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function hojeISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Escapa texto antes de colocar em innerHTML (evita injeção de HTML)
function esc(s){
  return (s == null ? '' : s).toString().replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Mensagem rápida na parte de baixo da tela
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function emptyState(title, sub){
  return `<div class="empty"><b>${esc(title)}</b>${esc(sub)}</div>`;
}

/* ---------- Janela deslizante (sheet) com <form> de verdade ----------
   openForm monta um <form>, liga o evento "submit" com preventDefault()
   e só chama onSubmit se a validação nativa do HTML5 passar
   (required, type=email, type=number, min/max, pattern...). */
function openForm(html, onSubmit){
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = '<div class="sheet-handle"></div><form id="sheetForm">' + html + '</form>';
  document.getElementById('overlay').classList.add('active');
  const form = document.getElementById('sheetForm');
  form.addEventListener('submit', (event) => {
    event.preventDefault();               // não recarrega a página
    onSubmit(new FormData(form), form);   // dados do formulário
  });
  const cancel = form.querySelector('[data-cancel]');
  if(cancel) cancel.addEventListener('click', closeSheet);
  return form;
}
function closeSheet(){
  document.getElementById('overlay').classList.remove('active');
}
document.getElementById('overlay').addEventListener('click', (e) => {
  if(e.target.id === 'overlay') closeSheet();
});

// Botões segmentados (status): guardam o valor num input hidden
function bindSeg(form, name){
  const seg = form.querySelector('.seg[data-seg="' + name + '"]');
  const hidden = form.querySelector('input[name="' + name + '"]');
  seg.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      hidden.value = btn.dataset.v;
      seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}
function segHTML(name, value, options){
  return `<div class="seg" data-seg="${name}">` +
    options.map(o => `<button type="button" data-v="${o.v}" class="${value === o.v ? 'active' : ''}">${o.l}</button>`).join('') +
    `</div><input type="hidden" name="${name}" value="${esc(value)}">`;
}
