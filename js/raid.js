// ── 자쿰 레이드 ──────────────────────────────────────────────

const ZAKUM = {
  hp:        5_000_000,
  physDef:   80,
  magicDef:  80,
  // 기본 공격
  atk:         100,
  atkInterval: 2.5,
  // 범위 공격
  aoeAtk:      70,
  aoeInterval: 7.0,
  // 소환수
  summonInterval: 18.0,
  maxMinions:     40,
  // 버프 해제
  dispelInterval: 28.0,
  // 자폭 명령
  explodeInterval: 22.0,
  // 희귀 기술 (rareTimer마다 확률 체크)
  rareCheckInterval: 15.0,
  accDebuffChance: 0.40,   // 40% → 명중률 저하
  sealChance:      0.35,   // 35% → 스킬 봉인
  accDebuffAmt:    70,     // -70 명중률
  accDebuffDur:    10.0,
  sealDur:         12.0,
};

const ZAKUM_MINION_HP       = 8_000;
const ZAKUM_MINION_ATK      = 35;
const ZAKUM_MINION_SPEED    = 90;
const ZAKUM_MINION_INTERVAL = 2.0;
const ZAKUM_EXPLODE_DMG     = 500;
const ZAKUM_EXPLODE_RANGE   = 100;

const RAID_CHAR_POS = [
  { x: 80,  y: 180 }, { x: 80,  y: 250 }, { x: 80,  y: 320 }, { x: 80,  y: 390 },
  { x: 130, y: 180 }, { x: 130, y: 250 }, { x: 130, y: 320 }, { x: 130, y: 390 },
];
const BOSS_X = 420, BOSS_Y = 240;

// ── 초기화 ────────────────────────────────────────────────────

function initRaidField() {
  gameState.raidField = {
    boss: {
      hp: ZAKUM.hp, maxHp: ZAKUM.hp, alive: true,
      x: BOSS_X, y: BOSS_Y, hitAnim: 0,
      atkTimer:     ZAKUM.atkInterval,
      aoeTimer:     ZAKUM.aoeInterval,
      summonTimer:  ZAKUM.summonInterval,
      dispelTimer:  ZAKUM.dispelInterval,
      explodeTimer: ZAKUM.explodeInterval,
      rareTimer:    ZAKUM.rareCheckInterval,
    },
    minions: [], nextMinionId: 0, cleared: false,
    damageLog: {}, healLog: {}, elapsedTime: 0,
  };
}

function resetRaidCharPos(char) {
  const list = gameState.characters.filter(c => c.inRaid);
  const idx  = list.indexOf(char);
  const pos  = RAID_CHAR_POS[idx % RAID_CHAR_POS.length];
  char.x = pos.x; char.y = pos.y;
  char.attackTimer = 0; char.attackAnim = 0; char.facing = 1;
}

function enterRaid(charId) {
  if (!gameState.raidField) initRaidField();
  if (gameState.raidField.cleared) return;
  const char = gameState.characters.find(c => c.id === charId);
  if (!char || char.inRaid) return;
  char.inRaid = true;
  resetRaidCharPos(char);
  markTabDirty();
}

function leaveRaid(charId) {
  const char = gameState.characters.find(c => c.id === charId);
  if (!char || !char.inRaid) return;
  char.inRaid        = false;
  char.raidAccDown   = 0;
  char.raidSkillSeal = 0;
  if (!gameState.stageFields[char.assignedStage]) initStageField(char.assignedStage);
  resetCharPos(char);
  markTabDirty();
}

function resetRaid() {
  initRaidField();
  for (const c of gameState.characters) {
    c.raidAccDown = 0; c.raidSkillSeal = 0;
    if (c.inRaid) resetRaidCharPos(c);
  }
  markTabDirty();
}

// ── 메인 업데이트 ─────────────────────────────────────────────

function logRaidDamage(rf, charId, dmg) {
  rf.damageLog[charId] = (rf.damageLog[charId] || 0) + dmg;
}

function logRaidHeal(rf, charId, heal) {
  rf.healLog[charId] = (rf.healLog[charId] || 0) + heal;
}

function finishRaid(rf) {
  if (rf.cleared) return;
  rf.cleared = true;
  markTabDirty();
  setTimeout(() => showRaidResult(rf), 1500);
}

