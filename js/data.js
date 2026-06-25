// 직업 정의
const CLASSES = {
  // ── 0차 ─────────────────────────────────────────────────
  novice:    { name: "모험가",   primary: null,  secondary: null,  range: "melee",
               weaponLock: "beginner_sword", canSkill: false,
               damageType: "physical", jobLevel: 0 },

  // ── 1차 ─────────────────────────────────────────────────
  warrior:   { name: "전사",    primary: "STR", secondary: "DEX", range: "melee",        canSkill: true, damageType: "physical", jobLevel: 1 },
  archer:    { name: "궁수",    primary: "DEX", secondary: "STR", range: "ranged_long",  canSkill: true, damageType: "physical", jobLevel: 1 },
  mage:      { name: "마법사",  primary: "INT", secondary: "LUK", range: "ranged",       canSkill: true, damageType: "magical",  jobLevel: 1 },
  rogue:     { name: "도적",    primary: "LUK", secondary: "DEX", range: "ranged_short", canSkill: true, damageType: "physical", jobLevel: 1 },

  // ── 2차 (전사 계열) ──────────────────────────────────────
  fighter:   { name: "파이터",   primary: "STR", secondary: "DEX", range: "melee",        canSkill: true, damageType: "physical", jobLevel: 2, parent: "warrior" },
  page:      { name: "페이지",   primary: "STR", secondary: "INT", range: "melee",        canSkill: true, damageType: "physical", jobLevel: 2, parent: "warrior" },
  spearman:  { name: "스피어맨", primary: "STR", secondary: "DEX", range: "melee_long",   canSkill: true, damageType: "physical", jobLevel: 2, parent: "warrior" },
  knight:    { name: "나이트",   primary: "STR", secondary: "DEX", range: "melee",        canSkill: true, damageType: "physical", jobLevel: 2, parent: "warrior" },

  // ── 2차 (마법사 계열) ────────────────────────────────────
  wizard_tl: { name: "썬콜",    primary: "INT", secondary: "DEX", range: "ranged",       canSkill: true, damageType: "magical",  jobLevel: 2, parent: "mage" },
  wizard_fp: { name: "불독",    primary: "INT", secondary: "LUK", range: "ranged",       canSkill: true, damageType: "magical",  jobLevel: 2, parent: "mage" },
  cleric:    { name: "클레릭",   primary: "INT", secondary: "STR", range: "ranged",       canSkill: true, damageType: "magical",  jobLevel: 2, parent: "mage" },

  // ── 2차 (도적 계열) ──────────────────────────────────────
  assassin:  { name: "어쌔신",   primary: "LUK", secondary: "DEX", range: "ranged_short", canSkill: true, damageType: "physical", jobLevel: 2, parent: "rogue" },
  thief:     { name: "시프",    primary: "LUK", secondary: "STR", range: "melee",        canSkill: true, damageType: "physical", jobLevel: 2, parent: "rogue" },

  // ── 2차 (궁수 계열) ──────────────────────────────────────
  hunter:    { name: "헌터",    primary: "DEX", secondary: "STR", range: "ranged_long",  canSkill: true, damageType: "physical", jobLevel: 2, parent: "archer" },
  marksman:  { name: "사수",    primary: "DEX", secondary: "LUK", range: "ranged_long",  canSkill: true, damageType: "physical", jobLevel: 2, parent: "archer" },
};

// 전직 가능 레벨
const JOB_ADVANCE_LEVEL  = 10;
const JOB_ADVANCE_LEVEL_2 = 30;

// 스탯 공통 효과 계수
const STAT_EFFECTS = {
  STR: { physDef: 0.5 },
  DEX: { evade: 0.1, accuracy: 0.5 },
  INT: { magicDef: 0.5 },
  LUK: { evade: 0.3 },
};

// 주스탯 데미지 계수 (주스탯 1포인트당 공격력 보정)
const PRIMARY_STAT_DMG_COEFF = 0.02;

// 레벨업 경험치 요구량 계산 (레벨별)
const expRequired = (level) => Math.floor(10 * Math.pow(1.4, level - 1));

// 레벨업 시 획득 스탯 포인트
const STAT_POINTS_PER_LEVEL = 5;

