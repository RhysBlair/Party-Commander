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
}

function renderCharacterTab() {
  const el = document.getElementById('tab-characters');
  if (gameState.characters.length === 0) {
    el.innerHTML = '<p style="color:#888">캐릭터가 없습니다.</p>';
    return;
  }

  const html = gameState.characters.map(char => {
    const needed = expRequired(char.level);
    const pct = Math.floor((char.exp / needed) * 100);
    return `
      <div class="char-card">
        <h3>${charClassName(char.classId)} (${char.classId})</h3>
        <div>레벨 <strong>${char.level}</strong> &nbsp;|&nbsp; EXP: ${char.exp} / ${needed} (${pct}%)</div>
        <div class="exp-bar-wrap"><div class="exp-bar-fill" style="width:${pct}%"></div></div>
        <div style="margin-top:6px;font-size:12px;color:#aaa">
          STR ${char.stats.STR} &nbsp; DEX ${char.stats.DEX} &nbsp;
          INT ${char.stats.INT} &nbsp; LUK ${char.stats.LUK}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = html;
}

function charClassName(classId) {
  const names = {
    novice: '모험가', warrior: '전사', mage: '마법사', archer: '궁수', rogue: '도적',
  };
  return names[classId] || classId;
}