function updateRaid(dt) {
  const rf = gameState.raidField;
  if (!rf) return;
  if (!rf.cleared) rf.elapsedTime = (rf.elapsedTime || 0) + dt;

  const raidChars = gameState.characters.filter(c => c.inRaid);
  if (!raidChars.length) return;

  // 레이드 디버프 타이머
  for (const c of raidChars) {
    if ((c.raidAccDown   || 0) > 0) c.raidAccDown   = Math.max(0, c.raidAccDown   - dt);
    if ((c.raidSkillSeal || 0) > 0) c.raidSkillSeal = Math.max(0, c.raidSkillSeal - dt);
  }

  // 캐릭터 hitAnim / attackAnim / 부활
  for (const c of raidChars) {
    c.attackAnim = Math.max(0, c.attackAnim - dt);
    c.hitAnim    = Math.max(0, (c.hitAnim || 0) - dt);
    if (c.isDead) {
      c.respawnTimer = (c.respawnTimer || 0) - dt;
      if (c.respawnTimer <= 0) {
        c.isDead = false; c.respawnTimer = 0;
        const s  = calcFinalStats(c);
        c.currentHp = s.maxHp; c.maxHpCache = s.maxHp;
        resetRaidCharPos(c);
      }
      continue;
    }
    updateShadow(c, dt);
  }

  const alive = raidChars.filter(c => !c.isDead);

  updateRaidMinions(rf, dt, alive);

  if (rf.boss.alive) {
    updateZakumBoss(rf, dt, raidChars, alive);
    rf.boss.hitAnim = Math.max(0, rf.boss.hitAnim - dt);
  }

  for (const c of alive) updateRaidCharacter(c, dt, rf);
}

// ── 보스 능력 ─────────────────────────────────────────────────

function updateZakumBoss(rf, dt, raidChars, alive) {
  const b = rf.boss;

  // 기본 공격 — 랜덤 1명
  b.atkTimer -= dt;
  if (b.atkTimer <= 0 && alive.length) {
    b.atkTimer = ZAKUM.atkInterval;
    raidTakeDamage(alive[Math.floor(Math.random() * alive.length)], ZAKUM.atk);
  }

  // 범위 공격 — 전원
  b.aoeTimer -= dt;
  if (b.aoeTimer <= 0 && alive.length) {
    b.aoeTimer = ZAKUM.aoeInterval;
    alive.forEach(c => raidTakeDamage(c, ZAKUM.aoeAtk));
    spawnRaidFT(b.x, b.y - 56, '★ 범위 공격!', '#e74c3c', 16);
  }

  // 소환수 소환
  b.summonTimer -= dt;
  if (b.summonTimer <= 0) {
    b.summonTimer = ZAKUM.summonInterval;
    const cur   = rf.minions.filter(m => m.alive).length;
    const count = Math.min(5 + Math.floor(Math.random() * 11), ZAKUM.maxMinions - cur);
    for (let i = 0; i < count; i++) spawnRaidMinion(rf);
    if (count > 0) spawnRaidFT(b.x, b.y - 70, `★ 소환! (${count}마리)`, '#9b59b6', 15);
  }

  // 버프 해제
  b.dispelTimer -= dt;
  if (b.dispelTimer <= 0) {
    b.dispelTimer = ZAKUM.dispelInterval;
    let hit = false;
    for (const c of raidChars) {
      if (c.activeBuffs && Object.keys(c.activeBuffs).length) { c.activeBuffs = {}; hit = true; }
    }
    if (hit) spawnRaidFT(b.x, b.y - 70, '★ 버프 해제!', '#f1c40f', 15);
  }

  // 소환수 자폭 명령
  b.explodeTimer -= dt;
  if (b.explodeTimer <= 0) {
    b.explodeTimer = ZAKUM.explodeInterval;
    const ready = rf.minions.filter(m => m.alive && !m.exploding);
    if (ready.length && alive.length) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      ready.forEach(m => { m.exploding = true; m.explodeTarget = target; });
      spawnRaidFT(b.x, b.y - 70, '★ 자폭 명령!', '#e67e22', 15);
    }
  }

  // 희귀 기술
  b.rareTimer -= dt;
  if (b.rareTimer <= 0) {
    b.rareTimer = ZAKUM.rareCheckInterval;
    const roll = Math.random();
    if (roll < ZAKUM.accDebuffChance) {
      raidChars.forEach(c => { c.raidAccDown = ZAKUM.accDebuffDur; });
      spawnRaidFT(b.x, b.y - 85, '★ 어둠의 장막!', '#7f8c8d', 15);
    } else if (roll < ZAKUM.accDebuffChance + ZAKUM.sealChance) {
      raidChars.forEach(c => { c.raidSkillSeal = ZAKUM.sealDur; });
      spawnRaidFT(b.x, b.y - 85, '★ 스킬 봉인!', '#8e44ad', 15);
    }
  }
}

// ── 소환수 ────────────────────────────────────────────────────

