let uiTimer = 0;
let _equipGradeFilter = null;
const HUD_INTERVAL = 0.1;

// 탭 재빌드: 레벨업 등 게임 이벤트 시 rAF로 1회 실행
let tabDirty = false;
function markTabDirty() {
  if (tabDirty) return;
  tabDirty = true;
  requestAnimationFrame(() => {
    tabDirty = false;
    checkTabUnlocks();
    renderActiveTab();
  });
}

function checkTabUnlocks() {
  const hasChar    = gameState.characters.length >= 1;
  const stage3Done = gameState.maxStageReached >= 3;
  const stage4Done = gameState.maxStageReached >= 4;
  const stage5Done = gameState.maxStageReached >= 5;
  const stage10Done = gameState.maxStageReached >= 10;

  // 상점: 첫 캐릭터 영입 시
  document.querySelectorAll('[data-tab="shop"]').forEach(el => el.classList.toggle('tab-hidden', !hasChar));
  // 펫: 스테이지 3 클리어
  document.querySelectorAll('[data-tab="pets"]').forEach(el => el.classList.toggle('tab-hidden', !stage3Done));
  // 제작: 스테이지 4 클리어
  document.querySelectorAll('[data-tab="craft"]').forEach(el => el.classList.toggle('tab-hidden', !stage4Done));
  // 업그레이드: 스테이지 5 클리어
  document.querySelectorAll('[data-tab="upgrades"]').forEach(el => el.classList.toggle('tab-hidden', !stage5Done));
  // 레이드: 스테이지 10 클리어
  document.querySelectorAll('[data-tab="raid"]').forEach(el => el.classList.toggle('tab-hidden', !stage10Done));
}

let charModalDirty = false;
function markCharModalDirty() {
  if (charModalDirty) return;
  charModalDirty = true;
  requestAnimationFrame(() => {
    charModalDirty = false;
    if (charModalOpenId !== null) renderCharModalBody();
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

  // 캐릭터 리스트 패널 — 이벤트 위임 (innerHTML 재렌더링에도 안정적)
  const panel = document.getElementById('char-list-panel');
  if (panel) {
    panel.addEventListener('click', e => {
      const item = e.target.closest('.char-list-item');
      if (item && item.dataset.charId) {
        openCharModal(Number(item.dataset.charId));
      }
    });
  }

  // 스테이지 바 — DOM 1회 생성, 이후 클래스만 갱신
  initStageBar();
  checkTabUnlocks();
}

function updateUI(dt) {
  uiTimer += dt;
  if (uiTimer < HUD_INTERVAL) return;
  uiTimer = 0;
  updateHUD();
  updateCharList();
  updateStageBar();
  // 탭 콘텐츠는 여기서 갱신하지 않음
  // → 버튼 onclick 또는 markTabDirty()에서만 갱신
}

// 스테이지 바 DOM을 최초 1회 생성 — 이후 updateStageBar로 클래스만 갱신
function initStageBar() {
  const el = document.getElementById('stage-bar');
  if (!el) return;
  el.innerHTML = '';

  for (let i = 0; i < STAGES.length; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'sdot-wrap';
    wrap.id = `sdot-wrap-${i}`;

    const dot = document.createElement('div');
    dot.className = 'sdot';
    dot.id = `sdot-${i}`;
    dot.title = STAGES[i].name;
    dot.textContent = i + 1;

    const cnt = document.createElement('div');
    cnt.className = 'sdot-cnt';
    cnt.id = `sdot-cnt-${i}`;

    wrap.appendChild(dot);
    wrap.appendChild(cnt);

    // 직접 이벤트 리스너 — innerHTML 갱신과 무관하게 항상 동작
    wrap.addEventListener('click', () => {
      if (i <= gameState.maxStageReached) goToStage(i);
    });

    el.appendChild(wrap);

    if (i < STAGES.length - 1) {
      const line = document.createElement('div');
      line.className = 'sdot-line';
      line.id = `sdot-line-${i}`;
      el.appendChild(line);
    }
  }
}

function updateStageBar() {
  const view = gameState.viewStage;
  const max  = gameState.maxStageReached;

  for (let i = 0; i < STAGES.length; i++) {
    const wrap = document.getElementById(`sdot-wrap-${i}`);
    const dot  = document.getElementById(`sdot-${i}`);
    const cnt  = document.getElementById(`sdot-cnt-${i}`);
    const line = document.getElementById(`sdot-line-${i}`);
    if (!wrap || !dot || !cnt) continue;

    const unlocked   = i <= max;
    const isView     = i === view;
    const conquered  = i < max;
    const n          = gameState.characters.filter(c => c.assignedStage === i).length;

    wrap.classList.toggle('sdot-wrap-locked', !unlocked);

    dot.className = 'sdot' +
      (!unlocked ? ' sdot-locked' : isView ? ' sdot-view' : n > 0 ? ' sdot-chars' : conquered ? ' sdot-conquered' : '');

    cnt.textContent = n > 0 ? `${n}명` : conquered ? '✓' : '';

    if (line) line.className = 'sdot-line' + (unlocked && i < max ? ' sdot-line-on' : '');
  }
}

function updateHUD() {
  const s = gameState;
  document.getElementById('hud-gold').textContent = `골드: ${s.gold.toLocaleString()}`;
  document.getElementById('hud-gems').textContent = `젬: ${s.gems.toLocaleString()}`;
  if (s.viewRaid) {
    const rf = s.raidField;
    document.getElementById('hud-stage').textContent    = `[레이드] 자쿰`;
    document.getElementById('hud-progress').textContent = rf ? `HP: ${(rf.boss.hp / rf.boss.maxHp * 100).toFixed(1)}%` : '준비 중';
  } else {
    const stage = STAGES[s.viewStage];
    const field = s.stageFields[s.viewStage];
    const kills = field ? field.kills : 0;
    const isConquered = s.viewStage < s.maxStageReached;
    document.getElementById('hud-stage').textContent    = `스테이지: ${stage.name}`;
    document.getElementById('hud-progress').textContent = isConquered
      ? `정복완료 (재파밍: ${kills} / ${stage.killsToAdvance})`
      : `처치: ${kills} / ${stage.killsToAdvance}`;
  }
}

function renderActiveTab() {
  const activeBtn = document.querySelector('.tab-btn.active');
  if (!activeBtn) return;
  const tab = activeBtn.dataset.tab;
  if (tab === 'characters') renderCharacterTab();
  else if (tab === 'equipment')  renderEquipmentTab();
  else if (tab === 'shop')       renderShopTab();
  else if (tab === 'skills')     renderSkillTab();
  else if (tab === 'pets')       renderPetTab();
  else if (tab === 'craft')      renderCraftTab();
  else if (tab === 'upgrades')   renderUpgradeTab();
  else if (tab === 'raid')       renderRaidTab();
}

// ── 캐릭터 탭 ──────────────────────────────────────────────
const JOB_DEFS = [
  { id: 'warrior', name: '전사',   color: '#e74c3c', desc: 'STR · 근접 · 물리방어' },
  { id: 'archer',  name: '궁수',   color: '#27ae60', desc: 'DEX · 장거리 · 명중/회피' },
  { id: 'mage',    name: '마법사', color: '#9b59b6', desc: 'INT · 중거리 · 마법방어' },
  { id: 'rogue',   name: '도적',   color: '#95a5a6', desc: 'LUK · 단거리 · 회피 특화' },
];

const JOB2_DEFS = {
  warrior: [
    { id: 'fighter',   name: '파이터',   color: '#c0392b', desc: 'STR/DEX · 근접 · 물리 화력 극대화' },
    { id: 'page',      name: '페이지',   color: '#e74c3c', desc: 'STR/INT · 근접 · 균형형 기사' },
    { id: 'spearman',  name: '스피어맨', color: '#d35400', desc: 'STR/DEX · 창 · 파티 체력/스킬 버프' },
    { id: 'knight',    name: '나이트',   color: '#3498db', desc: 'STR/DEX · 근접 · 파티 공격력 버프' },
  ],
  mage: [
    { id: 'wizard_tl', name: '썬콜',    color: '#1abc9c', desc: 'INT/DEX · 번개/빙결 · 공격속도 상승' },
    { id: 'wizard_fp', name: '불독',    color: '#e67e22', desc: 'INT/LUK · 화염/독 · 크리티컬 특화' },
    { id: 'cleric',    name: '클레릭',   color: '#f1c40f', desc: 'INT/STR · 신성 · HP 회복 강화' },
  ],
  rogue: [
    { id: 'assassin',  name: '어쌔신',   color: '#2c3e50', desc: 'LUK/DEX · 원거리 표창 · 암살 특화' },
    { id: 'thief',     name: '시프',    color: '#8e44ad', desc: 'LUK/STR · 근접 단검 · 근접 전투' },
  ],
  archer: [
    { id: 'hunter',    name: '헌터',    color: '#27ae60', desc: 'DEX/STR · 활 · 표준 궁수' },
    { id: 'marksman',  name: '사수',    color: '#229954', desc: 'DEX/LUK · 석궁 · 크리티컬 정밀사격' },
  ],
};

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
    const fs = calcFinalStats(char);
    const resetCost = 100 * char.level;
    const canReset = gameState.gold >= resetCost;

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

    // 2차 전직: 1차 직업 보유 + Lv.30 이상
    const avail2nd = JOB2_DEFS[char.classId] || [];
    const job2Section = avail2nd.length > 0 && char.level >= JOB_ADVANCE_LEVEL_2 ? `
      <div class="job-advance-box" style="border-color:#f39c12">
        <div class="job-advance-title" style="color:#f39c12">✦ 2차 전직 가능! (Lv.30 달성)</div>
        <div class="job-btn-grid">
          ${avail2nd.map(j => `
            <button class="job-btn" style="border-color:${j.color}"
                    onclick="tryAdvanceJob2(${char.id}, '${j.id}'); renderCharacterTab();">
              <span class="job-btn-name" style="color:${j.color}">${j.name}</span>
              <span class="job-btn-desc">${j.desc}</span>
            </button>`).join('')}
        </div>
      </div>` : '';

    const classColor = CLASS_COLORS[char.classId] || '#aaa';

    const stageLabel = char.assignedStage >= 0
      ? `<span style="color:#f39c12;font-size:11px">${STAGES[char.assignedStage]?.name || ''}</span>`
      : `<span style="color:#666;font-size:11px">미배정</span>`;

    return `
      <div class="char-card" style="cursor:pointer"
           onclick="if(!event.target.closest('button,input')){${char.assignedStage >= 0 ? `goToStage(${char.assignedStage})` : ''}}">
        <h3 style="color:${classColor}">${char.nickname || '???'}
          <span style="color:#888;font-size:12px;font-weight:normal"> (${charClassName(char.classId)})</span>
          <span style="color:#666;font-size:11px;font-weight:normal"> Lv.${char.level}</span>
          <span style="float:right;margin-top:2px">${stageLabel}</span>
        </h3>
        <div style="font-size:12px;color:#888;margin-bottom:4px">
          EXP ${char.exp} / ${needed} (${pct}%)
        </div>
        <div class="exp-bar-wrap"><div class="exp-bar-fill" style="width:${pct}%"></div></div>

        <div class="stat-inline-row">
          ${['STR','DEX','INT','LUK'].map(stat => {
            const bonus = equipStatBonus(char, stat);
            return `<div class="stat-inline-item">
              <span class="stat-lbl-tip" title="${STAT_LABELS[stat]}">${stat}</span>
              <span class="stat-val" id="sv-${char.id}-${stat}">${statValHtml(char.stats[stat], bonus)}</span>
              <button class="stat-plus-btn" id="sb-${char.id}-${stat}"
                      style="${hasPoints ? '' : 'display:none'}"
                      onclick="tryAddStatPoint(${char.id},'${stat}');updateStatDisplay(${char.id});">＋</button>
            </div>`;
          }).join('')}
          <div style="margin-left:auto;display:flex;align-items:center;gap:5px">
            <span id="sp-${char.id}" style="color:#f1c40f;font-size:11px${char.unspentPoints > 0 ? '' : ';display:none'}">잔여&nbsp;<strong id="spv-${char.id}">${char.unspentPoints}</strong>pt</span>
            <button class="toggle-btn ${char.autoAssign ? 'active' : ''}"
                    onclick="tryToggleAutoAssign(${char.id});renderCharacterTab();">
              자동배분 ${char.autoAssign ? 'ON' : 'OFF'}
            </button>
            <button id="freset-${char.id}" class="reset-stat-btn ${canReset ? '' : 'disabled'}"
                    onclick="tryResetStats(${char.id});renderCharacterTab();"
                    title="골드 ${resetCost.toLocaleString()} 소모">스텟초기화</button>
          </div>
        </div>

        <div class="char-fs-line" id="fs-${char.id}" style="margin-bottom:5px">
          <span>HP <strong style="color:#e74c3c">${char.maxHpCache ? Math.ceil(char.currentHp||0) : fs.maxHp}/${fs.maxHp}</strong></span>
          <span>공격력 <strong>${fs.atk}</strong></span>
          <span>물방 <strong>${fs.physDef}</strong></span>
          <span>마방 <strong>${fs.magicDef}</strong></span>
          <span>명중 <strong>${fs.accuracy.toFixed(0)}%</strong></span>
          <span>회피 <strong>${fs.evade.toFixed(0)}%</strong></span>
          <span>크리 <strong style="color:#f1c40f">${fs.critRate.toFixed(1)}%</strong></span>
        </div>

        <div class="assign-section">
          <span class="assign-label">배치 필드 <span style="color:#555;font-size:10px">(스테이지당 최대 6명)</span></span>
          <div class="assign-btns">
            ${Array.from({ length: gameState.maxStageReached + 1 }, (_, i) => {
              const inStage = gameState.characters.filter(c => c.assignedStage === i).length;
              const isCurrent = char.assignedStage === i;
              const isFull = !isCurrent && inStage >= 6;
              return `<button class="assign-btn ${isCurrent ? 'active' : isFull ? 'disabled' : ''}"
                              onclick="assignCharToStage(${char.id}, ${i}); renderCharacterTab();"
                              title="${isFull ? '파티 만원' : ''}"
                              ${isFull ? 'disabled' : ''}>
                        ${STAGES[i].name} <span style="font-size:9px;opacity:0.7">${inStage}/6</span>
                      </button>`;
            }).join('')}
          </div>
        </div>
        ${jobSection}
        ${job2Section}
      </div>`;
  }).join('');

  const curChars  = gameState.characters.length;
  const addCost   = charAddCost(curChars);
  const canAfford = gameState.gold >= addCost;

  const addSection = `<div class="add-char-box">
       <div class="add-char-info">
         <span>파티원 <strong>${curChars}명</strong></span>
         <span class="add-char-sub">새 모험가 영입 — 스테이지 1에서 시작</span>
       </div>
       <button class="small-btn ${canAfford ? '' : 'disabled'}"
               onclick="tryAddCharacter(); renderCharacterTab();">
         영입 ${addCost.toLocaleString()}G
       </button>
     </div>`;

  el.innerHTML = html + addSection;
}