// 장비 정의  (minDropStage: 0=초원, 1=숲, 2=동굴, 3=사막, 4=화산)
const EQUIPMENT = {
  // ── 스타터 ──────────────────────────────────────────────
  beginner_sword:  { name: "초보자의 검",   type: "weapon",    grade: "노멀", atk: 3,                       req: {},                               cost: 0,    minDropStage: 99 },

  // ── 무기 (전사 전용) ────────────────────────────────────
  iron_sword:      { name: "철검",           type: "weapon",    grade: "노멀", atk: 8,  bonusSTR: 3,  bonusDEX: 1, req: { level: 5,  classId: "warrior" }, cost: 200,  minDropStage: 0 },
  steel_sword:     { name: "강철검",         type: "weapon",    grade: "노멀", atk: 16, bonusSTR: 6,  bonusDEX: 2, req: { level: 10, classId: "warrior" }, cost: 600,  minDropStage: 1 },

  // ── 무기 (직업 전용) ────────────────────────────────────
  knight_sword:    { name: "기사검",         type: "weapon",    grade: "에픽", atk: 40, bonusSTR: 15, bonusDEX: 5, req: { level: 15, classId: "warrior" }, cost: 5000, minDropStage: 4 },
  long_bow:        { name: "장궁",           type: "weapon",    grade: "노멀", atk: 12,                      req: { level: 5,  classId: "archer"  }, cost: 280,  minDropStage: 0 },
  compound_bow:    { name: "복합궁",         type: "weapon",    grade: "레어", atk: 22,                      req: { level: 10, classId: "archer"  }, cost: 750,  minDropStage: 1 },
  magic_staff:     { name: "마법 지팡이",    type: "weapon",    grade: "노멀", atk: 5,  bonusINT: 5,         req: { level: 5,  classId: "mage"    }, cost: 280,  minDropStage: 0 },
  great_staff:     { name: "대마법 지팡이",  type: "weapon",    grade: "레어", atk: 8,  bonusINT: 10,        req: { level: 10, classId: "mage"    }, cost: 750,  minDropStage: 1 },
  dagger:          { name: "단검",           type: "weapon",    grade: "노멀", atk: 11, weaponType: "dagger",                      req: { level: 5,  classId: "rogue"   }, cost: 260,  minDropStage: 0 },
  shadow_blade:    { name: "그림자 단검",    type: "weapon",    grade: "레어", atk: 20, weaponType: "dagger",                      req: { level: 10, classId: "rogue"   }, cost: 720,  minDropStage: 1 },

  // ── 무기 (직업 전용, 에픽) ──────────────────────────────
  epic_staff:      { name: "고대 마법 지팡이", type: "weapon", grade: "에픽", atk: 12, bonusINT: 22, req: { level: 30, classId: "mage"   }, cost: 9000, minDropStage: 7 },
  epic_bow:        { name: "전설의 활",        type: "weapon", grade: "에픽", atk: 50, bonusDEX: 18, req: { level: 30, classId: "archer" }, cost: 9000, minDropStage: 7 },

  // ── 석궁 (궁수 계열, 크리티컬 특화) ──────────────────────
  crossbow:        { name: "석궁",     type: "weapon", grade: "노멀", atk:  8, bonusCritRate:  5,                    req: { level:  5, classId: "archer" }, cost: 320,  minDropStage: 0 },
  heavy_crossbow:  { name: "중석궁",   type: "weapon", grade: "레어", atk: 14, bonusCritRate: 12, bonusCritDmg: 0.5, req: { level: 15, classId: "archer" }, cost: 1200, minDropStage: 3 },
  epic_crossbow:   { name: "심연의 석궁", type: "weapon", grade: "에픽", atk: 30, bonusCritRate: 20, bonusCritDmg: 1.0, req: { level: 30, classId: "archer" }, cost: 10000, minDropStage: 7 },

  // ── 단검 (시프 전용) ────────────────────────────────────
  iron_dagger:     { name: "철제단검",    type: "weapon", grade: "노멀", atk: 18, bonusLUK: 5,               weaponType: "dagger", req: { level: 10, classId: "thief" }, cost: 500,  minDropStage: 2 },
  dark_dagger:     { name: "어둠단검",    type: "weapon", grade: "에픽", atk: 55, bonusLUK: 18, bonusSTR: 5,  weaponType: "dagger", req: { level: 20, classId: "thief" }, cost: 6000, minDropStage: 4 },
  reaper_dagger:   { name: "사신단검",    type: "weapon", grade: "에픽",   atk: 58, bonusLUK: 20, bonusSTR: 5,  weaponType: "dagger", req: { level: 30, classId: "thief" }, cost: 18000, minDropStage: 7 },

  // ── 방어구 ──────────────────────────────────────────────
  leather_armor:   { name: "가죽 갑옷",      type: "armor",     grade: "노멀", physDef: 5,                   req: { level: 5 },                     cost: 200,  minDropStage: 0 },
  chain_mail:      { name: "사슬 갑옷",      type: "armor",     grade: "노멀", physDef: 12,                  req: { level: 10 },                    cost: 600,  minDropStage: 1 },
  plate_armor:     { name: "판금 갑옷",      type: "armor",     grade: "레어", physDef: 22,                  req: { level: 15, classId: "warrior" }, cost: 1500, minDropStage: 2 },
  mage_robe:       { name: "마법사 로브",    type: "armor",     grade: "노멀", magicDef: 10, bonusINT: 3,    req: { level: 5,  classId: "mage"    }, cost: 250,  minDropStage: 0 },

  // ── 장신구 ──────────────────────────────────────────────
  lucky_ring:      { name: "행운의 반지",    type: "accessory", grade: "노멀", bonusLUK: 5,                  req: { level: 5 },                     cost: 300,  minDropStage: 0 },
  str_ring:        { name: "힘의 반지",      type: "accessory", grade: "노멀", bonusSTR: 5,                  req: { level: 5 },                     cost: 300,  minDropStage: 0 },
  dex_bracelet:    { name: "민첩의 팔찌",    type: "accessory", grade: "레어", bonusDEX: 8,                  req: { level: 10 },                    cost: 700,  minDropStage: 1 },
  int_necklace:    { name: "지성의 목걸이",  type: "accessory", grade: "레어", bonusINT: 8,                  req: { level: 10 },                    cost: 700,  minDropStage: 1 },

  // ── 표창 (도적 전용, throwable 슬롯) ── 수비→화비 지수적 증가 ──
  su_shuriken:     { name: "수비표창",   type: "throwable", grade: "노멀", atk: 10,  req: { classId: "rogue" },              cost: 300,  minDropStage: 0, maxEnhance: 0 },
  geum_shuriken:   { name: "금비표창",   type: "throwable", grade: "노멀", atk: 16,  req: { classId: "rogue", level: 5  },  cost: 700,  minDropStage: 0, maxEnhance: 0 },
  to_shuriken:     { name: "토비표창",   type: "throwable", grade: "노멀", atk: 26,  req: { classId: "rogue", level: 10 },  cost: 1500, minDropStage: 1, maxEnhance: 0 },
  rae_shuriken:    { name: "뇌전수리검", type: "throwable", grade: "레어", atk: 42,  req: { classId: "rogue", level: 15 },  cost: 3000, minDropStage: 2, maxEnhance: 0 },
  il_shuriken:     { name: "일비표창",   type: "throwable", grade: "레어", atk: 67,  req: { classId: "rogue", level: 15 },  cost: 5000, minDropStage: 3, maxEnhance: 0 },
  hwa_shuriken:    { name: "화비표창",   type: "throwable", grade: "에픽", atk: 107, req: { classId: "rogue", level: 20 },  cost: 9000, minDropStage: 4, maxEnhance: 0 },

  // ── 아대 (도적/어쌔신 전용 무기 슬롯) — 착용 시 표창 공격력 활성화, 시프 착용 불가 ──
  shadow_subweapon:  { name: "그림자 아대", type: "weapon", isAedae: true, grade: "노멀", atk: 8,  bonusLUK: 3,              req: { level: 10, classId: "rogue" }, cost: 800,  minDropStage: 1 },
  silence_subweapon: { name: "침묵의 아대", type: "weapon", isAedae: true, grade: "레어", atk: 18, bonusLUK: 6,  bonusDEX: 3, req: { level: 20, classId: "rogue" }, cost: 2000, minDropStage: 3 },
  moon_subweapon:    { name: "월식아대",    type: "weapon", isAedae: true, grade: "에픽", atk: 32, bonusLUK: 12, bonusDEX: 8, req: { level: 30, classId: "rogue" }, cost: 6000, minDropStage: 5 },
};