function spawnRaidMinion(rf) {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 65 + Math.random() * 80;
  rf.minions.push({
    id: rf.nextMinionId++,
    hp: ZAKUM_MINION_HP, maxHp: ZAKUM_MINION_HP, alive: true,
    x:  Math.max(185, Math.min(615, BOSS_X + Math.cos(angle) * dist)),
    y:  Math.max(60,  Math.min(440, BOSS_Y + Math.sin(angle) * dist)),
    atkTimer: ZAKUM_MINION_INTERVAL * (0.4 + Math.random() * 0.6),
    hitAnim: 0, exploding: false, explodeTarget: null,
    frozen: false, frozenTimer: 0, debuffTimer: 0, debuffDmgMult: 1,
  });
}

function updateRaidMinions(rf, dt, alive) {
  // 죽은 소환수 정리 (너무 많으면)
  if (rf.minions.filter(m => !m.alive).length > 20)
    rf.minions = rf.minions.filter(m => m.alive);

  for (const m of rf.minions) {
    m.hitAnim = Math.max(0, m.hitAnim - dt);
    if ((m.debuffTimer || 0) > 0) {
      m.debuffTimer -= dt;
      if (m.debuffTimer <= 0) { m.debuffTimer = 0; m.debuffDmgMult = 1; }
    }
    if (!m.alive) continue;

    // 빙결
    if (m.frozen && !m.exploding) {
      m.frozenTimer = (m.frozenTimer || 0) - dt;
      if (m.frozenTimer <= 0) { m.frozen = false; m.frozenTimer = 0; }
      continue;
    }

    if (m.exploding) {
      const t = m.explodeTarget;
      if (!t || t.isDead) { m.exploding = false; m.explodeTarget = null; continue; }
      const dx = t.x - m.x, dy = t.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 42) {
        // 폭발: 범위 내 캐릭터 피해
        for (const c of alive) {
          const cx = c.x - m.x, cy = c.y - m.y;
          if (cx * cx + cy * cy <= ZAKUM_EXPLODE_RANGE * ZAKUM_EXPLODE_RANGE)
            raidTakeDamage(c, ZAKUM_EXPLODE_DMG);
        }
        spawnRaidFT(m.x, m.y - 20, '폭발!', '#e67e22', 20);
        m.alive = false;
      } else {
        m.x += (dx / dist) * ZAKUM_MINION_SPEED * 2 * dt;
        m.y += (dy / dist) * ZAKUM_MINION_SPEED * 2 * dt;
      }
    } else {
      if (!alive.length) continue;
      let nearest = null, minD2 = Infinity;
      for (const c of alive) {
        const dx = c.x - m.x, dy = c.y - m.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD2) { minD2 = d2; nearest = c; }
      }
      const dist = Math.sqrt(minD2);
      if (dist > 60) {
        const dx = nearest.x - m.x, dy = nearest.y - m.y;
        m.x += (dx / dist) * ZAKUM_MINION_SPEED * dt;
        m.y += (dy / dist) * ZAKUM_MINION_SPEED * dt;
        m.x = Math.max(20, Math.min(628, m.x));
        m.y = Math.max(20, Math.min(458, m.y));
      }
      m.atkTimer -= dt;
      if (m.atkTimer <= 0 && dist <= 70) {
        m.atkTimer = ZAKUM_MINION_INTERVAL;
        raidTakeDamage(nearest, ZAKUM_MINION_ATK);
      }
    }
  }
}

// ── 캐릭터 전투 ───────────────────────────────────────────────

function findRaidTarget(char, rf) {
  // 소환수 우선, 없으면 보스
  let nearest = null, minD2 = Infinity;
  for (const m of rf.minions) {
    if (!m.alive) continue;
    const dx = m.x - char.x, dy = m.y - char.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < minD2) { minD2 = d2; nearest = m; }
  }
  if (nearest) return { target: nearest, isBoss: false };
  if (rf.boss.alive) return { target: rf.boss, isBoss: true };
  return null;
}

