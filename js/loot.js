// 드랍 & 펫 모듈

const DROP_CHANCE        = 0.15;  // 몬스터 처치 시 드랍 확률
const PET_SPEED          = 180;   // 기본 펫 이동 속도 (px/s)
const PET_PICKUP_RADIUS  = 16;    // 기본 펫 수집 판정 반경 (px)
const MAGNET_INTERVAL    = 0.4;   // 자석 펫 흡수 주기 (s)
const SLIME_PET_SPEED    = 220;   // 미니슬라임 이동 속도 (px/s)
const SLIME_PICKUP_DIST  = 14;    // 미니슬라임 아이템 수집 판정 거리 (px)

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

  // 2. 캐릭터별 드랍 수집
  for (const char of gameState.characters) {
    if (char.isDead || char.assignedStage < 0) continue;

    if (!char.pet) {
      // 펫 없음: 22px 밀착 시 수집 (combat.js가 이동 담당)
      for (let i = gameState.drops.length - 1; i >= 0; i--) {
        const d = gameState.drops[i];
        if (d.stageIdx !== char.assignedStage) continue;
        const dx = d.x - char.x, dy = d.y - char.y;
        if (dx * dx + dy * dy < 22 * 22) pickupDrop(i);
      }
    }
    // 미니슬라임은 updateSlimePets에서 이동 후 수집
  }
}

// 미니슬라임 펫: 아이템 향해 이동 → 수집 → 캐릭터 복귀
function updateSlimePets(dt) {
  for (const char of gameState.characters) {
    if (char.pet !== 'mini_slime' || char.isDead || char.assignedStage < 0) continue;

    // 위치 초기화
    if (char.petX === undefined) {
      char.petX = char.x - (char.facing || 1) * 25;
      char.petY = char.y + 10;
    }

    // 같은 스테이지의 가장 가까운 아이템 찾기
    let target = null, minD2 = Infinity;
    for (const d of gameState.drops) {
      if (d.stageIdx !== char.assignedStage) continue;
      const dx = d.x - char.petX, dy = d.y - char.petY;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD2) { minD2 = d2; target = d; }
    }

    if (target) {
      // 아이템 쪽으로 이동
      const dx = target.x - char.petX, dy = target.y - char.petY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= SLIME_PICKUP_DIST) {
        // 수집
        const idx = gameState.drops.indexOf(target);
        if (idx !== -1) pickupDrop(idx);
      } else {
        char.petX += (dx / dist) * SLIME_PET_SPEED * dt;
        char.petY += (dy / dist) * SLIME_PET_SPEED * dt;
      }
    } else {
      // 아이템 없으면 캐릭터 옆으로 복귀
      const homeX = char.x - (char.facing || 1) * 25;
      const homeY = char.y + 10;
      const dx = homeX - char.petX, dy = homeY - char.petY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 6) {
        char.petX += (dx / dist) * SLIME_PET_SPEED * dt;
        char.petY += (dy / dist) * SLIME_PET_SPEED * dt;
      }
    }
  }
}
