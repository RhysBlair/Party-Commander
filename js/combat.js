function updateCombat(dt) {
  // 사망 캐릭터 부활 처리
  for (const char of gameState.characters) {
    if (!char.isDead) continue;
    char.respawnTimer -= dt;
    if (char.respawnTimer <= 0) {
      char.isDead       = false;
      char.respawnTimer = 0;
      const stats = calcFinalStats(char);
      char.currentHp  = stats.maxHp;
      char.maxHpCache = stats.maxHp;
      resetCharPos(char);
    }
  }

  for (const char of gameState.characters) {
    char.attackAnim = Math.max(0, char.attackAnim - dt);
    char.hitAnim    = Math.max(0, (char.hitAnim || 0) - dt);
    if (!char.isDead) updateShadow(char, dt);
    if (char.isDead) continue;
    const field = gameState.stageFields[char.assignedStage];
    if (!field) continue;
    updateCharacter(char, dt, STAGES[char.assignedStage], field);
  }

  // 몬스터 이동 + 공격 + 리스폰
  for (let i = 0; i < gameState.stageFields.length; i++) {
    const field     = gameState.stageFields[i];
    if (!field) continue;
    const stageData = STAGES[i];
    const aliveChars = gameState.characters.filter(c => c.assignedStage === i && !c.isDead);

    for (const m of field.monsters) {
      m.hitAnim = Math.max(0, m.hitAnim - dt);
      if ((m.debuffTimer || 0) > 0) {
        m.debuffTimer -= dt;
        if (m.debuffTimer <= 0) { m.debuffTimer = 0; m.debuffDmgMult = 1; }
      }

      if (!m.alive) {
        if (m.respawnTimer > 0) {
          m.respawnTimer -= dt;
          if (m.respawnTimer <= 0) {
            m.alive       = true;
            m.currentHp   = m.maxHp;
            m.respawnTimer = 0;
            m.attackTimer  = MONSTER_ATTACK_INTERVAL;
            m.x = m.spawnX;
            m.y = m.spawnY;
          }
        }
        continue;
      }

      updateMonsterMovement(m, dt, stageData, aliveChars);

      // 몬스터 공격 타이머
      m.attackTimer -= dt;
      if (m.attackTimer <= 0 && aliveChars.length > 0) {
        // 가장 가까운 캐릭터
        let target = null, minD2 = Infinity;
        for (const c of aliveChars) {
          const dx = c.x - m.x, dy = c.y - m.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < minD2) { minD2 = d2; target = c; }
        }
        // aggroRange 체크, 빙결 중 공격 불가
        if (target && minD2 <= (stageData.monster.aggroRange || 400) ** 2 && !m.frozen) {
          m.attackTimer = MONSTER_ATTACK_INTERVAL;
          executeMonsterAttack(m, target, stageData, i);
        }
      }
    }
  }
}

// ── 플로팅 데미지 텍스트 ──────────────────────────────────
function spawnFloatingText(stageIdx, x, y, text, color, size) {
  gameState.floatingTexts.push({
    stageIdx,
    x, y,
    text,
    color,
    size: size || 13,
    timer: 0.9,
    vy: -55,
    vx: (Math.random() - 0.5) * 18,
  });
}