function updateRaidCharacter(char, dt, rf) {
  const stats = calcFinalStats(char);
  if (char.currentHp === undefined) char.currentHp = stats.maxHp;
  char.maxHpCache = stats.maxHp;

  // HP 자연 회복
  char.currentHp = Math.min(stats.maxHp, char.currentHp + stats.maxHp * 0.01 * dt);

  // 버프 타이머
  if (char.activeBuffs) {
    for (const key of Object.keys(char.activeBuffs)) {
      const b = char.activeBuffs[key];
      if (b && b.timer > 0) {
        b.timer -= dt;
        if (b.timer <= 0) {
          delete char.activeBuffs[key];
          if (key === 'hp') {
            const ns = calcFinalStats(char);
            char.maxHpCache = ns.maxHp;
            char.currentHp  = Math.min(char.currentHp || 0, ns.maxHp);
          }
        }
      }
    }
  }

  // 다중 타격 타이머
  if ((char.quickHitTimer || 0) > 0) {
    char.quickHitTimer -= dt;
    if (char.quickHitTimer <= 0) {
      char.quickHitTimer = 0;
      const t2 = findRaidTarget(char, rf);
      if (t2) dealRaidDamage(char, t2, stats, char.quickHitDmgMult ?? 0.5, rf);
      const rem = Math.max(0, (char.quickHitCount || 0) - 1);
      char.quickHitCount = rem;
      if (rem > 0) char.quickHitTimer = char.quickHitDelay || 0.065;
    }
  }

  char.skillAnim = Math.max(0, (char.skillAnim || 0) - dt);

  const t = findRaidTarget(char, rf);
  if (!t) return;

  const range = RANGE_PIXELS[CLASSES[char.classId].range];
  const dx = t.target.x - char.x, dy = t.target.y - char.y;
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
      const base      = CLASSES[char.classId]?.parent || char.classId;
      const rogueThrow = (char.classId === 'rogue' || base === 'rogue') && !!char.equipment?.throwable;
      const hasTriple  = rogueThrow && char.skills?.includes('triple_throw');
      if (hasTriple) {
        const tMult = (1/3) * (SKILL_LEVEL_MULTS[char.skillLevels?.['triple_throw'] || 1] ?? 1);
        dealRaidDamage(char, t, stats, tMult, rf);
        char.quickHitDmgMult = tMult; char.quickHitDelay = 0.065;
        char.quickHitCount = 2; char.quickHitTimer = 0.065;
      } else if (rogueThrow) {
        dealRaidDamage(char, t, stats, 0.5, rf);
        char.quickHitDmgMult = 0.5; char.quickHitDelay = 0.065;
        char.quickHitCount = 1; char.quickHitTimer = 0.065;
      } else {
        dealRaidDamage(char, t, stats, 1.0, rf);
      }
    }
  }

  if ((char.raidSkillSeal || 0) <= 0) useRaidSkills(char, dt, stats, rf);
}

function dealRaidDamage(char, targetInfo, stats, dmgMult, rf) {
  if (Math.random() * 100 >= stats.accuracy) {
    spawnRaidFT(targetInfo.target.x, targetInfo.target.y - 24, 'MISS', '#7f8c8d', 12);
    return;
  }
  const { target, isBoss } = targetInfo;
  const hasOrb     = char.skills?.includes('orb_strike');
  const dmgType    = CLASSES[char.classId]?.damageType || 'physical';
  const mDef       = isBoss ? (dmgType === 'magical' ? ZAKUM.magicDef : ZAKUM.physDef) : 0;
  const atkBufMult = (char.activeBuffs?.atk?.timer > 0) ? (char.activeBuffs.atk.mult || 1) : 1;

  let baseDmg, isCrit = false, orbExplosion = false;

  if (hasOrb && char.orbReady && dmgMult >= 1.0) {
    const sk     = SKILLS['orb_strike'];
    const orbLv  = char.skillLevels?.['orb_strike'] || 1;
    const orbM   = SKILL_LEVEL_MULTS[orbLv] ?? 1.0;
    baseDmg  = Math.max(1, Math.floor(stats.atk * (sk?.dmgMultiplier ?? 20) * orbM * atkBufMult) - mDef);
    char.orbReady = false; char.orbCount = 0; char.attackAnim = 0.6;
    orbExplosion = true;
  } else {
    const atkMult = getSkillAtkMult(char);
    const rawDmg  = Math.max(1, Math.floor(stats.atk * atkMult * atkBufMult) - mDef);
    baseDmg = Math.max(1, Math.floor(rawDmg * dmgMult));
    if (hasOrb) {
      char.orbCount = (char.orbCount || 0) + 1;
      if (char.orbCount >= (SKILLS['orb_strike']?.orbsRequired ?? 5)) { char.orbReady = true; char.orbCount = 0; }
    }
    if (Math.random() * 100 < stats.critRate) { isCrit = true; baseDmg = Math.floor(baseDmg * stats.critDmg); }
    char.attackAnim = 0.2;
  }

  if (!isBoss && (target.debuffTimer || 0) > 0) baseDmg = Math.floor(baseDmg * (target.debuffDmgMult || 1));

  const col  = orbExplosion ? '#ff6622' : isCrit ? '#f1c40f' : '#e0e0e0';
  const size = orbExplosion ? 22 : isCrit ? 19 : 13;
  spawnRaidFT(target.x, target.y - 24, (orbExplosion || isCrit) ? `${baseDmg}!` : `${baseDmg}`, col, size);
  target.hp -= baseDmg;
  target.hitAnim = orbExplosion ? 0.4 : isCrit ? 0.25 : 0.15;
  logRaidDamage(rf, char.id, baseDmg);

  if (char.shadowActive) {
    const sd = Math.max(1, Math.floor(baseDmg * 0.5));
    spawnRaidFT(target.x, target.y - 24, `${sd}`, '#e0e0e0', 13);
    target.hp -= sd;
    logRaidDamage(rf, char.id, sd);
  }

  if (target.hp <= 0) {
    if (isBoss) { rf.boss.alive = false; finishRaid(rf); }
    else         target.alive = false;
  }
}

