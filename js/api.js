/* ==========================================================
   api.js — consumo de APIs públicas com fetch()
   - ViaCEP (CEP -> endereço)                  sem chave
   - Open-Meteo (clima)                         sem chave
   - AwesomeAPI (dólar USD-BRL)                 sem chave
   - Cobre (MetalCharts)                        precisa de "Chave da API" (opcional)
   Todas têm: tempo limite, cache de 1 hora no localStorage e fallback
   para o último valor salvo (o app nunca quebra se estiver sem internet).
   ========================================================== */
const UMA_HORA = 60 * 60 * 1000;

// fetch com tempo limite (8 s) que devolve JSON ou lança erro
async function buscarJSON(url, opcoes = {}){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try{
    const resp = await fetch(url, { ...opcoes, signal: ctrl.signal });
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.json();
  } finally { clearTimeout(timer); }
}

/* ---------- ViaCEP ---------- */
async function buscarCEP(cep){
  const limpo = String(cep).replace(/\D/g, '');
  if(limpo.length !== 8) throw new Error('CEP deve ter 8 dígitos');
  const dados = await buscarJSON(`https://viacep.com.br/ws/${limpo}/json/`);
  if(dados.erro) throw new Error('CEP não encontrado');
  return dados;   // { logradouro, bairro, localidade, uf, ... }
}

/* ---------- Clima (Open-Meteo) ----------
   Retorna { cidade, dias:[{data,tmax,tmin,chuva,vento}], t, origem } ou null */
async function obterClima(forcar = false){
  const cidade = DB.settings.cidade || 'Corbélia';
  const chave = 'clima:' + cidade.toLowerCase();
  const c = cacheGet(chave);
  if(c && !forcar && Date.now() - c.t < UMA_HORA) return { ...c.v, t: c.t, origem: 'cache' };
  try{
    const geo = await buscarJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`);
    if(!geo.results || !geo.results.length) throw new Error('cidade não encontrada');
    const { latitude, longitude, name } = geo.results[0];
    const f = await buscarJSON(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=7`);
    const d = f.daily;
    const dias = d.time.map((data, i) => ({
      data, tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i],
      chuva: d.precipitation_probability_max[i], vento: d.wind_speed_10m_max[i]
    }));
    const v = { cidade: name, dias };
    cacheSet(chave, v);
    return { ...v, t: Date.now(), origem: 'api' };
  }catch(e){
    if(c) return { ...c.v, t: c.t, origem: 'cache-antigo' };   // fallback: último valor salvo
    return null;
  }
}

// Há risco de chuva ou vento forte no dia? (regra do alerta de serviços)
function climaDoDia(clima, dataISO){
  if(!clima) return null;
  return clima.dias.find(d => d.data === dataISO) || null;
}
function alertaClima(dia){
  if(!dia) return '';
  const motivos = [];
  if(dia.chuva >= 60) motivos.push('chuva ' + dia.chuva + '%');
  if(dia.vento >= 25) motivos.push('vento ' + Math.round(dia.vento) + ' km/h');
  return motivos.join(' · ');
}

/* ---------- Dólar (AwesomeAPI) ---------- */
async function obterDolar(forcar = false){
  const c = cacheGet('dolar');
  if(c && !forcar && Date.now() - c.t < UMA_HORA) return { ...c.v, t: c.t, origem: 'cache' };
  try{
    const j = await buscarJSON('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const q = j.USDBRL;
    const v = { bid: parseFloat(q.bid), pct: parseFloat(q.pctChange), data: q.create_date };
    if(!(v.bid > 0)) throw new Error('resposta inválida');
    cacheSet('dolar', v);
    return { ...v, t: Date.now(), origem: 'api' };
  }catch(e){
    if(c) return { ...c.v, t: c.t, origem: 'cache-antigo' };
    return null;
  }
}

/* ---------- Cobre ----------
   Provedor: MetalCharts (cobre = símbolo HG, em US$ por libra).
   ⚠ Formato da resposta NÃO foi confirmado na documentação oficial
   (o site bloqueia leitura automática). Por isso o leitor abaixo aceita
   alguns formatos comuns. Se a sua chave responder diferente, ajuste aqui.
   Retorna { usdLb, dolar, brlKg, t, origem } ou null. */
function extrairPrecoCobre(j){
  const tentativas = [
    j && j.data && j.data.HG && j.data.HG.price,
    j && j.HG && j.HG.price,
    j && j.prices && j.prices.HG && (j.prices.HG.price || j.prices.HG),
    j && j.data && j.data.HG,
    j && j.HG
  ];
  const achado = tentativas.find(v => typeof v === 'number' && v > 0);
  return achado || null;
}
async function obterCobre(forcar = false){
  const dolar = await obterDolar(forcar);
  const chaveAPI = (DB.settings.chaveCobre || '').trim();
  const c = cacheGet('cobre');
  const montar = (usdLb, origem, t) => ({
    usdLb, dolar: dolar ? dolar.bid : null,
    brlKg: dolar ? cobreBRLporKg(usdLb, dolar.bid) : null, t, origem
  });

  if(c && !forcar && Date.now() - c.t < UMA_HORA && dolar) return montar(c.v.usdLb, 'cache', c.t);

  if(chaveAPI){
    try{
      const j = await buscarJSON('https://api.metalcharts.org/v1/prices', { headers: { Authorization: 'Bearer ' + chaveAPI } });
      const usdLb = extrairPrecoCobre(j);
      if(!usdLb) throw new Error('formato inesperado');
      cacheSet('cobre', { usdLb });
      return montar(usdLb, 'api', Date.now());
    }catch(e){ /* cai no último valor salvo / manual */ }
  }
  if(c && dolar) return montar(c.v.usdLb, 'cache-antigo', c.t);

  // Sem API: usa o preço manual (R$/kg) digitado nas configurações
  if(DB.settings.cobreManual > 0){
    return { usdLb: null, dolar: dolar ? dolar.bid : null, brlKg: DB.settings.cobreManual, t: null, origem: 'manual' };
  }
  return null;
}
