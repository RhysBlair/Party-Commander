let ctx = null;

function initRender(canvas) {
  ctx = canvas.getContext('2d');
}

function render() {
  if (!ctx) return;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  const viewIdx = gameState.viewStage;
  const field   = gameState.stageFields[viewIdx];

  drawBackground(W, H, viewIdx);

  if (field) {
    for (const m of field.monsters) drawMonster(m, viewIdx);
  }

  drawDrops(viewIdx);

  // 분신은 캐릭터 뒤에 렌더링
  for (const char of gameState.characters) {
    if (char.assignedStage === viewIdx) drawShadow(char);
  }
  for (const char of gameState.characters) {
    if (char.assignedStage === viewIdx) drawCharacter(char);
  }
  // 오브는 캐릭터 위에 렌더링
  for (const char of gameState.characters) {
    if (char.assignedStage === viewIdx) drawCharacterOrbs(char);
  }

  drawPets(viewIdx);
  drawFloatingTexts(viewIdx);

  drawStageLabel(W, viewIdx, field);
}

function drawBackground(W, H, stageIdx) {
  const theme = STAGE_BG[stageIdx] || STAGE_BG[0];
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, H * 0.75, W, H * 0.25);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.75);
  ctx.lineTo(W, H * 0.75);
  ctx.stroke();
}

function drawMonster(m, stageIdx) {
  const R        = 24;
  const stageDef = STAGES[stageIdx];

  if (!m.alive) {
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

  if (m.hitAnim > 0) {
    ctx.globalAlpha = (m.hitAnim / 0.15) * 0.7;
    ctx.fillStyle = '#ffe000';
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#c0392b';
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

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

  ctx.fillStyle = '#eee';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stageDef.monster.name, m.x, m.y + R + 13);
  ctx.textAlign = 'left';

  const barW = 50, barH = 6;
  const barX = m.x - barW / 2;
  const barY = m.y - R - 14;
  const ratio = m.currentHp / m.maxHp;
  ctx.fillStyle = '#222';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(barX, barY, barW * ratio, barH);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);
}