function raidTakeDamage(char, rawDmg) {
  if (char.isDead) return;
  const stats  = calcFinalStats(char);
  const minDmg = Math.max(1, Math.floor(rawDmg * 0.2));
  const actual = Math.max(minDmg, Math.floor(rawDmg - stats.physDef * 0.5));
  char.currentHp = Math.max(0, (char.currentHp || char.maxHpCache || 100) - actual);
  char.hitAnim   = 0.2;
  spawnRaidFT(char.x, char.y - 30, `-${actual}`, '#e74c3c', 13);
  if (char.currentHp <= 0) {
    char.isDead = true; char.respawnTimer = CHARACTER_RESPAWN_TIME;
    if (char.shadowActive) {
      if (!char.skillTimers) char.skillTimers = {};
      char.skillTimers['shadow_partner'] = SKILLS['shadow_partner']?.cooldown ?? 1.5;
    }
    char.shadowActive = false; char.shadowTimer = 0;
  }
}

function spawnRaidFT(x, y, text, color, size) {
  gameState.floatingTexts.push({
    stageIdx: 'raid', x, y, text, color,
    size: size || 13, timer: 0.9, vy: -55, vx: (Math.random() - 0.5) * 18,
  });
}

// ── 스킬 사용 ─────────────────────────────────────────────────

function useRaidSkills(char, dt, stats, rf) {
  if (!char.skills?.length) return;
  if ((char.raidSkillSeal || 0) > 0) return;
  if (!char.skillTimers) char.skillTimers = {};
  for (const skillId of char.skills) {
    const skill = SKILLS[skillId];
    if (!skill || skill.targeting === 'passive') continue;
    if (skill.targeting === 'shadow' && char.shadowActive) continue;
    if (char.skillTimers[skillId] === undefined) char.skillTimers[skillId] = 0;
    const cdMult = (char.activeBuffs?.cd?.timer > 0) ? (char.activeBuffs.cd.mult || 1) : 1;
    char.skillTimers[skillId] -= dt * cdMult;
    if (char.skillTimers[skillId] > 0) continue;
    if (executeRaidSkill(char, skillId, skill, stats, rf)) {
      if (skill.targeting === 'shadow') {
        char.skillTimers[skillId] = 9999;
      } else {
        const sLv   = char.skillLevels?.[skillId] || 1;
        const cdScale = 1 + (sLv - 1) * 0.06;
        char.skillTimers[skillId] = skill.cooldown / cdScale;
      }
      char.skillAnim = 0.5;
    }
  }
}

