let uiTimer = 0;
const HUD_INTERVAL = 0.1;

// 탭 재빌드: 레벨업 등 게임 이벤트 시 rAF로 1회 실행
let tabDirty = false;
function markTabDirty() {
  if (tabDirty) return;
  tabDirty = true;
  requestAnimationFrame(() => {
    tabDirty = false;
    renderActiveTab();
  });
}

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
  if (uiTimer < HUD_INTERVAL) return;
  uiTimer = 0;
  updateHUD();
  // 탭 콘텐츠는 여기서 갱신하지 않음
  // → 버튼 onclick 또는 markTabDirty()에서만 갱신
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
const JOB_DEFS = [
  { id: 'warrior', name: '전사',   color: '#e74c3c', desc: 'STR · 근접 · 물리방어' },
  { id: 'archer',  name: '궁수',   color: '#27ae60', desc: 'DEX · 장거리 · 명중/회피' },
  { id: 'mage',    name: '마법사', color: '#9b59b6', desc: 'INT · 중거리 · 마법방어' },
  { id: 'rogue',   name: '도적',   color: '#95a5a6', desc: 'LUK · 단거리 · 회피 특화' },
];

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
    const canAdvance = char.classId === 'novice' && char.level >= JOB_ADVANCE_LEVEL;

    const jobSection = canAdvance ? `
      <div class="job-advance-box">
        <div class="job-advance-title">✦ 전직 가능! 직업을 선택하세요</div>
        <div class="job-btn-grid">
          ${JOB_DEFS.map(j => `
            <button class="job-btn" style="border-color:${j.color}"
                    onclick="tryAdvanceJob(${char.id}, '${j.id}'); renderCharacterTab();">
              <span class="job-btn-name" style="color:${j.color}">${j.name}</span>
              <span class="job-btn-desc">${j.desc}</span>
            </button>`).join('')}
        </div>
      </div>` : '';

    const classColor = CLASS_COLORS[char.classId] || '#aaa';

    return `
      <div class="char-card">
        <h3 style="color:${classColor}">${charClassName(char.classId)}
          <span style="color:#666;font-size:11px;font-weight:normal"> Lv.${char.level}</span>
        </h3>
        <div style="font-size:12px;color:#888;margin-bottom:4px">
          EXP ${char.exp} / ${needed} (${pct}%)
        </div>
        <div class="exp-bar-wrap"><div class="exp-bar-fill" style="width:${pct}%"></div></div>
        <div style="margin-top:6px;font-size:12px;color:#aaa">
          STR ${char.stats.STR} &nbsp; DEX ${char.stats.DEX} &nbsp;
          INT ${char.stats.INT} &nbsp; LUK ${char.stats.LUK}
        </div>
        ${char.unspentPoints > 0
          ? `<div class="points-badge">${hasPoints ? '⬆ 스탯 배분 가능' : '⬆ 자동 배분 중'} (${char.unspentPoints}pt)</div>`
          : ''}
        ${jobSection}
      </div>`;
  }).join('');

  el.innerHTML = html;
}

// ── 스탯 탭 (전체 재빌드) ───────────────────────────────────
const STAT_LABELS = {
  STR: '공격력 +0.5 · 물리방어 +0.5 · (전사) 추가 배율',
  DEX: '명중 +0.5% · 회피 +0.1% · (궁수) 추가 배율',
  INT: '마법방어 +0.5 · (마법사) 추가 배율',
  LUK: '회피 +0.3% · (도적) 추가 배율',
};

