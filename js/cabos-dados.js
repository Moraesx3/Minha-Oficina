/* ==========================================================
   cabos-dados.js — Tabela local de cabos de cobre (consulta de fiação)
   Não existe API pública para isso, então a tabela fica aqui.

   FONTE (referência): ABNT NBR 5410, Tabela 36 — condutores de cobre,
   isolação PVC 70 °C, método de instalação B1 (eletroduto em parede),
   3 condutores carregados, temperatura ambiente 30 °C.
   Fatores de agrupamento: NBR 5410, Tabela 42 (arredondados).
   ⚠ CONFIRA com a norma/catálogo do fabricante antes de usar em obra.
   Esta tabela é apoio de estudo/estimativa, não substitui projeto.
   ========================================================== */
const CABOS = {
  fonte: 'NBR 5410 Tab. 36 (B1, PVC 70°C, 3 condutores carregados, Cu) — conferir com a norma',
  resistividade: 0.0225,                 // ohm·mm²/m do cobre a 70 °C
  limiteQuedaPct: 4,                     // % máx. usada no dimensionamento (NBR 5410: 4% em circuitos terminais)
  secoes: [                              // [seção mm², corrente máx. A]
    [1.5, 15.5], [2.5, 21], [4, 28], [6, 36], [10, 50], [16, 68], [25, 89], [35, 110]
  ],
  disjuntores: [10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100],
  agrupamento: { 1: 1.0, 2: 0.80, 3: 0.70, 4: 0.65, 5: 0.60, 6: 0.57 },
  minimos: { iluminacao: 1.5, tomadas: 2.5, ac: 2.5, outro: 1.5 }   // seção mínima por tipo de circuito
};
