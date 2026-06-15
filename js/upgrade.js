// 성장 액션 모듈

function tryAddStatPoint(charId, statKey) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char || char.unspentPoints <= 0) return;
  if (!['STR', 'DEX', 'INT', 'LUK'].includes(statKey)) return;
  char.stats[statKey]++;
  char.unspentPoints--;
}

function tryToggleAutoAssign(charId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  char.autoAssign = !char.autoAssign;
  // ON으로 켜도 기존 잔여 포인트는 건드리지 않음
  // 이후 레벨업 시 새로 얻는 포인트에만 자동 배분 적용
}

function tryResetStats(charId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const cost = 100 * char.level;
  if (gameState.gold < cost) return;
  gameState.gold -= cost;
  const totalEarned = (char.level - 1) * STAT_POINTS_PER_LEVEL;
  char.stats = { STR: 5, DEX: 5, INT: 5, LUK: 5 };
  char.unspentPoints = totalEarned;
}

function tryAdvanceJob(charId, classId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  if (char.classId !== 'novice') return;
  if (char.level < JOB_ADVANCE_LEVEL) return;
  if (!CLASSES[classId] || CLASSES[classId].jobLevel !== 1) return;

  char.classId = classId;

  // 전직 시 스탯 초기화 + 포인트 전액 환급 (골드 소모 없음)
  const totalEarned = (char.level - 1) * STAT_POINTS_PER_LEVEL;
  char.stats = { STR: 5, DEX: 5, INT: 5, LUK: 5 };
  char.unspentPoints = totalEarned;

  // autoAssign 켜져 있으면 새 직업 주스탯 기준으로 즉시 배분
  if (char.autoAssign) autoAssignStats(char);
}

function tryAdvanceJob2(charId, classId) {
  const char = gameState.characters.find(c => c.id === charId);
  const cls2 = CLASSES[classId];
  if (!char || !cls2 || cls2.jobLevel !== 2) return;
  if (cls2.parent !== char.classId) return;          // 현재 직업의 2차전직이어야 함
  if (char.level < JOB_ADVANCE_LEVEL_2) return;

  char.classId = classId;
}

// 장비 장착 요건 체크 (itemOrId = string id 또는 { id, uid, enhance } 객체)
function canEquipItem(char, itemOrId) {
  const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
  const e  = EQUIPMENT[id];
  if (!e) return false;
  if (e.req.level && char.level < e.req.level) return false;
  if (e.req.classId) {
    const parentClass = CLASSES[char.classId]?.parent || char.classId;
    if (char.classId !== e.req.classId && parentClass !== e.req.classId) return false;
  }
  return true;
}

function tryBuyEquipment(equipId) {
  const e = EQUIPMENT[equipId];
  if (!e || e.cost === 0) return;
  if (gameState.gold < e.cost) return;
  gameState.gold -= e.cost;
  gameState.equipmentInventory.push({ id: equipId, uid: gameState.nextItemUid++, enhance: 0 });
}

// 인벤토리 → 캐릭터 슬롯 (uid로 식별, 기존 슬롯 아이템은 인벤토리로)
function tryEquipItem(charId, uid) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const idx  = gameState.equipmentInventory.findIndex(i => i.uid === uid);
  if (idx === -1) return;
  const item = gameState.equipmentInventory[idx];
  if (!canEquipItem(char, item)) return;

  const slot = EQUIPMENT[item.id].type;
  const prev = char.equipment[slot];
  if (prev && prev.uid !== 0) gameState.equipmentInventory.push(prev); // uid 0 = 초보자 검 (버림)

  gameState.equipmentInventory.splice(idx, 1);
  char.equipment[slot] = item;
}

// 장착 해제 → 인벤토리로
function tryUnequipItem(charId, slot) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const item = char.equipment[slot];
  if (!item || item.uid === 0) return; // 초보자 검은 해제 불가
  gameState.equipmentInventory.push(item);
  char.equipment[slot] = null;
}

// 강화 비용 계산 (내부 및 UI에서 공용)
function enhanceCost(item) {
  const e = EQUIPMENT[item.id];
  return Math.max(50, Math.floor((e.cost || 200) * 0.3 * (item.enhance + 1)));
}

// uid로 아이템 찾기 (인벤토리 + 장착 중 모두 탐색)
function findItemByUid(uid) {
  const inv = gameState.equipmentInventory.find(i => i.uid === uid);
  if (inv) return inv;
  for (const char of gameState.characters) {
    for (const slot of ['weapon', 'armor', 'accessory']) {
      if (char.equipment[slot]?.uid === uid) return char.equipment[slot];
    }
  }
  return null;
}

