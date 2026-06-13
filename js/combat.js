function updateCombat(dt) {
  const stage = STAGES[gameState.currentStage];

  for (const char of gameState.characters) {
    char.attackAnim = Math.max(0, char.attackAnim - dt);
    updateCharacter(char, dt, stage);
  }

  for (const m of gameState.fieldMonsters) {
    m.hitAnim = Math.max(0, m.hitAnim - dt);
    if (!m.alive && m.respawnTimer > 0) {
      m.respawnTimer -= dt;
      if (m.respawnTimer <= 0) {
        m.alive = true;
        m.currentHp = m.maxHp;
        m.respawnTimer = 0;
      }
    }
  }
}

function updateCharacter(char, dt, stage) {
  const stats = calcFinalStats(char);
  const range = RANGE_PIXELS[CLASSES[char.classId].range];

  const target = findNearestMonster(char);
  if (!target) return;

  const dx = target.x - char.x;
  const dy = target.y - char.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > range) {
    // 몬스터를 향해 이동
    const step = CHAR_SPEED * dt;
    char.x += (dx / dist) * step;
    char.y += (dy / dist) * step;
    char.facing = dx >= 0 ? 1 : -1;
    char.attackTimer = ATTACK_INTERVAL; // 이동 중에는 쿨다운 유지
  } else {
    // 사정거리 안 — 공격 쿨다운 감소
    char.attackTimer -= dt;
    if (char.attackTimer <= 0) {
      char.attackTimer = ATTACK_INTERVAL;
      dealDamage(char, target, stats, stage);
    }
  }
}

function findNearestMonster(char) {
  let nearest = null;
  let minDist = Infinity;
  for (const m of gameState.fieldMonsters) {
    if (!m.alive) continue;
    const dx = m.x - char.x;
    const dy = m.y - char.y;
    const d = dx * dx + dy * dy;
    if (d < minDist) { minDist = d; nearest = m; }
  }
  return nearest;
}

function dealDamage(char, monster, stats, stage) {
  // 명중 판정
  if (Math.random() * 100 >= stats.accuracy) return;

  const dmg = Math.max(1, stats.atk - stage.monster.def);
  monster.currentHp -= dmg;
  monster.hitAnim = 0.15;
  char.attackAnim  = 0.2;

  if (monster.currentHp <= 0) {
    killMonster(char, monster, stage);
  }
}

function killMonster(char, monster, stage) {
  monster.alive = false;
  monster.respawnTimer = MONSTER_RESPAWN_TIME;

  gameState.gold      += stage.monster.goldDrop;
  gameState.stageKills++;

  // 경험치 지급 및 레벨업 체크
  char.exp += stage.monster.expDrop;
  checkLevelUp(char);
}

function checkLevelUp(char) {
  const prevLevel = char.level;
  let needed = expRequired(char.level);
  while (char.exp >= needed) {
    char.exp   -= needed;
    char.level++;
    char.unspentPoints += STAT_POINTS_PER_LEVEL;
    if (char.autoAssign) autoAssignStats(char);
    console.log(`[레벨업] ${char.level}레벨 달성!`);
    needed = expRequired(char.level);
  }
  if (char.level !== prevLevel) markTabDirty();
}