const GRADE_COLORS = { "노멀": "#aaa", "레어": "#5b9bd5", "에픽": "#9b59b6" };

// 결정 시스템
const CRYSTAL_KEYS  = { "노멀": "dim",  "레어": "bright",  "에픽": "radiant" };
const CRYSTAL_NAMES = { dim: "은은한결정", bright: "빛나는결정", radiant: "찬란한결정" };
const CRYSTAL_COLORS = { dim: "#aaa", bright: "#5b9bd5", radiant: "#9b59b6" };
const CRAFT_COST_WEAPON = 25;  // 무기/표창 제작 비용 (grade 공통)
const CRAFT_COST_ARMOR  = 15;  // 방어구/장신구 제작 비용 (grade 공통)

// 장비 강화 설정
const ENHANCE_MAX = 10;
// 인덱스 = 현재 강화 단계, 값 = 성공 확률(%)
const ENHANCE_SUCCESS = [100, 100, 100, 100, 100, 80, 60, 40, 25, 10];

// 스킬 정의
const SKILLS = {
  // ── 전사 ──────────────────────────────────────────────────
  orb_strike:     { name: "오브 스트라이크", classId: "warrior",
                    targeting: "passive", orbsRequired: 5, dmgMultiplier: 14.0, cost: 500, mpCost: 30 },
  taunt:          { name: "도발", classId: "warrior",
                    targeting: "taunt", cooldown: 12, mpCost: 15, cost: 500,
                    buffDef: 0, buffDefPerLv: 10,
                    buffDuration: 8 },

  // ── 2차 전사 ──────────────────────────────────────────────
  power_burst:    { name: "파워 버스트",       classId: "fighter",
                    targeting: "power_burst",
                    statMultBase: 2.0, statMultPerLv: 2/9,
                    durationBase: 2.0, durationPerLv: 3/9,
                    cost: 500, mpCost: 0 },

  threat:         { name: "위협",            classId: "page",     cooldown: 15.0,
                    targeting: "debuff_area", debuffRange: 250, debuffDmgMult: 1.5,
                    debuffDuration: 8.0, cost: 500, mpCost: 15 },
  spear_aura:     { name: "하이퍼바디",       classId: "spearman", cooldown: 90.0,
                    targeting: "party_buff",
                    buffHp: 1.2, buffHpPerLv: 0.2, buffDuration: 60.0, cost: 500, mpCost: 50 },
  rage:           { name: "분노",            classId: "knight",   cooldown: 60.0,
                    targeting: "party_buff",
                    buffAtk: 2.0, buffAtkPerLv: 0.2222, buffAtkLabel: "물리공격력",
                    buffDuration: 30.0, cost: 500, mpCost: 50 },

  // ── 마법사 ────────────────────────────────────────────────
  mage_blast:     { name: "마력 폭발",      classId: "mage",    cooldown: 4.0,
                    targeting: "aoe",    maxTargets: 5, dmgMultiplier: 1.2, cost: 500, mpCost: 12 },
  magic_guard:    { name: "매직가드",       classId: "mage",
                    targeting: "passive", maxLevel: 1, mgAbsorb: 0.8, cost: 300, mpCost: 0 },

  // ── 2차 마법사 ────────────────────────────────────────────
  ice_strike:     { name: "아이스 스트라이크", classId: "wizard_tl", cooldown: 8.0,
                    targeting: "aoe_freeze", freezeRange: 405, maxTargets: 8, maxTargetsBase: 1,
                    dmgMultiplier: 3.0, freezeDuration: 5.0, cost: 500, mpCost: 20 },
  cleric_heal:    { name: "힐",              classId: "cleric",  cooldown: 5.0, cooldownDecay: 0.647,
                    targeting: "heal",   healRange: 320, healMult: 3, cost: 500, mpCost: 15 },
  resurrection:   { name: "리저렉션",       classId: "cleric",  cooldown: 180,
                    targeting: "resurrection", maxLevel: 3, cooldownPerLv: -60,
                    cost: 500, mpCost: 30 },

  // ── 궁수 ──────────────────────────────────────────────────
  silver_hawk:    { name: "실버호크",         classId: "archer",  cooldown: 20, mpCost: 20, cost: 500,
                    targeting: "silver_hawk",
                    hawkDmgBase: 0.8,        hawkDmgPerLv: 0.133,
                    hawkStunChanceBase: 0.5, hawkStunChancePerLv: 0.0556,
                    hawkStunDurBase: 3.0,    hawkStunDurPerLv: 0.556,
                    hawkDuration: 30,        hawkDurationPerLv: 3 },
  double_shot:    { name: "더블샷",          classId: "archer",  cooldown: 3.0,
                    targeting: "double_hit", hits: 2, dmgMultiplier: 0.8, cost: 500, mpCost: 10 },

  // ── 2차 궁수 (헌터가 연사 계승) ──────────────────────────
  archer_shot:    { name: "연사",            classId: "hunter",
                    targeting: "passive", attackInterval: 0.2, dmgMultiplier: 1.2, cost: 500, mpCost: 0 },

  // ── 도적 ──────────────────────────────────────────────────
  shadow_partner: { name: "쉐도우파트너",    classId: "rogue",   cooldown: 1.5,
                    targeting: "shadow", duration: 60.0, cost: 500, mpCost: 3 },

  // ── 도적 (1차) ──────────────────────────────────────────
  log_decoy:      { name: "통나무분신술",    classId: "rogue",    cooldown: 30.0,
                    targeting: "log_decoy", decoyHp: 667, decoyHpPerLv: 3629,
                    cost: 500, mpCost: 20 },

  // ── 2차 도적 (어쌔신) ────────────────────────────────────
  triple_throw:   { name: "트리플 스로우",   classId: "assassin",
                    targeting: "passive", hits: 3, cost: 500, mpCost: 0 },

  // ── 2차 도적 (시프) ──────────────────────────────────────
  savage_blow:    { name: "세비지 블로우",   classId: "thief",    cooldown: 4.0,
                    targeting: "savage_blow", hits: 10, hitDelay: 0.2,
                    dmgMultiplier: 0.8, cost: 500, mpCost: 20 },

  // ── 2차 마법사 (썬콜) ─────────────────────────────────────
  meditation_tl:  { name: "메디테이션",      classId: "wizard_tl", cooldown: 60.0,
                    targeting: "party_buff", buffAtk: 2.0, buffAtkPerLv: 0.1111, buffAtkLabel: "마법공격력",
                    buffDuration: 30.0, cost: 500, mpCost: 30 },

  // ── 2차 마법사 (불독) ─────────────────────────────────────
  meditation_fp:  { name: "메디테이션",      classId: "wizard_fp", cooldown: 60.0,
                    targeting: "party_buff", buffAtk: 2.0, buffAtkPerLv: 0.1111, buffAtkLabel: "마법공격력",
                    buffDuration: 30.0, cost: 500, mpCost: 30 },
  poison_field:   { name: "포이즌",          classId: "wizard_fp", cooldown: 10.0,
                    targeting: "poison_area", poisonRange: 220, dmgMultiplier: 25.0,
                    poisonDuration: 8.0, poisonFieldRadius: 220, poisonTickInterval: 0.1,
                    cost: 500, mpCost: 20 },
  meteor:         { name: "메테오",           classId: "wizard_fp", cooldown: 20.0,
                    targeting: "meteor_cast", castTime: 5.0, fallTime: 3.0,
                    meteorRange: 800, dmgMultiplier: 45.0, dmgPerLv: 161.67,
                    cost: 500, mpCost: 120 },

  // ── 2차 궁수 (사수) ──────────────────────────────────────
  piercing:       { name: "피어싱",          classId: "marksman",  cooldown: 10.0,
                    targeting: "piercing", chargeTime: 3.0, dmgMultiplier: 15.0, cost: 500, mpCost: 50 },
  sharp_eyes_mk:  { name: "샤프아이즈",      classId: "marksman", cooldown: 60.0,
                    targeting: "party_buff", buffCritDmg: 0.20, buffCritDmgPerLv: 0.1444,
                    buffDuration: 30.0, cost: 500, mpCost: 30 },

  // ── 2차 궁수 (헌터) 추가 ────────────────────────────────
  sharp_eyes_ht:  { name: "샤프아이즈",      classId: "hunter",   cooldown: 60.0,
                    targeting: "party_buff", buffCritDmg: 0.20, buffCritDmgPerLv: 0.1444,
                    buffDuration: 30.0, cost: 500, mpCost: 30 },
};

