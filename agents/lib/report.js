// lib/report.js
// Gerador de relatório técnico de UX em Markdown

import { writeFileSync } from 'fs';
import { getMetricas, getBugs, getAtritos } from './logger.js';

export function gerarRelatorio(outputPath, contexto = {}) {
  const metricas  = getMetricas();
  const bugs      = getBugs();
  const atritos   = getAtritos();
  const agora     = new Date().toISOString();

  // ── Estatísticas gerais ──────────────────────────────────────
  const totalAcoes  = metricas.length;
  const acoesBem    = metricas.filter(m => m.sucesso).length;
  const acoesFalha  = totalAcoes - acoesBem;
  const duracaoMedia = totalAcoes
    ? Math.round(metricas.reduce((s, m) => s + (m.duracao_ms || 0), 0) / totalAcoes)
    : 0;

  const realtimeMetricas = metricas.filter(m => m.realtime_delay_ms != null);
  const realtimeMedia = realtimeMetricas.length
    ? Math.round(realtimeMetricas.reduce((s, m) => s + m.realtime_delay_ms, 0) / realtimeMetricas.length)
    : null;

  // ── Agrupa bugs por severidade ───────────────────────────────
  const bugsAgrupados = {
    critico:  bugs.filter(b => b.severidade === 'critico'),
    moderado: bugs.filter(b => b.severidade === 'moderado'),
    menor:    bugs.filter(b => b.severidade === 'menor'),
  };

  // ── Agrupa métricas por área ─────────────────────────────────
  const porArea = {};
  for (const m of metricas) {
    const area = _areaDeAcao(m.acao);
    if (!porArea[area]) porArea[area] = { total: 0, falhas: 0, duracoes: [] };
    porArea[area].total++;
    if (!m.sucesso) porArea[area].falhas++;
    if (m.duracao_ms) porArea[area].duracoes.push(m.duracao_ms);
  }

  // ── Nota geral de UX ─────────────────────────────────────────
  let nota = 5;
  nota -= bugsAgrupados.critico.length * 1.0;
  nota -= bugsAgrupados.moderado.length * 0.3;
  nota -= bugsAgrupados.menor.length * 0.1;
  nota -= atritos.filter(a => a.impacto === 'alto').length * 0.2;
  nota -= atritos.filter(a => a.impacto === 'medio').length * 0.1;
  nota = Math.max(1, Math.min(5, nota));
  const estrelas = '⭐'.repeat(Math.round(nota)) + '☆'.repeat(5 - Math.round(nota));

  // ── Monta Markdown ───────────────────────────────────────────
  let md = `# Relatório Técnico de UX — RPG Hub\n\n`;
  md += `**Data:** ${agora}\n`;
  md += `**Campanha simulada:** ${contexto.campanha || 'Agentes - A Cripta Maldita'}\n`;
  md += `**Rodadas de combate:** ${contexto.rodadas || '5'}\n`;
  md += `**Participantes simulados:** Mestre (TV), Jogador 1 (desktop), Jogador 2 (mobile), Jogador 3 (mobile + pet)\n\n`;
  md += `---\n\n`;

  // Resumo executivo
  md += `## Resumo Executivo\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| Ações simuladas | ${totalAcoes} |\n`;
  md += `| Ações bem-sucedidas | ${acoesBem} (${totalAcoes ? Math.round(acoesBem/totalAcoes*100) : 0}%) |\n`;
  md += `| Ações com falha | ${acoesFalha} |\n`;
  md += `| Tempo médio por ação | ${duracaoMedia}ms |\n`;
  if (realtimeMedia != null) md += `| Delay médio realtime | ${realtimeMedia}ms |\n`;
  md += `| Bugs críticos | ${bugsAgrupados.critico.length} |\n`;
  md += `| Bugs moderados | ${bugsAgrupados.moderado.length} |\n`;
  md += `| Bugs menores | ${bugsAgrupados.menor.length} |\n`;
  md += `| Pontos de atrito UX | ${atritos.length} |\n`;
  md += `| **Nota UX geral** | **${estrelas} (${nota.toFixed(1)}/5)** |\n\n`;

  // Bugs encontrados
  md += `## 🐛 Bugs Encontrados\n\n`;
  if (bugs.length === 0) {
    md += `> Nenhum bug detectado nas áreas testadas. ✅\n\n`;
  } else {
    if (bugsAgrupados.critico.length) {
      md += `### 🔴 Críticos (impedem o jogo)\n\n`;
      for (const b of bugsAgrupados.critico) md += _formatBug(b);
    }
    if (bugsAgrupados.moderado.length) {
      md += `### 🟡 Moderados (causam confusão)\n\n`;
      for (const b of bugsAgrupados.moderado) md += _formatBug(b);
    }
    if (bugsAgrupados.menor.length) {
      md += `### 🟢 Menores (polimento)\n\n`;
      for (const b of bugsAgrupados.menor) md += _formatBug(b);
    }
  }

  // Atrito de UX
  md += `## ⚠ Pontos de Atrito de UX\n\n`;
  if (atritos.length === 0) {
    md += `> Nenhum atrito de UX significativo encontrado. ✅\n\n`;
  } else {
    const ordemImpacto = { alto: 0, medio: 1, baixo: 2 };
    const sorted = [...atritos].sort((a, b) => ordemImpacto[a.impacto] - ordemImpacto[b.impacto]);
    for (const a of sorted) {
      const emoji = a.impacto === 'alto' ? '🔴' : a.impacto === 'medio' ? '🟡' : '🟢';
      md += `#### ${emoji} [${a.impacto.toUpperCase()}] ${a.descricao}\n`;
      md += `- **Agente:** ${a.agente} | **Detectado em:** ${a.ts}\n`;
      if (a.sugestao) md += `- **Sugestão:** ${a.sugestao}\n`;
      md += '\n';
    }
  }

  // Análise por área
  md += `## 📊 Análise por Área\n\n`;
  md += `| Área | Ações | Falhas | Tempo Médio |\n|---|---|---|---|\n`;
  for (const [area, dados] of Object.entries(porArea)) {
    const med = dados.duracoes.length
      ? Math.round(dados.duracoes.reduce((a, b) => a + b, 0) / dados.duracoes.length)
      : '—';
    md += `| ${area} | ${dados.total} | ${dados.falhas} | ${med}ms |\n`;
  }
  md += '\n';

  // Cenários testados
  md += `## ✅ Cenários Testados\n\n`;
  md += _cenarioChecklist(metricas, bugs);

  // Recomendações
  md += `## 💡 Recomendações Prioritárias\n\n`;
  md += _gerarRecomendacoes(bugsAgrupados, atritos, porArea);

  // Log detalhado
  md += `## 📋 Log de Ações Detalhado\n\n`;
  md += `<details>\n<summary>Expandir log completo (${totalAcoes} ações)</summary>\n\n`;
  md += `| Timestamp | Agente | Dispositivo | Ação | Duração | Sucesso | Erro |\n`;
  md += `|---|---|---|---|---|---|---|\n`;
  for (const m of metricas) {
    md += `| ${m.ts.slice(11,19)} | ${m.agente} | ${m.dispositivo} | ${m.acao} | ${m.duracao_ms || '—'}ms | ${m.sucesso ? '✅' : '❌'} | ${m.erro || ''} |\n`;
  }
  md += `\n</details>\n`;

  writeFileSync(outputPath, md, 'utf8');
  return { nota, bugs: bugs.length, atritos: atritos.length, acoes: totalAcoes };
}