function updateFloatingTexts(dt) {
  for (let i = gameState.floatingTexts.length - 1; i >= 0; i--) {
    const f = gameState.floatingTexts[i];
    f.timer -= dt;
    if (f.timer <= 0) { gameState.floatingTexts.splice(i, 1); continue; }
    f.x  += f.vx * dt;
    f.y  += f.vy * dt;
    f.vy += 40 * dt; // 서서히 감속
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

function takeDamage(char, dmg, stageIdx) {
  if (char.isDead) return;
  char.currentHp = (char.currentHp || char.maxHpCache || 100) - dmg;
  char.hitAnim   = 0.2;
  if (char.currentHp <= 0) {
    char.currentHp    = 0;
    char.isDead       = true;
    char.respawnTimer = CHARACTER_RESPAWN_TIME;
    // 분신 활성 중 사망 → 강제 종료 + 쿨다운 정상 설정 (미설정 시 9999 고착 버그)
    if (char.shadowActive) {
      if (!char.skillTimers) char.skillTimers = {};
      const sp = SKILLS['shadow_partner'];
      char.skillTimers['shadow_partner'] = sp ? sp.cooldown : 1.5;
    }
    char.shadowActive = false;
    char.shadowTimer  = 0;
  }
  spawnFloatingText(stageIdx, char.x, char.y - 30, `-${dmg}`, '#e74c3c', 13);
}

// ── 몬스터 이동 ───────────────────────────────────────────
function updateMonsterMovement(m, dt, stageData, aliveChars) {
  // 빙결 타이머 감소 + 이동 정지
  if (m.frozen) {
    m.frozenTimer = (m.frozenTimer || 0) - dt;
    if (m.frozenTimer <= 0) { m.frozen = false; m.frozenTimer = 0; }
    return;
  }

  const md  = stageData.monster;
  const spd = md.moveSpeed || 0;
  if (!spd) return;

  // 생존 캐릭터 없으면 스폰으로 귀환
  if (aliveChars.length === 0) {
    returnToSpawn(m, dt, spd);
    return;
  }

  let nearest = null, minD2 = Infinity;
  for (const c of aliveChars) {
    const dx = c.x - m.x, dy = c.y - m.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < minD2) { minD2 = d2; nearest = c; }
  }

  const dist       = Math.sqrt(minD2);
  const aggroRange = md.aggroRange || 400;

  if (dist > aggroRange) {
    returnToSpawn(m, dt, spd);
    return;
  }

  const stopDist = md.attackRange || 60;
  if (dist > stopDist) {
    const dx = nearest.x - m.x, dy = nearest.y - m.y;
    m.x += (dx / dist) * spd * dt;
    m.y += (dy / dist) * spd * dt;
    // 캔버스 경계 클램프
    m.x = Math.max(48, Math.min(628, m.x));
    m.y = Math.max(48, Math.min(448, m.y));
  }
}

function returnToSpawn(m, dt, spd) {
  const dx = m.spawnX - m.x, dy = m.spawnY - m.y;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < 4) return;
  m.x += (dx / d) * spd * dt;
  m.y += (dy / d) * spd * dt;
}

// ── 투사체 ───────────────────────────────────────────────
function spawnProjectile(stageIdx, x, y, targetChar, dmg, speed, color) {
  const dx   = targetChar.x - x;
  const dy   = targetChar.y - y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  gameState.projectiles.push({
    stageIdx, x, y,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    dmg, color,
    timer: 3.5,
  });
}

function updateProjectiles(dt) {
  for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
    const p = gameState.projectiles[i];
    p.x     += p.vx * dt;
    p.y     += p.vy * dt;
    p.timer -= dt;
    if (p.timer <= 0) { gameState.projectiles.splice(i, 1); continue; }

    for (const char of gameState.characters) {
      if (char.assignedStage !== p.stageIdx || char.isDead) continue;
      const dx = char.x - p.x, dy = char.y - p.y;
      if (dx * dx + dy * dy < 22 * 22) {
        takeDamage(char, p.dmg, p.stageIdx);
        gameState.projectiles.splice(i, 1);
        break;
      }
    }
  }
}

// ── 몬스터 공격 실행 ─────────────────────────────────────
function executeMonsterAttack(m, target, stageData, stageIdx) {
  const md   = stageData.monster;
  const dist = Math.sqrt((target.x - m.x) ** 2 + (target.y - m.y) ** 2);

  // 근접: 공격 범위 내 있어야 함
  if (md.attackType !== 'ranged' && dist > (md.attackRange || 60)) return;

  const stats   = calcFinalStats(target);
  const charDef = md.atkDamageType === 'magical' ? stats.magicDef : stats.physDef;
  const minDmg  = Math.max(1, Math.floor(md.atk * 0.2)); // 최소 20% 관통
  const dmg     = Math.max(minDmg, md.atk - charDef);

  if (md.attackType === 'ranged') {
    spawnProjectile(stageIdx, m.x, m.y, target, dmg, md.projSpeed || 200, md.projColor || '#ff6622');
  } else {
    takeDamage(target, dmg, stageIdx);
  }
}