// ── 파티 업그레이드 정의 ─────────────────────────────────────
const UPGRADES = {
  atk_boost:  { name: "공격 강화",     desc: "파티 전체 공격력",     unit: "+5%/레벨",  maxLevel: 20, baseCost: 500,  costMult: 1.5 },
  def_boost:  { name: "방어 강화",     desc: "파티 전체 물리방어",   unit: "+3/레벨",   maxLevel: 15, baseCost: 400,  costMult: 1.4 },
  exp_boost:  { name: "경험치 보너스", desc: "몬스터 경험치 획득량", unit: "+10%/레벨", maxLevel: 10, baseCost: 800,  costMult: 1.6 },
  gold_boost: { name: "골드 보너스",   desc: "몬스터 골드 획득량",   unit: "+10%/레벨", maxLevel: 10, baseCost: 600,  costMult: 1.6 },
  atk_spd:    { name: "공격속도 강화", desc: "파티 전체 공격속도",   unit: "+5%/레벨",  maxLevel: 10, baseCost: 1200, costMult: 1.8 },
};

// 펫 정의
const PETS = {
  mini_rabbit: { name: "미니래빗",    desc: "공격속도가 30% 증가한다 / 아이템 자동 수집",  atkSpeed: 0.30,    cost: 5000 },
  mini_bat:    { name: "꼬마박쥐",    desc: "크리티컬 확률을 20% 증가 / 아이템 자동 수집", critBonus: 20,     cost: 5000 },
  baby_bear:   { name: "아기곰",      desc: "최대 체력을 50% 증가 / 아이템 자동 수집",     hpMult: 0.50,     cost: 5000 },
  baby_snake:  { name: "아기뱀",      desc: "5초마다 체력 100% 회복 / 아이템 자동 수집",   healInterval: 5.0, cost: 5000 },
  baby_turtle: { name: "아기거북이",  desc: "5초마다 쉴드로 공격 1회 방어 / 아이템 자동 수집", shieldInterval: 5.0, cost: 5000 },
};

