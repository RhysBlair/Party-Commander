// 드랍 & 펫 모듈

const DROP_CHANCE        = 0.15;   // 몬스터 처치 시 드랍 확률
const DROP_PICKUP_RADIUS = 60;     // 캐릭터 수동 수집 반경 (px)

let petPickupTimer = 0;
let nextDropUid    = 1;

// 등급별 가중치 드랍 풀 (첫 호출 시 생성)
let _dropPool = null;
function getDropPool() {
  if (_dropPool) return _dropPool;
  _dropPool = [];
  for (const [id, e] of Object.entries(EQUIPMENT)) {
    if (id === 'beginner_sword') continue;
    const w = e.grade === '노멀' ? 70 : e.grade === '레어' ? 25 : 5;
    for (let i = 0; i < w; i++) _dropPool.push(id);
  }
  return _dropPool;
}

// 몬스터 사망 시 combat.js에서 호출
function generateDrop(stageIdx, x, y) {
  if (Math.random() >= DROP_CHANCE) return;
  const pool = getDropPool();
  if (!pool.length) return;
  const equipId = pool[Math.floor(Math.random() * pool.length)];
  gameState.drops.push({
    uid:     nextDropUid++,
    stageIdx,
    x:       x + (Math.random() - 0.5) * 50,
    y:       y + (Math.random() - 0.5) * 40,
    equipId,
    timer:   DROP_EXPIRE_SECONDS,
  });
}

function pickupDrop(idx) {
  const drop = gameState.drops[idx];
  if (!drop) return;
  gameState.equipmentInventory.push({ id: drop.equipId, uid: gameState.nextItemUid++, enhance: 0 });
  gameState.drops.splice(idx, 1);
}

function updateLoot(dt) {
  // 1. 만료 타이머 처리
  for (let i = gameState.drops.length - 1; i >= 0; i--) {
    gameState.drops[i].timer -= dt;
    if (gameState.drops[i].timer <= 0) gameState.drops.splice(i, 1);
  }

  // 2. 펫 없을 때: 캐릭터가 드랍에 근접하면 수집
  if (gameState.pets.length === 0) {
    for (const char of gameState.characters) {
      for (let i = gameState.drops.length - 1; i >= 0; i--) {
        const d = gameState.drops[i];
        if (d.stageIdx !== char.assignedStage) continue;
        const dx = d.x - char.x, dy = d.y - char.y;
        if (dx * dx + dy * dy < DROP_PICKUP_RADIUS * DROP_PICKUP_RADIUS) pickupDrop(i);
      }
    }
    return;
  }

  // 3. 펫 자동 수집 (보유 펫 중 범위 가장 넓은 것 적용)
  let bestId = gameState.pets[0];
  for (const pid of gameState.pets) {
    if (PETS[pid].pickupRange > PETS[bestId].pickupRange) bestId = pid;
  }
  const petDef = PETS[bestId];

  petPickupTimer -= dt;
  if (petPickupTimer > 0) return;
  petPickupTimer = petDef.pickupInterval;

  for (let i = gameState.drops.length - 1; i >= 0; i--) {
    const d = gameState.drops[i];
    const charsHere = gameState.characters.filter(c => c.assignedStage === d.stageIdx);
    if (!charsHere.length) continue;
    let minDist = Infinity;
    for (const c of charsHere) {
      const dx = d.x - c.x, dy = d.y - c.y;
      minDist = Math.min(minDist, Math.sqrt(dx * dx + dy * dy));
    }
    if (minDist < petDef.pickupRange) pickupDrop(i);
  }
}
