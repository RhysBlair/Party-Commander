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

function tryResetSkills(charId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const cost = 100 * char.level;
  if (gameState.gold < cost) return;
  gameState.gold -= cost;
  const totalEarned = Math.floor((char.level - 1) / SKILL_SP_PER_LEVEL);
  char.skillLevels = {};
  char.skills = [];
  char.skillPoints = totalEarned;
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

  // 시프 전직: 표창·아대 해제, 단검 아닌 무기 해제, weapon2 슬롯 확보
  if (classId === 'thief') {
    if (char.equipment.throwable) { gameState.equipmentInventory.push(char.equipment.throwable); char.equipment.throwable = null; }
    for (const slot of ['weapon', 'weapon2']) {
      const w = char.equipment[slot];
      if (!w || w.uid === 0) continue;
      const eDef = EQUIPMENT[w.id];
      if (!eDef) continue;
      if (eDef.isAedae || eDef.weaponType !== 'dagger') {
        gameState.equipmentInventory.push(w);
        char.equipment[slot] = null;
      }
    }
    if (char.equipment.weapon2 === undefined) char.equipment.weapon2 = null;
  }
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
  // 아대(isAedae 무기)는 시프 착용 불가
  if (e.isAedae && char.classId === 'thief') return false;
  // 시프는 단검(weaponType:'dagger')만 착용 가능
  if (char.classId === 'thief' && e.type === 'weapon' && !e.isAedae && e.weaponType !== 'dagger') return false;
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
// slotOverride: 시프의 weapon2 슬롯에 직접 장착할 때 'weapon2' 전달
function tryEquipItem(charId, uid, slotOverride) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const idx  = gameState.equipmentInventory.findIndex(i => i.uid === uid);
  if (idx === -1) return;
  const item = gameState.equipmentInventory[idx];
  if (!canEquipItem(char, item)) return;

  const itemType = EQUIPMENT[item.id].type;
  // weapon2 오버라이드: 시프가 두 번째 무기 슬롯에 장착
  const slot = (slotOverride === 'weapon2' && char.classId === 'thief' && itemType === 'weapon')
    ? 'weapon2'
    : itemType;

  const prev = char.equipment[slot];
  if (prev && prev.uid !== 0) gameState.equipmentInventory.push(prev); // uid 0 = 초보자 검 (버림)

  gameState.equipmentInventory.splice(idx, 1);
  char.equipment[slot] = item;
}

// 아이템 효율 점수 (강화 보너스 포함 총 스탯 합산)
function itemScore(item) {
  const e = EQUIPMENT[item.id];
  if (!e) return 0;
  const mult = 1 + (item.enhance || 0) * 0.15;
  return (
    (e.atk      || 0) * mult +
    (e.physDef  || 0) * mult +
    (e.magicDef || 0) * mult +
    (e.bonusSTR || 0) * 2 +
    (e.bonusDEX || 0) * 2 +
    (e.bonusINT || 0) * 2 +
    (e.bonusLUK || 0) * 2
  );
}

// 빈 슬롯에 인벤토리에서 가장 효율 좋은 아이템 자동 장착
function tryAutoEquip(charId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;

  const slots = getCharSlotList(char);

  for (const slot of slots) {
    const cur = char.equipment[slot];
    if (cur && cur.uid !== 0) continue; // 이미 장착됨

    // weapon2 슬롯은 type='weapon' 아이템을 수용
    const targetType = slot === 'weapon2' ? 'weapon' : slot;
    const candidates = gameState.equipmentInventory
      .filter(item => {
        const e = EQUIPMENT[item.id];
        return e && e.type === targetType && canEquipItem(char, item);
      })
      .sort((a, b) => itemScore(b) - itemScore(a));

    if (!candidates.length) continue;

    const best = candidates[0];
    const idx  = gameState.equipmentInventory.indexOf(best);
    if (idx === -1) continue;
    gameState.equipmentInventory.splice(idx, 1);
    char.equipment[slot] = best;
    // uid=0 슬롯(초보자 검)은 인벤토리에 돌려보내지 않음
  }
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

// 아이템별 최대 강화치 (data.js에 maxEnhance 명시 없으면 전역 ENHANCE_MAX, uid=0은 강화 불가)
function itemMaxEnhance(item) {
  if (!item || item.uid === 0) return 0;
  return EQUIPMENT[item.id]?.maxEnhance ?? ENHANCE_MAX;
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
    for (const slot of ['weapon', 'weapon2', 'armor', 'accessory', 'throwable']) {
      if (char.equipment[slot]?.uid === uid) return char.equipment[slot];
    }
  }
  return null;
}

