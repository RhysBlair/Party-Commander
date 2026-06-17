// 게임 전체 상태 객체
const gameState = {
  version: 1,
  lastTick: Date.now(),

  gold: 0,
  gems: 0,

  potionStock: {},   // { hp_s: 0, hp_m: 0, ... } 전역 물약 재고

  characters: [],
  equipmentInventory: [],  // [{ id, uid, enhance }, ...]
  unlockedSkills: [],

  nextItemUid: 1,          // 아이템 인스턴스 고유 ID 카운터
  maxStageReached: 0,
  drops: [],
  upgrades: {},            // { upgradeId: level }
  crystals: { dim: 0, bright: 0, radiant: 0 },  // 분해 결정
  floatingTexts: [],       // 런타임 전용 — 저장 제외
  projectiles:   [],       // 런타임 전용 — 저장 제외
  poisonFields:  [],       // 런타임 전용 — 저장 제외
  meteors:       [],       // 런타임 전용 — 저장 제외

  // 런타임 전용 (저장 제외)
  viewStage: 0,
  stageFields: [],
  raidField: null,
  viewRaid: false,
};

// 새 캐릭터 생성 (모험가)
function createCharacter(assignedStage = 0) {
  return {
    id: Date.now(),
    nickname: NICKNAME_LIST[Math.floor(Math.random() * NICKNAME_LIST.length)],
    classId: 'novice',
    level: 1,
    exp: 0,
    stats: { STR: 5, DEX: 5, INT: 5, LUK: 5 },
    unspentPoints: 0,
    autoAssign: true,
    equipment: { weapon: { id: 'beginner_sword', uid: 0, enhance: 0 }, armor: null, accessory: null, throwable: null, weapon2: null },
    skills: [],
    skillLevels: {},
    skillPoints: 0,
    pet: null,
    assignedStage,
    selectedHpPotion: 'hp_s',              // 사용할 HP 물약 타입
    selectedMpPotion: 'mp_s',              // 사용할 MP 물약 타입
    equippedHpPotion: { id: 'hp_s', count: 0 },  // 현재 장착된 HP 물약 (자동 관리)
    equippedMpPotion: { id: 'mp_s', count: 0 },  // 현재 장착된 MP 물약 (자동 관리)
    // 런타임 필드 상태 (저장 제외)
    x: 80, y: 240, attackTimer: 0, attackAnim: 0, facing: 1,
  };
}

// 스폰 영역 (Canvas 640×480 기준)
const SPAWN_AREA = { x1: 280, x2: 600, y1: 80, y2: 400 };

// 캐릭터 시작 위치 — 한 필드에 최대 6명 배치
const CHAR_START_POS = [
  { x: 80, y: 240 },
  { x: 80, y: 150 },
  { x: 80, y: 330 },
  { x: 60, y: 195 },
  { x: 60, y: 285 },
  { x: 100, y: 240 },
];

// 특정 스테이지의 필드를 (재)초기화
function initStageField(stageIdx) {
  const stage = STAGES[stageIdx];
  if (!stage) return;
  const layout = stage.spawnLayout || SPAWN_LAYOUTS[stage.spawnCount] || SPAWN_LAYOUTS[4];
  const w = SPAWN_AREA.x2 - SPAWN_AREA.x1;
  const h = SPAWN_AREA.y2 - SPAWN_AREA.y1;

  gameState.stageFields[stageIdx] = {
    monsters: layout.map(([rx, ry], id) => ({
      id,
      spawnX: SPAWN_AREA.x1 + rx * w,
      spawnY: SPAWN_AREA.y1 + ry * h,
      x:      SPAWN_AREA.x1 + rx * w,
      y:      SPAWN_AREA.y1 + ry * h,
      currentHp: stage.monster.hp,
      maxHp:     stage.monster.hp,
      alive: true,
      respawnTimer: 0,
      hitAnim: 0,
      attackTimer: Math.random() * (stage.monster.monsterAtkInterval || MONSTER_ATTACK_INTERVAL),
      def: stage.monster,
    })),
    kills: 0,
  };
}

// 캐릭터의 배치 위치를 해당 필드 내 순서에 맞게 리셋
function resetCharPos(char) {
  const siblings = gameState.characters.filter(c => c.assignedStage === char.assignedStage);
  const idx = siblings.indexOf(char);
  const pos = CHAR_START_POS[idx % CHAR_START_POS.length];
  char.x = pos.x;
  char.y = pos.y;
  char.attackTimer = 0;
  char.attackAnim  = 0;
  char.facing      = 1;
}

