// 드랍 & 펫 모듈

const DROP_CHANCE        = 0.15;  // 몬스터 처치 시 드랍 확률
const PET_SPEED          = 180;   // 기본 펫 이동 속도 (px/s)
const PET_PICKUP_RADIUS  = 16;    // 기본 펫 수집 판정 반경 (px)
const MAGNET_INTERVAL    = 0.4;   // 자석 펫 흡수 주기 (s)

let nextDropUid = 1;

// 스테이지별 드랍 풀 캐시 (첫 호출 시 생성)
const _dropPools = {};
function getDropPool(stageIdx) {
  if (_dropPools[stageIdx]) return _dropPools[stageIdx];
  const pool = [];
  for (const [id, e] of Object.entries(EQUIPMENT)) {
    if ((e.minDropStage ?? 99) > stageIdx) continue;
    const w = e.grade === '노멀' ? 70 : e.grade === '레어' ? 25 : 5;
    for (let i = 0; i < w; i++) pool.push(id);
  }
  return (_dropPools[stageIdx] = pool);
}

// 몬스터 사망 시 combat.js에서 호출
function generateDrop(stageIdx, x, y) {
  if (Math.random() >= DROP_CHANCE) return;
  const pool = getDropPool(stageIdx);
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

  // 2. 캐릭터별 드랍 수집 (각자 자신의 펫으로 독립 처리)
  for (const char of gameState.characters) {
    if (!char.pet) {
      // 펫 없음: 캐릭터 근접 시 수집
      for (let i = gameState.drops.length - 1; i >= 0; i--) {
        const d = gameState.drops[i];
        if (d.stageIdx !== char.assignedStage) continue;
        const dx = d.x - char.x, dy = d.y - char.y;
        if (dx * dx + dy * dy < 60 * 60) pickupDrop(i);
      }
    } else if (char.pet === 'pet_magnet') {
      // 자석 펫: 주기마다 이 캐릭터 스테이지의 드랍 즉시 흡수
      if (!char.magnetTimer) char.magnetTimer = 0;
      char.magnetTimer -= dt;
      if (char.magnetTimer <= 0) {
        char.magnetTimer = MAGNET_INTERVAL;
        for (let i = gameState.drops.length - 1; i >= 0; i--) {
          if (gameState.drops[i].stageIdx === char.assignedStage) pickupDrop(i);
        }
      }
    } else {
      // 기본 펫: 드랍을 향해 직접 이동하여 수집
      if (char.petX === undefined) {
        char.petX = char.x - char.facing * 25;
        char.petY = char.y + 10;
      }

      let targetDrop = null, minDist2 = Infinity;
      for (const d of gameState.drops) {
        if (d.stageIdx !== char.assignedStage) continue;
        const dx = d.x - char.petX, dy = d.y - char.petY;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDist2) { minDist2 = d2; targetDrop = d; }
      }

      if (targetDrop) {
        const dx   = targetDrop.x - char.petX;
        const dy   = targetDrop.y - char.petY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PET_PICKUP_RADIUS) {
          const idx = gameState.drops.findIndex(d => d.uid === targetDrop.uid);
          if (idx !== -1) pickupDrop(idx);
        } else {
          const step = PET_SPEED * dt;
          char.petX += (dx / dist) * step;
          char.petY += (dy / dist) * step;
        }
      } else {
        // 드랍 없으면 이 캐릭터 뒤를 따라다님
        const tx   = char.x - char.facing * 25;
        const ty   = char.y + 10;
        const dx   = tx - char.petX;
        const dy   = ty - char.petY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 8) {
          const step = PET_SPEED * dt;
          char.petX += (dx / dist) * Math.min(step, dist);
          char.petY += (dy / dist) * Math.min(step, dist);
        }
      }
    }
  }
}
