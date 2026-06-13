// 게임 전체 상태 객체
const gameState = {
  version: 1,
  lastTick: Date.now(),

  gold: 0,
  gems: 0,

  characters: [],
  equipmentInventory: [],
  pets: [],
  unlockedSkills: [],

  currentStage: 0,
  stageKills: 0,
  maxStageReached: 0,

  drops: [],
  fieldMonsters: [],  // 런타임 전용 — 저장 제외
};

// 새 캐릭터 생성 (모험가)
function createCharacter() {
  return {
    id: Date.now(),
    classId: 'novice',
    level: 1,
    exp: 0,
    stats: { STR: 5, DEX: 5, INT: 5, LUK: 5 },
    unspentPoints: 0,
    autoAssign: true,
    equipment: { weapon: 'beginner_sword', armor: null, accessory: null },
    skills: [],
    // 런타임 필드 상태 (저장 제외)
    x: 80, y: 240, attackTimer: 0, attackAnim: 0, facing: 1,
  };
}

// 캐릭터 시작 위치 목록
const CHAR_START_POS = [
  { x: 80, y: 240 },
  { x: 80, y: 150 },
  { x: 80, y: 330 },
  { x: 60, y: 240 },
];

// 스폰 영역 (Canvas 640×480 기준)
const SPAWN_AREA = { x1: 280, x2: 600, y1: 80, y2: 400 };

// 스테이지 몬스터 초기화 + 캐릭터 위치 리셋
function initField() {
  const stage = STAGES[gameState.currentStage];
  const layout = SPAWN_LAYOUTS[stage.spawnCount] || SPAWN_LAYOUTS[4];
  const w = SPAWN_AREA.x2 - SPAWN_AREA.x1;
  const h = SPAWN_AREA.y2 - SPAWN_AREA.y1;

  gameState.fieldMonsters = layout.map(([rx, ry], i) => ({
    id: i,
    spawnX: SPAWN_AREA.x1 + rx * w,
    spawnY: SPAWN_AREA.y1 + ry * h,
    x:      SPAWN_AREA.x1 + rx * w,
    y:      SPAWN_AREA.y1 + ry * h,
    currentHp: stage.monster.hp,
    maxHp:     stage.monster.hp,
    alive: true,
    respawnTimer: 0,
    hitAnim: 0,
  }));

  // 캐릭터 위치 리셋
  gameState.characters.forEach((char, i) => {
    const pos = CHAR_START_POS[i] || CHAR_START_POS[0];
    char.x = pos.x;
    char.y = pos.y;
    char.attackTimer = 0;
    char.attackAnim = 0;
    char.facing = 1;
  });
}

const SAVE_KEY = 'party_commander_save';

// 런타임 필드만 제외하고 직렬화
const RUNTIME_CHAR_KEYS = ['x', 'y', 'attackTimer', 'attackAnim', 'facing'];

function saveGame() {
  const chars = gameState.characters.map(c => {
    const s = { ...c };
    RUNTIME_CHAR_KEYS.forEach(k => delete s[k]);
    return s;
  });
  const { fieldMonsters, drops, ...rest } = gameState;
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...rest, characters: chars, lastTick: Date.now() }));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    Object.assign(gameState, saved);
    return true;
  } catch {
    return false;
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
}