// 게임 시작 시 전체 필드 초기화 (캐릭터 배치 + 뷰 스테이지 기준)
function initField() {
  const needed = new Set(gameState.characters.map(c => c.assignedStage));
  needed.add(gameState.viewStage);

  for (const idx of needed) {
    if (STAGES[idx]) initStageField(idx);
  }

  // 캐릭터 위치 초기화 (스테이지별 순서대로)
  const byStage = {};
  for (const char of gameState.characters) {
    const s = char.assignedStage;
    if (!byStage[s]) byStage[s] = [];
    byStage[s].push(char);
  }
  for (const chars of Object.values(byStage)) {
    chars.forEach((char, i) => {
      const pos = CHAR_START_POS[i % CHAR_START_POS.length];
      char.x = pos.x; char.y = pos.y;
      char.attackTimer = 0; char.attackAnim = 0; char.facing = 1;
    });
  }
}

// 캐릭터를 다른 스테이지에 배치 (UI에서 호출)
// 이미 배정된 스테이지 재클릭 시 배정 해제 (assignedStage = -1)
function assignCharToStage(charId, stageIdx) {
  if (stageIdx < 0 || stageIdx > gameState.maxStageReached) return;
  const char = gameState.characters.find(c => c.id === charId);
  if (!char) return;

  // 재클릭 → 배정 해제
  if (char.assignedStage === stageIdx) {
    char.assignedStage = -1;
    return;
  }

  // 스테이지당 최대 6명 제한
  const inTarget = gameState.characters.filter(c => c.assignedStage === stageIdx).length;
  if (inTarget >= 6) return;

  char.assignedStage = stageIdx;
  if (!gameState.stageFields[stageIdx]) initStageField(stageIdx);
  resetCharPos(char);
}

// 스테이지 클리어 → 해당 필드에 배치된 캐릭터들을 다음 스테이지로 자동 이동
function advanceStageField(stageIdx) {
  const next = stageIdx + 1;
  const field = gameState.stageFields[stageIdx];

  if (next >= STAGES.length) {
    if (next > gameState.maxStageReached) gameState.maxStageReached = next;
    if (field) field.kills = 0;
    return;
  }

  if (next > gameState.maxStageReached) gameState.maxStageReached = next;

  // 해당 스테이지에 배치된 캐릭터들 다음 스테이지로 이동
  const toMove = gameState.characters.filter(c => c.assignedStage === stageIdx);
  for (const char of toMove) char.assignedStage = next;

  if (!gameState.stageFields[next]) initStageField(next);

  // 이동한 캐릭터들 위치 리셋
  toMove.forEach((char, i) => {
    const pos = CHAR_START_POS[i % CHAR_START_POS.length];
    char.x = pos.x; char.y = pos.y;
    char.attackTimer = 0; char.attackAnim = 0; char.facing = 1;
  });

  // 뷰도 따라 이동
  if (gameState.viewStage === stageIdx) gameState.viewStage = next;

  // 이전 필드 리셋 (파밍용으로 유지)
  if (field) { field.kills = 0; initStageField(stageIdx); }
}

// 뷰 스테이지 변경 — 캐릭터 배치는 변경하지 않음
function goToStage(index) {
  if (index < 0 || index > gameState.maxStageReached) return;
  gameState.viewStage = index;
  if (!gameState.stageFields[index]) initStageField(index);
}

// 직업별 장비 슬롯 목록 반환
// 시프:           weapon(무기1) + weapon2(무기2)
// 도적/어쌔신:    weapon(무기 or 아대) + throwable(표창)
//   └ weapon에 아대(isAedae) 착용 시에만 표창 공격력이 대미지에 반영 (sumEquipStat에서 처리)
// 기타: weapon
function getCharSlotList(char) {
  if (char.classId === 'thief') {
    return ['weapon', 'weapon2', 'armor', 'accessory'];
  }
  const baseClass = CLASSES[char.classId]?.parent || char.classId;
  if (char.classId === 'rogue' || baseClass === 'rogue') {
    return ['weapon', 'throwable', 'armor', 'accessory'];
  }
  return ['weapon', 'armor', 'accessory'];
}

const SAVE_KEY = 'party_commander_save';

// 런타임 전용 캐릭터 필드 (저장 제외)
const RUNTIME_CHAR_KEYS = ['x', 'y', 'attackTimer', 'attackAnim', 'facing', 'skillTimers', 'skillAnim', 'petX', 'petY', 'magnetTimer', 'shadowActive', 'shadowTimer', 'shadowX', 'shadowY', 'orbCount', 'orbReady', 'currentHp', 'maxHpCache', 'currentMp', 'maxMpCache', 'potionHpCd', 'potionMpCd', 'hpRefillTimer', 'mpRefillTimer', 'hitAnim', 'isDead', 'respawnTimer', 'quickHitTimer', 'quickHitCount', 'quickHitDmgMult', 'quickHitDelay', 'activeBuffs', 'inRaid', 'raidAccDown', 'raidSkillSeal', 'poisonMoveTarget', 'petHealTimer', 'petShieldTimer', 'petShieldActive', 'burned', 'burnTimer', 'burnDmg', 'burnTickTimer', 'frozen', 'frozenTimer', 'meteorCasting', 'meteorCastTimer', 'meteorTargetX', 'meteorTargetY', 'charging'];

