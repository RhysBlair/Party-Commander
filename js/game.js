// 메인 게임 루프
let lastTime = 0;
let tickLog = 0;          // 콘솔 tick 확인용 누적 시간
const SAVE_INTERVAL = 10; // 10초마다 자동 저장

let saveAccum = 0;

function startLoop() {
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = (now - lastTime) / 1000; // 초 단위 delta
  lastTime = now;

  // 1단계 확인용: 매 초 콘솔에 tick 출력
  tickLog += dt;
  if (tickLog >= 1) {
    console.log(`[tick] dt=${dt.toFixed(3)}s`);
    tickLog -= 1;
  }

  // 시스템 업데이트
  updateRaid(dt);
  updateCombat(dt);
  updateLoot(dt);
  updateFloatingTexts(dt);
  updateProjectiles(dt);
  updateMeteors(dt);

  // 자동 저장
  saveAccum += dt;
  if (saveAccum >= SAVE_INTERVAL) {
    saveGame();
    saveAccum = 0;
  }

  // 렌더
  render();

  updateUI(dt);

  requestAnimationFrame(loop);
}
