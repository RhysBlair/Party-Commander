// 드랍 & 펫 모듈

const DROP_CHANCE        = 0.15;  // 몬스터 처치 시 드랍 확률
const PET_SPEED          = 180;   // 기본 펫 이동 속도 (px/s)
const PET_PICKUP_RADIUS  = 16;    // 기본 펫 수집 판정 반경 (px)
const MAGNET_INTERVAL    = 0.4;   // 자석 펫 흡수 주기 (s)

let magnetTimer  = 0;
let nextDropUid  = 1;

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

// stageField에 펫 초기 위치 설정 (없을 때만)
function ensurePetPos(field, leader) {
  if (field.petX === undefined) {
    field.petX = leader.x - leader.facing * 25;
    field.petY = leader.y + 10;
  }
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
        if (dx * dx + dy * dy < 60 * 60) pickupDrop(i);
      }
    }
    return;
  }

  // 활성 펫 (범위 가장 넓은 것)
  let activePetId = gameState.pets[0];
  for (const pid of gameState.pets) {
    if (PETS[pid].pickupRange > PETS[activePetId].pickupRange) activePetId = pid;
  }
  const isMagnet = activePetId === 'pet_magnet';

  if (isMagnet) {
    // ── 자석 펫: 주기마다 전체 필드 드랍 즉시 흡수 ────────────
    magnetTimer -= dt;
    if (magnetTimer <= 0) {
      magnetTimer = MAGNET_INTERVAL;
      for (let i = gameState.drops.length - 1; i >= 0; i--) {
        const d = gameState.drops[i];
        const charsHere = gameState.characters.filter(c => c.assignedStage === d.stageIdx);
        if (charsHere.length) pickupDrop(i);
      }
    }
    return;
  }

  // ── 기본 펫: 스테이지마다 드랍을 향해 직접 이동하여 수집 ───
  for (let si = 0; si < gameState.stageFields.length; si++) {
    const field = gameState.stageFields[si];
    if (!field) continue;
    const charsHere = gameState.characters.filter(c => c.assignedStage === si);
    if (!charsHere.length) continue;

    const leader = charsHere[0];
    ensurePetPos(field, leader);

    // 이 필드에서 가장 가까운 드랍 찾기
    let targetDrop = null, minDist2 = Infinity;
    for (const d of gameState.drops) {
      if (d.stageIdx !== si) continue;
      const dx = d.x - field.petX, dy = d.y - field.petY;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist2) { minDist2 = d2; targetDrop = d; }
    }

    if (targetDrop) {
      // 드랍 향해 이동
      const dx   = targetDrop.x - field.petX;
      const dy   = targetDrop.y - field.petY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PET_PICKUP_RADIUS) {
        const idx = gameState.drops.findIndex(d => d.uid === targetDrop.uid);
        if (idx !== -1) pickupDrop(idx);
      } else {
        const step = PET_SPEED * dt;
        field.petX += (dx / dist) * step;
        field.petY += (dy / dist) * step;
      }
    } else {
      // 드랍 없으면 리더 캐릭터 뒤를 따라다님
      const tx   = leader.x - leader.facing * 25;
      const ty   = leader.y + 10;
      const dx   = tx - field.petX;
      const dy   = ty - field.petY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 8) {
        const step = PET_SPEED * dt;
        field.petX += (dx / dist) * Math.min(step, dist);
        field.petY += (dy / dist) * Math.min(step, dist);
      }
    }
  }
}