// ── 스탯 헬퍼 (캐릭터 탭에서 사용) ─────────────────────────
const STAT_LABELS = {
  STR: '공격력 +0.5 · 물리방어 +0.5 · (전사/파이터/페이지/스피어맨) 추가 배율',
  DEX: '명중 +0.5% · 회피 +0.1% · (궁수/헌터/사수) 추가 배율',
  INT: '마법방어 +0.5 · (마법사/썬콜/불독/클레릭) 추가 배율',
  LUK: '회피 +0.3% · (도적/어쌔신/시프) 추가 배율',
};

function equipStatBonus(char, stat) {
  return sumEquipStat(char, 'bonus' + stat);
}

function statValHtml(base, bonus) {
  if (bonus <= 0) return `${base}`;
  return `${base + bonus}<span class="stat-equip-bonus">(${base}+${bonus})</span>`;
}

// ── 스탯 인플레이스 업데이트 (DOM 재빌드 없음) ──────────────
function updateStatDisplay(charId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const hasPoints = char.unspentPoints > 0;

  ['STR', 'DEX', 'INT', 'LUK'].forEach(stat => {
    const valEl = document.getElementById(`sv-${charId}-${stat}`);
    if (valEl) valEl.innerHTML = statValHtml(char.stats[stat], equipStatBonus(char, stat));
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
      <span>HP <strong style="color:#e74c3c">${char.maxHpCache ? Math.ceil(char.currentHp || 0) : fs.maxHp}/${fs.maxHp}</strong></span>
      <span>공격력 <strong>${fs.atk}</strong></span>
      <span>물방 <strong>${fs.physDef}</strong></span>
      <span>마방 <strong>${fs.magicDef}</strong></span>
      <span>명중 <strong>${fs.accuracy.toFixed(0)}%</strong></span>
      <span>회피 <strong>${fs.evade.toFixed(0)}%</strong></span>
      <span>크리 <strong style="color:#f1c40f">${fs.critRate.toFixed(1)}%</strong></span>`;
  }
}

// ── 장비 탭 ────────────────────────────────────────────────
const SLOT_NAMES = { weapon: '무기', weapon2: '무기 2', throwable: '표창', armor: '방어구', accessory: '장신구' };

// 강화 보너스가 적용된 실제 스탯 문자열 반환
function equipStatText(e, enhance) {
  const mult  = enhance > 0 ? (1 + enhance * 0.15) : 1;
  const fl    = (v) => v > 0 ? Math.floor(v * mult) : 0;
  const parts = [];
  if (e.atk)      parts.push(`ATK+${fl(e.atk)}`);
  if (e.physDef)  parts.push(`물방+${fl(e.physDef)}`);
  if (e.magicDef) parts.push(`마방+${fl(e.magicDef)}`);
  if (e.bonusSTR) parts.push(`STR+${fl(e.bonusSTR)}`);
  if (e.bonusDEX) parts.push(`DEX+${fl(e.bonusDEX)}`);
  if (e.bonusINT) parts.push(`INT+${fl(e.bonusINT)}`);
  if (e.bonusLUK) parts.push(`LUK+${fl(e.bonusLUK)}`);
  return parts.join(' · ') || '—';
}

function enhanceBadge(enhance) {
  if (!enhance) return '';
  const color = enhance >= 7 ? '#e2b96f' : enhance >= 4 ? '#5b9bd5' : '#4caf50';
  return `<span style="color:${color};font-weight:bold;font-size:11px"> +${enhance}</span>`;
}

function renderEquipmentTab() {
  const el = document.getElementById('tab-equipment');
  if (gameState.characters.length === 0) {
    el.innerHTML = '<p style="color:#888">캐릭터가 없습니다.</p>';
    return;
  }

  // 스크롤 위치 보존
  const prevLeft  = el.querySelector('.eq-left-panel');
  const prevRight = el.querySelector('.eq-right-panel');
  const savedLeftScroll  = prevLeft  ? prevLeft.scrollTop  : 0;
  const savedRightScroll = prevRight ? prevRight.scrollTop : 0;

  // ── 장착 중 (왼쪽 패널) ─────────────────────────────────────────────
  const charCards = gameState.characters.map(char => {
    const slotList = getCharSlotList(char);
    const slots = slotList.map(slot => {
      const item = char.equipment[slot];
      const e    = item ? EQUIPMENT[item.id] : null;
      const col  = e ? (GRADE_COLORS[e.grade] || '#aaa') : '#333';
      const canRemove = item && item.uid !== 0;
      const _eMax  = item ? itemMaxEnhance(item) : 0;
      const enhBtn = item && _eMax > 0 && item.enhance < _eMax ? (() => {
        const cost    = enhanceCost(item);
        const canAff  = gameState.gold >= cost;
        const succPct = ENHANCE_SUCCESS[item.enhance];
        return `<button class="small-btn enhance-btn ${canAff ? '' : 'disabled'}"
                        onclick="this.disabled=true;showEnhanceFloat(this,tryEnhanceEquipment(${item.uid}));markTabDirty();"
                        title="성공률 ${succPct}%">
                  강화 ${cost.toLocaleString()}G (${succPct}%)
                </button>`;
      })() : (item && _eMax > 0 && item.enhance >= _eMax ? `<span style="color:#e2b96f;font-size:10px">MAX</span>` : '');

      return `
        <div class="equip-slot">
          <div class="equip-slot-label">${SLOT_NAMES[slot]}</div>
          <div class="equip-slot-item" style="border-color:${col}"
               ondragover="equipDragOver(event)"
               ondragleave="equipDragLeave(event)"
               ondrop="equipDrop(event,${char.id},'${slot}')">
            ${e
              ? `<span style="color:${col}">${e.name}${enhanceBadge(item.enhance)}</span>
                 <span class="equip-stat-text">${equipStatText(e, item.enhance)}</span>`
              : `<span style="color:#444">— 없음 —</span>`}
            <div style="display:flex;gap:4px;margin-left:auto;flex-shrink:0;align-items:center">
              ${enhBtn}
              ${canRemove ? `<button class="equip-remove" onclick="tryUnequipItem(${char.id},'${slot}');renderEquipmentTab();">✕</button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="char-card">
        <h3 style="color:${CLASS_COLORS[char.classId]||'#aaa'};margin-bottom:8px">
          ${char.nickname || '???'} <span style="color:#888;font-size:12px;font-weight:normal">(${charClassName(char.classId)})</span> Lv.${char.level}
        </h3>
        <div class="equip-slots">${slots}</div>
      </div>`;
  }).join('');

  // ── 인벤토리 (오른쪽 패널) ─────────────────────────────────────────────
  const inv = gameState.equipmentInventory;
  const filteredInv = _equipGradeFilter
    ? inv.filter(i => { const e = EQUIPMENT[i.id]; return e && e.grade === _equipGradeFilter; })
    : inv;

  const invHtml = filteredInv.length === 0
    ? '<div style="color:#555;font-size:12px;padding:6px 0">보유 장비 없음</div>'
    : filteredInv.map(item => {
        const e = EQUIPMENT[item.id];
        if (!e) return '';
        const col = GRADE_COLORS[e.grade] || '#aaa';
        const _iMax   = itemMaxEnhance(item);
        const canAff  = _iMax > 0 && item.enhance < _iMax && gameState.gold >= enhanceCost(item);
        const succPct = ENHANCE_SUCCESS[item.enhance] ?? 0;
        const enhBtn  = _iMax === 0 ? ''
          : item.enhance < _iMax
            ? `<button class="small-btn enhance-btn ${canAff ? '' : 'disabled'}"
                       onclick="this.disabled=true;showEnhanceFloat(this,tryEnhanceEquipment(${item.uid}));markTabDirty();"
                       title="성공률 ${succPct}%">
                 강화 ${enhanceCost(item).toLocaleString()}G (${succPct}%)
               </button>`
            : `<span style="color:#e2b96f;font-size:10px">MAX</span>`;

        const sellPrice = e.cost ? Math.floor(e.cost * 0.6) : 0;
        const sellBtn   = sellPrice > 0
          ? `<button class="equip-remove sell-btn"
                     onclick="trySellItem(${item.uid});renderEquipmentTab();">
               판매 ${sellPrice.toLocaleString()}G
             </button>`
          : '';

        const canDecomp = gameState.maxStageReached >= 4 && CRYSTAL_KEYS[e.grade];
        const decompBtn = canDecomp
          ? `<button class="equip-remove decomp-btn"
                     onclick="tryDecomposeItem(${item.uid});renderEquipmentTab();">
               분해
             </button>`
          : '';

        return `
          <div class="inv-item" draggable="true" data-uid="${item.uid}"
               ondragstart="equipDragStart(event)"
               style="display:flex;align-items:center;gap:6px;justify-content:space-between">
            <div style="display:flex;flex-direction:column;gap:3px;min-width:0">
              <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
                <span style="color:${col}">${e.name}${enhanceBadge(item.enhance)}</span>
                <span class="equip-stat-text">${equipStatText(e, item.enhance)}</span>
              </div>
              ${enhBtn ? `<div>${enhBtn}</div>` : ''}
            </div>
            <div style="display:flex;gap:3px;flex-shrink:0">
              ${sellBtn}${decompBtn}
            </div>
          </div>`;
      }).join('');

  const gradeCount = g => inv.filter(i => { const e = EQUIPMENT[i.id]; return e && e.grade === g; }).length;

  // 필터 버튼 (전체 / 노멀 / 레어 / 에픽)
  const filterBtns = [
    { g: null, label: `전체 (${inv.length})`, col: '#aaa' },
    ...['노멀', '레어', '에픽'].map(g => ({ g, label: `${g} (${gradeCount(g)})`, col: GRADE_COLORS[g] || '#aaa' }))
  ].map(({ g, label, col }) =>
    `<button class="inv-filter-btn ${_equipGradeFilter === g ? 'active' : ''}" style="color:${col}"
             onclick="setEquipFilter(${g === null ? 'null' : `'${g}'`})">
       ${label}
     </button>`
  ).join('');

  // 일괄판매 버튼
  const sellBtns = ['노멀', '레어', '에픽'].map(g => {
    const cnt = gradeCount(g);
    const col = GRADE_COLORS[g] || '#aaa';
    return `<button class="small-btn ${cnt > 0 ? '' : 'disabled'}" style="color:${col}"
                    onclick="trySellByGrade('${g}');renderEquipmentTab();">
              ${g} 일괄판매 (${cnt})
            </button>`;
  }).join('');

  el.innerHTML = `
    <div class="eq-layout">
      <div class="eq-left-panel">
        <div class="eq-sticky-head">
          <div class="eq-section-title" style="margin-bottom:0">장착 중</div>
        </div>
        ${charCards}
      </div>
      <div class="eq-right-panel">
        <div class="eq-sticky-head">
          <div class="eq-section-title" style="margin-bottom:6px">인벤토리</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">${filterBtns}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">${sellBtns}</div>
        </div>
        <div class="inv-list">${invHtml}</div>
      </div>
    </div>`;

  // 스크롤 위치 복원
  const newLeft  = el.querySelector('.eq-left-panel');
  const newRight = el.querySelector('.eq-right-panel');
  if (newLeft)  newLeft.scrollTop  = savedLeftScroll;
  if (newRight) newRight.scrollTop = savedRightScroll;
}

function setEquipFilter(grade) {
  _equipGradeFilter = _equipGradeFilter === grade ? null : grade;
  renderEquipmentTab();
}

function equipDragStart(event) {
  event.dataTransfer.setData('text/plain', event.currentTarget.dataset.uid);
  event.dataTransfer.effectAllowed = 'move';
}

function equipDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function equipDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    event.currentTarget.classList.remove('drag-over');
  }
}

