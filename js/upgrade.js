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
  if (char.autoAssign && char.unspentPoints > 0) {
    autoAssignStats(char);
  }
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

function tryAdvanceJob(_charId, _classId) {
  // 5단계에서 구현
}

function tryBuyEquipment(_equipId) {
  // 7단계에서 구현
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