function saveGame() {
  const chars = gameState.characters.map(c => {
    const s = { ...c };
    RUNTIME_CHAR_KEYS.forEach(k => delete s[k]);
    return s;
  });
  const { stageFields, viewStage, raidField, viewRaid, drops, floatingTexts, projectiles, poisonFields, meteors, ...rest } = gameState;
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...rest, characters: chars, lastTick: Date.now() }));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    Object.assign(gameState, saved);

    // 구형 세이브 호환: currentStage → assignedStage
    const legacyStage = saved.currentStage ?? 0;
    for (const char of gameState.characters) {
      if (char.assignedStage === undefined) char.assignedStage = legacyStage;
      // 장비 슬롯: string → object
      for (const slot of ['weapon', 'armor', 'accessory']) {
        const val = char.equipment?.[slot];
        if (typeof val === 'string') {
          char.equipment[slot] = { id: val, uid: gameState.nextItemUid++, enhance: 0 };
        }
      }
      if (!char.equipment) {
        char.equipment = { weapon: { id: 'beginner_sword', uid: 0, enhance: 0 }, armor: null, accessory: null, throwable: null, weapon2: null };
      } else {
        if (char.equipment.throwable === undefined) char.equipment.throwable = null;
        if (char.equipment.weapon2   === undefined) char.equipment.weapon2   = null;
        // 구형 subweapon 슬롯 → 인벤토리로 이관
        if (char.equipment.subweapon) {
          gameState.equipmentInventory.push(char.equipment.subweapon);
          char.equipment.subweapon = undefined;
          delete char.equipment.subweapon;
        } else {
          delete char.equipment.subweapon;
        }
      }
    }
    // 인벤토리: string → object
    gameState.equipmentInventory = (gameState.equipmentInventory || []).map(item => {
      if (typeof item === 'string') return { id: item, uid: gameState.nextItemUid++, enhance: 0 };
      return item;
    });
    if (!gameState.nextItemUid) gameState.nextItemUid = 100;

    // 구형 세이브 호환: 전역 pets[] → 첫 캐릭터 pet 필드로 마이그레이션
    if (saved.pets && saved.pets.length > 0) {
      const bestPet = saved.pets.includes('pet_magnet') ? 'pet_magnet' : 'pet_basic';
      if (gameState.characters.length > 0 && !gameState.characters[0].pet) {
        gameState.characters[0].pet = bestPet;
      }
    }
    // pet 필드 없는 구형 캐릭터 초기화
    for (const char of gameState.characters) {
      if (char.pet === undefined) char.pet = null;
      // rogue_throw → shadow_partner 마이그레이션
      const rtIdx = (char.skills || []).indexOf('rogue_throw');
      if (rtIdx !== -1) char.skills[rtIdx] = 'shadow_partner';
      // warrior_strike → orb_strike 마이그레이션
      const wsIdx = (char.skills || []).indexOf('warrior_strike');
      if (wsIdx !== -1) char.skills[wsIdx] = 'orb_strike';
      // skillLevels / skillPoints 구형 세이브 호환
      if (!char.skillLevels) {
        char.skillLevels = {};
        for (const id of (char.skills || [])) char.skillLevels[id] = 1;
      }
      if (char.skillPoints === undefined)
        char.skillPoints = Math.floor((char.level - 1) / SKILL_SP_PER_LEVEL);
      if (!char.nickname)
        char.nickname = NICKNAME_LIST[Math.floor(Math.random() * NICKNAME_LIST.length)];
      // 물약 시스템 마이그레이션
      if (!char.selectedHpPotion) char.selectedHpPotion = 'hp_s';
      if (!char.selectedMpPotion) char.selectedMpPotion = 'mp_s';
      if (!char.equippedHpPotion || !char.equippedHpPotion.id)
        char.equippedHpPotion = { id: char.selectedHpPotion, count: 0 };
      if (!char.equippedMpPotion || !char.equippedMpPotion.id)
        char.equippedMpPotion = { id: char.selectedMpPotion, count: 0 };
    }
    if (!gameState.potionStock) gameState.potionStock = {};
    if (!gameState.poisonFields) gameState.poisonFields = [];

    // 구형 세이브: upgrades 필드 없으면 초기화
    if (!gameState.upgrades) gameState.upgrades = {};
    if (!gameState.crystals) gameState.crystals = { dim: 0, bright: 0, radiant: 0 };

    // 구형 펫 ID(pet_basic, pet_magnet 등) 제거 + ownedPets 마이그레이션
    for (const char of gameState.characters) {
      if (char.pet && !PETS[char.pet]) char.pet = null;
      if (!char.ownedPets) char.ownedPets = [];
      // 현재 장착 중인 펫이 ownedPets에 없으면 추가 (구형 세이브 호환)
      if (char.pet && !char.ownedPets.includes(char.pet)) char.ownedPets.push(char.pet);
    }

    gameState.viewStage = legacyStage;

    return true;
  } catch {
    return false;
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
}
