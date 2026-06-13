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
  if (!CLASSES[classId] || classId === 'novice') return;

  char.classId = classId;

  // 전직 시 스탯 초기화 + 포인트 전액 환급 (골드 소모 없음)
  const totalEarned = (char.level - 1) * STAT_POINTS_PER_LEVEL;
  char.stats = { STR: 5, DEX: 5, INT: 5, LUK: 5 };
  char.unspentPoints = totalEarned;

  // autoAssign 켜져 있으면 새 직업 주스탯 기준으로 즉시 배분
  if (char.autoAssign) autoAssignStats(char);
}

// 장비 장착 요건 체크 (itemOrId = string id 또는 { id, uid, enhance } 객체)
function canEquipItem(char, itemOrId) {
  const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
  const e  = EQUIPMENT[id];
  if (!e) return false;
  if (e.req.level   && char.level   < e.req.level)   return false;
  if (e.req.classId && char.classId !== e.req.classId) return false;
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

function tryLearnSkill(charId, skillId) {
  const char  = gameState.characters.find(c => c.id === charId);
  const skill = SKILLS[skillId];
  if (!char || !skill) return;
  if (skill.classId !== char.classId) return;
  if (char.skills.includes(skillId)) return;
  if (gameState.gold < skill.cost) return;
  gameState.gold -= skill.cost;
  char.skills.push(skillId);
}

function tryBuyPet(petId) {
  const p = PETS[petId];
  if (!p) return;
  if (gameState.pets.includes(petId)) return;
  if (gameState.gold < p.cost) return;
  gameState.gold -= p.cost;
  gameState.pets.push(petId);
}

function tryAddCharacter() {
  // 11단계에서 구현
}