function equipDrop(event, charId, slot) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const uid = parseInt(event.dataTransfer.getData('text/plain'));
  if (isNaN(uid)) return;
  tryEquipItem(charId, uid, slot);
  renderEquipmentTab();
}

// ── 상점 탭 (물약 상점 — 전역 재고) ──────────────────────────
function renderShopTab() {
  const el = document.getElementById('tab-shop');

  function potionMini(potionId) {
    const p     = POTIONS[potionId];
    const col   = p.type === 'hp' ? '#2ecc71' : '#3498db';
    const label = p.type === 'hp' ? `HP +${p.restoreAmt.toLocaleString()}` : `MP +${p.restoreAmt.toLocaleString()}`;
    const stock = gameState.potionStock[potionId] || 0;

    const buyBtns = [100, 500].map(qty => {
      const cost   = p.cost * qty;
      const canAff = gameState.gold >= cost;
      return `<button class="potion-buy-btn ${canAff ? '' : 'disabled'}"
                      onclick="tryBuyPotion('${potionId}',${qty});renderShopTab();">
                +${qty}<br><span style="font-size:9px;color:#aaa">${cost.toLocaleString()}G</span>
              </button>`;
    }).join('');

    return `
      <div class="potion-mini-card">
        <div style="font-size:12px;font-weight:bold;color:${col}">${p.name}</div>
        <div style="font-size:10px;color:${col};margin:2px 0">${label} · ${p.cost}G/개</div>
        <div style="font-size:10px;color:#aaa;margin-bottom:5px">재고 <strong style="color:#e2b96f">${stock}</strong>개</div>
        <div style="display:flex;gap:4px">${buyBtns}</div>
      </div>`;
  }

  el.innerHTML = `
    <div class="eq-section-title">
      물약 상점 <span style="color:#e2b96f;font-size:11px"> 골드: ${gameState.gold.toLocaleString()}G</span>
    </div>
    <div style="font-size:10px;color:#555;margin-bottom:10px">HP 50% 이하·MP 30% 이하 시 자동 사용 · 소진 시 100개 자동 충전 (5초 행동 중지)</div>
    <div class="shop-potion-label" style="color:#2ecc71">체력 물약</div>
    <div class="potion-mini-row">${['hp_s','hp_m','hp_l'].map(potionMini).join('')}</div>
    <div class="shop-potion-label" style="color:#3498db;margin-top:10px">마나 물약</div>
    <div class="potion-mini-row">${['mp_s','mp_m','mp_l'].map(potionMini).join('')}</div>`;
}

// ── 스킬 탭 ────────────────────────────────────────────────
const SKILL_TARGET_DESC = {
  single_melee: '단일 근접',
  single_long:  '단일 원거리',
  aoe:          '전체 범위',
  double_hit:   '2회 연속',
  shadow:       '분신 소환',
  passive:      '패시브',
  heal:         '범위 회복',
  aoe_freeze:   '광역 빙결',
  party_buff:   '파티 버프',
  debuff_area:  '범위 디버프',
};