function drawCharacter(char) {
  const color = CLASS_COLORS[char.classId] || '#3498db';

  // 스킬 발동 링 효과
  if ((char.skillAnim || 0) > 0) {
    const t = char.skillAnim / 0.5;
    ctx.globalAlpha = t * 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(char.x, char.y - 8, 28 + (1 - t) * 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }

  if (char.attackAnim > 0) {
    ctx.globalAlpha = (char.attackAnim / 0.2) * 0.6;
    ctx.fillStyle = '#fff700';
    ctx.fillRect(char.x + (char.facing > 0 ? 14 : -54), char.y - 10, 40, 16);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = color;
  ctx.fillRect(char.x - 14, char.y - 24, 28, 36);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(char.x - 14, char.y - 24, 28, 36);
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath();
  ctx.arc(char.x, char.y - 32, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Lv.${char.level}`, char.x, char.y + 20);
  ctx.textAlign = 'left';
}

function drawCharacterOrbs(char) {
  if (!char.skills || !char.skills.includes('orb_strike')) return;
  const count = char.orbCount || 0;
  const ready = char.orbReady || false;
  if (count === 0 && !ready) return;

  const ORB_SLOTS = 5;
  const orbRadius = 28;
  const orbSize   = 5;
  const now       = Date.now();
  const angleOff  = now / 800;
  const col       = ready ? '#f1c40f' : '#5b9bd5';

  // 5개 충전 시 황금 광채
  if (ready) {
    const pulse = 0.22 + Math.sin(now / 150) * 0.10;
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#f1c40f';
    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur  = 28;
    ctx.beginPath();
    ctx.arc(char.x, char.y - 12, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }

  const showCount = ready ? ORB_SLOTS : count;
  for (let i = 0; i < showCount; i++) {
    const angle = (i / ORB_SLOTS) * Math.PI * 2 + angleOff;
    const ox = char.x + Math.cos(angle) * orbRadius;
    const oy = (char.y - 12) + Math.sin(angle) * orbRadius * 0.5;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = col;
    ctx.beginPath();
    ctx.arc(ox, oy, orbSize, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawShadow(char) {
  if (!char.shadowActive) return;
  const px = char.shadowX ?? (char.x - char.facing * 28);
  const py = char.shadowY ?? (char.y + 4);

  // 잔여 시간이 10초 미만이면 깜빡임 효과
  const remaining = char.shadowTimer ?? 0;
  const flicker   = remaining < 10 ? (Math.sin(Date.now() / 120) * 0.25 + 0.45) : 0.65;

  ctx.globalAlpha = flicker;

  // 몸체 (어두운 자주빛)
  ctx.fillStyle = '#2a1040';
  ctx.fillRect(px - 14, py - 24, 28, 36);
  ctx.strokeStyle = '#7a4aaa';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px - 14, py - 24, 28, 36);

  // 머리
  ctx.fillStyle = '#3d1a5a';
  ctx.beginPath();
  ctx.arc(px, py - 32, 10, 0, Math.PI * 2);
  ctx.fill();

  // 눈 (흐릿하게)
  ctx.fillStyle = '#9b59b6';
  ctx.beginPath();
  ctx.arc(px - 4, py - 33, 2, 0, Math.PI * 2);
  ctx.arc(px + 4, py - 33, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawPets(viewIdx) {
  for (const char of gameState.characters) {
    if (char.assignedStage !== viewIdx || !char.pet) continue;

    const isMagnet = char.pet === 'pet_magnet';
    const bodyCol  = isMagnet ? '#5b9bd5' : '#f39c12';
    const earCol   = isMagnet ? '#3a78b5' : '#d4820f';

    let px, py;
    if (isMagnet) {
      px = char.x - char.facing * 25;
      py = char.y + 10;
    } else if (char.petX !== undefined) {
      px = char.petX;
      py = char.petY;
    } else {
      px = char.x - char.facing * 25;
      py = char.y + 10;
    }

    // 귀
    ctx.fillStyle = earCol;
    ctx.beginPath();
    ctx.ellipse(px - 5, py - 11, 3, 5, -0.3, 0, Math.PI * 2);
    ctx.ellipse(px + 5, py - 11, 3, 5,  0.3, 0, Math.PI * 2);
    ctx.fill();

    // 몸통
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 눈
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(px - 3, py - 1, 1.8, 0, Math.PI * 2);
    ctx.arc(px + 3, py - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px - 2.3, py - 1.5, 0.7, 0, Math.PI * 2);
    ctx.arc(px + 3.7, py - 1.5, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 코
    ctx.fillStyle = isMagnet ? '#a0c8f0' : '#e8a87c';
    ctx.beginPath();
    ctx.arc(px, py + 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 자석 펫: 수집 범위 광채
    if (isMagnet) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#5b9bd5';
      ctx.beginPath();
      ctx.arc(px, py, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawFloatingTexts(viewIdx) {
  ctx.textAlign = 'center';
  for (const f of gameState.floatingTexts) {
    if (f.stageIdx !== viewIdx) continue;
    ctx.globalAlpha = Math.min(f.timer * 2, 1);
    ctx.font        = `bold ${f.size}px sans-serif`;
    ctx.fillStyle   = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur  = 10;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';
}

function drawDrops(viewIdx) {
  for (const d of gameState.drops) {
    if (d.stageIdx !== viewIdx) continue;
    const e    = EQUIPMENT[d.equipId];
    const col  = e ? (GRADE_COLORS[e.grade] || '#aaa') : '#aaa';
    const fade = Math.min(1, d.timer / 5);

    ctx.globalAlpha = fade;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = col;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(e ? e.name[0] : '?', d.x, d.y + 3);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

function drawStageLabel(W, stageIdx, field) {
  const stage = STAGES[stageIdx];
  const kills = field ? field.kills : 0;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`[ ${stage.name} ]  처치: ${kills} / ${stage.killsToAdvance}`, W - 10, 20);
  ctx.textAlign = 'left';
}
