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
  const s     = gameState;
  const stage = STAGES[s.viewStage];
  const field = s.stageFields[s.viewStage];
  const kills = field ? field.kills : 0;
  document.getElementById('hud-gold').textContent     = `골드: ${s.gold.toLocaleString()}`;
  document.getElementById('hud-gems').textContent     = `젬: ${s.gems.toLocaleString()}`;
  document.getElementById('hud-stage').textContent    = `스테이지: ${stage.name}`;
  document.getElementById('hud-progress').textContent = `처치: ${kills} / ${stage.killsToAdvance}`;
}

function renderActiveTab() {
  const activeBtn = document.querySelector('.tab-btn.active');
  if (!activeBtn) return;
  const tab = activeBtn.dataset.tab;
  if (tab === 'characters') renderCharacterTab();
  else if (tab === 'stats')      renderStatsTab();
  else if (tab === 'equipment')  renderEquipmentTab();
  else if (tab === 'skills')     renderSkillTab();
  else if (tab === 'pets')       renderPetTab();
  else if (tab === 'stage')      renderStageTab();
  else if (tab === 'upgrades')   renderUpgradeTab();
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
          ? `<div class="points-badge">⬆ 잔여 포인트 (${char.unspentPoints}pt)${char.autoAssign ? ' · 레벨업 시 자동 배분' : ''}</div>`
          : ''}
        <div class="assign-section">
          <span class="assign-label">배치 필드</span>
          <div class="assign-btns">
            ${Array.from({ length: gameState.maxStageReached + 1 }, (_, i) => `
              <button class="assign-btn ${char.assignedStage === i ? 'active' : ''}"
                      onclick="assignCharToStage(${char.id}, ${i}); renderCharacterTab();">
                ${STAGES[i].name}
              </button>`).join('')}
          </div>
        </div>
        ${jobSection}
      </div>`;
  }).join('');

  const maxChars = CHAR_START_POS.length;
  const curChars = gameState.characters.length;
  const addCost  = charAddCost(curChars);
  const canAfford = gameState.gold >= addCost;

  const addSection = curChars < maxChars
    ? `<div class="add-char-box">
         <div class="add-char-info">
           <span>파티 슬롯 <strong>${curChars} / ${maxChars}</strong></span>
           <span class="add-char-sub">새 모험가 영입 — 스테이지 1에서 시작</span>
         </div>
         <button class="small-btn ${canAfford ? '' : 'disabled'}"
                 onclick="tryAddCharacter(); renderCharacterTab();">
           영입 ${addCost.toLocaleString()}G
         </button>
       </div>`
    : `<div class="add-char-box add-char-full">
         파티가 가득 찼습니다 (최대 ${maxChars}명)
       </div>`;

  el.innerHTML = html + addSection;
}

// ── 스탯 탭 (전체 재빌드) ───────────────────────────────────
const STAT_LABELS = {
  STR: '공격력 +0.5 · 물리방어 +0.5 · (전사) 추가 배율',
  DEX: '명중 +0.5% · 회피 +0.1% · (궁수) 추가 배율',
  INT: '마법방어 +0.5 · (마법사) 추가 배율',
  LUK: '회피 +0.3% · (도적) 추가 배율',
};

// 장비로 인한 스탯 보너스 (bonusSTR 등)
function equipStatBonus(char, stat) {
  return sumEquipStat(char, 'bonus' + stat); // bonusSTR, bonusDEX, bonusINT, bonusLUK
}

// "17(10+7)" 형식 스탯 문자열
function statValHtml(base, bonus) {
  if (bonus <= 0) return `${base}`;
  return `${base + bonus}<span class="stat-equip-bonus">(${base}+${bonus})</span>`;
}

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
    const hasPoints = char.unspentPoints > 0;

    const statRows = ['STR', 'DEX', 'INT', 'LUK'].map(stat => {
      const bonus = equipStatBonus(char, stat);
      return `
      <div class="stat-row">
        <span class="stat-label" title="${STAT_LABELS[stat]}">${stat}</span>
        <span class="stat-val" id="sv-${char.id}-${stat}">${statValHtml(char.stats[stat], bonus)}</span>
        <button class="stat-plus-btn" id="sb-${char.id}-${stat}"
                style="${hasPoints ? '' : 'display:none'}"
                onclick="tryAddStatPoint(${char.id}, '${stat}'); updateStatDisplay(${char.id});">＋</button>
        <span class="stat-desc">${STAT_LABELS[stat]}</span>
      </div>`;
    }).join('');

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
          ${char.autoAssign ? '<span style="color:#aaa;font-size:11px"> (자동배분 ON · 레벨업 시 자동 배분)</span>' : ''}
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
      <span>공격력 <strong>${fs.atk}</strong></span>
      <span>물리방어 <strong>${fs.physDef}</strong></span>
      <span>마법방어 <strong>${fs.magicDef}</strong></span>
      <span>명중 <strong>${fs.accuracy.toFixed(0)}%</strong></span>
      <span>회피 <strong>${fs.evade.toFixed(0)}%</strong></span>`;
  }
}