function skillEffectDesc(id, s, level) {
  const m   = SKILL_LEVEL_MULTS[level] ?? 1.0;
  const cd  = s.cooldown
    ? (s.cooldownDecay
        ? Math.max(0.1, s.cooldown * Math.pow(s.cooldownDecay, level - 1)).toFixed(1)
        : s.cooldownPerLv
          ? Math.max(1, s.cooldown + s.cooldownPerLv * (level - 1)).toFixed(0)
          : (s.cooldown / (1 + (level - 1) * 0.06)).toFixed(1))
    : null;
  const mp  = s.mpCost > 0 ? `MP ${s.mpCost}` : null;
  const meta = [cd ? `쿨타임 ${cd}초` : null, mp].filter(Boolean).join(' · ');
  const suffix = meta ? ` [${meta}]` : '';
  const pct = v => `${Math.round(v * 100)}%`;

  switch (s.targeting) {
    case 'passive':
      if (s.orbsRequired)
        return `구슬 ${s.orbsRequired}개가 모이면 강력한 일격 자동 발동 · 위력 ${pct(s.dmgMultiplier * m)}${mp ? ` [${mp}]` : ''}`;
      if (s.attackInterval)
        return `${s.attackInterval}초마다 자동 연사 · 타격당 위력 ${pct((s.dmgMultiplier ?? 1) * m)} [패시브]`;
      if (s.hits)
        return `한번에 ${s.hits}개의 표창을 타격당 ${pct(m / s.hits)} 데미지로 공격 [패시브]`;
      if (s.critDmgBonus) {
        const bonus = s.critDmgBonus + (level - 1) * (s.critDmgBonusPerLv || 0);
        return `크리티컬 데미지 +${Math.round(bonus * 100)}% 증가 [패시브]`;
      }
      if (s.mgAbsorb)
        return `받는 피해의 ${Math.round(s.mgAbsorb * 100)}%를 HP 대신 MP로 대체 [패시브]`;
      return '[패시브]';
    case 'resurrection':
      return `스테이지 내 사망한 아군 전원을 즉시 부활 (HP 30%) · 경험치 손실 없음${suffix}`;

    case 'aoe':
      return `최대 ${s.maxTargets || 5}마리에게 ${pct((s.dmgMultiplier || 1) * m)} 범위 마법 공격${suffix}`;

    case 'aoe_freeze': {
      const freeze = ((s.freezeDuration || 5) + (level - 1) * 0.4).toFixed(1);
      const tgt = s.maxTargetsBase !== undefined
        ? Math.round(s.maxTargetsBase + (level - 1) * ((s.maxTargets - s.maxTargetsBase) / 9))
        : (s.maxTargets || 8);
      return `최대 ${tgt}마리에게 ${pct((s.dmgMultiplier || 1) * m)} 범위 공격 후 ${freeze}초 빙결${suffix}`;
    }
    case 'debuff_area': {
      const dmBonus = Math.round(((s.debuffDmgMult - 1) * m) * 100);
      const dur = ((s.debuffDuration || 8) * (1 + (level - 1) * 0.1)).toFixed(0);
      return `범위(${s.debuffRange}px) 내 모든 몬스터에게 ${dur}s간 받는 피해 +${dmBonus}% 부여${suffix}`;
    }
    case 'party_buff': {
      const dur = ((s.buffDuration || 30) * (1 + (level - 1) * 0.12)).toFixed(0);
      const effects = [];
      if (s.buffHp) {
        const hpMult = s.buffHp + (level - 1) * (s.buffHpPerLv || 0);
        effects.push(`HP +${Math.round((hpMult - 1) * 100)}%`);
      }
      if (s.buffCdMult)  effects.push(`스킬 쿨타임 ${Math.round(100 / s.buffCdMult)}%`);
      if (s.buffAtk) {
        const atkMult = s.buffAtk + (level - 1) * (s.buffAtkPerLv || 0);
        effects.push(`마법공격력 +${Math.round((atkMult - 1) * 100)}%`);
      }
      if (s.buffCritDmg) {
        const critBonus = s.buffCritDmg + (level - 1) * (s.buffCritDmgPerLv || 0);
        effects.push(`크리 데미지 +${Math.round(critBonus * 100)}%`);
      }
      return `파티 전원 ${effects.join(' · ')}를 ${dur}초간 강화${suffix}`;
    }
    case 'heal': {
      const h = ((s.healMult || 2) * m).toFixed(2);
      return `범위(${s.healRange}px) 내 아군 HP를 공격력의 ${h}배만큼 회복${suffix}`;
    }
    case 'shadow': {
      const dur = ((s.duration || 60) * (1 + (level - 1) * 0.12)).toFixed(0);
      return `${dur}s간 분신이 나타나 함께 공격${suffix}`;
    }
    case 'double_hit':
      return `같은 대상에게 ${s.hits || 2}번 연속 공격 · 타격당 ${pct((s.dmgMultiplier || 1) * m)} 데미지${suffix}`;

    case 'savage_blow':
      return `${s.hits}타 연속 난타 · 타격당 ${pct((s.dmgMultiplier || 1) * m)} 데미지${suffix}`;

    case 'poison_area':
      return `${s.poisonDuration}s간 독 구름 설치 · ${s.poisonTickInterval}s마다 ${pct((s.dmgMultiplier || 1) * m)} 피해${suffix}`;

    case 'piercing':
      return `${s.chargeTime}s 차지 후 전방 관통 · 위력 ${pct((s.dmgMultiplier || 1) * m)}${suffix}`;

    default:
      return `위력 ${pct((s.dmgMultiplier || 1) * m)}${suffix}`;
  }
}

function renderSkillTab() {
  const el = document.getElementById('tab-skills');
  if (gameState.characters.length === 0) {
    el.innerHTML = '<p style="color:#888">캐릭터가 없습니다.</p>';
    return;
  }

  const html = gameState.characters.map(char => {
    const cls = CLASSES[char.classId];
    const sp  = char.skillPoints || 0;
    if (!cls.canSkill) {
      return `
        <div class="char-card">
          <h3 style="color:${CLASS_COLORS[char.classId]||'#aaa'};margin-bottom:6px">
            ${char.nickname || '???'} <span style="color:#888;font-size:12px;font-weight:normal">(${charClassName(char.classId)})</span> Lv.${char.level}
          </h3>
          <div style="color:#555;font-size:12px">전직 후 스킬을 배울 수 있습니다.</div>
        </div>`;
    }

    const parentClassId = CLASSES[char.classId]?.parent;
    const col = CLASS_COLORS[char.classId] || '#aaa';

    // 1차 / 2차 스킬 분리
    const tier1Skills = Object.entries(SKILLS).filter(([, s]) => s.classId === (parentClassId || char.classId) && parentClassId);
    const tier2Skills = Object.entries(SKILLS).filter(([, s]) => s.classId === char.classId);
    // 1차 직업은 tier2에만 있음
    const onlyTier = !parentClassId ? Object.entries(SKILLS).filter(([, s]) => s.classId === char.classId) : null;

    function makeSkillCard(id, s) {
      const curLv    = char.skillLevels?.[id] || 0;
      const learned  = curLv > 0;
      const skillMaxLv = s.maxLevel || SKILL_MAX_LEVEL;
      const isMax    = curLv >= skillMaxLv;
      const nextCost = learned ? (SKILL_SP_COSTS[curLv + 1] ?? Infinity) : (SKILL_SP_COSTS[1] ?? 1);
      const canUp    = !isMax && sp >= nextCost;

      const lvBadge = learned
        ? `<span style="color:${isMax ? '#e2b96f' : '#4caf50'};font-size:10px;font-weight:bold">${isMax ? 'MAX' : `Lv.${curLv}`}</span>`
        : `<span style="color:#444;font-size:10px">미습득</span>`;

      // 미습득: Lv.1 효과 표시, 습득: 현재 레벨 효과
      const showLv  = learned ? curLv : 1;
      const desc    = skillEffectDesc(id, s, showLv);
      const nextDesc = (!isMax && learned) ? skillEffectDesc(id, s, curLv + 1) : '';

      const btn = isMax
        ? `<span style="color:#e2b96f;font-size:10px;display:block;text-align:center">MAX</span>`
        : learned
          ? `<button class="skill-card-btn-el ${canUp ? '' : 'disabled'}"
                     onclick="tryUpgradeSkill(${char.id},'${id}');renderSkillTab();">
               ${curLv}→${curLv+1} <span style="color:#888">(${nextCost}SP)</span>
             </button>`
          : `<button class="skill-card-btn-el ${canUp ? '' : 'disabled'}"
                     onclick="tryLearnSkill(${char.id},'${id}');renderSkillTab();">
               배우기 <span style="color:#888">(${nextCost}SP)</span>
             </button>`;

      return `
        <div class="skill-card ${learned ? 'skill-card-learned' : ''}">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
            <span style="font-size:12px;font-weight:bold;color:${learned ? col : '#666'}">${s.name}</span>
            ${lvBadge}
          </div>
          <div style="font-size:10px;color:${learned ? '#aaa' : '#555'};flex:1;line-height:1.4">
            ${!learned ? '<span style="color:#444;font-size:9px">Lv.1 효과: </span>' : ''}${desc}
          </div>
          ${nextDesc ? `<div style="font-size:10px;color:#3a5a3a;margin-top:2px">▲ ${nextDesc}</div>` : ''}
          <div style="margin-top:5px">${btn}</div>
        </div>`;
    }

    const tier1Html = tier1Skills.length
      ? `<div class="skill-tier-label">1차 스킬</div>
         <div class="skill-tier-row">${tier1Skills.map(([id, s]) => makeSkillCard(id, s)).join('')}</div>`
      : '';
    const tier2Html = tier2Skills.length
      ? `<div class="skill-tier-label" style="margin-top:6px">2차 스킬</div>
         <div class="skill-tier-row">${tier2Skills.map(([id, s]) => makeSkillCard(id, s)).join('')}</div>`
      : '';
    const onlyHtml = onlyTier
      ? `<div class="skill-tier-row">${onlyTier.map(([id, s]) => makeSkillCard(id, s)).join('')}</div>`
      : '';

    const resetCost     = 100 * char.level;
    const canResetSkill = gameState.gold >= resetCost;

    return `
      <div class="char-card">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
          <h3 style="color:${col};flex:1;margin:0">
            ${char.nickname || '???'} <span style="color:#888;font-size:12px;font-weight:normal">(${charClassName(char.classId)})</span> Lv.${char.level}
          </h3>
          <span style="color:${sp > 0 ? '#f1c40f' : '#555'};font-size:12px">SP <strong>${sp}</strong></span>
          <button class="reset-stat-btn ${canResetSkill ? '' : 'disabled'}"
                  onclick="tryResetSkills(${char.id});renderSkillTab();"
                  title="골드 ${resetCost.toLocaleString()} 소모">스킬초기화</button>
        </div>
        ${onlyHtml}${tier1Html}${tier2Html}
      </div>`;
  }).join('');

  el.innerHTML = html;
}