// 물약 정의
const POTIONS = {
  hp_s: { name: "체력 물약 (소)", type: "hp", restoreAmt: 500,  cost: 200     },
  hp_m: { name: "체력 물약 (중)", type: "hp", restoreAmt: 2000, cost: 25000   },
  hp_l: { name: "체력 물약 (대)", type: "hp", restoreAmt: 8000, cost: 1000000 },
  mp_s: { name: "마나 물약 (소)", type: "mp", restoreAmt: 150,  cost: 250     },
  mp_m: { name: "마나 물약 (중)", type: "mp", restoreAmt: 600,  cost: 25000   },
  mp_l: { name: "마나 물약 (대)", type: "mp", restoreAmt: 2500, cost: 1000000 },
};

// 드랍 아이템 소멸 시간(초)
const DROP_EXPIRE_SECONDS = 30;

// 스테이지 / 몬스터 정의
// attackType: "melee" | "ranged"   atkDamageType: "physical" | "magical"
// physDef: 물리방어 / magicDef: 마법방어 (분리 적용)
// aoeAtk / aoeRange / aoeInterval / aoeDamageType : 범위 공격 (해당 필드 있으면 활성화)
const STAGES = [
  { name: "고블린 요새",
    monster: { name: "고블린",       hp: 60,        atk: 5,    physDef: 1,   magicDef: 0,   goldDrop: 55,      expDrop: 44,
               moveSpeed: 60,  attackRange: 55,  aggroRange: 360, attackType: "melee",  atkDamageType: "physical" },
    spawnCount: 4, killsToAdvance: 20 },

  { name: "오크의 숲",
    monster: { name: "오크",         hp: 900,       atk: 20,   physDef: 6,   magicDef: 3,   goldDrop: 200,     expDrop: 160,
               moveSpeed: 35,  attackRange: 60,  aggroRange: 320, attackType: "melee",  atkDamageType: "physical" },
    spawnCount: 5, killsToAdvance: 30 },

  { name: "슬라임 습지",
    isBossStage: true,
    monster: { name: "킹슬라임", type: "kingSlime",
               hp: 5000, atk: 40, physDef: 12, magicDef: 6, goldDrop: 500, expDrop: 400,
               moveSpeed: 25, attackRange: 80, aggroRange: 320, attackType: "melee", atkDamageType: "physical" },
    slimeDef:  { name: "슬라임",    type: "slime",
               hp: 600, atk: 60, physDef: 7, magicDef: 3, goldDrop: 80, expDrop: 60,
               moveSpeed: 40, attackRange: 55, aggroRange: 320, attackType: "melee", atkDamageType: "physical" },
    miniSlimeDef: { name: "미니슬라임", type: "miniSlime",
               hp: 250, atk: 90, physDef: 4, magicDef: 1, goldDrop: 30, expDrop: 20,
               moveSpeed: 55, attackRange: 45, aggroRange: 320, attackType: "melee", atkDamageType: "physical" },
    spawnCount: 1, spawnLayout: [[0.75, 0.5]], killsToAdvance: 5 },

  { name: "사막",
    monster: { name: "모래 골렘",    hp: 3500,      atk: 87,   physDef: 22,  magicDef: 10,  goldDrop: 700,     expDrop: 616,
               moveSpeed: 22,  attackRange: 65,  aggroRange: 300, attackType: "melee",  atkDamageType: "physical",
               pullForce: 35, pullRange: 400 },
    spawnCount: 5, killsToAdvance: 50 },

  { name: "화산",
    monster: { name: "불꽃 도마뱀",  hp: 12000,     atk: 160,  physDef: 42,  magicDef: 20,  goldDrop: 2500,    expDrop: 2300,
               moveSpeed: 50,  attackRange: 60,  aggroRange: 380, attackType: "melee",  atkDamageType: "physical",
               aoeAtk: 120,  aoeRange: 120, aoeInterval: 5.0, aoeDamageType: "physical",
               burnDmg: 20, burnDuration: 5.0, burnTickInterval: 0.2 },
    spawnCount: 6, killsToAdvance: 60 },

  { name: "죽은자의 숲",
    monster: { name: "쿨리좀비",     hp: 50000,     atk: 280,  physDef: 234, magicDef: 32,  goldDrop: 9000,    expDrop: 8280,
               moveSpeed: 55,  attackRange: 65,  aggroRange: 420, attackType: "melee",  atkDamageType: "physical",
               aoeAtk: 200,  aoeRange: 110, aoeInterval: 4.5, aoeDamageType: "physical",
               undead: true },
    spawnCount: 5, killsToAdvance: 70 },

  { name: "지하묘지",
    monster: { name: "네크로맨서",  hp: 160000,    atk: 380,  physDef: 8,   magicDef: 110, goldDrop: 32000,   expDrop: 29900,
               moveSpeed: 40,  attackRange: 270, aggroRange: 460, attackType: "ranged", atkDamageType: "magical",
               projSpeed: 220, projColor: "#8e44ad",
               aoeAtk: 280,  aoeRange: 160, aoeInterval: 6.0, aoeDamageType: "magical",
               summonInterval: 10.0, summonCount: 3 },
    zombieDef: { name: "좀비", type: "zombie",
               hp: 8000, atk: 0, physDef: 0, magicDef: 0, goldDrop: 200, expDrop: 300,
               moveSpeed: 170, attackRange: 55, aggroRange: 9999,
               attackType: "suicide", atkDamageType: "physical",
               suicideDmg: 3750 },
    spawnCount: 4, killsToAdvance: 60 },

  { name: "고대 유적",
    monster: { name: "고대 골렘",    hp: 520000,    atk: 2600, physDef: 160, magicDef: 65,  goldDrop: 110000,  expDrop: 88000,
               moveSpeed: 18,  attackRange: 70,  aggroRange: 340, attackType: "melee",  atkDamageType: "physical",
               monsterAtkInterval: 8.0,
               aoeAtk: 400,  aoeRange: 130, aoeInterval: 5.0, aoeDamageType: "physical" },
    spawnCount: 3, killsToAdvance: 50 },

  { name: "설산",
    monster: { name: "설녀",         hp: 1200000,   atk: 272,  physDef: 60,  magicDef: 180, goldDrop: 380000,  expDrop: 300000,
               moveSpeed: 50,  attackRange: 320, aggroRange: 520, attackType: "ranged", atkDamageType: "magical",
               projSpeed: 260, projColor: "#a8d8f0",
               freezeOnHit: true, freezeDuration: 3.0, freezeImmune: true,
               aoeAtk: 200,  aoeRange: 160, aoeInterval: 5.0, aoeDamageType: "magical" },
    spawnCount: 4, killsToAdvance: 65 },

  { name: "신성 신전",
    monster: { name: "천상의 파수꾼", hp: 5000000,  atk: 1100, physDef: 240, magicDef: 380, goldDrop: 1300000, expDrop: 1050000,
               moveSpeed: 45,  attackRange: 340, aggroRange: 600, attackType: "ranged", atkDamageType: "magical",
               projSpeed: 320, projColor: "#f1c40f",
               aoeAtk: 850,  aoeRange: 200, aoeInterval: 4.0, aoeDamageType: "magical" },
    spawnCount: 3, killsToAdvance: 70 },
];

