let ctx = null;

function initRender(canvas) {
  ctx = canvas.getContext('2d');
}

function render() {
  if (!ctx) return;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  drawBackground(W, H);

  for (const m of gameState.fieldMonsters) {
    drawMonster(m);
  }

  for (const char of gameState.characters) {
    drawCharacter(char);
  }

  drawStageLabel(W);
}

function drawBackground(W, H) {
  const theme = STAGE_BG[gameState.currentStage] || STAGE_BG[0];

  // 하늘
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  // 땅
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, H * 0.75, W, H * 0.25);

  // 구분선
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.75);
  ctx.lineTo(W, H * 0.75);
  ctx.stroke();
}

function drawMonster(m) {
  const R = 24;
  const stageDef = STAGES[gameState.currentStage];

  if (!m.alive) {
    // 리스폰 대기 중 — 반투명 회색 + 카운트다운
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(m.spawnX, m.spawnY, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.respawnTimer.toFixed(1) + 's', m.spawnX, m.spawnY + 4);
    ctx.textAlign = 'left';
    return;
  }

  // 피격 이펙트 — 노란 후광
  if (m.hitAnim > 0) {
    const alpha = m.hitAnim / 0.15;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#ffe000';
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 몬스터 몸통
  ctx.fillStyle = '#c0392b';
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 눈 (귀여운 느낌)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(m.x - 8, m.y - 6, 5, 0, Math.PI * 2);
  ctx.arc(m.x + 8, m.y - 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(m.x - 7, m.y - 6, 3, 0, Math.PI * 2);
  ctx.arc(m.x + 9, m.y - 6, 3, 0, Math.PI * 2);
  ctx.fill();

  // 몬스터 이름
  ctx.fillStyle = '#eee';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stageDef.monster.name, m.x, m.y + R + 13);
  ctx.textAlign = 'left';

  // HP 바
  const barW = 50, barH = 6;
  const barX = m.x - barW / 2;
  const barY = m.y - R - 14;
  const ratio = m.currentHp / m.maxHp;

  ctx.fillStyle = '#222';
  ctx.fillRect(barX, barY, barW, barH);

  const hpColor = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barW * ratio, barH);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);
}

function drawCharacter(char) {
  const color = CLASS_COLORS[char.classId] || '#3498db';

  // 공격 이펙트 — 캐릭터 앞 방향으로 섬광
  if (char.attackAnim > 0) {
    const alpha = char.attackAnim / 0.2;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = '#fff700';
    ctx.fillRect(
      char.x + (char.facing > 0 ? 14 : -54),
      char.y - 10,
      40, 16
    );
    ctx.globalAlpha = 1;
  }

  // 몸통
  ctx.fillStyle = color;
  ctx.fillRect(char.x - 14, char.y - 24, 28, 36);

  // 테두리
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(char.x - 14, char.y - 24, 28, 36);

  // 머리
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath();
  ctx.arc(char.x, char.y - 32, 10, 0, Math.PI * 2);
  ctx.fill();

  // 레벨 표시
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Lv.${char.level}`, char.x, char.y + 20);
  ctx.textAlign = 'left';
}

function drawStageLabel(W) {
  const stage = STAGES[gameState.currentStage];
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`[ ${stage.name} ]  처치: ${gameState.stageKills} / ${stage.killsToAdvance}`, W - 10, 20);
  ctx.textAlign = 'left';
}