// ── 펫 탭 ──────────────────────────────────────────────────
function renderPetTab() {
  const el = document.getElementById('tab-pets');
  if (gameState.characters.length === 0) {
    el.innerHTML = '<p style="color:#888">캐릭터가 없습니다.</p>';
    return;
  }

  const charCards = gameState.characters.map(char => {
    const highLevel = char.level >= 30;
    const visiblePets = Object.entries(PETS).filter(([id]) => id === 'mini_slime' || highLevel);

    const owned = char.ownedPets || [];
    const petCards = visiblePets.map(([id, p]) => {
      const isEquipped = char.pet === id;
      const isOwned    = owned.includes(id);
      const canAfford  = !isOwned && gameState.gold >= p.cost;
      let actionHtml;
      if (isEquipped) {
        actionHtml = `<span style="font-size:10px;color:#4caf50">✓ 장착 중</span>`;
      } else if (isOwned) {
        actionHtml = `<button class="small-btn" style="font-size:10px;padding:2px 6px;border-color:#2a6a4a;color:#4caf50"
                               onclick="tryBuyPet(${char.id},'${id}');renderPetTab();">
                        보유중 (장착)
                      </button>`;
      } else {
        actionHtml = `<button class="small-btn ${canAfford ? '' : 'disabled'}" style="font-size:10px;padding:2px 6px"
                               onclick="tryBuyPet(${char.id},'${id}');renderPetTab();">
                        ${p.cost.toLocaleString()}G
                      </button>`;
      }
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;
                    padding:8px;min-width:90px;border:1px solid ${isEquipped ? '#4caf50' : isOwned ? '#1a4a2a' : '#2a3a2a'};
                    border-radius:6px;background:${isEquipped ? '#0a2010' : isOwned ? '#0a1a10' : '#111'};flex-shrink:0">
          <span style="font-size:12px;font-weight:bold;color:${isEquipped ? '#4caf50' : isOwned ? '#5cbc80' : '#d0d0d0'}">${p.name}</span>
          <span style="font-size:10px;color:#888;text-align:center;line-height:1.3">${p.desc}</span>
          ${actionHtml}
        </div>`;
    }).join('');

    const lockNotice = !highLevel
      ? `<div style="font-size:10px;color:#666;padding:4px 0">Lv.30 이상 시 더 많은 펫 해금</div>`
      : '';

    return `
      <div class="char-card" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span style="color:${CLASS_COLORS[char.classId]||'#aaa'};font-weight:bold">${char.nickname || '???'}</span>
          <span style="color:#888;font-size:12px">(${charClassName(char.classId)}) Lv.${char.level}</span>
          ${char.pet && PETS[char.pet] ? `<span style="font-size:11px;color:#4caf50">─ ${PETS[char.pet].name} 장착 중</span>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${petCards}</div>
        ${lockNotice}
      </div>`;
  }).join('');

  const dropCount = gameState.drops.length;
  const dropNotice = dropCount > 0
    ? `<div style="margin-top:8px;padding:6px 10px;background:#1a1a0a;border:1px solid #3a3a1a;border-radius:4px;font-size:12px;color:#e2b96f">
         드랍 아이템 ${dropCount}개 필드에 존재
       </div>`
    : '';

  el.innerHTML = `
    <div class="eq-section-title">펫</div>
    <div style="font-size:11px;color:#666;margin-bottom:8px">
      캐릭터마다 펫을 개별 장착합니다. 펫이 없으면 캐릭터가 드랍을 직접 수집합니다.
    </div>
    ${charCards}
    ${dropNotice}`;
}

// ── 스테이지 탭 ────────────────────────────────────────────
function renderStageTab() {
  const el     = document.getElementById('tab-stage');
  const viewIdx = gameState.viewStage;
  const cur    = STAGES[viewIdx];
  const field  = gameState.stageFields[viewIdx];
  const kills  = field ? field.kills : 0;
  const pct    = Math.floor((kills / cur.killsToAdvance) * 100);
  const atMax  = viewIdx === STAGES.length - 1;

  const stageRows = STAGES.map((s, i) => {
    const unlocked  = i <= gameState.maxStageReached;
    const isView    = i === viewIdx;
    const charsHere = gameState.characters.filter(c => c.assignedStage === i);
    const charIcons = charsHere.map(c =>
      `<span style="color:${CLASS_COLORS[c.classId] || '#aaa'};font-size:11px">● </span>`
    ).join('');

    const f = gameState.stageFields[i];
    const fKills = f ? f.kills : 0;
    const conquered = i < gameState.maxStageReached;
    const killInfo = conquered
      ? `<span class="stage-row-kills" style="color:#4caf50">정복완료</span>`
      : charsHere.length > 0
        ? `<span class="stage-row-kills">${fKills} / ${s.killsToAdvance}</span>`
        : `<span class="stage-row-kills" style="color:#444">${s.killsToAdvance}처치</span>`;

    let statusLabel = '', statusClass = '';
    if (isView)        { statusLabel = '👁 보는 중'; statusClass = 'status-current'; }
    else if (!unlocked){ statusLabel = '🔒';         statusClass = 'status-locked';  }

    return `
      <div class="stage-row ${isView ? 'stage-row-active' : ''} ${unlocked ? 'stage-row-unlock' : 'stage-row-locked'}"
           ${unlocked ? `onclick="goToStage(${i}); renderStageTab();"` : ''}>
        <span class="stage-row-num">${i + 1}</span>
        <span class="stage-row-name">${s.name}</span>
        <span class="stage-row-monster">${s.monster.name}</span>
        <span class="stage-row-chars">${charIcons}</span>
        ${killInfo}
        <span class="stage-row-status ${statusClass}">${statusLabel}</span>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="stage-current-box">
      <div class="stage-current-title">
        ${viewIdx + 1}. ${cur.name}
        ${atMax ? '<span style="color:#e2b96f;font-size:11px"> ✦ 최고 스테이지</span>' : ''}
      </div>
      <div class="stage-monster-info">
        <span>${cur.monster.name}</span>
        <span>HP ${cur.monster.hp}</span>
        <span>공격 ${cur.monster.atk}</span>
        <span>방어 ${cur.monster.def}</span>
        <span>골드 +${cur.monster.goldDrop}</span>
        <span>경험치 +${cur.monster.expDrop}</span>
      </div>
      <div style="margin:6px 0 2px;font-size:12px">
        처치 진행: <strong>${kills} / ${cur.killsToAdvance}</strong> (${pct}%)
      </div>
      <div class="exp-bar-wrap">
        <div class="exp-bar-fill" style="width:${pct}%;background:#e2b96f"></div>
      </div>
      ${atMax ? '<div style="color:#888;font-size:11px;margin-top:4px">최고 스테이지 — 계속 파밍 가능</div>' : ''}
    </div>
    <div style="font-size:11px;color:#666;margin-bottom:6px">
      스테이지를 클릭하면 보기만 변경됩니다. 캐릭터 배치는 캐릭터 탭에서 변경하세요.
    </div>
    <div class="stage-list">${stageRows}</div>`;
}

// ── 업그레이드 탭 ──────────────────────────────────────────
function upgradeEffectText(id, level) {
  if (!level) return '효과 없음';
  switch (id) {
    case 'atk_boost':  return `공격력 +${level * 5}%`;
    case 'def_boost':  return `물리방어 +${level * 3}`;
    case 'exp_boost':  return `경험치 +${level * 10}%`;
    case 'gold_boost': return `골드 +${level * 10}%`;
    case 'atk_spd':   return `공격속도 +${level * 5}%`;
    default: return '';
  }
}

// ── 제작 탭 ────────────────────────────────────────────────
function renderCraftTab() {
  const el = document.getElementById('tab-craft');
  const crystals = gameState.crystals || { dim: 0, bright: 0, radiant: 0 };

  const crystalRow = Object.entries(CRYSTAL_NAMES).map(([key, name]) =>
    `<span style="color:${CRYSTAL_COLORS[key]};margin-right:16px">${name} <strong>${crystals[key] || 0}</strong>개</span>`
  ).join('');

  // 무기/표창류는 5배 비용
  function craftCost(e) {
    const base = CRAFT_COSTS[e.grade] || 5;
    if (e.type === 'weapon' || e.type === 'throwable') return base * 5;
    if (e.type === 'armor' || e.type === 'accessory') return base * 4;
    return base;
  }

  const grades = ['노멀', '레어', '에픽'];
  const craftHtml = grades.map(grade => {
    const key  = CRYSTAL_KEYS[grade];
    const col  = GRADE_COLORS[grade] || '#aaa';
    const have = crystals[key] || 0;

    // 유니크·무료 아이템 제외, 그 외 전부 포함
    const items = Object.entries(EQUIPMENT).filter(([id, e]) =>
      e.grade === grade && e.cost > 0 && CRYSTAL_KEYS[e.grade]
    );
    if (!items.length) return '';

    const rows = items.map(([id, e]) => {
      const cost = craftCost(e);
      const canCraft = have >= cost;
      const typeTag = e.type === 'weapon' || e.type === 'throwable'
        ? `<span style="font-size:10px;color:#c9a060;margin-left:4px">[무기]</span>` : '';
      return `
        <div class="craft-item">
          <div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0">
            <span style="color:${col}">${e.name}</span>${typeTag}
            <span class="equip-stat-text">${equipStatText(e, 0)}</span>
          </div>
          <button class="small-btn ${canCraft ? '' : 'disabled'}" style="flex-shrink:0;font-size:11px"
                  onclick="tryCraftItem('${id}');renderCraftTab();">
            ${CRYSTAL_NAMES[key]} ${cost}개
          </button>
        </div>`;
    }).join('');

    return `
      <div class="eq-section-title" style="color:${col};margin-top:10px">
        ${grade}
        <span style="font-size:10px;color:#666;font-weight:normal;margin-left:6px">보유 ${have}개</span>
      </div>
      ${rows}`;
  }).join('');

  el.innerHTML = `
    <div class="eq-section-title">결정 보유량</div>
    <div style="margin-bottom:12px;padding:8px;background:#0d1b2a;border-radius:4px;border:1px solid #1a2a3a">
      ${crystalRow}
    </div>
    ${craftHtml}`;
}

function renderUpgradeTab() {
  const el = document.getElementById('tab-upgrades');

  const rows = Object.entries(UPGRADES).map(([id, def]) => {
    const lv       = gameState.upgrades[id] || 0;
    const isMax    = lv >= def.maxLevel;
    const cost     = isMax ? 0 : upgradeCost(id);
    const canAfford = !isMax && gameState.gold >= cost;
    const nextLv   = lv + 1;
    const nextEffect = (() => {
      switch (id) {
        case 'atk_boost':  return `공격력 +${nextLv * 5}%`;
        case 'def_boost':  return `물리방어 +${nextLv * 3}`;
        case 'exp_boost':  return `경험치 +${nextLv * 10}%`;
        case 'gold_boost': return `골드 +${nextLv * 10}%`;
        case 'atk_spd':   return `공격속도 +${nextLv * 5}%`;
        default: return '';
      }
    })();

    return `
      <div class="upgrade-row">
        <div class="upgrade-info">
          <div class="upgrade-name">${def.name}</div>
          <div class="upgrade-desc">${def.desc} <span class="upgrade-unit">${def.unit}</span></div>
          <div class="upgrade-current">
            현재: <strong style="color:${lv > 0 ? '#4caf50' : '#555'}">${upgradeEffectText(id, lv)}</strong>
            ${!isMax ? `→ <span style="color:#e2b96f">${nextEffect}</span>` : ''}
          </div>
        </div>
        <div class="upgrade-right">
          <span class="upgrade-level ${isMax ? 'upgrade-max' : ''}">
            ${isMax ? 'MAX' : `Lv.${lv} / ${def.maxLevel}`}
          </span>
          ${isMax
            ? ''
            : `<button class="small-btn ${canAfford ? '' : 'disabled'}"
                       onclick="tryBuyUpgrade('${id}');renderUpgradeTab();">
                 ${cost.toLocaleString()}G
               </button>`}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="eq-section-title">파티 업그레이드</div>
    <div style="font-size:11px;color:#666;margin-bottom:12px">
      골드를 사용해 파티 전체에 영구 강화를 적용합니다.
    </div>
    <div class="upgrade-list">${rows}</div>`;
}

// ── 레이드 탭 ─────────────────────────────────────────────
function renderRaidTab() {
  const el = document.getElementById('tab-raid');
  if (!el) return;

  const rf = gameState.raidField;
  const raidChars    = gameState.characters.filter(c => c.inRaid);
  const killedChars  = gameState.characters.filter(c => !c.inRaid && c.raidKilled);
  const normalChars  = gameState.characters.filter(c => !c.inRaid && !c.raidKilled);

  const bossSection = (() => {
    if (!rf) return `<div style="color:#999;font-size:12px">레이드가 초기화되지 않았습니다.</div>`;
    const b     = rf.boss;
    const pct   = Math.max(0, (b.hp / b.maxHp) * 100).toFixed(1);
    const col   = b.hp / b.maxHp > 0.5 ? '#c0392b' : b.hp / b.maxHp > 0.2 ? '#e67e22' : '#7b241c';
    const minAlive = rf.minions.filter(m => m.alive).length;
    return `
      <div class="upgrade-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div style="color:#e74c3c;font-weight:bold;font-size:14px">자쿰</div>
        <div style="font-size:11px;color:#aaa">HP: ${b.hp.toLocaleString()} / ${b.maxHp.toLocaleString()} (${pct}%)</div>
        <div style="width:100%;height:10px;background:#1a0010;border-radius:4px;overflow:hidden;margin:2px 0">
          <div style="width:${pct}%;height:100%;background:${col};transition:width 0.3s"></div>
        </div>
        <div style="font-size:11px;color:#e67e22">소환수: ${minAlive}마리 생존</div>
        ${rf.cleared ? `<div style="color:#f1c40f;font-weight:bold">✓ 자쿰 격파 완료!</div>` : ''}
      </div>`;
  })();

  const raidCharRows = raidChars.map(c => {
    const s    = calcFinalStats(c);
    const hp   = Math.max(0, c.currentHp || 0);
    const hpPct = Math.min(100, (hp / s.maxHp) * 100).toFixed(0);
    const dead = c.isDead ? `<span style="color:#e74c3c"> (전사 복귀 중…)</span>` : '';
    const seal = (c.raidSkillSeal || 0) > 0 ? `<span style="color:#8e44ad"> 봉인${c.raidSkillSeal.toFixed(0)}s</span>` : '';
    const acc  = (c.raidAccDown   || 0) > 0 ? `<span style="color:#7f8c8d"> 암흑${c.raidAccDown.toFixed(0)}s</span>` : '';
    const col  = CLASS_COLORS[c.classId] || '#aaa';
    return `
      <div class="upgrade-row">
        <div class="upgrade-info" style="gap:2px">
          <div style="font-size:12px;font-weight:bold">
            <span style="color:${col}">${c.nickname || '???'}</span>
            <span style="color:#888;font-weight:normal"> (${CLASSES[c.classId]?.name || c.classId}) Lv.${c.level}</span>${dead}${seal}${acc}
          </div>
          <div style="font-size:10px;color:#aaa">HP ${hp.toLocaleString()} / ${s.maxHp.toLocaleString()} (${hpPct}%)</div>
        </div>
        <button class="small-btn" onclick="leaveRaid(${c.id});renderRaidTab();">복귀</button>
      </div>`;
  }).join('');

  const normalCharRows = normalChars.map(c => {
    const col = CLASS_COLORS[c.classId] || '#aaa';
    return `
      <div class="upgrade-row">
        <div class="upgrade-info">
          <div style="font-size:12px;font-weight:bold">
            <span style="color:${col}">${c.nickname || '???'}</span>
            <span style="color:#888;font-weight:normal"> (${CLASSES[c.classId]?.name || c.classId}) Lv.${c.level}</span>
          </div>
          <div style="font-size:10px;color:#aaa">스테이지 ${c.assignedStage + 1}에 배치 중</div>
        </div>
        <button class="small-btn ${rf?.cleared ? 'disabled' : ''}"
                onclick="enterRaid(${c.id});renderRaidTab();">
          참전
        </button>
      </div>`;
  }).join('');

  const viewBtn = gameState.viewRaid
    ? `<button class="small-btn" onclick="gameState.viewRaid=false;renderRaidTab();">필드 보기</button>`
    : `<button class="small-btn" onclick="gameState.viewRaid=true;renderRaidTab();">레이드 보기</button>`;

  const resetBtn = `<button class="small-btn" style="margin-left:8px" onclick="if(confirm('레이드를 리셋하시겠습니까?')){resetRaid();}renderRaidTab();">리셋</button>`;
  const leaveAllBtn = raidChars.length
    ? `<button class="small-btn" style="margin-left:8px" onclick="gameState.characters.filter(c=>c.inRaid).forEach(c=>leaveRaid(c.id));renderRaidTab();">전체 복귀</button>`
    : '';

  el.innerHTML = `
    <div class="eq-section-title">⚔️ 자쿰 레이드</div>
    <div style="font-size:11px;color:#666;margin-bottom:8px">
      캐릭터를 레이드에 참전시켜 자쿰을 처치하세요.<br>
      레이드 중인 캐릭터는 일반 스테이지 전투에 참여하지 않습니다.
    </div>
    <div style="margin-bottom:10px;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
      ${viewBtn}${resetBtn}${leaveAllBtn}
    </div>
    <div class="eq-section-title" style="font-size:12px">보스 상태</div>
    ${bossSection}
    <div class="eq-section-title" style="font-size:12px;margin-top:10px">레이드 참전 중 (${raidChars.length}명)</div>
    ${raidChars.length ? raidCharRows : `<div style="color:#555;font-size:11px">참전 중인 캐릭터 없음</div>`}
    ${killedChars.length ? `
    <div class="eq-section-title" style="font-size:12px;margin-top:10px;color:#e74c3c">전사 (${killedChars.length}명) — 재참전 불가</div>
    ${killedChars.map(c => {
      const col = CLASS_COLORS[c.classId] || '#aaa';
      return `<div class="upgrade-row" style="opacity:0.55">
        <div class="upgrade-info">
          <div style="font-size:12px;font-weight:bold">
            <span style="color:${col}">${c.nickname || '???'}</span>
            <span style="color:#888;font-weight:normal"> (${CLASSES[c.classId]?.name || c.classId}) Lv.${c.level}</span>
          </div>
          <div style="font-size:10px;color:#e74c3c">이번 레이드에서 전사</div>
        </div>
        <span style="color:#e74c3c;font-size:12px">✕</span>
      </div>`;
    }).join('')}` : ''}
    <div class="eq-section-title" style="font-size:12px;margin-top:10px">참전 가능 캐릭터 (${normalChars.length}명)</div>
    ${normalChars.length ? normalCharRows : `<div style="color:#555;font-size:11px">참전 가능한 캐릭터 없음</div>`}`;
}

// ── 오프라인 보상 모달 ──────────────────────────────────────
function showOfflineModal(result) {
  const el = document.getElementById('offline-modal');
  if (!el) return;

  const h = Math.floor(result.seconds / 3600);
  const m = Math.floor((result.seconds % 3600) / 60);
  const timeStr = h > 0 ? `${h}시간 ${m}분` : `${m}분`;

  const expLines = gameState.characters.map(char => {
    const gained = result.expGains[char.id] || 0;
    if (!gained) return '';
    return `<div class="offline-exp-line">
      <span style="color:${CLASS_COLORS[char.classId] || '#aaa'}">${char.nickname || '???'} (${charClassName(char.classId)}) Lv.${char.level}</span>
      <span>+${gained.toLocaleString()} EXP</span>
    </div>`;
  }).filter(Boolean).join('');

  document.getElementById('offline-time').textContent = timeStr;
  document.getElementById('offline-gold').textContent = result.totalGold.toLocaleString() + 'G';
  document.getElementById('offline-exp-list').innerHTML = expLines || '<div style="color:#555;font-size:12px">없음</div>';
  el.classList.add('active');
}

function closeOfflineModal() {
  const el = document.getElementById('offline-modal');
  if (el) el.classList.remove('active');
}

// ── 강화 결과 플로팅 텍스트 (버튼 위로 떠오름) ───────────────
function showEnhanceFloat(btn, result) {
  if (!result || !btn) return;
  const rect = btn.getBoundingClientRect();
  const el   = document.createElement('div');
  el.textContent = result.success ? `+${result.newLevel} 성공!` : '강화 실패';
  el.style.cssText = [
    'position:fixed',
    `left:${Math.round(rect.left + rect.width / 2)}px`,
    `top:${Math.round(rect.top - 4)}px`,
    'transform:translateX(-50%)',
    `color:${result.success ? '#4caf50' : '#e74c3c'}`,
    'font-size:15px', 'font-weight:bold',
    'pointer-events:none', 'z-index:9999',
    'text-shadow:0 1px 6px #000c',
    'transition:top 0.75s ease-out, opacity 0.75s ease-out',
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.top  = `${Math.round(rect.top - 52)}px`;
      el.style.opacity = '0';
    });
  });
  setTimeout(() => el.remove(), 800);
}

// ── 공통 헬퍼 ──────────────────────────────────────────────
function charClassName(classId) {
  return CLASSES[classId]?.name || classId;
}

function charLabel(char) {
  return `${char.nickname || '???'} (${charClassName(char.classId)})`;
}

// ── 캐릭터 리스트 패널 (canvas 오버레이) ────────────────────
let charModalOpenId = null;
let charModalSection = 'stats';

function updateCharList() {
  const panel = document.getElementById('char-list-panel');
  if (!panel) return;

  const stageChars = gameState.characters.filter(
    c => !c.inRaid && c.assignedStage === gameState.viewStage
  );

  // 구성이 바뀐 경우만 DOM 재빌드 (클릭 mousedown~mouseup 사이 DOM 교체 방지)
  const curIds = Array.from(panel.querySelectorAll('.char-list-item')).map(el => el.dataset.charId);
  const newIds = stageChars.map(c => String(c.id));
  const needsRebuild = curIds.length !== newIds.length || curIds.some((id, i) => id !== newIds[i]);

  if (needsRebuild) {
    if (stageChars.length === 0) { panel.innerHTML = ''; return; }
    panel.innerHTML = stageChars.map(char => {
      const fs     = calcFinalStats(char);
      const maxHp  = char.maxHpCache || fs.maxHp;
      const hp     = Math.max(0, char.currentHp || maxHp);
      const hpPct  = Math.min(100, (hp / maxHp) * 100);
      const ratio  = hp / maxHp;
      const hpCol  = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#e67e22' : '#e74c3c';
      const col    = CLASS_COLORS[char.classId] || '#aaa';
      const tag    = char.isDead ? '💀 ' : '';
      return `
        <div class="char-list-item" data-char-id="${char.id}">
          <div class="char-list-nick" style="color:${col}">${tag}${char.nickname || '???'}(${charClassName(char.classId)})</div>
          <div class="char-list-sub">Lv.${char.level}</div>
          <div class="char-list-hp">
            <div class="char-list-hp-fill" style="width:${hpPct}%;background:${hpCol}"></div>
          </div>
        </div>`;
    }).join('');
    return;
  }

  // 구성 동일 → HP바만 업데이트 (DOM 유지, 클릭 안전)
  for (const char of stageChars) {
    const item = panel.querySelector(`.char-list-item[data-char-id="${char.id}"]`);
    if (!item) continue;
    const fs    = calcFinalStats(char);
    const maxHp = char.maxHpCache || fs.maxHp;
    const hp    = Math.max(0, char.currentHp || maxHp);
    const ratio = hp / maxHp;
    const hpPct = Math.min(100, ratio * 100);
    const hpCol = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#e67e22' : '#e74c3c';
    const fill  = item.querySelector('.char-list-hp-fill');
    if (fill) { fill.style.width = `${hpPct}%`; fill.style.background = hpCol; }
    const nick = item.querySelector('.char-list-nick');
    if (nick) {
      const tag = char.isDead ? '💀 ' : '';
      nick.textContent = `${tag}${char.nickname || '???'}(${charClassName(char.classId)})`;
    }
  }
}

// ── 캐릭터 상세 모달 ────────────────────────────────────────
function openCharModal(charId) {
  charModalOpenId = charId;
  charModalSection = 'stats';
  document.getElementById('char-modal-overlay').classList.add('active');
  renderCharModal();
}

// ── 레이드 결과 모달 ─────────────────────────────────────────
function showRaidResult(rf) {
  const overlay = document.getElementById('raid-result-overlay');
  if (!overlay) return;

  const totalSec = Math.floor(rf.elapsedTime || 0);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  document.getElementById('raid-result-time').textContent =
    `${mins}분 ${secs.toString().padStart(2, '0')}초`;

  const medals = ['🥇', '🥈', '🥉'];
  const dmgEntries = Object.entries(rf.damageLog || {})
    .map(([id, dmg]) => {
      const c = gameState.characters.find(ch => ch.id === Number(id));
      return { name: c ? (c.nickname || '???') : '???', job: c ? charClassName(c.classId) : '', dmg };
    })
    .sort((a, b) => b.dmg - a.dmg);

  const dmgEl = document.getElementById('raid-result-dmg');
  if (dmgEntries.length) {
    dmgEl.innerHTML = dmgEntries.slice(0, 3).map((e, i) =>
      `<div class="raid-result-row">
        <span>${medals[i] || ''} ${e.name} <span style="color:#666;font-size:11px">(${e.job})</span></span>
        <span style="color:#e74c3c;font-weight:bold">${e.dmg.toLocaleString()}</span>
      </div>`
    ).join('');
  } else {
    dmgEl.innerHTML = '<div style="color:#666;font-size:12px">데이터 없음</div>';
  }

  const healEntries = Object.entries(rf.healLog || {})
    .map(([id, heal]) => {
      const c = gameState.characters.find(ch => ch.id === Number(id));
      return { name: c ? (c.nickname || '???') : '???', job: c ? charClassName(c.classId) : '', heal };
    })
    .filter(e => e.heal > 0)
    .sort((a, b) => b.heal - a.heal);

  const healEl = document.getElementById('raid-result-heal');
  if (healEntries.length) {
    healEl.innerHTML = healEntries.map(e =>
      `<div class="raid-result-row">
        <span>💚 ${e.name} <span style="color:#666;font-size:11px">(${e.job})</span></span>
        <span style="color:#2ecc71;font-weight:bold">${e.heal.toLocaleString()}</span>
      </div>`
    ).join('');
  } else {
    healEl.innerHTML = '<div style="color:#666;font-size:12px">힐러 없음</div>';
  }

  overlay.classList.add('active');
}

function closeRaidResult() {
  document.getElementById('raid-result-overlay').classList.remove('active');
}

function closeCharModal() {
  charModalOpenId = null;
  document.getElementById('char-modal-overlay').classList.remove('active');
}

function switchCharModalSection(section) {
  charModalSection = section;
  document.querySelectorAll('.modal-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.section === section);
  });
  renderCharModalBody();
}

function renderCharModal() {
  const char = gameState.characters.find(c => c.id === charModalOpenId);
  if (!char) { closeCharModal(); return; }
  const col = CLASS_COLORS[char.classId] || '#aaa';
  document.getElementById('char-modal-title').innerHTML =
    `<span style="color:${col}">${char.nickname || '???'}</span>` +
    ` <span style="color:#888;font-size:12px;font-weight:normal">(${charClassName(char.classId)})</span>`;
  document.querySelectorAll('.modal-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.section === charModalSection);
  });
  renderCharModalBody();
}

function renderCharModalBody() {
  const char = gameState.characters.find(c => c.id === charModalOpenId);
  if (!char) return;
  const body = document.getElementById('char-modal-body');
  if (!body) return;
  if (charModalSection === 'stats')         body.innerHTML = buildModalStats(char);
  else if (charModalSection === 'equipment') body.innerHTML = buildModalEquipment(char);
  else if (charModalSection === 'skills')    body.innerHTML = buildModalSkills(char);
}

function buildModalStats(char) {
  const fs        = calcFinalStats(char);
  const hasPoints = char.unspentPoints > 0;
  const isMagic   = CLASSES[char.classId]?.damageType === 'magical';
  const resetCost = 100 * char.level;
  const canReset  = gameState.gold >= resetCost;

  const statRows = ['STR', 'DEX', 'INT', 'LUK'].map(stat => {
    const bonus = equipStatBonus(char, stat);
    const btn = hasPoints
      ? `<button class="stat-plus-btn" onclick="tryAddStatPoint(${char.id},'${stat}');renderCharModalBody();">＋</button>`
      : `<span class="stat-plus-placeholder"></span>`;
    return `
      <div class="stat-row">
        <span class="stat-label">${stat}</span>
        <span class="stat-val">${statValHtml(char.stats[stat], bonus)}</span>
        ${btn}
        <span class="stat-desc" style="font-size:10px">${STAT_LABELS[stat]}</span>
      </div>`;
  }).join('');

  const curMp  = Math.floor(char.currentMp ?? fs.maxMp);
  const combatRows = [
    ['공격력',    `${fs.atk}`],
    ['물리방어',  `${fs.physDef}`],
    ['마법공격',  isMagic ? `${fs.atk}` : `<span style="color:#555">—</span>`],
    ['마법방어',  `${fs.magicDef}`],
    ['명중률',    `${fs.accuracy.toFixed(0)}%`],
    ['회피율',    `${fs.evade.toFixed(0)}%`],
    ['이동속도',  `${CHAR_SPEED} px/s`],
    ['최대 MP',   `<span style="color:#3498db">${fs.maxMp}</span> <span style="color:#555;font-size:10px">(현재 ${curMp})</span>`],
  ].map(([label, val]) => `
    <div class="stat-row">
      <span class="stat-label" style="width:64px;color:#aaa">${label}</span>
      <span class="stat-val">${val}</span>
    </div>`).join('');

  return `
    <div class="nickname-edit-row">
      <span style="font-size:12px;color:#888;flex-shrink:0">닉네임</span>
      <input class="nickname-input" id="nick-inp-${char.id}" value="${char.nickname || ''}" maxlength="12" placeholder="최대 12자">
      <button class="small-btn" onclick="trySetNickname(${char.id},document.getElementById('nick-inp-${char.id}').value);renderCharModal();">변경</button>
    </div>
    <div style="font-size:12px;color:#aaa;margin-bottom:8px">Lv.${char.level} &nbsp; EXP ${char.exp} / ${expRequired(char.level)}</div>
    ${hasPoints ? `<div class="points-badge" style="margin-bottom:8px">잔여 포인트: <strong>${char.unspentPoints}</strong></div>` : ''}
    <div class="eq-section-title" style="margin-bottom:6px">기본 스탯</div>
    <div class="stat-grid" style="margin-bottom:12px">${statRows}</div>
    <div class="eq-section-title" style="margin-bottom:6px">전투 능력치</div>
    <div class="stat-grid" style="margin-bottom:12px">${combatRows}</div>
    <button class="small-btn reset-btn ${canReset ? '' : 'disabled'}" style="width:100%"
            onclick="tryResetStats(${char.id});renderCharModalBody();">
      스탯 초기화 (${resetCost.toLocaleString()}G)
    </button>`;
}

function buildModalEquipment(char) {
  const slotList = getCharSlotList(char);

  const slots = slotList.map(slot => {
    const item = char.equipment[slot];
    const e    = item ? EQUIPMENT[item.id] : null;
    const col  = e ? (GRADE_COLORS[e.grade] || '#aaa') : '#333';
    const canRemove = item && item.uid !== 0;
    const _mMax  = item ? itemMaxEnhance(item) : 0;
    const enhBtn = item && _mMax > 0 && item.enhance < _mMax ? (() => {
      const cost    = enhanceCost(item);
      const canAff  = gameState.gold >= cost;
      const succPct = ENHANCE_SUCCESS[item.enhance];
      return `<button class="small-btn enhance-btn ${canAff ? '' : 'disabled'}"
                      onclick="this.disabled=true;showEnhanceFloat(this,tryEnhanceEquipment(${item.uid}));markCharModalDirty();"
                      title="성공률 ${succPct}%">강화 ${cost.toLocaleString()}G (${succPct}%)</button>`;
    })() : (item && _mMax > 0 && item.enhance >= _mMax ? `<span style="color:#e2b96f;font-size:10px">MAX</span>` : '');
    return `
      <div class="equip-slot">
        <div class="equip-slot-label">${SLOT_NAMES[slot]}</div>
        <div class="equip-slot-item" style="border-color:${col}">
          ${e
            ? `<span style="color:${col}">${e.name}${enhanceBadge(item.enhance)}</span>
               <span class="equip-stat-text">${equipStatText(e, item.enhance)}</span>`
            : `<span style="color:#444">— 없음 —</span>`}
          <div style="display:flex;gap:4px;margin-left:auto;flex-shrink:0;align-items:center">
            ${enhBtn}
            ${canRemove ? `<button class="equip-remove" onclick="tryUnequipItem(${char.id},'${slot}');renderCharModalBody();">✕</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const inv = gameState.equipmentInventory;
  const gradeCount = g => inv.filter(i => { const e = EQUIPMENT[i.id]; return e && e.grade === g; }).length;
  const sellBtns = ['노멀', '레어', '에픽'].map(g => {
    const cnt = gradeCount(g);
    const col = GRADE_COLORS[g] || '#aaa';
    return `<button class="small-btn ${cnt > 0 ? '' : 'disabled'}" style="color:${col}"
                    onclick="trySellByGrade('${g}');renderCharModalBody();">
              ${g} 일괄판매 (${cnt})
            </button>`;
  }).join('');

  const equipableInv = inv.filter(item => canEquipItem(char, item));
  const invHtml = equipableInv.length === 0
    ? '<div style="color:#555;font-size:12px">장착 가능한 장비 없음</div>'
    : equipableInv.map(item => {
        const e = EQUIPMENT[item.id];
        if (!e) return '';
        const col      = GRADE_COLORS[e.grade] || '#aaa';
        const isThiefWeapon2 = char.classId === 'thief' && e.type === 'weapon';
        const equipBtn = isThiefWeapon2
          ? `<button class="assign-btn" onclick="tryEquipItem(${char.id},${item.uid});renderCharModalBody();">무기 1</button>` +
            `<button class="assign-btn" onclick="tryEquipItem(${char.id},${item.uid},'weapon2');renderCharModalBody();">무기 2</button>`
          : `<button class="assign-btn" onclick="tryEquipItem(${char.id},${item.uid});renderCharModalBody();">장착</button>`;
        const sellPrice = e.cost ? Math.floor(e.cost * 0.6) : 0;
        const sellBtn = sellPrice > 0
          ? `<button class="equip-remove sell-btn" onclick="trySellItem(${item.uid});renderCharModalBody();">판매 ${sellPrice.toLocaleString()}G</button>`
          : '';
        const _invMax = itemMaxEnhance(item);
        const canAff  = _invMax > 0 && item.enhance < _invMax && gameState.gold >= enhanceCost(item);
        const enhBtn  = _invMax === 0 ? ''
          : item.enhance < _invMax
            ? `<button class="small-btn enhance-btn ${canAff ? '' : 'disabled'}"
                       onclick="this.disabled=true;showEnhanceFloat(this,tryEnhanceEquipment(${item.uid}));markCharModalDirty();">강화 ${enhanceCost(item).toLocaleString()}G</button>`
            : `<span style="color:#e2b96f;font-size:10px">MAX</span>`;
        return `
          <div class="inv-item">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="color:${col}">${e.name}${enhanceBadge(item.enhance)}</span>
              <span class="equip-stat-text">${equipStatText(e, item.enhance)}</span>
            </div>
            <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;align-items:center">
              ${equipBtn}${enhBtn}${sellBtn}
            </div>
          </div>`;
      }).join('');

  const allSlots2  = getCharSlotList(char);
  const canAutoEquip = allSlots2.some(slot => {
    const cur = char.equipment[slot];
    if (cur && cur.uid !== 0) return false;
    return gameState.equipmentInventory.some(item => {
      const e = EQUIPMENT[item.id];
      return e && e.type === slot && canEquipItem(char, item);
    });
  });
  const autoBtn = canAutoEquip
    ? `<button class="small-btn" style="margin-bottom:10px;width:100%"
               onclick="tryAutoEquip(${char.id});markCharModalDirty();">빈 슬롯 자동 장착</button>`
    : '';

  // 물약 타입 선택 섹션
  function potionSelectHtml(slotType, label, col, potionIds) {
    const selectedKey = slotType === 'hp' ? 'selectedHpPotion' : 'selectedMpPotion';
    const equippedKey = slotType === 'hp' ? 'equippedHpPotion' : 'equippedMpPotion';
    const timerKey    = slotType === 'hp' ? 'hpRefillTimer'    : 'mpRefillTimer';
    const selected    = char[selectedKey];
    const equipped    = char[equippedKey] || { id: null, count: 0 };
    const refillTimer = char[timerKey] || 0;

    const statusText = refillTimer > 0
      ? `<span style="color:#f39c12;font-size:11px">충전 중 ${refillTimer.toFixed(1)}s</span>`
      : equipped.count > 0
        ? `<span style="color:${col};font-size:11px">장착 ${equipped.count}개</span>`
        : selected
          ? `<span style="color:#888;font-size:11px">소진 (재고 대기 중)</span>`
          : `<span style="color:#555;font-size:11px">미사용</span>`;

    const opts = [
      { id: null,  name: '없음' },
      ...potionIds.map(id => ({ id, name: POTIONS[id].name.replace(/(체력|마나) 물약 /, '') })),
    ];

    const btns = opts.map(opt => {
      const isActive = (selected === opt.id) || (!opt.id && !selected);
      const onclick  = `selectCharPotion(${char.id},'${slotType}',${opt.id ? `'${opt.id}'` : 'null'});renderCharModalBody();`;
      const stock    = opt.id ? (gameState.potionStock[opt.id] || 0) : 0;
      const stockTip = opt.id ? ` (재고 ${stock})` : '';
      return `<button class="assign-btn ${isActive ? 'active' : ''}"
                      style="${isActive ? `color:${col};` : ''}"
                      onclick="${onclick}" title="${opt.name}${stockTip}">${opt.name}</button>`;
    }).join('');

    return `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;color:#888;margin-bottom:4px">${label} &nbsp; ${statusText}</div>
        <div class="assign-btns">${btns}</div>
      </div>`;
  }

  const potionSlots = [
    potionSelectHtml('hp', 'HP 물약', '#2ecc71', ['hp_s', 'hp_m', 'hp_l']),
    potionSelectHtml('mp', 'MP 물약', '#3498db', ['mp_s', 'mp_m', 'mp_l']),
  ].join('');

  return `
    ${autoBtn}
    <div class="eq-section-title" style="margin-bottom:6px">장착 중</div>
    <div class="equip-slots" style="margin-bottom:12px">${slots}</div>
    <div class="eq-section-title" style="margin-bottom:6px">물약 설정</div>
    <div style="font-size:10px;color:#666;margin-bottom:6px">HP 50% 이하 자동 사용 · MP 30% 이하 자동 사용 · 소진 시 100개 자동 충전 (5초)</div>
    <div style="margin-bottom:12px">${potionSlots}</div>
    <div class="eq-section-title" style="margin-bottom:6px">인벤토리</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${sellBtns}</div>
    <div class="inv-list">${invHtml}</div>`;
}

function buildModalSkills(char) {
  const cls = CLASSES[char.classId];
  const sp  = char.skillPoints || 0;
  if (!cls.canSkill) return `<div style="color:#555;font-size:12px;padding:8px 0">전직 후 스킬을 배울 수 있습니다.</div>`;

  const parentClassId = CLASSES[char.classId]?.parent;
  const charSkills = Object.entries(SKILLS).filter(([, s]) =>
    s.classId === char.classId || s.classId === parentClassId
  );

  const rows = charSkills.map(([id, s]) => {
    const curLv   = char.skillLevels?.[id] || 0;
    const learned = curLv > 0;
    const isMax   = curLv >= SKILL_MAX_LEVEL;
    const nextCost = learned ? (SKILL_SP_COSTS[curLv + 1] ?? Infinity) : (SKILL_SP_COSTS[1] ?? 1);
    const canUp   = !isMax && sp >= nextCost;
    const col     = CLASS_COLORS[char.classId] || '#aaa';
    const lvBadge = learned
      ? `<span style="color:${isMax ? '#e2b96f' : '#4caf50'};font-weight:bold;font-size:11px">${isMax ? 'MAX' : `Lv.${curLv}`}</span>`
      : `<span style="color:#555;font-size:11px">미습득</span>`;
    const btn = isMax
      ? `<span style="color:#e2b96f;font-size:10px">MAX</span>`
      : learned
        ? `<button class="small-btn ${canUp ? '' : 'disabled'}" onclick="tryUpgradeSkill(${char.id},'${id}');renderCharModalBody();">Lv.${curLv}→${curLv+1} (${nextCost}SP)</button>`
        : `<button class="small-btn ${canUp ? '' : 'disabled'}" onclick="tryLearnSkill(${char.id},'${id}');renderCharModalBody();">배우기 (${nextCost}SP)</button>`;
    return `
      <div class="skill-row">
        <div class="skill-info">
          <div style="display:flex;align-items:center;gap:6px">
            <span class="skill-name" style="color:${learned ? col : '#888'}">${s.name}</span>
            ${lvBadge}
          </div>
          <span class="skill-meta" style="color:#999">${learned ? skillEffectDesc(id, s, curLv) : '—'}</span>
        </div>
        <div>${btn}</div>
      </div>`;
  }).join('');

  const resetCost  = 100 * char.level;
  const canReset   = gameState.gold >= resetCost && char.skills.length > 0;

  return `
    <div style="font-size:12px;color:${sp > 0 ? '#f1c40f' : '#555'};margin-bottom:10px">
      스킬 포인트: <strong>${sp}</strong>
    </div>
    ${rows}
    <button class="small-btn reset-btn ${canReset ? '' : 'disabled'}" style="width:100%;margin-top:12px"
            onclick="tryResetSkills(${char.id});renderCharModalBody();">
      스킬 초기화 (${resetCost.toLocaleString()}G)
    </button>`;
}