function tryEnhanceEquipment(uid) {
  const item = findItemByUid(uid);
  if (!item || item.uid === 0) return;           // 초보자 검 강화 불가
  if (item.enhance >= ENHANCE_MAX) return;

  const cost = enhanceCost(item);
  if (gameState.gold < cost) return;
  gameState.gold -= cost;

  const successRate = ENHANCE_SUCCESS[item.enhance];
  if (Math.random() * 100 < successRate) {
    item.enhance++;
  }
  // 실패 시 골드만 소모, 아이템 파괴 없음
}

// skillId에 대한 SP 비용 계산 (현재 레벨 → 다음 레벨)
function skillUpgradeCost(char, skillId) {
  const cur = char.skillLevels?.[skillId] || 0;
  if (cur >= SKILL_MAX_LEVEL) return Infinity;
  return SKILL_SP_COSTS[cur + 1] ?? Infinity;
}

function tryLearnSkill(charId, skillId) {
  const char  = gameState.characters.find(c => c.id === charId);
  const skill = SKILLS[skillId];
  if (!char || !skill) return;
  const parentClass = CLASSES[char.classId]?.parent || char.classId;
  if (skill.classId !== char.classId && skill.classId !== parentClass) return;
  if ((char.skillLevels?.[skillId] || 0) > 0) return; // 이미 습득
  const cost = SKILL_SP_COSTS[1] ?? 1;
  if ((char.skillPoints || 0) < cost) return;
  char.skillPoints -= cost;
  if (!char.skillLevels) char.skillLevels = {};
  char.skillLevels[skillId] = 1;
  if (!char.skills.includes(skillId)) char.skills.push(skillId);
}

function tryUpgradeSkill(charId, skillId) {
  const char  = gameState.characters.find(c => c.id === charId);
  const skill = SKILLS[skillId];
  if (!char || !skill) return;
  const cur  = char.skillLevels?.[skillId] || 0;
  if (cur === 0) return; // 먼저 tryLearnSkill 사용
  if (cur >= SKILL_MAX_LEVEL) return;
  const cost = SKILL_SP_COSTS[cur + 1];
  if ((char.skillPoints || 0) < cost) return;
  char.skillPoints -= cost;
  char.skillLevels[skillId] = cur + 1;
}

function tryBuyPet(charId, petId) {
  const char = gameState.characters.find(c => c.id === charId);
  const p = PETS[petId];
  if (!char || !p) return;
  if (char.pet === petId) return;
  if (gameState.gold < p.cost) return;
  gameState.gold -= p.cost;
  char.pet = petId;
}

function trySellItem(uid) {
  const idx = gameState.equipmentInventory.findIndex(i => i.uid === uid);
  if (idx === -1) return;
  const item = gameState.equipmentInventory[idx];
  if (item.uid === 0) return;
  const e = EQUIPMENT[item.id];
  if (!e || !e.cost) return;
  gameState.gold += Math.floor(e.cost * 0.6);
  gameState.equipmentInventory.splice(idx, 1);
}

function trySetNickname(charId, name) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const trimmed = (name || '').trim().slice(0, 12);
  if (!trimmed) return;
  char.nickname = trimmed;
}

function trySellByGrade(grade) {
  let total = 0;
  for (let i = gameState.equipmentInventory.length - 1; i >= 0; i--) {
    const item = gameState.equipmentInventory[i];
    if (item.uid === 0) continue;
    const e = EQUIPMENT[item.id];
    if (!e || e.grade !== grade) continue;
    total += Math.floor((e.cost || 0) * 0.6);
    gameState.equipmentInventory.splice(i, 1);
  }
  gameState.gold += total;
  return total;
}

// ── 파티 업그레이드 ─────────────────────────────────────────
function upgradeCost(id) {
  const def = UPGRADES[id];
  if (!def) return 0;
  const lv = gameState.upgrades[id] || 0;
  return Math.floor(def.baseCost * Math.pow(def.costMult, lv));
}

function tryBuyUpgrade(id) {
  const def = UPGRADES[id];
  if (!def) return;
  const lv = gameState.upgrades[id] || 0;
  if (lv >= def.maxLevel) return;
  const cost = upgradeCost(id);
  if (gameState.gold < cost) return;
  gameState.gold -= cost;
  gameState.upgrades[id] = lv + 1;
}

function tryAddCharacter() {
  const cur = gameState.characters.length;
  const cost = charAddCost(cur);
  if (gameState.gold < cost) return;
  gameState.gold -= cost;
  const newChar = createCharacter(0);
  gameState.characters.push(newChar);
  if (!gameState.stageFields[0]) initStageField(0);
  resetCharPos(newChar);
  markTabDirty();
}
