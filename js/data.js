// 직업 정의
const CLASSES = {
  novice:  { name: "모험가", primary: null, secondary: null, range: "melee",
             weaponLock: "beginner_sword", canSkill: false },
  warrior: { name: "전사",   primary: "STR", secondary: "DEX", range: "melee",        canSkill: true },
  archer:  { name: "궁수",   primary: "DEX", secondary: "STR", range: "ranged_long",  canSkill: true },
  mage:    { name: "마법사", primary: "INT", secondary: "LUK", range: "ranged",       canSkill: true },
  rogue:   { name: "도적",   primary: "LUK", secondary: "DEX", range: "ranged_short", canSkill: true },
};

// 전직 가능 레벨
const JOB_ADVANCE_LEVEL = 10;

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

// 장비 정의
const EQUIPMENT = {
  // ── 스타터 ──────────────────────────────────────────────
  beginner_sword:  { name: "초보자의 검",   type: "weapon",    grade: "노멀", atk: 3,                       req: {},                              cost: 0    },

  // ── 무기 (공용) ─────────────────────────────────────────
  iron_sword:      { name: "철검",           type: "weapon",    grade: "노멀", atk: 8,                       req: { level: 5 },                    cost: 200  },
  steel_sword:     { name: "강철검",         type: "weapon",    grade: "노멀", atk: 16,                      req: { level: 10 },                   cost: 600  },

  // ── 무기 (직업 전용) ────────────────────────────────────
  knight_sword:    { name: "기사검",         type: "weapon",    grade: "레어", atk: 28,                      req: { level: 15, classId: "warrior" }, cost: 1500 },
  long_bow:        { name: "장궁",           type: "weapon",    grade: "노멀", atk: 12,                      req: { level: 5,  classId: "archer"  }, cost: 280  },
  compound_bow:    { name: "복합궁",         type: "weapon",    grade: "레어", atk: 22,                      req: { level: 10, classId: "archer"  }, cost: 750  },
  magic_staff:     { name: "마법 지팡이",    type: "weapon",    grade: "노멀", atk: 5,  bonusINT: 5,         req: { level: 5,  classId: "mage"    }, cost: 280  },
  great_staff:     { name: "대마법 지팡이",  type: "weapon",    grade: "레어", atk: 8,  bonusINT: 10,        req: { level: 10, classId: "mage"    }, cost: 750  },
  dagger:          { name: "단검",           type: "weapon",    grade: "노멀", atk: 11,                      req: { level: 5,  classId: "rogue"   }, cost: 260  },
  shadow_blade:    { name: "그림자 검",      type: "weapon",    grade: "레어", atk: 20,                      req: { level: 10, classId: "rogue"   }, cost: 720  },

  // ── 방어구 ──────────────────────────────────────────────
  leather_armor:   { name: "가죽 갑옷",      type: "armor",     grade: "노멀", physDef: 5,                   req: { level: 5 },                    cost: 200  },
  chain_mail:      { name: "사슬 갑옷",      type: "armor",     grade: "노멀", physDef: 12,                  req: { level: 10 },                   cost: 600  },
  plate_armor:     { name: "판금 갑옷",      type: "armor",     grade: "레어", physDef: 22,                  req: { level: 15, classId: "warrior" }, cost: 1500 },
  mage_robe:       { name: "마법사 로브",    type: "armor",     grade: "노멀", magicDef: 10, bonusINT: 3,    req: { level: 5,  classId: "mage"    }, cost: 250  },

  // ── 장신구 ──────────────────────────────────────────────
  lucky_ring:      { name: "행운의 반지",    type: "accessory", grade: "노멀", bonusLUK: 5,                  req: { level: 5 },                    cost: 300  },
  str_ring:        { name: "힘의 반지",      type: "accessory", grade: "노멀", bonusSTR: 5,                  req: { level: 5 },                    cost: 300  },
  dex_bracelet:    { name: "민첩의 팔찌",    type: "accessory", grade: "레어", bonusDEX: 8,                  req: { level: 10 },                   cost: 700  },
  int_necklace:    { name: "지성의 목걸이",  type: "accessory", grade: "레어", bonusINT: 8,                  req: { level: 10 },                   cost: 700  },
};

const GRADE_COLORS = { "노멀": "#aaa", "레어": "#5b9bd5", "에픽": "#9b59b6", "유니크": "#e2b96f" };

// 스킬 정의
const SKILLS = {
  warrior_strike: { name: "강타",      classId: "warrior", cooldown: 4.0,
                    targeting: "single_melee",  dmgMultiplier: 2.8, cost: 500 },
  mage_blast:     { name: "마력 폭발", classId: "mage",    cooldown: 4.0,
                    targeting: "aoe",           maxTargets: 5, dmgMultiplier: 1.2, cost: 500 },
  archer_shot:    { name: "강사격",    classId: "archer",  cooldown: 4.0,
                    targeting: "single_long",   dmgMultiplier: 2.0, cost: 500 },
  rogue_throw:    { name: "표창 투척", classId: "rogue",   cooldown: 4.0,
                    targeting: "double_hit",    hits: 2, dmgMultiplier: 1.5, cost: 500 },
};

// 펫 정의
const PETS = {
  pet_basic:  { name: "기본 펫",  pickupRange: 120,  pickupInterval: 1.0, cost: 1000 },
  pet_magnet: { name: "자석 펫", pickupRange: 9999, pickupInterval: 0.5, cost: 5000 },
};

// 드랍 아이템 소멸 시간(초)
const DROP_EXPIRE_SECONDS = 30;

// 스테이지 / 몬스터 정의
const STAGES = [
  { name: "초원",   monster: { name: "슬라임",    hp: 50,  atk: 4,  def: 1, goldDrop: 10, expDrop: 8  }, spawnCount: 4, killsToAdvance: 20 },
  { name: "숲",     monster: { name: "고블린",    hp: 120, atk: 8,  def: 2, goldDrop: 22, expDrop: 18 }, spawnCount: 4, killsToAdvance: 30 },
  { name: "동굴",   monster: { name: "오크",      hp: 280, atk: 15, def: 5, goldDrop: 50, expDrop: 40 }, spawnCount: 5, killsToAdvance: 40 },
  { name: "사막",   monster: { name: "모래 골렘", hp: 600, atk: 25, def: 10, goldDrop: 110, expDrop: 90 }, spawnCount: 5, killsToAdvance: 50 },
  { name: "화산",   monster: { name: "불꽃 도마뱀", hp: 1200, atk: 40, def: 18, goldDrop: 240, expDrop: 200 }, spawnCount: 6, killsToAdvance: 60 },
];

// 사거리 픽셀 값
const RANGE_PIXELS = {
  melee:        80,
  ranged_short: 200,
  ranged:       300,
  ranged_long:  420,
};

// 캐릭터 추가 비용 (n번째 캐릭터 추가 시)
const charAddCost = (currentCount) => Math.floor(500 * Math.pow(3, currentCount));

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
];

// 직업별 Canvas 색상
const CLASS_COLORS = {
  novice:  '#3498db',
  warrior: '#e74c3c',
  mage:    '#9b59b6',
  archer:  '#27ae60',
  rogue:   '#95a5a6',
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