function updateCharacter(char, dt, stage, field) {
  const stats = calcFinalStats(char);

  // HP 초기화 (첫 틱 또는 undefined)
  if (char.currentHp === undefined) char.currentHp = stats.maxHp;
  char.maxHpCache = stats.maxHp;

  // 버프 타이머 감소
  if (char.activeBuffs) {
    for (const key of Object.keys(char.activeBuffs)) {
      const b = char.activeBuffs[key];
      if (b && b.timer > 0) {
        b.timer -= dt;
        if (b.timer <= 0) {
          delete char.activeBuffs[key];
          if (key === 'hp') {
            const newStats = calcFinalStats(char);
            char.maxHpCache = newStats.maxHp;
            char.currentHp  = Math.min(char.currentHp || 0, newStats.maxHp);
          }
        }
      }
    }
  }

  // 자연 HP 회복 (초당 1%)
  char.currentHp = Math.min(stats.maxHp, char.currentHp + stats.maxHp * 0.01 * dt);

  // 다중 타격 타이머 (따닥/트리플 스로우)
  if ((char.quickHitTimer || 0) > 0) {
    char.quickHitTimer -= dt;
    if (char.quickHitTimer <= 0) {
      char.quickHitTimer = 0;
      const t2 = findNearestMonster(char, field);
      if (t2) dealDamage(char, t2, stats, stage, field, char.quickHitDmgMult ?? 0.5);
      const remaining = Math.max(0, (char.quickHitCount || 0) - 1);
      char.quickHitCount = remaining;
      if (remaining > 0) char.quickHitTimer = char.quickHitDelay || 0.065;
    }
  }

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
      const baseClass     = CLASSES[char.classId]?.parent || char.classId;
      const rogueThrow    = (char.classId === 'rogue' || baseClass === 'rogue') && !!char.equipment?.throwable;
      const hasTriple     = rogueThrow && char.skills?.includes('triple_throw');
      if (hasTriple) {
        // 트리플 스로우: 1/3 × 3타
        dealDamage(char, target, stats, stage, field, 1 / 3);
        char.quickHitDmgMult = 1 / 3;
        char.quickHitDelay   = 0.065;
        char.quickHitCount   = 2;
        char.quickHitTimer   = 0.065;
      } else if (rogueThrow) {
        // 따닥: 0.5 × 2타
        dealDamage(char, target, stats, stage, field, 0.5);
        char.quickHitDmgMult = 0.5;
        char.quickHitDelay   = 0.065;
        char.quickHitCount   = 1;
        char.quickHitTimer   = 0.065;
      } else {
        dealDamage(char, target, stats, stage, field);
      }
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
    const cdMult = (char.activeBuffs?.cd?.timer > 0) ? (char.activeBuffs.cd.mult || 1) : 1;
    char.skillTimers[skillId] -= dt * cdMult;
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
  // ── 몬스터 디버프 — 받는 피해 증가 (페이지 위협) ───────────
  if (skill.targeting === 'debuff_area') {
    const maxR2   = (skill.debuffRange || 250) ** 2;
    const targets = field.monsters.filter(m => {
      if (!m.alive) return false;
      const dx = m.x - char.x, dy = m.y - char.y;
      return dx * dx + dy * dy <= maxR2;
    });
    if (!targets.length) return false;
    for (const t of targets) {
      t.debuffDmgMult = skill.debuffDmgMult || 1.5;
      t.debuffTimer   = skill.debuffDuration || 8.0;
      spawnFloatingText(char.assignedStage, t.x, t.y - 28, '피해 +50%', '#e67e22', 12);
    }
    return true;
  }

  // ── 파티 버프 (스피어맨 오라, 나이트 분노) ─────────────────
  if (skill.targeting === 'party_buff') {
    const stageIdx = char.assignedStage;
    const allies   = gameState.characters.filter(c => c.assignedStage === stageIdx && !c.isDead);
    if (!allies.length) return false;
    for (const c of allies) {
      if (!c.activeBuffs) c.activeBuffs = {};
      if (skill.buffHp) {
        const wasBuffed = c.activeBuffs.hp && c.activeBuffs.hp.timer > 0;
        c.activeBuffs.hp = { mult: skill.buffHp, timer: skill.buffDuration };
        if (!wasBuffed) {
          const newMax = calcFinalStats(c).maxHp;
          c.currentHp  = Math.min(newMax, (c.currentHp || c.maxHpCache || 100) * skill.buffHp);
          c.maxHpCache = newMax;
        }
        spawnFloatingText(stageIdx, c.x, c.y - 30, '체력 ×2!', '#2ecc71', 13);
      }
      if (skill.buffCdMult) {
        c.activeBuffs.cd = { mult: skill.buffCdMult, timer: skill.buffDuration };
        spawnFloatingText(stageIdx, c.x, c.y - 44, '스킬 가속!', '#3498db', 13);
      }
      if (skill.buffAtk) {
        c.activeBuffs.atk = { mult: skill.buffAtk, timer: skill.buffDuration };
        spawnFloatingText(stageIdx, c.x, c.y - 30, '공격 ×2!', '#e74c3c', 13);
      }
    }
    return true;
  }

  // 쉐도우파트너: 분신 소환
  if (skill.targeting === 'shadow') {
    char.shadowActive = true;
    char.shadowTimer  = skill.duration;
    char.shadowX = char.x - char.facing * 28;
    char.shadowY = char.y + 4;
    return true;
  }

  const dmg = Math.floor(stats.atk * skill.dmgMultiplier);

  // ── 범위 회복 (클레릭) ──────────────────────────────────
  if (skill.targeting === 'heal') {
    const stageIdx = char.assignedStage;
    const healAmt  = Math.floor(stats.atk * (skill.healMult || 2));
    const allies   = gameState.characters.filter(c => {
      if (c.isDead || c.assignedStage !== stageIdx) return false;
      const dx = c.x - char.x, dy = c.y - char.y;
      return dx * dx + dy * dy <= (skill.healRange || 300) ** 2;
    });
    const needsHeal = allies.some(c => (c.currentHp || 0) < (c.maxHpCache || 100));
    if (!needsHeal) return false;
    for (const c of allies) {
      if ((c.currentHp || 0) < (c.maxHpCache || 100)) {
        c.currentHp = Math.min(c.maxHpCache || 100, (c.currentHp || 0) + healAmt);
        spawnFloatingText(stageIdx, c.x, c.y - 24, `+${healAmt}`, '#2ecc71', 14);
      }
    }
    return true;
  }

  // ── 광역 빙결 (썬콜) ────────────────────────────────────
  if (skill.targeting === 'aoe_freeze') {
    const maxR2   = (skill.freezeRange || 270) ** 2;
    const targets = field.monsters.filter(m => {
      if (!m.alive) return false;
      const dx = m.x - char.x, dy = m.y - char.y;
      return dx * dx + dy * dy <= maxR2;
    }).slice(0, skill.maxTargets || 8);
    if (!targets.length) return false;
    for (const t of targets) {
      dealSkillDamage(char, t, dmg, stage, field, stats);
      t.frozen      = true;
      t.frozenTimer = skill.freezeDuration || 5.0;
    }
    return true;
  }

  if (skill.targeting === 'aoe') {
    const targets = field.monsters.filter(m => m.alive).slice(0, skill.maxTargets || 5);
    if (!targets.length) return false;
    for (const t of targets) dealSkillDamage(char, t, dmg, stage, field, stats);
    return true;
  }

  if (skill.targeting === 'double_hit') {
    const t = findNearestMonster(char, field);
    if (!t) return false;
    for (let h = 0; h < (skill.hits || 2); h++) dealSkillDamage(char, t, dmg, stage, field, stats);
    return true;
  }

  // single_melee / single_long
  const t = findNearestMonster(char, field);
  if (!t) return false;
  dealSkillDamage(char, t, dmg, stage, field, stats);
  return true;
}