function executeRaidSkill(char, skillId, skill, stats, rf) {
  const sLv   = char.skillLevels?.[skillId] || 1;
  const sMult = SKILL_LEVEL_MULTS[sLv] ?? 1.0;

  if (skill.targeting === 'shadow') {
    char.shadowActive = true;
    char.shadowTimer  = (skill.duration || 60) * (1 + (sLv - 1) * 0.12);
    char.shadowX = char.x - char.facing * 28; char.shadowY = char.y + 4;
    return true;
  }

  const atkBuf = (char.activeBuffs?.atk?.timer > 0) ? (char.activeBuffs.atk.mult || 1) : 1;
  const dmgType = CLASSES[char.classId]?.damageType || 'physical';

  // 힐
  if (skill.targeting === 'heal') {
    const healAmt = Math.floor(stats.atk * (skill.healMult || 2) * sMult);
    const targets = gameState.characters.filter(c => c.inRaid && !c.isDead);
    if (!targets.some(c => (c.currentHp || 0) < (c.maxHpCache || 100))) return false;
    let totalHealed = 0;
    for (const c of targets) {
      if ((c.currentHp || 0) < (c.maxHpCache || 100)) {
        const missing = (c.maxHpCache || 100) - (c.currentHp || 0);
        totalHealed += Math.min(healAmt, missing);
        c.currentHp = Math.min(c.maxHpCache || 100, (c.currentHp || 0) + healAmt);
        spawnRaidFT(c.x, c.y - 24, `+${healAmt}`, '#2ecc71', 14);
      }
    }
    logRaidHeal(rf, char.id, totalHealed);
    return true;
  }

  // 파티 버프
  if (skill.targeting === 'party_buff') {
    const buffDur = (skill.buffDuration || 30) * (1 + (sLv - 1) * 0.12);
    const targets = gameState.characters.filter(c => c.inRaid && !c.isDead);
    if (!targets.length) return false;
    for (const c of targets) {
      if (!c.activeBuffs) c.activeBuffs = {};
      if (skill.buffHp) {
        const was = c.activeBuffs.hp?.timer > 0;
        c.activeBuffs.hp = { mult: skill.buffHp, timer: buffDur };
        if (!was) { const nm = calcFinalStats(c).maxHp; c.currentHp = Math.min(nm, (c.currentHp || c.maxHpCache || 100) * skill.buffHp); c.maxHpCache = nm; }
        spawnRaidFT(c.x, c.y - 30, '체력 ×2!', '#2ecc71', 13);
      }
      if (skill.buffCdMult) { c.activeBuffs.cd = { mult: skill.buffCdMult, timer: buffDur }; spawnRaidFT(c.x, c.y - 44, '스킬 가속!', '#3498db', 13); }
      if (skill.buffAtk)   { c.activeBuffs.atk = { mult: skill.buffAtk,   timer: buffDur }; spawnRaidFT(c.x, c.y - 30, '공격 ×2!',  '#e74c3c', 13); }
    }
    return true;
  }

  // 광역 빙결 → 소환수
  if (skill.targeting === 'aoe_freeze') {
    const maxR2 = (skill.freezeRange || 270) ** 2;
    const targets = rf.minions.filter(m => { if (!m.alive) return false; const dx = m.x - char.x, dy = m.y - char.y; return dx*dx+dy*dy <= maxR2; }).slice(0, skill.maxTargets || 8);
    if (!targets.length) return false;
    const rawDmg    = Math.floor(stats.atk * (skill.dmgMultiplier || 1) * sMult * atkBuf);
    const freezeDur = (skill.freezeDuration || 5.0) + (sLv - 1) * 0.4;
    for (const m of targets) {
      const d = Math.max(1, rawDmg); m.hp -= d; m.hitAnim = 0.2; m.frozen = true; m.frozenTimer = freezeDur;
      logRaidDamage(rf, char.id, d);
      if (m.hp <= 0) m.alive = false;
      spawnRaidFT(m.x, m.y - 24, `${d}`, '#1abc9c', 13);
    }
    return true;
  }

  // 범위 디버프 (위협) → 소환수
  if (skill.targeting === 'debuff_area') {
    const maxR2     = (skill.debuffRange || 250) ** 2;
    const targets   = rf.minions.filter(m => { if (!m.alive) return false; const dx = m.x - char.x, dy = m.y - char.y; return dx*dx+dy*dy <= maxR2; });
    if (!targets.length) return false;
    const debuffM   = 1 + (skill.debuffDmgMult - 1) * sMult;
    const debuffDur = (skill.debuffDuration || 8.0) * (1 + (sLv - 1) * 0.1);
    for (const m of targets) { m.debuffDmgMult = debuffM; m.debuffTimer = debuffDur; spawnRaidFT(m.x, m.y - 28, `피해 +${Math.round((debuffM-1)*100)}%`, '#e67e22', 12); }
    return true;
  }

  // AOE → 소환수 우선, 없으면 보스
  if (skill.targeting === 'aoe') {
    const rawDmg = Math.floor(stats.atk * (skill.dmgMultiplier || 1) * sMult * atkBuf);
    const minions = rf.minions.filter(m => m.alive);
    if (minions.length) {
      for (const m of minions.slice(0, skill.maxTargets || 5)) {
        const d = Math.max(1, rawDmg); m.hp -= d; m.hitAnim = 0.2;
        logRaidDamage(rf, char.id, d);
        if (m.hp <= 0) m.alive = false;
        spawnRaidFT(m.x, m.y - 24, `${d}`, '#5b9bd5', 13);
      }
    } else if (rf.boss.alive) {
      const bossDef = dmgType === 'magical' ? ZAKUM.magicDef : ZAKUM.physDef;
      const d = Math.max(1, rawDmg - bossDef); rf.boss.hp -= d; rf.boss.hitAnim = 0.2;
      logRaidDamage(rf, char.id, d);
      spawnRaidFT(rf.boss.x, rf.boss.y - 24, `${d}`, '#5b9bd5', 13);
      if (rf.boss.hp <= 0) { rf.boss.alive = false; finishRaid(rf); }
    } else return false;
    return true;
  }

  // 더블 히트
  if (skill.targeting === 'double_hit') {
    const t = findRaidTarget(char, rf);
    if (!t) return false;
    const rawDmg = Math.floor(stats.atk * (skill.dmgMultiplier || 1) * sMult * atkBuf);
    const mDef   = t.isBoss ? (dmgType === 'magical' ? ZAKUM.magicDef : ZAKUM.physDef) : 0;
    for (let h = 0; h < (skill.hits || 2); h++) {
      const d = Math.max(1, rawDmg - mDef); t.target.hp -= d; t.target.hitAnim = 0.2;
      logRaidDamage(rf, char.id, d);
      spawnRaidFT(t.target.x, t.target.y - 24, `${d}`, '#5b9bd5', 13);
      if (t.target.hp <= 0) { if (t.isBoss) { rf.boss.alive = false; finishRaid(rf); } else t.target.alive = false; }
    }
    return true;
  }

  // 단일 대상
  const t = findRaidTarget(char, rf);
  if (!t) return false;
  const rawDmg = Math.floor(stats.atk * (skill.dmgMultiplier || 1) * sMult * atkBuf);
  const mDef   = t.isBoss ? (dmgType === 'magical' ? ZAKUM.magicDef : ZAKUM.physDef) : 0;
  const d = Math.max(1, rawDmg - mDef); t.target.hp -= d; t.target.hitAnim = 0.2;
  logRaidDamage(rf, char.id, d);
  spawnRaidFT(t.target.x, t.target.y - 24, `${d}`, '#5b9bd5', 13);
  if (t.target.hp <= 0) { if (t.isBoss) { rf.boss.alive = false; finishRaid(rf); } else t.target.alive = false; }
  return true;
}

