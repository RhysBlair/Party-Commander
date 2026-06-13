// 스탯 계산 모듈 (스텁 — 단계적으로 채워진다)

// 캐릭터의 최종 전투 스탯 계산
function calcFinalStats(char) {
  const cls = CLASSES[char.classId];
  const s = char.stats;

  // 장비 공격력
  const weaponId = char.equipment?.weapon;
  const weaponAtk = weaponId ? (EQUIPMENT[weaponId]?.atk ?? 0) : 0;

  // STR 기본 공격력 보너스 (직업 무관, 1포인트당 +0.5)
  const strAtkBonus = (s.STR ?? 0) * 0.5;
  const baseAtk = 5 + weaponAtk + strAtkBonus;

  // 주스탯 보정 (전사=STR배율, 궁수=DEX배율 등)
  const primaryStat = cls.primary ? (s[cls.primary] ?? 0) : 0;
  const atkMultiplier = 1 + PRIMARY_STAT_DMG_COEFF * primaryStat;

  // 공통 스탯 효과
  const physDef   = (s.STR ?? 0) * STAT_EFFECTS.STR.physDef;
  const magicDef  = (s.INT ?? 0) * STAT_EFFECTS.INT.magicDef;
  const accuracy  = 80 + (s.DEX ?? 0) * STAT_EFFECTS.DEX.accuracy;
  const evade     = (s.DEX ?? 0) * STAT_EFFECTS.DEX.evade
                  + (s.LUK ?? 0) * STAT_EFFECTS.LUK.evade;

  return {
    atk: Math.floor(baseAtk * atkMultiplier),
    physDef: Math.floor(physDef),
    magicDef: Math.floor(magicDef),
    accuracy: Math.min(accuracy, 99),   // 최대 99%
    evade: Math.min(evade, 60),         // 최대 60%
  };
}

// 자동 스탯 분배: 주스탯 위주, 부스탯 소량
function autoAssignStats(char) {
  if (char.unspentPoints <= 0) return;
  const cls = CLASSES[char.classId];
  if (!cls.primary) {
    // 모험가: STR에 몰아줌
    char.stats.STR += char.unspentPoints;
  } else {
    const pts = char.unspentPoints;
    // 5포인트마다 주스탯4 : 부스탯1 비율
    const toSecondary = Math.floor(pts / 5);
    const toPrimary   = pts - toSecondary;
    char.stats[cls.primary]   = (char.stats[cls.primary]   ?? 0) + toPrimary;
    char.stats[cls.secondary] = (char.stats[cls.secondary] ?? 0) + toSecondary;
  }
  char.unspentPoints = 0;
}