function dealSkillDamage(char, monster, dmg, stage, field, stats) {
  const isCrit    = stats && Math.random() * 100 < stats.critRate;
  const critMult  = isCrit ? (stats?.critDmg ?? 2) : 1;
  const dmgType   = CLASSES[char.classId]?.damageType || 'physical';
  const mDef      = dmgType === 'magical' ? stage.monster.magicDef : stage.monster.physDef;
  const debuffMult = (monster.debuffTimer > 0) ? (monster.debuffDmgMult || 1) : 1;
  const actualDmg = Math.max(1, Math.floor((Math.floor(dmg * critMult) - mDef) * debuffMult));

  const col  = isCrit ? '#f1c40f' : '#5b9bd5';
  const size = isCrit ? 17 : 13;
  spawnFloatingText(char.assignedStage, monster.x, monster.y - 24,
                    isCrit ? `${actualDmg}!` : `${actualDmg}`, col, size);
  monster.currentHp -= actualDmg;
  monster.hitAnim    = isCrit ? 0.25 : 0.2;
  char.attackAnim    = 0.25;

  // 쉐도우파트너: 스킬 분신 타격 — 몬스터 위치에 동일하게 표기
  if (char.shadowActive) {
    const shadowDmg = Math.max(1, Math.floor(actualDmg * 0.5));
    spawnFloatingText(char.assignedStage, monster.x, monster.y - 24,
                      `${shadowDmg}`, '#e0e0e0', 13);
    monster.currentHp -= shadowDmg;
  }

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

// dmgMult: 도적 따닥 분할 타격 시 0.5 전달 (기본값 1.0)
function dealDamage(char, monster, stats, stage, field, dmgMult = 1.0) {
  if (Math.random() * 100 >= stats.accuracy) return;

  const hasOrb = char.skills && char.skills.includes('orb_strike');
  let baseDmg, orbExplosion = false, isCrit = false;

  const dmgType = CLASSES[char.classId]?.damageType || 'physical';
  const mDef    = dmgType === 'magical' ? stage.monster.magicDef : stage.monster.physDef;

  if (hasOrb && char.orbReady && dmgMult >= 1.0) {
    const skill = SKILLS['orb_strike'];
    const mult  = skill ? skill.dmgMultiplier : 20;
    baseDmg      = Math.max(1, Math.floor(stats.atk * mult) - mDef);
    char.orbReady   = false;
    char.orbCount   = 0;
    char.attackAnim = 0.6;
    orbExplosion    = true;
  } else {
    const atkMult    = getSkillAtkMult(char);
    const atkBufMult = (char.activeBuffs?.atk?.timer > 0) ? (char.activeBuffs.atk.mult || 1) : 1;
    const rawDmg  = Math.max(1, Math.floor(stats.atk * atkMult * atkBufMult) - mDef);
    baseDmg       = Math.max(1, Math.floor(rawDmg * dmgMult));
    if (hasOrb) {
      char.orbCount = (char.orbCount || 0) + 1;
      const required = SKILLS['orb_strike']?.orbsRequired ?? 5;
      if (char.orbCount >= required) { char.orbReady = true; char.orbCount = 0; }
    }
    if (Math.random() * 100 < stats.critRate) {
      isCrit  = true;
      baseDmg = Math.floor(baseDmg * stats.critDmg);
    }
    char.attackAnim = atkMult > 1 ? 0.1 : 0.2;
  }

  // 디버프(위협): 받는 피해 증가
  const debuffMult = (monster.debuffTimer > 0) ? (monster.debuffDmgMult || 1) : 1;
  baseDmg = Math.floor(baseDmg * debuffMult);

  // 캐릭터 타격 텍스트
  const col  = orbExplosion ? '#ff6622' : isCrit ? '#f1c40f' : '#e0e0e0';
  const size = orbExplosion ? 22        : isCrit ? 19        : 13;
  spawnFloatingText(char.assignedStage, monster.x, monster.y - 24,
                    (orbExplosion || isCrit) ? `${baseDmg}!` : `${baseDmg}`, col, size);
  monster.currentHp -= baseDmg;
  monster.hitAnim    = orbExplosion ? 0.4 : isCrit ? 0.25 : 0.15;

  // 쉐도우파트너: 분신 타격 — 몬스터 위치에 일반 공격과 동일하게 표기
  if (char.shadowActive) {
    const shadowDmg = Math.max(1, Math.floor(baseDmg * 0.5));
    spawnFloatingText(char.assignedStage, monster.x, monster.y - 24,
                      `${shadowDmg}`, '#e0e0e0', 13);
    monster.currentHp -= shadowDmg;
  }

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

  // 처치수: 다음 스테이지가 아직 해금되지 않은 경우에만 카운트 + 자동 진행
  const nextIdx        = char.assignedStage + 1;
  const alreadyUnlocked = nextIdx < STAGES.length && nextIdx <= gameState.maxStageReached;
  if (!alreadyUnlocked) {
    field.kills++;
    if (field.kills >= stage.killsToAdvance) {
      advanceStageField(char.assignedStage);
      markTabDirty();
    }
  }

  // 경험치 분배 (항상)
  const expMult  = 1 + (gameState.upgrades?.exp_boost || 0) * 0.10;
  const allies   = gameState.characters.filter(c => c.assignedStage === char.assignedStage);
  const killerI  = allies.indexOf(char);
  const expArr   = calcExpDistribution(Math.floor(stage.monster.expDrop * expMult), allies.map(c => c.level), killerI);
  allies.forEach((c, i) => { c.exp += expArr[i]; checkLevelUp(c); });

  generateDrop(char.assignedStage, monster.x, monster.y);
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
      const charDmgType = CLASSES[char.classId]?.damageType || 'physical';
      const offDef = charDmgType === 'magical' ? m.magicDef : m.physDef;
      const dmg = Math.max(1, Math.floor(stats.atk * atkMult) - offDef);
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