// ── 렌더링 ────────────────────────────────────────────────────

function drawRaid(W, H) {
  // 던전 배경
  ctx.fillStyle = '#06030e';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#100820';
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
  ctx.strokeStyle = '#2a0020';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, H * 0.72); ctx.lineTo(W, H * 0.72); ctx.stroke();

  // 바닥 용암 글로우
  const glow = 0.10 + Math.sin(Date.now() / 700) * 0.04;
  ctx.globalAlpha = glow;
  ctx.fillStyle   = '#c0392b';
  ctx.fillRect(0, H * 0.80, W, H * 0.20);
  ctx.globalAlpha = 1;

  const rf = gameState.raidField;
  if (!rf) return;

  const raidChars = gameState.characters.filter(c => c.inRaid);

  drawBossHPBar(rf.boss, W);

  for (const m of rf.minions) drawRaidMinion(m);
  for (const c of raidChars)  drawShadow(c);
  for (const c of raidChars)  { drawCharacter(c); drawRaidCharStatus(c); }
  for (const c of raidChars)  drawCharacterOrbs(c);
  drawZakumBoss(rf.boss);

  // 레이드 플로팅 텍스트
  ctx.textAlign = 'center';
  for (const f of gameState.floatingTexts) {
    if (f.stageIdx !== 'raid') continue;
    ctx.globalAlpha = Math.min(f.timer * 2, 1);
    ctx.font        = `bold ${f.size}px sans-serif`;
    ctx.fillStyle   = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur  = 10;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left';

  // 격파 오버레이
  if (rf.cleared) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center'; ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 24;
    ctx.fillText('자쿰 격파!', W/2, H/2 - 10);
    ctx.shadowBlur = 0; ctx.fillStyle = '#999'; ctx.font = '15px sans-serif';
    ctx.fillText('레이드 탭에서 리셋할 수 있습니다', W/2, H/2 + 28);
    ctx.textAlign = 'left';
  }

  // 우하단 정보
  const aliveMinions = rf.minions.filter(m => m.alive).length;
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(`[ 자쿰 레이드 ]  소환수 ${aliveMinions}마리  파티 ${raidChars.length}명`, W - 10, H - 10);
  ctx.textAlign = 'left';
}