function _formatBug(b) {
  let s = `#### [${b.id}] ${b.descricao}\n`;
  s += `- **Agente:** ${b.agente} | **Detectado em:** ${b.ts}\n`;
  if (b.dados && Object.keys(b.dados).length) {
    s += `- **Dados:** \`${JSON.stringify(b.dados)}\`\n`;
  }
  s += '\n';
  return s;
}

function _areaDeAcao(acao) {
  if (!acao) return 'Geral';
  const a = acao.toLowerCase();
  if (a.includes('login') || a.includes('auth')) return 'Autenticação';
  if (a.includes('campanha') || a.includes('setup')) return 'Setup';
  if (a.includes('batalha') || a.includes('combat') || a.includes('iniciativa')) return 'Combate';
  if (a.includes('ataque') || a.includes('dano') || a.includes('skill')) return 'Sistema de Ataque';
  if (a.includes('token') || a.includes('mapa') || a.includes('movimento')) return 'VTT / Mapa';
  if (a.includes('pet') || a.includes('sombra')) return 'Sistema de Pet';
  if (a.includes('npc') || a.includes('vorn') || a.includes('lobo')) return 'NPCs';
  if (a.includes('chat') || a.includes('mensagem')) return 'Chat';
  if (a.includes('item') || a.includes('inventario') || a.includes('poção')) return 'Inventário';
  if (a.includes('mobile') || a.includes('controle') || a.includes('dpad')) return 'Mobile Controller';
  if (a.includes('nivel') || a.includes('xp') || a.includes('level')) return 'Progressão';
  if (a.includes('criativo') || a.includes('creative')) return 'Ação Criativa';
  return 'Geral';
}

