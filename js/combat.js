function updateCombat(dt) {
  // 각 캐릭터는 자신이 배치된 스테이지 필드에서 독립 전투
  for (const char of gameState.characters) {
    char.attackAnim = Math.max(0, char.attackAnim - dt);
    const field = gameState.stageFields[char.assignedStage];
    if (!field) continue;
    updateCharacter(char, dt, STAGES[char.assignedStage], field);
  }

  // 모든 활성 필드의 몬스터 리스폰 처리
  for (const field of gameState.stageFields) {
    if (!field) continue;
    for (const m of field.monsters) {
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
}

function updateCharacter(char, dt, stage, field) {
  const stats = calcFinalStats(char);
  const range  = RANGE_PIXELS[CLASSES[char.classId].range];
  const target = findNearestMonster(char, field);
  if (!target) return;

  char.skillAnim = Math.max(0, (char.skillAnim || 0) - dt);

  const dx = target.x - char.x;
  const dy = target.y - char.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > range) {
    const step = CHAR_SPEED * dt;
    char.x += (dx / dist) * step;
    char.y += (dy / dist) * step;
    char.facing = dx >= 0 ? 1 : -1;
    char.attackTimer = ATTACK_INTERVAL;
  } else {
    char.attackTimer -= dt;
    if (char.attackTimer <= 0) {
      char.attackTimer = ATTACK_INTERVAL;
      dealDamage(char, target, stats, stage, field);
    }
  }

  useSkills(char, dt, stats, stage, field);
}

function useSkills(char, dt, stats, stage, field) {
  if (!char.skills || !char.skills.length) return;
  if (!char.skillTimers) char.skillTimers = {};

  for (const skillId of char.skills) {
    const skill = SKILLS[skillId];
    if (!skill) continue;
    if (char.skillTimers[skillId] === undefined) char.skillTimers[skillId] = 0;
    char.skillTimers[skillId] -= dt;
    if (char.skillTimers[skillId] > 0) continue;

    if (executeSkill(char, skill, stats, stage, field)) {
      char.skillTimers[skillId] = skill.cooldown;
      char.skillAnim = 0.5;
    }
  }
}

function executeSkill(char, skill, stats, stage, field) {
  const dmg = Math.floor(stats.atk * skill.dmgMultiplier);

  if (skill.targeting === 'aoe') {
    const targets = field.monsters.filter(m => m.alive).slice(0, skill.maxTargets || 5);
    if (!targets.length) return false;
    for (const t of targets) dealSkillDamage(char, t, dmg, stage, field);
    return true;
  }

  if (skill.targeting === 'double_hit') {
    const t = findNearestMonster(char, field);
    if (!t) return false;
    for (let h = 0; h < (skill.hits || 2); h++) dealSkillDamage(char, t, dmg, stage, field);
    return true;
  }

  // single_melee / single_long
  const t = findNearestMonster(char, field);
  if (!t) return false;
  dealSkillDamage(char, t, dmg, stage, field);
  return true;
}

function dealSkillDamage(char, monster, dmg, stage, field) {
  const actualDmg = Math.max(1, dmg - stage.monster.def);
  monster.currentHp -= actualDmg;
  monster.hitAnim    = 0.2;
  char.attackAnim    = 0.25;
  if (monster.currentHp <= 0) killMonster(char, monster, stage, field);
}

function findNearestMonster(char, field) {
  let nearest = null, minDist = Infinity;
  for (const m of field.monsters) {
    if (!m.alive) continue;
    const dx = m.x - char.x, dy = m.y - char.y;
    const d = dx * dx + dy * dy;
    if (d < minDist) { minDist = d; nearest = m; }
  }
  return nearest;
}

function dealDamage(char, monster, stats, stage, field) {
  if (Math.random() * 100 >= stats.accuracy) return;
  const dmg = Math.max(1, stats.atk - stage.monster.def);
  monster.currentHp -= dmg;
  monster.hitAnim    = 0.15;
  char.attackAnim    = 0.2;
  if (monster.currentHp <= 0) killMonster(char, monster, stage, field);
}

function killMonster(char, monster, stage, field) {
  monster.alive         = false;
  monster.respawnTimer  = MONSTER_RESPAWN_TIME;

  gameState.gold += stage.monster.goldDrop;
  field.kills++;

  char.exp += stage.monster.expDrop;
  checkLevelUp(char);

  generateDrop(char.assignedStage, monster.x, monster.y);

  if (field.kills >= stage.killsToAdvance) {
    advanceStageField(char.assignedStage);
    markTabDirty();
  }
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