// 사거리 픽셀 값
const RANGE_PIXELS = {
  melee:        80,
  melee_long:   130,  // 스피어맨 전용
  ranged_short: 200,
  ranged:       300,
  ranged_long:  420,
};

// 캐릭터 추가 비용 (n번째 캐릭터 추가 시)
const charAddCost = (currentCount) => Math.floor(500 * Math.pow(3, currentCount));

// 몬스터 공격 주기 (초)
const MONSTER_ATTACK_INTERVAL = 2.0;

// 방어력 감소 공식: 감소율 = def / (def + DEF_K), 최종 데미지 = atk × DEF_K / (def + DEF_K)
const DEF_K = 200;

// 캐릭터 사망 후 부활 대기 시간 (초)
const CHARACTER_RESPAWN_TIME = 8.0;

// 스킬 레벨 시스템
const SKILL_MAX_LEVEL    = 10;
const SKILL_SP_PER_LEVEL = 5;  // (레거시, 미사용)
// 1차 SP: Lv10~29 매 레벨마다 1개 (최대 20개)
function calcSP1Earned(level) {
  if (level < 10) return 0;
  return Math.min(level, 29) - 10 + 1;
}
// 2차 SP: Lv30 이후 매 레벨마다 1개
function calcSP2Earned(level) {
  return level >= 30 ? level - 30 + 1 : 0;
}
// 스킬 차수 판별 (1=1차, 2=2차)
function getSkillTier(char, skillId) {
  const skill = SKILLS[skillId];
  const cls   = CLASSES[char.classId];
  if (!skill || !cls) return 1;
  if (!cls.parent) return 1;              // 1차 직업: 모두 1차 스킬
  if (skill.classId === cls.parent) return 1;
  if (skill.classId === char.classId)  return 2;
  return 1;
}
// 인덱스 = 목표 레벨(1~10), 값 = 필요 SP
const SKILL_SP_COSTS = [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3];
// 인덱스 = 스킬 레벨(1~10), 값 = 효과 배율 (점점 가속)
const SKILL_LEVEL_MULTS = [0, 1.00, 1.15, 1.32, 1.52, 1.75, 2.02, 2.33, 2.68, 3.08, 3.55];

