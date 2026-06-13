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

// 장비 구매 요건 체크 (UI에서도 사용)
function canEquipItem(char, equipId) {
  const e = EQUIPMENT[equipId];
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
  gameState.equipmentInventory.push(equipId);
}

// 인벤토리 → 캐릭터 슬롯으로 장착 (기존 슬롯 아이템은 인벤토리로)
function tryEquipItem(charId, equipId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char || !canEquipItem(char, equipId)) return;
  const idx = gameState.equipmentInventory.indexOf(equipId);
  if (idx === -1) return;

  const slot = EQUIPMENT[equipId].type; // weapon | armor | accessory
  const prev = char.equipment[slot];
  if (prev && prev !== 'beginner_sword') gameState.equipmentInventory.push(prev);

  gameState.equipmentInventory.splice(idx, 1);
  char.equipment[slot] = equipId;
}

// 장착 해제 → 인벤토리로
function tryUnequipItem(charId, slot) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;
  const equipId = char.equipment[slot];
  if (!equipId || equipId === 'beginner_sword') return;
  gameState.equipmentInventory.push(equipId);
  char.equipment[slot] = null;
}

function tryEnhanceEquipment(_uid) {
  // 8단계에서 구현
}

function tryLearnSkill(_charId, _skillId) {
  // 10단계에서 구현
}

function tryBuyPet(_petId) {
  // 9단계에서 구현
}

function tryAddCharacter() {
  // 11단계에서 구현
}