function drawBossHPBar(boss, W) {
  const barW = W - 40, barH = 16, barX = 20, barY = 10;
  const ratio = Math.max(0, boss.hp / boss.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
  ctx.fillStyle = '#120008'; ctx.fillRect(barX, barY, barW, barH);
  const hpCol = ratio > 0.6 ? '#c0392b' : ratio > 0.3 ? '#7b241c' : '#4a0010';
  ctx.fillStyle = hpCol; ctx.fillRect(barX, barY, barW * ratio, barH);
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff'; ctx.fillRect(barX, barY, barW * ratio, barH / 2); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#8b0000'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(boss.alive ? `자쿰  ${boss.hp.toLocaleString()} / ${boss.maxHp.toLocaleString()}` : '자쿰 — 격파됨', W/2, barY + barH - 3);
  ctx.textAlign = 'left';
}

function drawZakumBoss(boss) {
  const R = 42;
  if (boss.hitAnim > 0) {
    ctx.globalAlpha = (boss.hitAnim / 0.15) * 0.5; ctx.fillStyle = '#ffe000';
    ctx.beginPath(); ctx.arc(boss.x, boss.y, R + 12, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (!boss.alive) {
    ctx.globalAlpha = 0.15; ctx.fillStyle = '#300';
    ctx.beginPath(); ctx.arc(boss.x, boss.y, R, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; return;
  }
  const now = Date.now();
  // 회전하는 팔 그루터기
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + now / 4000;
    const ax = boss.x + Math.cos(angle) * (R + 20), ay = boss.y + Math.sin(angle) * (R + 20);
    ctx.fillStyle = '#1a0820'; ctx.strokeStyle = '#7b241c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ax, ay, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // 몸체
  ctx.fillStyle = '#08000e'; ctx.strokeStyle = '#7b241c'; ctx.lineWidth = 3;
  ctx.shadowColor = '#7b241c'; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(boss.x, boss.y, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  // 눈
  const pulse = 0.65 + Math.sin(now / 300) * 0.35;
  ctx.fillStyle = `rgba(231,76,60,${pulse})`; ctx.shadowColor = '#e74c3c'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.arc(boss.x - 14, boss.y - 10, 8, 0, Math.PI * 2); ctx.arc(boss.x + 14, boss.y - 10, 8, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(boss.x - 14, boss.y - 10, 4, 0, Math.PI * 2); ctx.arc(boss.x + 14, boss.y - 10, 4, 0, Math.PI * 2); ctx.fill();
  // 입
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(boss.x, boss.y + 8, 14, 0.2, Math.PI - 0.2); ctx.stroke();
  // 이름
  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('자쿰', boss.x, boss.y + R + 18); ctx.textAlign = 'left';
}

function drawRaidMinion(m) {
  if (!m.alive) return;
  const R = 14;
  if (m.hitAnim > 0) {
    ctx.globalAlpha = (m.hitAnim / 0.15) * 0.5; ctx.fillStyle = '#ffe000';
    ctx.beginPath(); ctx.arc(m.x, m.y, R + 5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (m.exploding) {
    ctx.globalAlpha = 0.45 + Math.sin(Date.now() / 75) * 0.35; ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(m.x, m.y, R + 9, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (m.frozen) {
    ctx.globalAlpha = 0.4; ctx.fillStyle = '#7ecff5';
    ctx.beginPath(); ctx.arc(m.x, m.y, R + 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#a8e6ff'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.arc(m.x, m.y, R + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.fillStyle   = m.exploding ? '#8b0000' : '#4a0808';
  ctx.strokeStyle = m.exploding ? '#e74c3c' : '#7b241c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff4444';
  ctx.beginPath(); ctx.arc(m.x - 4, m.y - 3, 3, 0, Math.PI * 2); ctx.arc(m.x + 4, m.y - 3, 3, 0, Math.PI * 2); ctx.fill();
  if ((m.debuffTimer || 0) > 0) {
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#e67e22';
    ctx.beginPath(); ctx.arc(m.x, m.y, R + 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.arc(m.x, m.y, R + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  const bW = 28, bH = 3, ratio = Math.max(0, m.hp / m.maxHp);
  ctx.fillStyle = '#200'; ctx.fillRect(m.x - bW/2, m.y - R - 8, bW, bH);
  ctx.fillStyle = '#c0392b'; ctx.fillRect(m.x - bW/2, m.y - R - 8, bW * ratio, bH);
}

function drawRaidCharStatus(char) {
  if (char.isDead) return;
  let y = char.y - 46;
  if ((char.raidSkillSeal || 0) > 0) {
    ctx.fillStyle = '#8e44ad'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`🔒${char.raidSkillSeal.toFixed(0)}s`, char.x, y); y -= 12; ctx.textAlign = 'left';
  }
  if ((char.raidAccDown || 0) > 0) {
    ctx.fillStyle = '#7f8c8d'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`👁${char.raidAccDown.toFixed(0)}s`, char.x, y); ctx.textAlign = 'left';
  }
}
