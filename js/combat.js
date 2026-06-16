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
    if (char.inRaid) continue;
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
    const aliveChars = gameState.characters.filter(c => !c.inRaid && c.assignedStage === i && !c.isDead);

    for (const m of field.monsters) {
      m.hitAnim = Math.max(0, m.hitAnim - dt);
      if ((m.debuffTimer || 0) > 0) {
        m.debuffTimer -= dt;
        if (m.debuffTimer <= 0) { m.debuffTimer = 0; m.debuffDmgMult = 1; }
      }

      if (!m.alive) {
        if (!m.noRespawn && m.respawnTimer > 0) {
          m.respawnTimer -= dt;
          if (m.respawnTimer <= 0) {
            m.alive        = true;
            m.currentHp    = m.maxHp;
            m.respawnTimer = 0;
            m.attackTimer  = MONSTER_ATTACK_INTERVAL;
            m.aoeTimer     = undefined;
            m.poisoned     = false;
            m.x = m.spawnX;
            m.y = m.spawnY;
          }
        }
        continue;
      }

      // 독 틱 처리
      if (m.poisoned) {
        m.poisonTimer -= dt;
        m.poisonTickTimer = (m.poisonTickTimer ?? 1.0) - dt;
        if (m.poisonTickTimer <= 0) {
          m.poisonTickTimer = 1.0;
          const pd = m.poisonDmg || 0;
          m.currentHp -= pd;
          spawnFloatingText(i, m.x, m.y - 32, `${pd}`, '#9b59b6', 12);
          if (m.currentHp <= 0) {
            const killer = m.poisonChar || aliveChars[0];
            if (killer) killMonster(killer, m, stageData, field);
          }
        }
        if (m.poisonTimer <= 0) { m.poisoned = false; m.poisonDmg = 0; m.poisonChar = null; }
      }

      if (!m.alive) continue;

      updateMonsterMovement(m, dt, stageData, aliveChars);

      const md = m.def || stageData.monster;

      // 자폭 몬스터: 범위 내 진입 즉시 폭발 (attackTimer 무시)
      if (md.attackType === 'suicide' && aliveChars.length > 0) {
        let nearestChar = null, nearD2 = Infinity;
        for (const c of aliveChars) {
          const dx = c.x - m.x, dy = c.y - m.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < nearD2) { nearD2 = d2; nearestChar = c; }
        }
        if (nearestChar && nearD2 <= (md.attackRange || 55) ** 2) {
          executeMonsterAttack(m, nearestChar, stageData, i);
        }
        continue;
      }

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
        if (target && minD2 <= ((m.def || stageData.monster).aggroRange || 400) ** 2 && !m.frozen) {
          m.attackTimer = MONSTER_ATTACK_INTERVAL;
          executeMonsterAttack(m, target, stageData, i);
        }
      }

      // 범위 공격 (aoeAtk 있는 몬스터만)
      if (md.aoeAtk && !m.frozen && aliveChars.length > 0) {
        if (m.aoeTimer === undefined) m.aoeTimer = md.aoeInterval * (0.3 + Math.random() * 0.7);
        m.aoeTimer -= dt;
        if (m.aoeTimer <= 0) {
          m.aoeTimer = md.aoeInterval;
          const aoeR2  = (md.aoeRange || 120) ** 2;
          let hit = false;
          for (const c of aliveChars) {
            const dx = c.x - m.x, dy = c.y - m.y;
            if (dx * dx + dy * dy <= aoeR2) {
              const cStats  = calcFinalStats(c);
              const cDef    = (md.aoeDamageType || md.atkDamageType) === 'magical' ? cStats.magicDef : cStats.physDef;
              const minDmg  = Math.max(1, Math.floor(md.aoeAtk * 0.2));
              const aoeDmg  = Math.max(minDmg, md.aoeAtk - cDef);
              takeDamage(c, aoeDmg, i);
              hit = true;
            }
          }
          if (hit) {
            spawnFloatingText(i, m.x, m.y - 44, '★ 범위 공격!', '#e67e22', 13);
            m.hitAnim = 0.3;
          }
        }
      }

      // 끌어당기기 — 매 프레임 연속 인력 (pullForce px/s)
      if (md.pullForce && m.alive && aliveChars.length > 0) {
        const pullR2  = (md.pullRange || 400) ** 2;
        const pullSpd = md.pullForce * dt;
        for (const c of aliveChars) {
          const dx = m.x - c.x, dy = m.y - c.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 <= pullR2) {
            const dist = Math.sqrt(d2);
            const move = Math.min(pullSpd, dist);
            c.x += (dx / dist) * move;
            c.y += (dy / dist) * move;
            c.x  = Math.max(24, Math.min(656, c.x));
            c.y  = Math.max(24, Math.min(456, c.y));
          }
        }
      }

      // 소환 타이머 (네크로맨서 등)
      if (md.summonInterval && stageData.zombieDef && aliveChars.length > 0) {
        if (m.summonTimer === undefined) m.summonTimer = md.summonInterval;
        m.summonTimer -= dt;
        if (m.summonTimer <= 0) {
          m.summonTimer = md.summonInterval;
          const count = md.summonCount || 3;
          for (let si = 0; si < count; si++) {
            const angle = (si / count) * Math.PI * 2;
            const sx = Math.max(60, Math.min(620, m.x + Math.cos(angle) * 55));
            const sy = Math.max(60, Math.min(440, m.y + Math.sin(angle) * 55));
            field.monsters.push({
              id: field.monsters.length,
              spawnX: sx, spawnY: sy, x: sx, y: sy,
              currentHp: stageData.zombieDef.hp, maxHp: stageData.zombieDef.hp,
              alive: true, respawnTimer: 0, hitAnim: 0,
              attackTimer: 0,
              def: stageData.zombieDef,
              noRespawn: true,
            });
          }
          spawnFloatingText(i, m.x, m.y - 54, '좀비 소환!', '#8e44ad', 13);
        }
      }
    }
  }

  // 포이즌 장판 업데이트
  for (let pi = gameState.poisonFields.length - 1; pi >= 0; pi--) {
    const pf = gameState.poisonFields[pi];
    pf.duration -= dt;
    if (pf.duration <= 0) { gameState.poisonFields.splice(pi, 1); continue; }
    pf.tickTimer = (pf.tickTimer || 0) - dt;
    if (pf.tickTimer <= 0) {
      pf.tickTimer += pf.tickInterval;
      const pField = gameState.stageFields[pf.stageIdx];
      if (!pField) continue;
      const r2 = pf.radius * pf.radius;
      for (const m of pField.monsters) {
        if (!m.alive) continue;
        const dx = m.x - pf.x, dy = m.y - pf.y;
        if (dx * dx + dy * dy > r2) continue;
        m.currentHp -= pf.dmgPerTick;
        m.hitAnim    = 0.1;
        spawnFloatingText(pf.stageIdx, m.x + (Math.random() - 0.5) * 30, m.y - 20, `${pf.dmgPerTick}`, '#9b59b6', 10);
        if (m.currentHp <= 0 && m.alive) {
          const pStageData   = STAGES[pf.stageIdx];
          const pfAliveChars = gameState.characters.filter(c => !c.inRaid && c.assignedStage === pf.stageIdx && !c.isDead);
          const killer = gameState.characters.find(c => c.id === pf.charId) || pfAliveChars[0];
          if (killer) killMonster(killer, m, pStageData, pField);
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

// 패시브 스킬 중 공격 배율 반환 (없으면 1) — 스킬 레벨 배율 적용
function getSkillAtkMult(char) {
  if (char.skills) {
    for (const id of char.skills) {
      const s = SKILLS[id];
      if (s && s.attackInterval) {
        const sLv  = char.skillLevels?.[id] || 1;
        const sMult = SKILL_LEVEL_MULTS[sLv] ?? 1.0;
        return (s.dmgMultiplier ?? 1) * sMult;
      }
    }
  }
  return 1;
}

function takeDamage(char, dmg, stageIdx) {
  if (char.isDead) return;
  // 매직가드: 피해의 80%를 HP 대신 MP로 흡수
  if (char.skills?.includes('magic_guard') && (char.skillLevels?.magic_guard || 0) > 0) {
    const absorb  = Math.floor(dmg * (SKILLS['magic_guard']?.mgAbsorb || 0.8));
    const mpUsed  = Math.min(absorb, char.currentMp || 0);
    char.currentMp = (char.currentMp || 0) - mpUsed;
    dmg -= mpUsed;
  }
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
    // 사망 경험치 패널티 (-5%, 현재 레벨 0% 미만 불가)
    const expLoss = Math.floor(expRequired(char.level) * 0.05);
    if (expLoss > 0) {
      char.exp = Math.max(0, char.exp - expLoss);
      spawnFloatingText(stageIdx, char.x, char.y - 46, `EXP -${expLoss}`, '#f39c12', 12);
    }
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

  const md  = m.def || stageData.monster;
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
  const md = m.def || stageData.monster;

  // 자폭 (좀비): 범위 내 모든 캐릭터에게 폭발 데미지 후 즉사
  if (md.attackType === 'suicide') {
    const blastR2 = (md.attackRange || 55) ** 2;
    const stageChars = gameState.characters.filter(c =>
      c.assignedStage === stageIdx && !c.isDead && !c.inRaid
    );
    for (const c of stageChars) {
      const dx = c.x - m.x, dy = c.y - m.y;
      if (dx * dx + dy * dy <= blastR2) takeDamage(c, md.suicideDmg || md.atk, stageIdx);
    }
    spawnFloatingText(stageIdx, m.x, m.y - 20, '자폭!', '#e74c3c', 18);
    m.alive     = false;
    m.noRespawn = true;
    return;
  }

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

  // 화상 적용 (중첩: 피격마다 burnDmg 누적)
  if (md.burnDmg) {
    target.burnDmg          = (target.burnDmg || 0) + md.burnDmg;
    target.burned           = true;
    target.burnTimer        = md.burnDuration || 5.0;
    target.burnTickInterval = md.burnTickInterval || 0.2;
    if (!target.burnTickTimer || target.burnTickTimer <= 0) target.burnTickTimer = target.burnTickInterval;
    spawnFloatingText(stageIdx, target.x, target.y - 46, '화상!', '#e67e22', 12);
  }
}

function updateCharacter(char, dt, stage, field) {
  const stats = calcFinalStats(char);

  // HP 초기화 (첫 틱 또는 undefined)
  if (char.currentHp === undefined) char.currentHp = stats.maxHp;
  char.maxHpCache = stats.maxHp;

  // MP 초기화 및 자연 회복 (초당 0.5%)
  const maxMp = stats.maxMp ?? 200;
  char.maxMpCache = maxMp;
  if (char.currentMp === undefined) char.currentMp = maxMp;
  char.currentMp = Math.min(maxMp, (char.currentMp || 0) + maxMp * 0.005 * dt);

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

  // 화상 틱 데미지
  if (char.burned) {
    char.burnTimer = (char.burnTimer || 0) - dt;
    if (char.burnTimer <= 0) {
      char.burned    = false;
      char.burnDmg   = 0;
    } else {
      char.burnTickTimer = (char.burnTickTimer ?? char.burnTickInterval ?? 0.2) - dt;
      if (char.burnTickTimer <= 0) {
        char.burnTickTimer = char.burnTickInterval || 0.2;
        takeDamage(char, char.burnDmg || 0, char.assignedStage);
      }
    }
  }

  // 포션 쿨타임 감소
  if ((char.potionHpCd || 0) > 0) char.potionHpCd = Math.max(0, char.potionHpCd - dt);
  if ((char.potionMpCd || 0) > 0) char.potionMpCd = Math.max(0, char.potionMpCd - dt);

  // 장착 물약 초기화 (undefined 방어)
  if (!char.equippedHpPotion) char.equippedHpPotion = { id: char.selectedHpPotion || 'hp_s', count: 0 };
  if (!char.equippedMpPotion) char.equippedMpPotion = { id: char.selectedMpPotion || 'mp_s', count: 0 };

  // HP 물약 재충전 타이머 (소진 시 스톡에서 100개 자동 충전, 5초 소요)
  if ((char.hpRefillTimer || 0) > 0) {
    char.hpRefillTimer = Math.max(0, char.hpRefillTimer - dt);
    if (char.hpRefillTimer <= 0) {
      const selId = char.selectedHpPotion;
      const avail = selId ? (gameState.potionStock[selId] || 0) : 0;
      const take  = Math.min(100, avail);
      if (take > 0) {
        gameState.potionStock[selId] -= take;
        char.equippedHpPotion = { id: selId, count: take };
        spawnFloatingText(char.assignedStage, char.x, char.y - 50, `HP 물약 ${take}개 충전`, '#2ecc71', 11);
      } else {
        spawnFloatingText(char.assignedStage, char.x, char.y - 50, 'HP 물약 부족!', '#e74c3c', 11);
      }
    }
  } else if ((char.equippedHpPotion.count || 0) === 0 && char.selectedHpPotion) {
    const selId = char.selectedHpPotion;
    if ((gameState.potionStock[selId] || 0) > 0) {
      char.hpRefillTimer = 5.0;
      spawnFloatingText(char.assignedStage, char.x, char.y - 50, 'HP 물약 충전 중...', '#95a5a6', 10);
    }
  }

  // MP 물약 재충전 타이머
  if ((char.mpRefillTimer || 0) > 0) {
    char.mpRefillTimer = Math.max(0, char.mpRefillTimer - dt);
    if (char.mpRefillTimer <= 0) {
      const selId = char.selectedMpPotion;
      const avail = selId ? (gameState.potionStock[selId] || 0) : 0;
      const take  = Math.min(100, avail);
      if (take > 0) {
        gameState.potionStock[selId] -= take;
        char.equippedMpPotion = { id: selId, count: take };
        spawnFloatingText(char.assignedStage, char.x, char.y - 62, `MP 물약 ${take}개 충전`, '#3498db', 11);
      } else {
        spawnFloatingText(char.assignedStage, char.x, char.y - 62, 'MP 물약 부족!', '#e74c3c', 11);
      }
    }
  } else if ((char.equippedMpPotion.count || 0) === 0 && char.selectedMpPotion) {
    const selId = char.selectedMpPotion;
    if ((gameState.potionStock[selId] || 0) > 0) {
      char.mpRefillTimer = 5.0;
      spawnFloatingText(char.assignedStage, char.x, char.y - 62, 'MP 물약 충전 중...', '#95a5a6', 10);
    }
  }

  // 충전 중에는 행동 불가
  if ((char.hpRefillTimer || 0) > 0 || (char.mpRefillTimer || 0) > 0) return;

  // HP 포션 자동 사용 (HP 50% 이하)
  if ((char.potionHpCd || 0) <= 0 && char.currentHp < stats.maxHp * 0.5) {
    const pot = char.equippedHpPotion;
    if (pot && pot.id && (pot.count || 0) > 0) {
      const p = POTIONS[pot.id];
      if (p) {
        char.currentHp = Math.min(stats.maxHp, char.currentHp + p.restoreAmt);
        pot.count--;
        char.potionHpCd = 0.5;
        spawnFloatingText(char.assignedStage, char.x, char.y - 50, `HP +${p.restoreAmt}`, '#2ecc71', 12);
      }
    }
  }

  // MP 포션 자동 사용 (MP 30% 이하)
  if ((char.potionMpCd || 0) <= 0 && (char.currentMp || 0) < maxMp * 0.3) {
    const pot = char.equippedMpPotion;
    if (pot && pot.id && (pot.count || 0) > 0) {
      const p = POTIONS[pot.id];
      if (p) {
        char.currentMp = Math.min(maxMp, (char.currentMp || 0) + p.restoreAmt);
        pot.count--;
        char.potionMpCd = 0.5;
        spawnFloatingText(char.assignedStage, char.x, char.y - 62, `MP +${p.restoreAmt}`, '#3498db', 12);
      }
    }
  }

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

  // 세비지 블로우 연속 타격
  if ((char.savageHitsLeft || 0) > 0) {
    char.savageHitTimer = (char.savageHitTimer || 0) - dt;
    if (char.savageHitTimer <= 0) {
      char.savageHitTimer = char.savageHitDelay || 0.2;
      const sv = findNearestMonster(char, field);
      if (sv) dealSkillDamage(char, sv, char.savageHitDmg || 0, stage, field, stats);
      char.savageHitsLeft = Math.max(0, (char.savageHitsLeft || 1) - 1);
    }
  }

  // 피어싱 충전 중: 충전 완료 후 몬스터 등장 시 발사, 그 사이 행동 금지
  if (char.charging) {
    char.chargeTimer = Math.max(0, (char.chargeTimer || 0) - dt);
    if (char.chargeTimer <= 0) {
      const pt = findNearestMonster(char, field);
      if (pt) {
        const cDmg = Math.floor(stats.atk * (char.chargeDmgMult || 15));
        dealSkillDamage(char, pt, cDmg, stage, field, stats);
        spawnFloatingText(char.assignedStage, pt.x, pt.y - 40, '피어싱!', '#e2b96f', 20);
        char.charging = false;
      }
      // 몬스터 없으면 충전 상태 유지 (chargeTimer = 0 고정, 몬스터 등장 대기)
    }
    return;
  }

  // 스킬 쿨타임은 항상 감소, 공격 스킬은 쿨 차는 즉시 발동
  char.skillAnim = Math.max(0, (char.skillAnim || 0) - dt);
  useSkills(char, dt, stats, stage, field);

  // 포이즌 장판 최적 위치 이동 (일반 이동/공격 억제)
  if (char.poisonMoveTarget) {
    const pmDx = char.poisonMoveTarget.x - char.x;
    const pmDy = char.poisonMoveTarget.y - char.y;
    const pmDist = Math.sqrt(pmDx * pmDx + pmDy * pmDy);
    if (pmDist > 28) {
      char.x += (pmDx / pmDist) * CHAR_SPEED * dt;
      char.y += (pmDy / pmDist) * CHAR_SPEED * dt;
      char.facing = pmDx >= 0 ? 1 : -1;
      return;
    }
    char.poisonMoveTarget = null;
  }

  const range  = RANGE_PIXELS[CLASSES[char.classId].range];
  const target = findNearestMonster(char, field);
  if (!target) {
    // 펫 없으면 몬스터가 없을 때 드랍 아이템을 주우러 이동
    if (!char.pet) moveCharTowardDrop(char, dt);
    return;
  }

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
      const rogueThrow    = (char.classId === 'rogue' || (baseClass === 'rogue' && char.classId !== 'thief')) && !!char.equipment?.throwable;
      const hasTriple     = rogueThrow && char.skills?.includes('triple_throw');
      if (hasTriple) {
        // 트리플 스로우: 1/3 × 레벨배율 × 3타
        const tMult = (1 / 3) * (SKILL_LEVEL_MULTS[char.skillLevels?.['triple_throw'] || 1] ?? 1);
        dealDamage(char, target, stats, stage, field, tMult);
        char.quickHitDmgMult = tMult;
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
}

// 독 장판을 놓기 가장 좋은 위치 계산 (살아있는 몬스터 커버 최대화)
function findBestPoisonPosition(field, radius) {
  const alive = field.monsters.filter(m => m.alive);
  if (!alive.length) return null;
  const r2 = radius * radius;
  let bestPos = null, bestCount = 0;
  for (const pivot of alive) {
    let cnt = 0, sx = 0, sy = 0;
    for (const m of alive) {
      const dx = m.x - pivot.x, dy = m.y - pivot.y;
      if (dx * dx + dy * dy <= r2) { cnt++; sx += m.x; sy += m.y; }
    }
    if (cnt > bestCount) {
      bestCount = cnt;
      bestPos = { x: sx / cnt, y: sy / cnt };
    }
  }
  return bestPos;
}

function useSkills(char, dt, stats, stage, field) {
  if (!char.skills || !char.skills.length) return;
  if (char.charging) return;
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

    // MP 부족 시 스킬 사용 불가 (쿨타임은 계속 감소)
    const mpCost = skill.mpCost || 0;
    if (mpCost > 0 && (char.currentMp || 0) < mpCost) continue;

    // 포이즌 장판: 최대 커버 위치로 먼저 이동 후 시전
    if (skill.targeting === 'poison_area') {
      const bestPos = findBestPoisonPosition(field, skill.poisonFieldRadius || 200);
      if (!bestPos) continue;
      const pdx = bestPos.x - char.x, pdy = bestPos.y - char.y;
      if (pdx * pdx + pdy * pdy > 28 * 28) {
        char.poisonMoveTarget = bestPos;
        continue;
      }
      char.poisonMoveTarget = null;
    }

    if (executeSkill(char, skillId, skill, stats, stage, field)) {
      if (mpCost > 0) char.currentMp = Math.max(0, (char.currentMp || 0) - mpCost);
      // shadow_partner는 소멸 시 쿨다운을 설정하므로 여기선 0으로만
      if (skill.targeting !== 'shadow') {
        const sLv     = char.skillLevels?.[skillId] || 1;
        const baseCd  = skill.cooldownDecay
          ? Math.max(0.1, skill.cooldown * Math.pow(skill.cooldownDecay, sLv - 1))
          : skill.cooldownPerLv
            ? Math.max(1, skill.cooldown + skill.cooldownPerLv * (sLv - 1))
            : skill.cooldown / (1 + (sLv - 1) * 0.06);
        const overshoot = Math.max(char.skillTimers[skillId], -dt);
        char.skillTimers[skillId] = baseCd + overshoot;
      } else {
        char.skillTimers[skillId] = 9999;
      }
      char.skillAnim = 0.5;
    }
  }
}

function executeSkill(char, skillId, skill, stats, stage, field) {
  const sLv   = char.skillLevels?.[skillId] || 1;
  const sMult = SKILL_LEVEL_MULTS[sLv] ?? 1.0;

  // ── 몬스터 디버프 — 받는 피해 증가 (페이지 위협) ───────────
  if (skill.targeting === 'debuff_area') {
    const maxR2   = (skill.debuffRange || 250) ** 2;
    const targets = field.monsters.filter(m => {
      if (!m.alive) return false;
      const dx = m.x - char.x, dy = m.y - char.y;
      return dx * dx + dy * dy <= maxR2;
    });
    if (!targets.length) return false;
    const debuffMult = 1 + (skill.debuffDmgMult - 1) * sMult;   // 레벨업 → 피해 증가폭 상승
    const debuffDur  = (skill.debuffDuration || 8.0) * (1 + (sLv - 1) * 0.1);
    for (const t of targets) {
      t.debuffDmgMult = debuffMult;
      t.debuffTimer   = debuffDur;
      spawnFloatingText(char.assignedStage, t.x, t.y - 28, `피해 +${Math.round((debuffMult - 1) * 100)}%`, '#e67e22', 12);
    }
    return true;
  }

  // ── 파티 버프 (스피어맨 오라, 나이트 분노) ─────────────────
  if (skill.targeting === 'party_buff') {
    const stageIdx  = char.assignedStage;
    const buffDur   = (skill.buffDuration || 30) * (1 + (sLv - 1) * 0.12);
    const allies    = gameState.characters.filter(c => c.assignedStage === stageIdx && !c.isDead);
    if (!allies.length) return false;
    for (const c of allies) {
      if (!c.activeBuffs) c.activeBuffs = {};
      if (skill.buffHp) {
        const wasBuffed = c.activeBuffs.hp && c.activeBuffs.hp.timer > 0;
        const hpMult = skill.buffHp + (sLv - 1) * (skill.buffHpPerLv || 0);
        c.activeBuffs.hp = { mult: hpMult, timer: buffDur };
        if (!wasBuffed) {
          const newMax = calcFinalStats(c).maxHp;
          c.currentHp  = Math.min(newMax, (c.currentHp || c.maxHpCache || 100) * hpMult);
          c.maxHpCache = newMax;
        }
        spawnFloatingText(stageIdx, c.x, c.y - 30, `HP +${Math.round((hpMult - 1) * 100)}%!`, '#2ecc71', 13);
      }
      if (skill.buffCdMult) {
        c.activeBuffs.cd = { mult: skill.buffCdMult, timer: buffDur };
        spawnFloatingText(stageIdx, c.x, c.y - 44, '스킬 가속!', '#3498db', 13);
      }
      if (skill.buffAtk) {
        const atkMult = skill.buffAtk + (sLv - 1) * (skill.buffAtkPerLv || 0);
        c.activeBuffs.atk = { mult: atkMult, timer: buffDur };
        spawnFloatingText(stageIdx, c.x, c.y - 30, `공격 +${Math.round((atkMult - 1) * 100)}%!`, '#e74c3c', 13);
      }
      if (skill.buffCritDmg) {
        const critBonus = skill.buffCritDmg + (sLv - 1) * (skill.buffCritDmgPerLv || 0);
        c.activeBuffs.critDmg = { bonus: critBonus, timer: buffDur };
        spawnFloatingText(stageIdx, c.x, c.y - 44, `크리 +${Math.round(critBonus * 100)}%!`, '#f1c40f', 13);
      }
    }
    return true;
  }

  // 쉐도우파트너: 분신 소환
  if (skill.targeting === 'shadow') {
    char.shadowActive = true;
    char.shadowTimer  = (skill.duration || 60) * (1 + (sLv - 1) * 0.12);
    char.shadowX = char.x - char.facing * 28;
    char.shadowY = char.y + 4;
    return true;
  }

  const dmg = Math.floor(stats.atk * (skill.dmgMultiplier || 1) * sMult);

  // ── 범위 회복 (클레릭) — 언데드에게는 데미지 ────────────
  if (skill.targeting === 'heal') {
    const stageIdx = char.assignedStage;
    const healAmt  = Math.floor(stats.atk * (skill.healMult || 2) * sMult);
    const healR2   = (skill.healRange || 300) ** 2;

    const allies = gameState.characters.filter(c => {
      if (c.isDead || c.assignedStage !== stageIdx) return false;
      const dx = c.x - char.x, dy = c.y - char.y;
      return dx * dx + dy * dy <= healR2;
    });

    const undeadTargets = field.monsters.filter(m => {
      if (!m.alive) return false;
      if (!(m.def || STAGES[stageIdx].monster).undead) return false;
      const dx = m.x - char.x, dy = m.y - char.y;
      return dx * dx + dy * dy <= healR2;
    });

    const needsHeal = allies.some(c => (c.currentHp || 0) < (c.maxHpCache || 100));
    if (!needsHeal && undeadTargets.length === 0) return false;

    for (const c of allies) {
      if ((c.currentHp || 0) < (c.maxHpCache || 100)) {
        c.currentHp = Math.min(c.maxHpCache || 100, (c.currentHp || 0) + healAmt);
        spawnFloatingText(stageIdx, c.x, c.y - 24, `+${healAmt}`, '#2ecc71', 14);
      }
    }

    for (const m of undeadTargets) {
      const holyDmg = healAmt * 2;
      m.currentHp -= holyDmg;
      m.hitAnim = 0.2;
      spawnFloatingText(stageIdx, m.x, m.y - 24, `${holyDmg}`, '#f1c40f', 15);
      if (m.currentHp <= 0 && m.alive) killMonster(char, m, STAGES[stageIdx], field);
    }

    return true;
  }

  // ── 리저렉션 (클레릭) ──────────────────────────────────
  if (skill.targeting === 'resurrection') {
    const stageIdx = char.assignedStage;
    const deadAllies = gameState.characters.filter(c =>
      c !== char && c.assignedStage === stageIdx && c.isDead
    );
    if (deadAllies.length === 0) return false;
    for (const c of deadAllies) {
      const cStats = calcFinalStats(c);
      c.isDead = false;
      c.respawnTimer = 0;
      c.currentHp = Math.floor(cStats.maxHp * 0.3);
      resetCharPos(c);
      spawnFloatingText(stageIdx, c.x, c.y - 36, '부활!', '#f1c40f', 16);
    }
    return true;
  }

  // ── 광역 빙결 (썬콜) ────────────────────────────────────
  if (skill.targeting === 'aoe_freeze') {
    const maxR2 = (skill.freezeRange || 270) ** 2;
    const maxT  = skill.maxTargetsBase !== undefined
      ? Math.round(skill.maxTargetsBase + (sLv - 1) * ((skill.maxTargets - skill.maxTargetsBase) / 9))
      : (skill.maxTargets || 8);
    const targets = field.monsters.filter(m => {
      if (!m.alive) return false;
      const dx = m.x - char.x, dy = m.y - char.y;
      return dx * dx + dy * dy <= maxR2;
    }).slice(0, maxT);
    if (!targets.length) return false;
    const freezeDur = (skill.freezeDuration || 5.0) + (sLv - 1) * 0.4;
    for (const t of targets) {
      dealSkillDamage(char, t, dmg, stage, field, stats);
      t.frozen = true; t.frozenTimer = freezeDur;
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

  // ── 포이즌 장판 (불독): 발밑에 독 필드 생성 ──────────────
  if (skill.targeting === 'poison_area') {
    const radius      = skill.poisonFieldRadius || skill.poisonRange || 200;
    const pDur        = (skill.poisonDuration || 8.0) + (sLv - 1) * 0.5;
    const tickInterval = skill.poisonTickInterval || 1.0;
    const dmgPerTick  = Math.max(1, Math.floor(stats.atk * (skill.dmgMultiplier || 0.5) * sMult * tickInterval));
    gameState.poisonFields.push({
      stageIdx:     char.assignedStage,
      x: char.x,   y: char.y,
      radius,
      duration:     pDur,
      tickInterval,
      tickTimer:    tickInterval,
      dmgPerTick,
      charId:       char.id,
    });
    spawnFloatingText(char.assignedStage, char.x, char.y - 36, '포이즌!', '#9b59b6', 14);
    return true;
  }

  // ── 세비지 블로우 (시프): 10연타 ─────────────────────────
  if (skill.targeting === 'savage_blow') {
    const t = findNearestMonster(char, field);
    if (!t) return false;
    const hitDmg = Math.floor(stats.atk * (skill.dmgMultiplier || 0.8) * sMult);
    dealSkillDamage(char, t, hitDmg, stage, field, stats);
    char.savageHitDmg   = hitDmg;
    char.savageHitsLeft = (skill.hits || 10) - 1;
    char.savageHitDelay = skill.hitDelay || 0.2;
    char.savageHitTimer = skill.hitDelay || 0.2;
    return true;
  }

  // ── 피어싱 충전 시작 (사수): 3초 후 1500% 데미지 ─────────
  if (skill.targeting === 'piercing') {
    if (char.charging) return false;
    const t = findNearestMonster(char, field);
    if (!t) return false;
    char.charging      = true;
    char.chargeTimer   = skill.chargeTime || 3.0;
    char.chargeDmgMult = (skill.dmgMultiplier || 15.0) * sMult;
    spawnFloatingText(char.assignedStage, char.x, char.y - 36, '충전 중...', '#e2b96f', 13);
    return true;
  }

  const t = findNearestMonster(char, field);
  if (!t) return false;
  dealSkillDamage(char, t, dmg, stage, field, stats);
  return true;
}

function dealSkillDamage(char, monster, dmg, stage, field, stats) {
  const isCrit    = stats && Math.random() * 100 < stats.critRate;
  const critMult  = isCrit ? (stats?.critDmg ?? 2) : 1;
  const dmgType   = CLASSES[char.classId]?.damageType || 'physical';
  const _monDef   = monster.def || stage.monster;
  const mDef      = dmgType === 'magical' ? _monDef.magicDef : _monDef.physDef;
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

function moveCharTowardDrop(char, dt) {
  let nearest = null, minD2 = Infinity;
  for (const d of gameState.drops) {
    if (d.stageIdx !== char.assignedStage) continue;
    const dx = d.x - char.x, dy = d.y - char.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < minD2) { minD2 = d2; nearest = d; }
  }
  if (!nearest) return;
  const dist = Math.sqrt(minD2);
  if (dist < 22) {
    const idx = gameState.drops.findIndex(d => d.uid === nearest.uid);
    if (idx !== -1) pickupDrop(idx);
  } else {
    const dx = nearest.x - char.x, dy = nearest.y - char.y;
    char.x += (dx / dist) * CHAR_SPEED * dt;
    char.y += (dy / dist) * CHAR_SPEED * dt;
    char.facing = dx >= 0 ? 1 : -1;
  }
}

// dmgMult: 도적 따닥 분할 타격 시 0.5 전달 (기본값 1.0)
function dealDamage(char, monster, stats, stage, field, dmgMult = 1.0) {
  if (Math.random() * 100 >= stats.accuracy) return;

  const hasOrb = char.skills && char.skills.includes('orb_strike');
  let baseDmg, orbExplosion = false, isCrit = false;

  const dmgType = CLASSES[char.classId]?.damageType || 'physical';
  const _monDef2 = monster.def || stage.monster;
  const mDef    = dmgType === 'magical' ? _monDef2.magicDef : _monDef2.physDef;

  if (hasOrb && char.orbReady && dmgMult >= 1.0) {
    const skill = SKILLS['orb_strike'];
    const orbLv  = char.skillLevels?.['orb_strike'] || 1;
    const orbMult = SKILL_LEVEL_MULTS[orbLv] ?? 1.0;
    const mult   = (skill ? skill.dmgMultiplier : 20) * orbMult;
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

function _giveKillRewards(char, mDef, monster) {
  const goldMult = 1 + (gameState.upgrades?.gold_boost || 0) * 0.10;
  gameState.gold += Math.floor(mDef.goldDrop * goldMult);
  const expMult  = 1 + (gameState.upgrades?.exp_boost  || 0) * 0.10;
  const allies   = gameState.characters.filter(c => c.assignedStage === char.assignedStage);
  const killerI  = allies.indexOf(char);
  const expArr   = calcExpDistribution(Math.floor(mDef.expDrop * expMult), allies.map(c => c.level), killerI);
  allies.forEach((c, i) => { c.exp += expArr[i]; checkLevelUp(c); });
  generateDrop(char.assignedStage, monster.x, monster.y);
}

function spawnBossWaveMonsters(field, def, count, parentX, parentY) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.max(60, Math.min(620, parentX + Math.cos(angle) * 50));
    const y = Math.max(60, Math.min(440, parentY + Math.sin(angle) * 50));
    field.monsters.push({
      id: field.monsters.length,
      spawnX: x, spawnY: y, x, y,
      currentHp: def.hp, maxHp: def.hp,
      alive: true, respawnTimer: 0, hitAnim: 0,
      attackTimer: Math.random() * MONSTER_ATTACK_INTERVAL,
      def,
      noRespawn: true,
    });
  }
}

function killMonster(char, monster, stage, field) {
  const mDef = monster.def || stage.monster;

  if (stage.isBossStage) {
    const type = mDef.type;
    if (type === 'kingSlime') {
      monster.alive        = false;
      monster.respawnTimer = MONSTER_RESPAWN_TIME;
      spawnBossWaveMonsters(field, stage.slimeDef, 5, monster.x, monster.y);
      _giveKillRewards(char, mDef, monster);
    } else if (type === 'slime') {
      monster.alive     = false;
      monster.noRespawn = true;
      spawnBossWaveMonsters(field, stage.miniSlimeDef, 3, monster.x, monster.y);
      _giveKillRewards(char, mDef, monster);
    } else if (type === 'miniSlime') {
      monster.alive     = false;
      monster.noRespawn = true;
      _giveKillRewards(char, mDef, monster);
      const anyMiniAlive  = field.monsters.some(m => m !== monster && m.def?.type === 'miniSlime' && m.alive);
      const anySlimeAlive = field.monsters.some(m => m.def?.type === 'slime' && m.alive);
      if (!anyMiniAlive && !anySlimeAlive) {
        // 슬라임/미니슬라임 시체 정리
        field.monsters = field.monsters.filter(m => !m.def || m.def.type === 'kingSlime');
        // 웨이브 클리어 카운트
        const nextIdx = char.assignedStage + 1;
        const alreadyUnlocked = nextIdx < STAGES.length && nextIdx <= gameState.maxStageReached;
        if (!alreadyUnlocked) {
          field.kills++;
          if (field.kills >= stage.killsToAdvance) {
            advanceStageField(char.assignedStage);
            markTabDirty();
          }
        }
      }
    }
    return;
  }

  // 일반 스테이지
  monster.alive        = false;
  monster.respawnTimer = MONSTER_RESPAWN_TIME;

  const goldMult = 1 + (gameState.upgrades?.gold_boost || 0) * 0.10;
  gameState.gold += Math.floor(mDef.goldDrop * goldMult);

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

  // 경험치 분배
  const expMult  = 1 + (gameState.upgrades?.exp_boost || 0) * 0.10;
  const allies   = gameState.characters.filter(c => c.assignedStage === char.assignedStage);
  const killerI  = allies.indexOf(char);
  const expArr   = calcExpDistribution(Math.floor(mDef.expDrop * expMult), allies.map(c => c.level), killerI);
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
    if (char.level % SKILL_SP_PER_LEVEL === 0) {
      char.skillPoints = (char.skillPoints || 0) + 1;
    }
    needed = expRequired(char.level);
  }
  if (char.level !== prevLevel) markTabDirty();
}
