# Minha Oficina

Sistema de gestão para eletricistas e instaladores de ar-condicionado: clientes, serviços, orçamentos em PDF, materiais, cálculos técnicos (BTU e cabos), levantamentos e ficha de inspeção técnica.
Projeto da disciplina Desenvolvimento Web I.

SPA em HTML5 + CSS3 + JavaScript ES6 puro, sem frameworks. Dados no `localStorage`.
Empresa: F.Moraes Instalações e Climatização — Corbélia/PR.

## Como abrir
Dê dois cliques em `index.html` (ou publique a pasta no GitHub Pages). Não precisa instalar nada.

## Estrutura
```
index.html            estrutura semântica (header, main, section, form, footer)
css/style.css         estilos, :hover, Grid/Flexbox, @media
libs/jspdf.umd.min.js gerador de PDF (local)
js/seed.js, logo.js   dados de exemplo e logo (base64)
js/cabos-dados.js     tabela de cabos de cobre (com fonte registrada)
js/utils.js           formatação, toast, openForm (form + submit + preventDefault)
js/storage.js         localStorage + JSON.stringify/parse + cache de APIs
js/calculos.js        BTU, cabos, conversão do cobre (funções puras)
js/api.js             fetch: ViaCEP, Open-Meteo, AwesomeAPI, cobre
js/pdf.js             PDF do orçamento e tela de Arquivos (Documentos salvos)
js/telas-base.js      Painel, Clientes, Serviços, Orçamentos, Empresa, Backup
js/telas-tecnico.js   Materiais, BTU, Cabos, Levantamentos
js/inspecao.js        Ficha de inspeção técnica: locais, aparelhos, inspeções e PDF
js/script.js          navegação e inicialização
```

## Requisitos da atividade
| Requisito | Onde |
|---|---|
| Tags semânticas | `index.html` |
| `<form>` + `submit` + `preventDefault()` | `openForm` em `utils.js` e formulários das calculadoras |
| Validação nativa (required, email, number, min/max, pattern) | todos os formulários |
| CRUD completo | Clientes, Serviços, Orçamentos, Materiais, Levantamentos, Fichas de inspeção (fichas, aparelhos e inspeções) |
| Array methods | `filter`, `map`, `reduce`, `forEach`, `find`, `sort` em todo o código |
| ID único | `DB.nextId.*` (contador por entidade) |
| localStorage + JSON | `storage.js` |
| API externa (bônus) | ViaCEP no cadastro de cliente; clima; dólar; cobre |
| `:hover` com cores diferentes | Editar (azul) · Excluir (vermelho) · Concluir (verde) |
| Responsivo | Grid/Flexbox + `@media` (700px e 1100px) |

## Ficha de inspeção técnica (Técnico → 📝 Inspeção)
Registro das inspeções e manutenções preventivas de ar-condicionado, preenchido pelo celular e impresso em PDF.
1. **Ficha**: cliente, local, área, ocupantes, data de início e o técnico responsável (nome e qualificação), que assina a ficha.
2. **Aparelhos**: código da etiqueta (AC-01, AC-02...), ambiente, tipo, BTU, fluido, marca/modelo/série.
3. **Inspeção** (no celular): periodicidade mensal/trimestral/semestral/anual, checklist dos itens daquela periodicidade, medições (tensão, corrente, temperaturas) e observações.
4. **Gerar PDF**: identificação do local, técnico e empresa, equipamentos, itens de inspeção, cronograma recomendado de 12 meses (com os meses já realizados), registro das inspeções, orientações em caso de falha, declaração e assinaturas do técnico e do cliente. Fica salvo em *Arquivos* para abrir, compartilhar ou imprimir.

Cada aparelho mostra a situação da inspeção mensal (em dia, vence em X dias, vencida, sem inspeção). Excluir uma ficha apaga também os aparelhos e as inspeções dela (com confirmação).

> **Não é PMOC.** O PMOC exigido pela Lei 13.589/2018 para ambientes de uso público e coletivo precisa de responsável técnico habilitado com ART/TRT. A ficha registra o serviço feito pelo técnico e deixa esse aviso escrito no próprio PDF.

## APIs
- **ViaCEP** — CEP → endereço (sem chave).
- **Open-Meteo** — clima e previsão 7 dias (sem chave). Uso gratuito é para fins **não comerciais**; para uso comercial da empresa, veja os termos em open-meteo.com. Atribuição está no rodapé.
- **AwesomeAPI** — dólar USD-BRL (sem chave, cache de 1 min no servidor).
- **Cobre (MetalCharts, símbolo HG, US$/lb)** — precisa de chave. Cole em *Empresa → Cobre, clima e BTU*. A chave fica só no navegador (não vai pro GitHub). Sem chave, usa o último valor salvo ou o preço manual em R$/kg.
  Conversão: `R$/kg = US$/lb × 2,20462 × dólar`.
- Todas usam **cache de 1 hora** e voltam ao último valor salvo se estiver sem internet.

## Pontos para conferir (honestidade técnica)
1. O formato exato da resposta da API de cobre **não foi confirmado** (a documentação bloqueia leitura automática). Se com a sua chave o preço não aparecer, ajuste `extrairPrecoCobre` em `js/api.js`. O preço é de bolsa (COMEX), não o do balcão.
2. A **tabela de cabos** (`js/cabos-dados.js`) segue a NBR 5410 (método B1, PVC 70 °C) de memória de fonte técnica — **confira na norma ou no catálogo do fabricante**. É apoio/estimativa, não projeto.
3. Regras de BTU: 700 BTU/m² + 700 a cada 2 pessoas (regra informada) + 600 por equipamento + 100/m² com sol da tarde. Tudo editável em *Empresa*. O resultado é **estimativa**.
4. Corrente do ar-condicionado é estimada (BTU × 0,293 ÷ COP 3). Confira na placa do aparelho.

## Segurança dos dados
- Nenhuma chave de API fica no código. A chave do cobre é colada em *Empresa* e fica só no navegador.
- O `.gitignore` impede que backups (`backup_*.json`, que têm clientes e a chave) e arquivos `.env` entrem no repositório.
- Os clientes do repositório são fictícios (`js/seed.js`).

## Dados antigos
As chaves do localStorage são as mesmas do app anterior (`fmoraes-painel-db`, `fmoraes-painel-docs`), então clientes, serviços, orçamentos e PDFs já salvos continuam aparecendo. Faça um backup (Empresa → Baixar backup) antes de trocar a versão.

## Histórico de commits
1. `estrutura HTML semântica, estilos e gerador de PDF`
2. `localStorage, utilitários e navegação`
3. `CRUD de clientes, serviços e orçamentos com PDF`
4. `calculadoras de BTU e cabos, levantamentos e APIs`
5. `adiciona ficha de inspeção técnica com PDF`
6. `adiciona README e .gitignore`