// ── 장비 탭 ────────────────────────────────────────────────
const SLOT_NAMES = { weapon: '무기', throwable: '표창', armor: '방어구', accessory: '장신구' };

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

  // ── 장착 중 ─────────────────────────────────────────────
  const charCards = gameState.characters.map(char => {
    const slotList = char.classId === 'rogue'
      ? ['weapon', 'throwable', 'armor', 'accessory']
      : ['weapon', 'armor', 'accessory'];
    const slots = slotList.map(slot => {
      const item = char.equipment[slot];
      const e    = item ? EQUIPMENT[item.id] : null;
      const col  = e ? (GRADE_COLORS[e.grade] || '#aaa') : '#333';
      const canRemove = item && item.uid !== 0;
      const enhBtn = item && item.uid !== 0 && item.enhance < ENHANCE_MAX ? (() => {
        const cost    = enhanceCost(item);
        const canAff  = gameState.gold >= cost;
        const succPct = ENHANCE_SUCCESS[item.enhance];
        return `<button class="small-btn enhance-btn ${canAff ? '' : 'disabled'}"
                        onclick="tryEnhanceEquipment(${item.uid});renderEquipmentTab();"
                        title="성공률 ${succPct}%">
                  강화 ${cost.toLocaleString()}G
                </button>`;
      })() : (item && item.enhance >= ENHANCE_MAX ? `<span style="color:#e2b96f;font-size:10px">MAX</span>` : '');

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
              ${canRemove ? `<button class="equip-remove" onclick="tryUnequipItem(${char.id},'${slot}');renderEquipmentTab();">✕</button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="char-card">
        <h3 style="color:${CLASS_COLORS[char.classId]||'#aaa'};margin-bottom:8px">
          ${charClassName(char.classId)} Lv.${char.level}
        </h3>
        <div class="equip-slots">${slots}</div>
      </div>`;
  }).join('');

  // ── 인벤토리 ─────────────────────────────────────────────
  const inv = gameState.equipmentInventory;
  const invHtml = inv.length === 0
    ? '<div style="color:#555;font-size:12px;padding:6px 0">보유 장비 없음</div>'
    : inv.map(item => {
        const e = EQUIPMENT[item.id];
        if (!e) return '';
        const col = GRADE_COLORS[e.grade] || '#aaa';
        const equipBtns = gameState.characters.map(char =>
          canEquipItem(char, item)
            ? `<button class="assign-btn" onclick="tryEquipItem(${char.id},${item.uid});renderEquipmentTab();">
                 ${charClassName(char.classId)[0]} 장착
               </button>`
            : ''
        ).join('');
        const canAff  = item.enhance < ENHANCE_MAX && gameState.gold >= enhanceCost(item);
        const succPct = ENHANCE_SUCCESS[item.enhance] ?? 0;
        const enhBtn  = item.enhance < ENHANCE_MAX
          ? `<button class="small-btn enhance-btn ${canAff ? '' : 'disabled'}"
                     onclick="tryEnhanceEquipment(${item.uid});renderEquipmentTab();"
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

        return `
          <div class="inv-item">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="color:${col}">${e.name}${enhanceBadge(item.enhance)}</span>
              <span class="equip-stat-text">${equipStatText(e, item.enhance)}</span>
            </div>
            <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;align-items:center">
              ${equipBtns}
              ${enhBtn}
              ${sellBtn}
            </div>
          </div>`;
      }).join('');

  // ── 상점 ─────────────────────────────────────────────────
  const shopRows = Object.entries(EQUIPMENT)
    .filter(([id]) => id !== 'beginner_sword')
    .sort((a, b) => (a[1].req.level || 0) - (b[1].req.level || 0))
    .map(([id, e]) => {
      const col       = GRADE_COLORS[e.grade] || '#aaa';
      const ownedInv  = inv.filter(x => x.id === id).length;
      const ownedEqp  = gameState.characters.filter(c =>
        Object.values(c.equipment).some(eq => eq?.id === id)
      ).length;
      const owned     = ownedInv + ownedEqp;
      const canAfford = gameState.gold >= e.cost;
      const reqParts  = [];
      if (e.req.level)   reqParts.push(`Lv.${e.req.level}`);
      if (e.req.classId) reqParts.push(charClassName(e.req.classId) + ' 전용');
      const reqStr = reqParts.join(' · ');

      return `
        <div class="shop-item">
          <div class="shop-item-left">
            <span style="color:${col};font-weight:bold">${e.name}</span>
            <span style="color:${col};font-size:10px">[${e.grade}]</span>
            <span class="equip-stat-text">${equipStatText(e, 0)}</span>
            ${reqStr ? `<span class="shop-req">${reqStr}</span>` : ''}
          </div>
          <div class="shop-item-right">
            <span class="shop-cost">${e.cost.toLocaleString()}G</span>
            ${owned ? `<span style="color:#555;font-size:11px">×${owned} 보유</span>` : ''}
            <button class="small-btn ${canAfford ? '' : 'disabled'}"
                    onclick="tryBuyEquipment('${id}');renderEquipmentTab();">구매</button>
          </div>
        </div>`;
    }).join('');

  el.innerHTML = `
    <div class="eq-section-title">장착 중</div>
    ${charCards}
    <div class="eq-section-title" style="margin-top:10px">인벤토리</div>
    <div class="inv-list">${invHtml}</div>
    <div class="eq-section-title" style="margin-top:10px">
      상점 <span style="color:#e2b96f;font-size:11px">골드: ${gameState.gold.toLocaleString()}</span>
    </div>
    <div class="shop-list">${shopRows}</div>`;
}

// ── 스킬 탭 ────────────────────────────────────────────────
const SKILL_TARGET_DESC = {
  single_melee: '단일 근접',
  single_long:  '단일 원거리',
  aoe:          '전체 범위',
  double_hit:   '2회 연속',
  shadow:       '분신 소환',
  passive:      '패시브',
};

function renderSkillTab() {
  const el = document.getElementById('tab-skills');
  if (gameState.characters.length === 0) {
    el.innerHTML = '<p style="color:#888">캐릭터가 없습니다.</p>';
    return;
  }

  const html = gameState.characters.map(char => {
    const cls = CLASSES[char.classId];
    if (!cls.canSkill) {
      return `
        <div class="char-card">
          <h3 style="color:${CLASS_COLORS[char.classId]||'#aaa'};margin-bottom:6px">
            ${charClassName(char.classId)} Lv.${char.level}
          </h3>
          <div style="color:#555;font-size:12px">전직 후 스킬을 배울 수 있습니다.</div>
        </div>`;
    }

    // 이 직업에 해당하는 스킬 목록
    const charSkills = Object.entries(SKILLS).filter(([, s]) => s.classId === char.classId);

    const skillRows = charSkills.map(([id, s]) => {
      const learned   = char.skills.includes(id);
      const canAfford = !learned && gameState.gold >= s.cost;
      const isShadow  = s.targeting === 'shadow';
      const isPassive = s.targeting === 'passive';
      const cd        = char.skillTimers?.[id];
      let cdText = '', cdStyle = '';

      if (isPassive && learned) {
        if (s.orbsRequired) {
          if (char.orbReady) {
            cdText  = '⚡ 충전 완료!';
            cdStyle = 'color:#f1c40f;font-weight:bold';
          } else {
            cdText = `구슬 ${char.orbCount || 0} / ${s.orbsRequired}`;
          }
        } else if (s.attackInterval) {
          cdText  = `연사 활성 · ${s.attackInterval}s/발`;
          cdStyle = 'color:#27ae60';
        }
      } else if (isShadow && char.shadowActive) {
        cdText  = `분신 활성 ${(char.shadowTimer || 0).toFixed(1)}s`;
        cdStyle = 'color:#9b59b6';
      } else if (learned && cd > 0 && cd < 9999) {
        cdText = `쿨타임 ${cd.toFixed(1)}s`;
      }
      const col = CLASS_COLORS[char.classId] || '#aaa';

      const metaHtml = isPassive
        ? s.orbsRequired
          ? `평타마다 구슬 1개 적립 &nbsp;·&nbsp; ${s.orbsRequired}개 시 다음 공격 ×${s.dmgMultiplier} (${s.dmgMultiplier * 100}%)`
          : `쿨타임 없이 연사 &nbsp;·&nbsp; ${s.attackInterval}s/발 &nbsp;·&nbsp; 위력 ×${s.dmgMultiplier}`
        : `${SKILL_TARGET_DESC[s.targeting] || s.targeting}
           ${s.cooldown ? ` &nbsp;·&nbsp; 쿨다운 ${s.cooldown}s` : ''}
           ${s.dmgMultiplier ? ` &nbsp;·&nbsp; 위력 ×${s.dmgMultiplier}` : ''}
           ${s.duration ? ` &nbsp;·&nbsp; 지속 ${s.duration}s &nbsp;·&nbsp; 분신 데미지 50%` : ''}
           ${s.hits ? ` &nbsp;·&nbsp; ${s.hits}회 타격` : ''}
           ${s.maxTargets ? ` &nbsp;·&nbsp; 최대 ${s.maxTargets}마리` : ''}`;

      return `
        <div class="skill-row">
          <div class="skill-info">
            <span class="skill-name" style="color:${learned ? col : '#888'}">${s.name}</span>
            <span class="skill-meta">${metaHtml}</span>
            ${cdText ? `<span class="skill-cd" style="${cdStyle}">${cdText}</span>` : ''}
          </div>
          <div>
            ${learned
              ? `<span class="skill-learned">습득 완료</span>`
              : `<button class="small-btn ${canAfford ? '' : 'disabled'}"
                         onclick="tryLearnSkill(${char.id},'${id}');renderSkillTab();">
                   배우기 ${s.cost.toLocaleString()}G
                 </button>`}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="char-card">
        <h3 style="color:${CLASS_COLORS[char.classId]||'#aaa'};margin-bottom:8px">
          ${charClassName(char.classId)} Lv.${char.level}
        </h3>
        ${skillRows}
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="eq-section-title">스킬</div>
    <div style="font-size:11px;color:#666;margin-bottom:8px">
      습득한 스킬은 쿨다운마다 자동으로 사용됩니다.
    </div>
    ${html}`;
}

// ── 펫 탭 ──────────────────────────────────────────────────
function renderPetTab() {
  const el = document.getElementById('tab-pets');
  if (gameState.characters.length === 0) {
    el.innerHTML = '<p style="color:#888">캐릭터가 없습니다.</p>';
    return;
  }

  const charCards = gameState.characters.map(char => {
    const petOptions = Object.entries(PETS).map(([id, p]) => {
      const isEquipped = char.pet === id;
      const rangeText  = p.pickupRange >= 9000 ? '전체 필드' : `${p.pickupRange}px`;
      const canAfford  = !isEquipped && gameState.gold >= p.cost;

      return `
        <div class="pet-option ${isEquipped ? 'pet-equipped' : ''}">
          <div class="pet-option-info">
            <span class="pet-option-name" style="color:${isEquipped ? '#4caf50' : '#e0e0e0'}">${p.name}</span>
            <span class="pet-option-meta">범위 ${rangeText} · 주기 ${p.pickupInterval}s</span>
          </div>
          ${isEquipped
            ? `<span class="skill-learned">✓ 장착 중</span>`
            : `<button class="small-btn ${canAfford ? '' : 'disabled'}"
                       onclick="tryBuyPet(${char.id},'${id}');renderPetTab();">
                 ${p.cost.toLocaleString()}G
               </button>`}
        </div>`;
    }).join('');

    return `
      <div class="char-card">
        <h3 style="color:${CLASS_COLORS[char.classId]||'#aaa'};margin-bottom:8px">
          ${charClassName(char.classId)} Lv.${char.level}
          ${char.pet ? `<span style="font-size:11px;font-weight:normal;color:#4caf50"> ─ ${PETS[char.pet].name} 장착 중</span>` : ''}
        </h3>
        ${petOptions}
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
      캐릭터마다 펫을 개별 장착합니다.<br>
      펫이 없으면 캐릭터가 드랍에 직접 근접해야 수집됩니다.
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
    const killInfo = charsHere.length > 0
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
      <span style="color:${CLASS_COLORS[char.classId] || '#aaa'}">${charClassName(char.classId)} Lv.${char.level}</span>
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

// ── 공통 헬퍼 ──────────────────────────────────────────────
function charClassName(classId) {
  const names = {
    novice: '모험가', warrior: '전사', mage: '마법사', archer: '궁수', rogue: '도적',
  };
  return names[classId] || classId;
}
