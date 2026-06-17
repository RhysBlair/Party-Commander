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

  // 2. 캐릭터별 드랍 수집
  for (const char of gameState.characters) {
    if (char.isDead || char.assignedStage < 0) continue;

    const petData = char.pet ? PETS[char.pet] : null;
    const pickupR = petData?.pickupRange ?? 0;

    if (pickupR >= 9999) {
      // 맵 전체 수집 (미니슬라임 등)
      for (let i = gameState.drops.length - 1; i >= 0; i--) {
        const d = gameState.drops[i];
        if (d.stageIdx === char.assignedStage) pickupDrop(i);
      }
    } else if (pickupR > 0) {
      // 지정 반경 수집
      const r2 = pickupR * pickupR;
      for (let i = gameState.drops.length - 1; i >= 0; i--) {
        const d = gameState.drops[i];
        if (d.stageIdx !== char.assignedStage) continue;
        const dx = d.x - char.x, dy = d.y - char.y;
        if (dx * dx + dy * dy < r2) pickupDrop(i);
      }
    } else if (!char.pet) {
      // 펫 없음: 22px 밀착 시 수집 (combat.js가 이동 담당)
      for (let i = gameState.drops.length - 1; i >= 0; i--) {
        const d = gameState.drops[i];
        if (d.stageIdx !== char.assignedStage) continue;
        const dx = d.x - char.x, dy = d.y - char.y;
        if (dx * dx + dy * dy < 22 * 22) pickupDrop(i);
      }
    }
  }
}