function _cenarioChecklist(metricas, bugs) {
  const acoes = new Set(metricas.map(m => m.acao));
  const temBug = (id) => bugs.some(b => b.id === id);

  const cenarios = [
    ['Setup de campanha e personagens', acoes.has('criar_campanha')],
    ['Login de múltiplos agentes', acoes.has('login_mestre')],
    ['Posicionamento de tokens no mapa', acoes.has('mover_token')],
    ['Iniciativa e ordem de turnos', acoes.has('rolar_iniciativa')],
    ['Ataque e cálculo de dano', acoes.has('executar_ataque')],
    ['Sistema de pet (turno compartilhado)', acoes.has('pet_ataque')],
    ['Ação criativa com aprovação do GM', acoes.has('submeter_criativo')],
    ['Mobile controller mode (D-pad)', acoes.has('mobile_mover')],
    ['NPC controlado pelo mestre', acoes.has('npc_atacar')],
    ['Death saves / personagem a 0 HP', acoes.has('death_save')],
    ['Uso de item consumível', acoes.has('usar_item')],
    ['Encerramento de batalha', acoes.has('encerrar_batalha')],
    ['Distribuição de XP', acoes.has('distribuir_xp')],
    ['Level up de personagem', acoes.has('level_up')],
    ['Chat entre jogadores', acoes.has('chat_mensagem')],
  ];

  let md = '';
  for (const [desc, feito] of cenarios) {
    md += `- ${feito ? '✅' : '⬜'} ${desc}\n`;
  }
  return md + '\n';
}

function _gerarRecomendacoes(bugsAgrupados, atritos, porArea) {
  const recs = [];
  let i = 1;

  for (const b of bugsAgrupados.critico) {
    recs.push(`${i++}. 🔴 **[URGENTE]** Corrigir bug \`${b.id}\`: ${b.descricao}`);
  }
  for (const b of bugsAgrupados.moderado) {
    recs.push(`${i++}. 🟡 Corrigir bug \`${b.id}\`: ${b.descricao}`);
  }
  for (const a of atritos.filter(x => x.impacto === 'alto')) {
    recs.push(`${i++}. 🔴 **[UX]** ${a.descricao}${a.sugestao ? ' — ' + a.sugestao : ''}`);
  }
  for (const a of atritos.filter(x => x.impacto === 'medio')) {
    recs.push(`${i++}. 🟡 **[UX]** ${a.descricao}${a.sugestao ? ' — ' + a.sugestao : ''}`);
  }

  // Áreas com alta taxa de falha
  for (const [area, dados] of Object.entries(porArea)) {
    if (dados.total >= 3 && dados.falhas / dados.total > 0.3) {
      recs.push(`${i++}. 📊 **[Estabilidade]** Área "${area}" tem ${Math.round(dados.falhas/dados.total*100)}% de taxa de falha — investigar`);
    }
  }

  if (recs.length === 0) recs.push('1. Sistema demonstrou estabilidade nos cenários testados. Considerar adicionar testes de carga.');

  return recs.join('\n') + '\n\n';
}