function tryEnhanceEquipment(uid) {
  const item = findItemByUid(uid);
  if (!item) return;
  const max = itemMaxEnhance(item);
  if (max === 0 || item.enhance >= max) return;

  const cost = enhanceCost(item);
  if (gameState.gold < cost) return;
  gameState.gold -= cost;

  const successRate = ENHANCE_SUCCESS[item.enhance];
  const success     = Math.random() * 100 < successRate;
  if (success) item.enhance++;
  return { success, newLevel: item.enhance, name: EQUIPMENT[item.id]?.name || '' };
}

// skillId에 대한 SP 비용 계산 (현재 레벨 → 다음 레벨)
function skillUpgradeCost(char, skillId) {
  const cur   = char.skillLevels?.[skillId] || 0;
  const maxLv = SKILLS[skillId]?.maxLevel || SKILL_MAX_LEVEL;
  if (cur >= maxLv) return Infinity;
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
  const cur   = char.skillLevels?.[skillId] || 0;
  const maxLv = skill.maxLevel || SKILL_MAX_LEVEL;
  if (cur === 0) return; // 먼저 tryLearnSkill 사용
  if (cur >= maxLv) return;
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

function tryDecomposeItem(uid) {
  const idx = gameState.equipmentInventory.findIndex(i => i.uid === uid);
  if (idx === -1) return;
  const item = gameState.equipmentInventory[idx];
  if (item.uid === 0) return;
  const e = EQUIPMENT[item.id];
  if (!e) return;
  const crystalKey = CRYSTAL_KEYS[e.grade];
  if (!crystalKey) return; // 유니크 등 결정 없음
  const amount = Math.floor(Math.random() * 3) + 1;
  gameState.crystals[crystalKey] = (gameState.crystals[crystalKey] || 0) + amount;
  gameState.equipmentInventory.splice(idx, 1);
}

function tryCraftItem(equipId) {
  const e = EQUIPMENT[equipId];
  if (!e) return;
  const crystalKey = CRYSTAL_KEYS[e.grade];
  const cost = CRAFT_COSTS[e.grade];
  if (!crystalKey || !cost) return;
  if ((gameState.crystals[crystalKey] || 0) < cost) return;
  gameState.crystals[crystalKey] -= cost;
  gameState.equipmentInventory.push({ id: equipId, uid: gameState.nextItemUid++, enhance: 0 });
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

// 전역 물약 재고에 구매
function tryBuyPotion(potionId, qty) {
  const p = POTIONS[potionId];
  if (!p) return;
  const cost = p.cost * qty;
  if (gameState.gold < cost) return;
  gameState.gold -= cost;
  gameState.potionStock[potionId] = (gameState.potionStock[potionId] || 0) + qty;
  markTabDirty();
}

// 캐릭터별 물약 타입 지정 (HP or MP 슬롯)
function selectCharPotion(charId, slotType, potionId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const selectedKey = slotType === 'hp' ? 'selectedHpPotion' : 'selectedMpPotion';
  const equippedKey = slotType === 'hp' ? 'equippedHpPotion' : 'equippedMpPotion';
  const timerKey    = slotType === 'hp' ? 'hpRefillTimer'   : 'mpRefillTimer';
  // 현재 장착된 물약 남은 수량은 전역 재고로 반납
  const cur = char[equippedKey];
  if (cur && cur.id && (cur.count || 0) > 0) {
    gameState.potionStock[cur.id] = (gameState.potionStock[cur.id] || 0) + cur.count;
  }
  char[timerKey]    = 0;
  char[selectedKey] = potionId;
  char[equippedKey] = { id: potionId, count: 0 };
  markCharModalDirty();
  markTabDirty();
}

function tryAddCharacter() {
  const cur = gameState.characters.length;
  const cost = charAddCost(cur);
  if (gameState.gold < cost) return;
  gameState.gold -= cost;

  // 자리 있는 첫 스테이지에 배치 (스테이지당 최대 6명)
  let targetStage = 0;
  for (let s = 0; s <= gameState.maxStageReached; s++) {
    const inStage = gameState.characters.filter(c => c.assignedStage === s).length;
    if (inStage < 6) { targetStage = s; break; }
  }

  const newChar = createCharacter(targetStage);
  gameState.characters.push(newChar);
  if (!gameState.stageFields[targetStage]) initStageField(targetStage);
  resetCharPos(newChar);
  markTabDirty();
}