// 랜덤 닉네임 풀
const NICKNAME_LIST = [
  '아르테', '리온', '세라', '카이', '루나', '제이', '미르', '나라', '다원', '소울',
  '블레이드', '스톰', '에코', '아이스', '파이어', '섀도우', '라이트', '다크', '스타', '문',
  '테라', '드래곤', '피닉스', '타이거', '울프', '이글', '호크', '레이', '크라우', '써니',
  '강호', '민준', '지훈', '동현', '성현', '현우', '태양', '은하', '별빛', '바람',
  '천둥', '번개', '폭풍', '서리', '화염', '독풍', '빛살', '그림자', '혼돈', '질서',
];

// 캐릭터 이동 속도 (픽셀/초)
const CHAR_SPEED = 120;

// 기본 공격 간격 (초)
const ATTACK_INTERVAL = 1.0;

// 몬스터 리스폰 대기 시간 (초)
const MONSTER_RESPAWN_TIME = 3.0;

// 스테이지별 배경 색상
const STAGE_BG = [
  { bg: '#1a3a1a', ground: '#2a5a2a' },  // 초원
  { bg: '#111e0d', ground: '#1a3010' },  // 숲
  { bg: '#1a1a1a', ground: '#2a2a2a' },  // 동굴
  { bg: '#2a1e0a', ground: '#3a2e1a' },  // 사막
  { bg: '#1a0808', ground: '#2a1010' },  // 화산
  { bg: '#0c0818', ground: '#1a1028' },  // 심층 던전
  { bg: '#180606', ground: '#2c0e0e' },  // 마법사 탑
  { bg: '#061414', ground: '#0e2424' },  // 고대 유적
  { bg: '#0a1828', ground: '#102030' },  // 설산
  { bg: '#141208', ground: '#26220c' },  // 신성 신전
];

