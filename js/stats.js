// 장비 슬롯 합산 헬퍼 (강화 보너스 포함: +15% per enhance level)
function sumEquipStat(char, stat) {
  let total = 0;
  for (const slot of ['weapon', 'weapon2', 'armor', 'accessory', 'throwable']) {
    // 무기 슬롯에 아대(isAedae) 미착용 시 표창 공격력 기여 없음
    if (slot === 'throwable' && stat === 'atk') {
      const wItem = char.equipment?.weapon;
      if (!wItem || !EQUIPMENT[wItem.id]?.isAedae) continue;
    }
    const item = char.equipment?.[slot];
    if (!item) continue;
    const id      = typeof item === 'string' ? item : item.id;
    const enhance = typeof item === 'object' ? (item.enhance || 0) : 0;
    const e = EQUIPMENT[id];
    if (!e) continue;
    const base = e[stat] ?? 0;
    total += enhance > 0 ? Math.floor(base * (1 + enhance * 0.15)) : base;
  }
  return total;
}

// 캐릭터의 최종 전투 스탯 계산
function calcFinalStats(char) {
  const cls = CLASSES[char.classId];
  const s   = char.stats;

  // 장비 ATK / 방어 보너스
  const eqAtk     = sumEquipStat(char, 'atk');
  const eqPhysDef = sumEquipStat(char, 'physDef');
  const eqMagDef  = sumEquipStat(char, 'magicDef');

  // 장비 스탯 보너스 적용 후 유효 스탯
  const statMult = (char.activeBuffs?.statMult?.timer > 0) ? (char.activeBuffs.statMult.mult || 1) : 1;
  const effSTR = ((s.STR ?? 0) + sumEquipStat(char, 'bonusSTR')) * statMult;
  const effDEX = ((s.DEX ?? 0) + sumEquipStat(char, 'bonusDEX')) * statMult;
  const effINT = ((s.INT ?? 0) + sumEquipStat(char, 'bonusINT')) * statMult;
  const effLUK = ((s.LUK ?? 0) + sumEquipStat(char, 'bonusLUK')) * statMult;
  const eff    = { STR: effSTR, DEX: effDEX, INT: effINT, LUK: effLUK };

  // 공격력: 기본5 + 장비ATK + 주스탯보너스 (직업 주스탯 배율 적용)
  const primaryStat   = cls.primary ? eff[cls.primary] : 0;
  const primaryBonus  = primaryStat * 0.5;
  const baseAtk       = 5 + eqAtk + primaryBonus;
  const atkMultiplier = 1 + PRIMARY_STAT_DMG_COEFF * primaryStat;

  // 방어 / 명중 / 회피
  const physDef  = effSTR * STAT_EFFECTS.STR.physDef  + eqPhysDef;
  const magicDef = effINT * STAT_EFFECTS.INT.magicDef + eqMagDef;
  const accuracy = 80 + effDEX * STAT_EFFECTS.DEX.accuracy;
  const evade    = effDEX * STAT_EFFECTS.DEX.evade + effLUK * STAT_EFFECTS.LUK.evade;

  const charUpg    = getCharUpgrades(char);
  const atkUpgPct  = (charUpg.atk_boost || 0) * 0.05;
  const defUpgFlat = (charUpg.def_boost || 0) * 3;
  const eqCritRate = sumEquipStat(char, 'bonusCritRate');
  const eqCritDmg  = sumEquipStat(char, 'bonusCritDmg');
  const critRate   = (effLUK <= 100
    ? effLUK * 0.3
    : 30 + (effLUK - 100) * 0.2) + eqCritRate; // LUK 100이하 0.3%/pt, 초과 0.2%/pt
  const maxHp      = Math.floor(100 + char.level * 20 + effSTR * 5);

  const hpBuffMult  = (char.activeBuffs?.hp?.timer > 0) ? (char.activeBuffs.hp.mult || 1) : 1;
  const accPenalty  = (char.raidAccDown || 0) > 0 ? ZAKUM?.accDebuffAmt ?? 70 : 0;

  // 펫 보너스
  const petCritBonus = char.pet === 'mini_bat'   ? (PETS['mini_bat']?.critBonus  || 0) : 0;
  const petHpMult    = char.pet === 'baby_bear'  ? (1 + (PETS['baby_bear']?.hpMult || 0)) : 1;

  return {
    atk:      Math.floor(baseAtk * atkMultiplier * (1 + atkUpgPct)),
    physDef:  Math.floor(physDef + defUpgFlat),
    magicDef: Math.floor(magicDef),
    accuracy: Math.max(10, Math.min(accuracy - accPenalty, 99)),
    evade:    Math.min(evade, 60),
    critRate: critRate + petCritBonus,
    critDmg:  3.0 + eqCritDmg + ((char.activeBuffs?.critDmg?.timer > 0) ? (char.activeBuffs.critDmg.bonus || 0) : 0),
    maxHp:    Math.floor(maxHp * hpBuffMult * petHpMult),
    maxMp:    Math.floor(200 + effINT * 4 + char.level * 5),
  };
}

// 순수 기본 스탯 (장비/버프/업그레이드 없이 char.stats만 사용) — 브레이크다운 표시용
function calcBaseStats(char) {
  const cls = CLASSES[char.classId];
  if (!cls) return { atk: 0, physDef: 0, magicDef: 0, accuracy: 80, evade: 0, critRate: 0, maxHp: 100, maxMp: 200 };
  const s   = char.stats || {};
  const STR = s.STR ?? 0;
  const DEX = s.DEX ?? 0;
  const INT = s.INT ?? 0;
  const LUK = s.LUK ?? 0;
  const primaryStat  = cls.primary ? (s[cls.primary] ?? 0) : 0;
  const primaryBonus = primaryStat * 0.5;
  const atkMult      = 1 + PRIMARY_STAT_DMG_COEFF * primaryStat;
  return {
    atk:      Math.floor((5 + primaryBonus) * atkMult),
    physDef:  Math.floor(STR * STAT_EFFECTS.STR.physDef),
    magicDef: Math.floor(INT * STAT_EFFECTS.INT.magicDef),
    accuracy: 80 + DEX * STAT_EFFECTS.DEX.accuracy,
    evade:    DEX * STAT_EFFECTS.DEX.evade + LUK * STAT_EFFECTS.LUK.evade,
    critRate: LUK <= 100 ? LUK * 0.3 : 30 + (LUK - 100) * 0.2,
    critDmg:  3.0,
    maxHp:    Math.floor(100 + char.level * 20 + STR * 5),
    maxMp:    Math.floor(200 + INT * 4 + char.level * 5),
  };
}

// 자동 스탯 분배: 5포인트당 주스탯4 : 부스탯1
function autoAssignStats(char) {
  if (char.unspentPoints <= 0) return;
  const cls = CLASSES[char.classId];
  if (!cls.primary) {
    char.stats.STR += char.unspentPoints;
  } else {
    const pts         = char.unspentPoints;
    const toSecondary = Math.floor(pts / 5);
    const toPrimary   = pts - toSecondary;
    char.stats[cls.primary]   = (char.stats[cls.primary]   ?? 0) + toPrimary;
    char.stats[cls.secondary] = (char.stats[cls.secondary] ?? 0) + toSecondary;
  }
  char.unspentPoints = 0;
}
