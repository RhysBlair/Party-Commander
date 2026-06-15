// 장비 슬롯 합산 헬퍼 (강화 보너스 포함: +15% per enhance level)
function sumEquipStat(char, stat) {
  let total = 0;
  for (const slot of ['weapon', 'armor', 'accessory', 'throwable']) {
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
  const effSTR = (s.STR ?? 0) + sumEquipStat(char, 'bonusSTR');
  const effDEX = (s.DEX ?? 0) + sumEquipStat(char, 'bonusDEX');
  const effINT = (s.INT ?? 0) + sumEquipStat(char, 'bonusINT');
  const effLUK = (s.LUK ?? 0) + sumEquipStat(char, 'bonusLUK');
  const eff    = { STR: effSTR, DEX: effDEX, INT: effINT, LUK: effLUK };

  // 공격력: 기본5 + 장비ATK + STR보너스 (직업 주스탯 배율 적용)
  const strAtkBonus  = effSTR * 0.5;
  const baseAtk      = 5 + eqAtk + strAtkBonus;
  const primaryStat  = cls.primary ? eff[cls.primary] : 0;
  const atkMultiplier = 1 + PRIMARY_STAT_DMG_COEFF * primaryStat;

  // 방어 / 명중 / 회피
  const physDef  = effSTR * STAT_EFFECTS.STR.physDef  + eqPhysDef;
  const magicDef = effINT * STAT_EFFECTS.INT.magicDef + eqMagDef;
  const accuracy = 80 + effDEX * STAT_EFFECTS.DEX.accuracy;
  const evade    = effDEX * STAT_EFFECTS.DEX.evade + effLUK * STAT_EFFECTS.LUK.evade;

  const atkUpgPct  = (gameState.upgrades?.atk_boost || 0) * 0.05;
  const defUpgFlat = (gameState.upgrades?.def_boost || 0) * 3;
  const critRate   = Math.min(effLUK * 0.5, 50); // LUK당 0.5%, 최대 50%
  const maxHp      = Math.floor(100 + char.level * 20 + effSTR * 5);

  const hpBuffMult  = (char.activeBuffs?.hp?.timer > 0) ? (char.activeBuffs.hp.mult || 1) : 1;
  const accPenalty  = (char.raidAccDown || 0) > 0 ? ZAKUM?.accDebuffAmt ?? 70 : 0;

  return {
    atk:      Math.floor(baseAtk * atkMultiplier * (1 + atkUpgPct)),
    physDef:  Math.floor(physDef + defUpgFlat),
    magicDef: Math.floor(magicDef),
    accuracy: Math.max(10, Math.min(accuracy - accPenalty, 99)),
    evade:    Math.min(evade, 60),
    critRate,
    critDmg:  2.0,
    maxHp:    Math.floor(maxHp * hpBuffMult),
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
