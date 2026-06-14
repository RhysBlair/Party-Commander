function updateCombat(dt) {
  for (const char of gameState.characters) {
    char.attackAnim = Math.max(0, char.attackAnim - dt);
    updateShadow(char, dt);
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

// ── 쉐도우파트너 업데이트 ─────────────────────────────────
function updateShadow(char, dt) {
  if (!char.shadowActive) return;

  char.shadowTimer -= dt;
  if (char.shadowTimer <= 0) {
    char.shadowActive = false;
    char.shadowTimer  = 0;
    // 분신 소멸 후 쿨다운 시작
    if (!char.skillTimers) char.skillTimers = {};
    const skill = SKILLS['shadow_partner'];
    char.skillTimers['shadow_partner'] = skill ? skill.cooldown : 10;
    return;
  }

  // 분신 위치: 캐릭터 바로 뒤를 부드럽게 추적
  const tx = char.x - char.facing * 28;
  const ty = char.y + 4;
  if (char.shadowX === undefined) {
    char.shadowX = tx;
    char.shadowY = ty;
  } else {
    char.shadowX += (tx - char.shadowX) * 0.25;
    char.shadowY += (ty - char.shadowY) * 0.25;
  }
}

// 패시브 스킬 중 attackInterval 값을 찾아 반환 (없으면 기본값)
function getAttackInterval(char) {
  let interval = ATTACK_INTERVAL;
  if (char.skills) {
    for (const id of char.skills) {
      const s = SKILLS[id];
      if (s && s.attackInterval) { interval = s.attackInterval; break; }
    }
  }
  const spdPct = (gameState.upgrades?.atk_spd || 0) * 0.05;
  return Math.max(0.1, interval * (1 - spdPct));
}

// 패시브 스킬 중 공격 배율 반환 (없으면 1)
function getSkillAtkMult(char) {
  if (char.skills) {
    for (const id of char.skills) {
      const s = SKILLS[id];
      if (s && s.attackInterval) return s.dmgMultiplier ?? 1;
    }
  }
  return 1;
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

  const atkInterval = getAttackInterval(char);

  if (dist > range) {
    const step = CHAR_SPEED * dt;
    char.x += (dx / dist) * step;
    char.y += (dy / dist) * step;
    char.facing = dx >= 0 ? 1 : -1;
    char.attackTimer = atkInterval;
  } else {
    char.attackTimer -= dt;
    if (char.attackTimer <= 0) {
      char.attackTimer = atkInterval;
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

    // 패시브 스킬은 useSkills에서 처리하지 않음 (dealDamage에서 처리)
    if (skill.targeting === 'passive') continue;
    // 쉐도우파트너: 분신 활성 중에는 쿨다운 타이머를 진행하지 않음
    if (skill.targeting === 'shadow' && char.shadowActive) continue;

    if (char.skillTimers[skillId] === undefined) char.skillTimers[skillId] = 0;
    char.skillTimers[skillId] -= dt;
    if (char.skillTimers[skillId] > 0) continue;

    if (executeSkill(char, skill, stats, stage, field)) {
      // shadow_partner는 소멸 시 쿨다운을 설정하므로 여기선 0으로만
      if (skill.targeting !== 'shadow') {
        char.skillTimers[skillId] = skill.cooldown;
      } else {
        char.skillTimers[skillId] = 9999; // 분신 소멸 전까지 재발동 방지
      }
      char.skillAnim = 0.5;
    }
  }
}

function executeSkill(char, skill, stats, stage, field) {
  // 쉐도우파트너: 분신 소환
  if (skill.targeting === 'shadow') {
    char.shadowActive = true;
    char.shadowTimer  = skill.duration;
    char.shadowX = char.x - char.facing * 28;
    char.shadowY = char.y + 4;
    return true;
  }

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
  let total = actualDmg;

  // 쉐도우파트너: 분신도 50% 추가 데미지
  if (char.shadowActive) total += Math.max(1, Math.floor(actualDmg * 0.5));

  monster.currentHp -= total;
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

  const hasOrb = char.skills && char.skills.includes('orb_strike');
  let baseDmg, orbExplosion = false;

  if (hasOrb && char.orbReady) {
    // 오브 폭발: 2000% 데미지
    const skill = SKILLS['orb_strike'];
    const mult  = skill ? skill.dmgMultiplier : 20;
    baseDmg      = Math.max(1, Math.floor(stats.atk * mult) - stage.monster.def);
    char.orbReady   = false;
    char.orbCount   = 0;
    char.attackAnim = 0.6;
    orbExplosion    = true;
  } else {
    const atkMult = getSkillAtkMult(char);
    baseDmg = Math.max(1, Math.floor(stats.atk * atkMult) - stage.monster.def);
    if (hasOrb) {
      char.orbCount = (char.orbCount || 0) + 1;
      const required = SKILLS['orb_strike']?.orbsRequired ?? 5;
      if (char.orbCount >= required) {
        char.orbReady = true;
        char.orbCount = 0;
      }
    }
    char.attackAnim = atkMult > 1 ? 0.1 : 0.2;
  }

  let total = baseDmg;
  // 쉐도우파트너: 분신도 50% 추가 데미지
  if (char.shadowActive) total += Math.max(1, Math.floor(baseDmg * 0.5));

  monster.currentHp -= total;
  monster.hitAnim    = orbExplosion ? 0.4 : 0.15;
  if (monster.currentHp <= 0) killMonster(char, monster, stage, field);
}

function calcExpDistribution(baseExp, levels, killerIdx) {
  const n        = levels.length;
  const levelSum = levels.reduce((a, b) => a + b, 0);
  const BONUS    = [1, 1, 1.10, 1.15, 1.20, 1.25, 1.30];
  const bonus    = BONUS[n] ?? 1;

  return levels.map((lv, i) => {
    const ratio = lv / levelSum;
    const share = i === killerIdx
      ? baseExp * (0.2 + 0.8 * ratio)
      : baseExp * 0.8 * ratio;
    return Math.floor(share * bonus);
  });
}

function killMonster(char, monster, stage, field) {
  monster.alive         = false;
  monster.respawnTimer  = MONSTER_RESPAWN_TIME;

  const goldMult = 1 + (gameState.upgrades?.gold_boost || 0) * 0.10;
  gameState.gold += Math.floor(stage.monster.goldDrop * goldMult);
  field.kills++;

  // 같은 스테이지 파티원 전원에게 경험치 분배
  const expMult  = 1 + (gameState.upgrades?.exp_boost || 0) * 0.10;
  const allies   = gameState.characters.filter(c => c.assignedStage === char.assignedStage);
  const killerI  = allies.indexOf(char);
  const expArr   = calcExpDistribution(Math.floor(stage.monster.expDrop * expMult), allies.map(c => c.level), killerI);
  allies.forEach((c, i) => { c.exp += expArr[i]; checkLevelUp(c); });

  generateDrop(char.assignedStage, monster.x, monster.y);

  if (field.kills >= stage.killsToAdvance) {
    advanceStageField(char.assignedStage);
    markTabDirty();
  }
}

// ── 오프라인 진행 계산 ─────────────────────────────────────
function calcOfflineRewards(elapsedSec) {
  const MAX_OFFLINE = 8 * 3600; // 최대 8시간 캡
  const t = Math.min(elapsedSec, MAX_OFFLINE);
  if (t < 30) return null;

  let totalGold = 0;
  const expGains = {}; // { charId: exp }

  const stageGroups = {};
  for (const char of gameState.characters) {
    const s = char.assignedStage;
    if (!stageGroups[s]) stageGroups[s] = [];
    stageGroups[s].push(char);
  }

  for (const [stageIdxStr, chars] of Object.entries(stageGroups)) {
    const stageIdx = parseInt(stageIdxStr);
    const stage = STAGES[stageIdx];
    if (!stage) continue;

    const m = stage.monster;
    const goldMult = 1 + (gameState.upgrades?.gold_boost || 0) * 0.10;
    const expMult  = 1 + (gameState.upgrades?.exp_boost  || 0) * 0.10;

    let partyDps = 0;
    for (const char of chars) {
      const stats = calcFinalStats(char);
      const atkInterval = getAttackInterval(char);
      const atkMult = getSkillAtkMult(char);
      const dmg = Math.max(1, Math.floor(stats.atk * atkMult) - m.def);
      partyDps += dmg / atkInterval;
    }
    if (partyDps <= 0) continue;

    const timeToKill = m.hp / partyDps;
    const cycleTime  = timeToKill + MONSTER_RESPAWN_TIME;
    const totalKills = Math.floor((t / cycleTime) * stage.spawnCount);
    if (totalKills <= 0) continue;

    totalGold += Math.floor(m.goldDrop * goldMult * totalKills);

    const levelSum = chars.reduce((a, c) => a + c.level, 0);
    const baseExpTotal = Math.floor(m.expDrop * expMult * totalKills);
    for (const char of chars) {
      const share = levelSum > 0 ? Math.floor(baseExpTotal * (char.level / levelSum)) : 0;
      expGains[char.id] = (expGains[char.id] || 0) + share;
    }
  }

  return { totalGold, expGains, seconds: t };
}

function applyOfflineProgress() {
  // gameState.lastTick = 마지막 저장 시각
  const elapsedSec = Math.floor((Date.now() - gameState.lastTick) / 1000);
  if (elapsedSec < 30) return null;

  const rewards = calcOfflineRewards(elapsedSec);
  if (!rewards) return null;

  gameState.gold += rewards.totalGold;
  for (const char of gameState.characters) {
    const gained = rewards.expGains[char.id] || 0;
    if (gained > 0) {
      char.exp += gained;
      checkLevelUp(char);
    }
  }
  return rewards;
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