// 직업별 Canvas 색상
const CLASS_COLORS = {
  // 0차
  novice:    '#3498db',
  // 1차
  warrior:   '#e74c3c',
  mage:      '#9b59b6',
  archer:    '#27ae60',
  rogue:     '#95a5a6',
  // 2차 — 전사 계열
  fighter:   '#c0392b',
  page:      '#e74c3c',
  spearman:  '#d35400',
  knight:    '#3498db',
  // 2차 — 마법사 계열
  wizard_tl: '#1abc9c',
  wizard_fp: '#e67e22',
  cleric:    '#f1c40f',
  // 2차 — 도적 계열
  assassin:  '#2c3e50',
  thief:     '#8e44ad',
  // 2차 — 궁수 계열
  hunter:    '#27ae60',
  marksman:  '#229954',
};

// 몬스터 스폰 위치 비율 배열 (Canvas 280~600 x, 80~400 y 기준)
const SPAWN_LAYOUTS = {
  1: [[0.5,  0.5 ]],
  2: [[0.25, 0.5 ], [0.75, 0.5 ]],
  3: [[0.2,  0.25], [0.8,  0.25], [0.5, 0.8]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.2,  0.2 ], [0.8,  0.2 ], [0.5,  0.5 ], [0.2,  0.8 ], [0.8, 0.8]],
  6: [[0.17, 0.2 ], [0.5,  0.2 ], [0.83, 0.2 ], [0.17, 0.8 ], [0.5, 0.8], [0.83, 0.8]],
};
