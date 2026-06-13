function init() {
  const canvas = document.getElementById('field-canvas');
  initRender(canvas);
  initUI();

  loadGame();

  // 캐릭터가 없으면 (새 게임 또는 구형 세이브) 모험가 1명으로 시작
  if (gameState.characters.length === 0) {
    gameState.characters.push(createCharacter());
    console.log('[main] 새 캐릭터 생성');
  } else {
    console.log('[main] 세이브 데이터 로드');
  }

  initField(); // 몬스터 스폰 + 캐릭터 위치 초기화
  startLoop();
  console.log('[main] 게임 루프 시작');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
