let uiTimer = 0;
const UI_INTERVAL = 0.1; // 100ms마다 DOM 갱신

function initUI() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      renderActiveTab();
    });
  });
}

function updateUI(dt) {
  uiTimer += dt;
  if (uiTimer < UI_INTERVAL) return;
  uiTimer = 0;
  updateHUD();
  renderActiveTab();
}

function updateHUD() {
  const s = gameState;
  const stage = STAGES[s.currentStage];
  document.getElementById('hud-gold').textContent     = `골드: ${s.gold.toLocaleString()}`;
  document.getElementById('hud-gems').textContent     = `젬: ${s.gems.toLocaleString()}`;
  document.getElementById('hud-stage').textContent    = `스테이지: ${stage.name}`;
  document.getElementById('hud-progress').textContent = `처치: ${s.stageKills} / ${stage.killsToAdvance}`;
}

function renderActiveTab() {
  const activeBtn = document.querySelector('.tab-btn.active');
  if (!activeBtn) return;
  const tab = activeBtn.dataset.tab;
  if (tab === 'characters') renderCharacterTab();
  else if (tab === 'stats')  renderStatsTab();
}

// ── 캐릭터 탭 ──────────────────────────────────────────────
function renderCharacterTab() {
  const el = document.getElementById('tab-characters');
  if (gameState.characters.length === 0) {
    el.innerHTML = '<p style="color:#888">캐릭터가 없습니다.</p>';
    return;
  }

  const html = gameState.characters.map(char => {
    const needed = expRequired(char.level);
    const pct = Math.floor((char.exp / needed) * 100);
    const hasPoints = char.unspentPoints > 0 && !char.autoAssign;
    return `
      <div class="char-card">
        <h3>${charClassName(char.classId)} <span style="color:#aaa;font-size:12px">(${char.classId})</span></h3>
        <div>레벨 <strong>${char.level}</strong> &nbsp;|&nbsp; EXP: ${char.exp} / ${needed} (${pct}%)</div>
        <div class="exp-bar-wrap"><div class="exp-bar-fill" style="width:${pct}%"></div></div>
        <div style="margin-top:6px;font-size:12px;color:#aaa">
          STR ${char.stats.STR} &nbsp; DEX ${char.stats.DEX} &nbsp;
          INT ${char.stats.INT} &nbsp; LUK ${char.stats.LUK}
        </div>
        ${char.unspentPoints > 0
          ? `<div class="points-badge">${hasPoints ? '⬆ 스탯 배분 가능' : '⬆ 자동 배분 중'} (${char.unspentPoints}pt)</div>`
          : ''}
      </div>`;
  }).join('');

  el.innerHTML = html;
}

// ── 스탯 탭 ────────────────────────────────────────────────
function renderStatsTab() {
  const el = document.getElementById('tab-stats');
  if (gameState.characters.length === 0) {
    el.innerHTML = '<p style="color:#888">캐릭터가 없습니다.</p>';
    return;
  }

  const STAT_LABELS = {
    STR: { label: 'STR', desc: '물리방어 +0.5, (전사) 공격력↑' },
    DEX: { label: 'DEX', desc: '명중 +0.5%, 회피 +0.1% (궁수) 공격력↑' },
    INT: { label: 'INT', desc: '마법방어 +0.5 (마법사) 공격력↑' },
    LUK: { label: 'LUK', desc: '회피 +0.3% (도적) 공격력↑' },
  };

  const html = gameState.characters.map(char => {
    const fs = calcFinalStats(char);
    const resetCost = 100 * char.level;
    const canReset = gameState.gold >= resetCost;
    const hasPoints = char.unspentPoints > 0 && !char.autoAssign;

    const statRows = ['STR', 'DEX', 'INT', 'LUK'].map(stat => `
      <div class="stat-row">
        <span class="stat-label" title="${STAT_LABELS[stat].desc}">${stat}</span>
        <span class="stat-val">${char.stats[stat]}</span>
        ${hasPoints
          ? `<button class="stat-plus-btn" onclick="tryAddStatPoint(${char.id}, '${stat}')">＋</button>`
          : `<span class="stat-plus-placeholder"></span>`}
        <span class="stat-desc">${STAT_LABELS[stat].desc}</span>
      </div>`).join('');

    return `
      <div class="char-card">
        <div class="stat-card-header">
          <h3>${charClassName(char.classId)} Lv.${char.level}</h3>
          <button class="toggle-btn ${char.autoAssign ? 'active' : ''}"
                  onclick="tryToggleAutoAssign(${char.id})">
            자동배분 ${char.autoAssign ? 'ON' : 'OFF'}
          </button>
        </div>

        ${char.unspentPoints > 0
          ? `<div class="points-badge" style="margin-bottom:8px">
               잔여 포인트: <strong>${char.unspentPoints}</strong>
               ${char.autoAssign ? '<span style="color:#aaa;font-size:11px"> (자동배분 ON — 수동 배분하려면 OFF로)</span>' : ''}
             </div>`
          : ''}

        <div class="stat-grid">${statRows}</div>

        <div class="final-stats">
          <span>공격력 <strong>${fs.atk}</strong></span>
          <span>물리방어 <strong>${fs.physDef}</strong></span>
          <span>마법방어 <strong>${fs.magicDef}</strong></span>
          <span>명중 <strong>${fs.accuracy.toFixed(0)}%</strong></span>
          <span>회피 <strong>${fs.evade.toFixed(0)}%</strong></span>
        </div>

        <button class="small-btn reset-btn ${canReset ? '' : 'disabled'}"
                onclick="tryResetStats(${char.id})">
          스탯 초기화 &nbsp;(골드 ${resetCost.toLocaleString()})
        </button>
      </div>`;
  }).join('');

  el.innerHTML = html;
}

// ── 공통 헬퍼 ──────────────────────────────────────────────
function charClassName(classId) {
  const names = {
    novice: '모험가', warrior: '전사', mage: '마법사', archer: '궁수', rogue: '도적',
  };
  return names[classId] || classId;
}