function renderStatsTab() {
  const el = document.getElementById('tab-stats');
  if (gameState.characters.length === 0) {
    el.innerHTML = '<p style="color:#888">캐릭터가 없습니다.</p>';
    return;
  }

  const html = gameState.characters.map(char => {
    const fs = calcFinalStats(char);
    const resetCost = 100 * char.level;
    const canReset = gameState.gold >= resetCost;
    const hasPoints = char.unspentPoints > 0 && !char.autoAssign;

    const statRows = ['STR', 'DEX', 'INT', 'LUK'].map(stat => `
      <div class="stat-row">
        <span class="stat-label" title="${STAT_LABELS[stat]}">${stat}</span>
        <span class="stat-val" id="sv-${char.id}-${stat}">${char.stats[stat]}</span>
        <button class="stat-plus-btn" id="sb-${char.id}-${stat}"
                style="${hasPoints ? '' : 'display:none'}"
                onclick="tryAddStatPoint(${char.id}, '${stat}'); updateStatDisplay(${char.id});">＋</button>
        <span class="stat-desc">${STAT_LABELS[stat]}</span>
      </div>`).join('');

    return `
      <div class="char-card">
        <div class="stat-card-header">
          <h3>${charClassName(char.classId)} Lv.${char.level}</h3>
          <button class="toggle-btn ${char.autoAssign ? 'active' : ''}"
                  onclick="tryToggleAutoAssign(${char.id}); renderStatsTab();">
            자동배분 ${char.autoAssign ? 'ON' : 'OFF'}
          </button>
        </div>

        <div class="points-badge" id="sp-${char.id}"
             style="margin-bottom:8px${char.unspentPoints === 0 ? ';display:none' : ''}">
          잔여 포인트: <strong id="spv-${char.id}">${char.unspentPoints}</strong>
          ${char.autoAssign ? '<span style="color:#aaa;font-size:11px"> (자동배분 ON — 수동 배분하려면 OFF로)</span>' : ''}
        </div>

        <div class="stat-grid">${statRows}</div>

        <div class="final-stats" id="fs-${char.id}">
          <span>공격력 <strong>${fs.atk}</strong></span>
          <span>물리방어 <strong>${fs.physDef}</strong></span>
          <span>마법방어 <strong>${fs.magicDef}</strong></span>
          <span>명중 <strong>${fs.accuracy.toFixed(0)}%</strong></span>
          <span>회피 <strong>${fs.evade.toFixed(0)}%</strong></span>
        </div>

        <button class="small-btn reset-btn ${canReset ? '' : 'disabled'}"
                onclick="tryResetStats(${char.id}); renderStatsTab();">
          스탯 초기화 &nbsp;(골드 ${resetCost.toLocaleString()})
        </button>
      </div>`;
  }).join('');

  el.innerHTML = html;
}

// ── 스탯 인플레이스 업데이트 (DOM 재빌드 없음) ──────────────
// + 버튼 클릭마다 이걸 호출 → 버튼이 DOM에서 사라지지 않아 빠른 연속 클릭 가능
function updateStatDisplay(charId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const hasPoints = char.unspentPoints > 0 && !char.autoAssign;

  ['STR', 'DEX', 'INT', 'LUK'].forEach(stat => {
    const valEl = document.getElementById(`sv-${charId}-${stat}`);
    if (valEl) valEl.textContent = char.stats[stat];
    const btnEl = document.getElementById(`sb-${charId}-${stat}`);
    if (btnEl) btnEl.style.display = hasPoints ? '' : 'none';
  });

  const spEl = document.getElementById(`sp-${charId}`);
  if (spEl) {
    spEl.style.display = char.unspentPoints > 0 ? '' : 'none';
    const spvEl = document.getElementById(`spv-${charId}`);
    if (spvEl) spvEl.textContent = char.unspentPoints;
  }

  const fs = calcFinalStats(char);
  const fsEl = document.getElementById(`fs-${charId}`);
  if (fsEl) {
    fsEl.innerHTML = `
      <span>공격력 <strong>${fs.atk}</strong></span>
      <span>물리방어 <strong>${fs.physDef}</strong></span>
      <span>마법방어 <strong>${fs.magicDef}</strong></span>
      <span>명중 <strong>${fs.accuracy.toFixed(0)}%</strong></span>
      <span>회피 <strong>${fs.evade.toFixed(0)}%</strong></span>`;
  }
}

// ── 공통 헬퍼 ──────────────────────────────────────────────
function charClassName(classId) {
  const names = {
    novice: '모험가', warrior: '전사', mage: '마법사', archer: '궁수', rogue: '도적',
  };
  return names[classId] || classId;
}
