/* ==========================================================
   calculos.js — funções puras de cálculo (sem tocar no DOM)
   BTU, dimensionamento de cabos e conversão do preço do cobre.
   ========================================================== */

// Capacidades comerciais de ar-condicionado (BTU/h)
const BTU_COMERCIAIS = [7000, 9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000];
const LB_PARA_KG = 2.20462;   // 1 kg = 2,20462 lb

/* ----- Cobre: US$/lb  ->  R$/kg ----- */
function cobreBRLporKg(usdPorLb, usdBrl){
  return usdPorLb * LB_PARA_KG * usdBrl;
}

/* ----- BTU -----
   base      = área × (700 [+100 se sol da tarde])
   pessoas   = +700 a cada 2 pessoas completas (3 pessoas = 1 bloco)
   equip     = nº de equipamentos × 600
   recomendado = primeira capacidade comercial >= total (arredonda pra cima) */
function calcularBTU({ area, pessoas, equip, sol }, cfg){
  const porM2 = cfg.btuM2 + (sol ? cfg.btuSol : 0);
  const base = area * porM2;
  const blocos = Math.floor(pessoas / 2);
  const dePessoas = blocos * cfg.btuPessoas;
  const deEquip = equip * cfg.btuEquip;
  const total = base + dePessoas + deEquip;
  const comercial = BTU_COMERCIAIS.find(c => c >= total) || null;   // null = acima de 60.000
  return { porM2, base, dePessoas, deEquip, total, comercial };
}

/* Corrente aproximada de um ar-condicionado (estimativa!): potência elétrica ≈ BTU × 0,293 / COP */
function correnteAC(btu, tensao, cfg){
  const watts = btu * 0.293 / (cfg.cop || 3);
  return { watts, amperes: watts / tensao };
}

/* ----- Cabos -----
   Entrada: corrente (A), tensão (V), distância (m), fases (1 ou 3),
            tipo de circuito, nº de circuitos agrupados no mesmo eletroduto.
   Regra: Ib <= In (disjuntor) <= Iz (capacidade do cabo × fator de agrupamento),
          queda de tensão <= limite, seção >= mínima do tipo (1,5 iluminação; 2,5 tomadas). */
function dimensionarCabo({ corrente, tensao, distancia, fases, tipo, agrupados }){
  const fator = CABOS.agrupamento[Math.min(Math.max(agrupados || 1, 1), 6)];
  const disjuntor = CABOS.disjuntores.find(d => d >= corrente);
  if(!disjuntor) return { erro: 'Corrente acima de 100 A: fora do alcance desta tabela. Consulte um projeto.' };
  const minimo = CABOS.minimos[tipo] || 1.5;
  const k = fases === 3 ? Math.sqrt(3) : 2;   // trifásico: √3 · mono/bifásico: 2 (ida e volta)

  for(const [secao, iMax] of CABOS.secoes){
    if(secao < minimo) continue;
    const iz = iMax * fator;
    if(iz < disjuntor) continue;                       // cabo precisa suportar o disjuntor
    const queda = (k * CABOS.resistividade * distancia * corrente) / (secao * tensao) * 100;
    if(queda > CABOS.limiteQuedaPct) continue;         // queda de tensão alta: sobe a bitola
    return { secao, disjuntor, iz, fator, queda, minimo };
  }
  return { erro: 'Nenhuma bitola da tabela atende (corrente alta ou distância grande). Consulte um projeto.' };
}

/* Preço de materiais: soma qtd × preço */
function totalMateriais(itens){
  return itens.reduce((soma, i) => soma + Number(i.qty || 0) * Number(i.price || 0), 0);
}
