let ctx = null;

function initRender(canvas) {
  ctx = canvas.getContext('2d');
}

function render() {
  if (!ctx) return;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  if (gameState.viewRaid) { drawRaid(W, H); return; }

  const viewIdx = gameState.viewStage;
  const field   = gameState.stageFields[viewIdx];

  drawBackground(W, H, viewIdx);

  if (field) {
    for (const m of field.monsters) drawMonster(m, viewIdx);
  }

  drawDrops(viewIdx);
  drawPoisonFields(viewIdx);

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
  drawProjectiles(viewIdx);
  drawMeteors(viewIdx);
  drawMeteorImpacts(viewIdx);
  drawHawks(viewIdx);
  drawDecoys(viewIdx);
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

function drawProjectiles(viewIdx) {
  for (const p of gameState.projectiles) {
    if (p.stageIdx !== viewIdx) continue;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    // 발광 코어
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawMonster(m, stageIdx) {
  const R        = 24;
  const stageDef = STAGES[stageIdx];
  const monsterDef = m.def || stageDef.monster;
  const isRanged   = monsterDef.attackType === 'ranged';
  const isZombie   = monsterDef.type === 'zombie';

  if (!m.alive) {
    if (m.noRespawn) return;
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

  // 좀비: 초록 계열 / 원거리: 파란 계열 / 근접: 빨간 계열
  ctx.fillStyle   = isZombie ? '#2d6a2f' : isRanged ? '#1a3a8a' : '#c0392b';
  ctx.strokeStyle = isZombie ? '#57c45a' : isRanged ? '#5b9bd5' : '#e74c3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 원거리 표시: 작은 외곽 링
  if (isRanged) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#5b9bd5';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

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

  // 위협 디버프 오버레이 (받는 피해 +50%)
  if ((m.debuffTimer || 0) > 0) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle   = '#e67e22';
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ${(m.debuffTimer || 0).toFixed(1)}s`, m.x, m.y + R + 26);
    ctx.textAlign = 'left';
  }

  // 기절 오버레이
  if ((m.stunTimer || 0) > 0) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle   = '#f39c12';
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`💫 ${(m.stunTimer || 0).toFixed(1)}s`, m.x, m.y + R + 26);
    ctx.textAlign = 'left';
  }

  // 빙결 오버레이
  if (m.frozen) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle   = '#7ecff5';
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#a8e6ff';
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#a8e6ff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`❄ ${(m.frozenTimer || 0).toFixed(1)}s`, m.x, m.y + R + 26);
    ctx.textAlign = 'left';
  }

  // 독 오버레이
  if (m.poisoned) {
    const pulse = 0.25 + Math.sin(Date.now() / 300) * 0.10;
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#9b59b6';
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#a569bd';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, R + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = '#eee';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((m.def || stageDef.monster).name, m.x, m.y + R + 13);
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

  // 사망 상태: 반투명 실루엣 + 부활 카운트다운
  if (char.isDead) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle   = '#888';
    ctx.fillRect(char.x - 14, char.y - 24, 28, 36);
    ctx.beginPath();
    ctx.arc(char.x, char.y - 32, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`💀 ${(char.respawnTimer || 0).toFixed(1)}s`, char.x, char.y + 4);
    ctx.textAlign = 'left';
    return;
  }

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

  // 피격 빨간 오버레이
  if ((char.hitAnim || 0) > 0) {
    ctx.globalAlpha = (char.hitAnim / 0.2) * 0.55;
    ctx.fillStyle   = '#e74c3c';
    ctx.fillRect(char.x - 16, char.y - 26, 32, 40);
    ctx.globalAlpha = 1;
  }

  // 빙결 오버레이
  if (char.frozen) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle   = '#7ecff5';
    ctx.fillRect(char.x - 16, char.y - 26, 32, 40);
    ctx.beginPath();
    ctx.arc(char.x, char.y - 32, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#a8e6ff';
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(char.x - 16, char.y - 26, 32, 40);
    ctx.setLineDash([]);
    ctx.fillStyle   = '#a8e6ff';
    ctx.font        = 'bold 10px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText(`❄ ${(char.frozenTimer || 0).toFixed(1)}s`, char.x, char.y + 46);
    ctx.textAlign   = 'left';
  }

  // 메테오 캐스팅 오버레이
  if (char.meteorCasting) {
    const skill = SKILLS['meteor'];
    const totalCast = skill ? skill.castTime : 5.0;
    const remain    = char.meteorCastTimer || 0;
    const prog      = Math.max(0, Math.min(1, 1 - remain / totalCast));
    const pulse     = 0.35 + Math.sin(Date.now() / 120) * 0.15;
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#e74c3c';
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur  = 22;
    ctx.beginPath();
    ctx.arc(char.x, char.y - 8, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    // 캐스팅 진행바
    const cbW = 36, cbH = 5, cbX = char.x - cbW / 2, cbY = char.y - 52;
    ctx.fillStyle = '#333';
    ctx.fillRect(cbX, cbY, cbW, cbH);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(cbX, cbY, cbW * prog, cbH);
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(cbX, cbY, cbW, cbH);
    ctx.fillStyle   = '#fff';
    ctx.font        = 'bold 9px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText(`메테오 ${remain.toFixed(1)}s`, char.x, cbY - 3);
    ctx.textAlign   = 'left';
  }

  // 피어싱 충전 오버레이
  if (char.charging) {
    const progress = 1 - Math.max(0, (char.chargeTimer || 0) / 3.0);
    const pulse    = 0.4 + Math.sin(Date.now() / 100) * 0.2;
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#e2b96f';
    ctx.shadowColor = '#e2b96f';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.arc(char.x, char.y - 8, 18 + progress * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle   = '#e2b96f';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((char.chargeTimer || 0) > 0 ? `충전 ${Math.ceil(char.chargeTimer)}s` : '발사 준비!', char.x, char.y - 44);
    ctx.textAlign = 'left';
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

  // HP 바
  const maxHp   = char.maxHpCache || 1;
  const hpRatio = Math.max(0, Math.min(1, (char.currentHp || 0) / maxHp));
  const bW = 30, bH = 4, bX = char.x - bW / 2, bY = char.y + 26;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(bX, bY, bW, bH);
  ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(bX, bY, bW * hpRatio, bH);
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 0.5;
  ctx.strokeRect(bX, bY, bW, bH);

  // MP 바
  const mpMax   = char.maxMpCache || 200;
  const mpRatio = Math.max(0, Math.min(1, (char.currentMp || 0) / mpMax));
  const mpY = bY + bH + 2;
  ctx.fillStyle = '#0a0a1e';
  ctx.fillRect(bX, mpY, bW, 3);
  ctx.fillStyle = '#3498db';
  ctx.fillRect(bX, mpY, bW * mpRatio, 3);
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 0.5;
  ctx.strokeRect(bX, mpY, bW, 3);

  // 물약 충전 중 표시
  const hpFill = char.hpRefillTimer || 0;
  const mpFill = char.mpRefillTimer || 0;
  if (hpFill > 0 || mpFill > 0) {
    const maxFill = Math.max(hpFill, mpFill);
    const pulse   = 0.65 + Math.sin(Date.now() / 200) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#f39c12';
    ctx.font        = 'bold 9px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText(`충전 ${maxFill.toFixed(1)}s`, char.x, char.y - 48);
    ctx.textAlign   = 'left';
    ctx.globalAlpha = 1;
  }
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

function drawShields(viewIdx) {
  const now = Date.now();
  for (const char of gameState.characters) {
    if (char.assignedStage !== viewIdx || !char.petShieldActive) continue;
    const pulse = 0.55 + Math.sin(now / 200) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    const grad = ctx.createRadialGradient(char.x, char.y - 18, 10, char.x, char.y - 18, 30);
    grad.addColorStop(0,   'rgba(80,200,255,0.0)');
    grad.addColorStop(0.7, 'rgba(80,200,255,0.18)');
    grad.addColorStop(1.0, 'rgba(80,200,255,0.55)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(char.x, char.y - 18, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4fc3f7';
    ctx.shadowBlur  = 8;
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.restore();
  }
}

function drawPets(viewIdx) {
  drawShields(viewIdx);
  for (const char of gameState.characters) {
    if (char.assignedStage !== viewIdx || !char.pet) continue;

    const isMagnet = char.pet === 'pet_magnet';

    let px, py;
    if (char.petX !== undefined) {
      px = char.petX; py = char.petY;
    } else {
      px = char.x - (char.facing || 1) * 25; py = char.y + 10;
    }

    {
      // ── 펫 공통 렌더: 토끼 형태 ──
      const PET_COLORS = {
        mini_rabbit: ['#f39c12', '#d4820f'],
        mini_bat:    ['#7d3c98', '#5d2d7a'],
        baby_bear:   ['#a0522d', '#7d3c1a'],
        baby_snake:  ['#27ae60', '#1e8449'],
        baby_turtle: ['#16a085', '#0e7060'],
      };
      const [bodyCol, earCol] = PET_COLORS[char.pet] || ['#888', '#666'];
      const isMagnetLocal = isMagnet;

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
      ctx.fillStyle = '#e8a87c';
      ctx.beginPath();
      ctx.arc(px, py + 2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 펫별 특수 표시
      if (char.pet === 'baby_turtle') {
        // 거북이: 등껍질 무늬
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 아이템 향해 이동 중 반짝임
      const hasTarget = gameState.drops.some(d => d.stageIdx === char.assignedStage);
      if (hasTarget) {
        const now2 = Date.now();
        ctx.globalAlpha = 0.3 + Math.sin(now2 / 150) * 0.15;
        ctx.fillStyle   = bodyCol;
        ctx.beginPath();
        ctx.arc(px, py, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
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

function drawPoisonFields(viewIdx) {
  for (const pf of gameState.poisonFields) {
    if (pf.stageIdx !== viewIdx) continue;
    const now   = Date.now();
    const pulse = 0.12 + Math.sin(now / 180) * 0.05;

    // 바닥 채움
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#9b59b6';
    ctx.beginPath();
    ctx.arc(pf.x, pf.y, pf.radius, 0, Math.PI * 2);
    ctx.fill();

    // 외곽선 점선
    ctx.globalAlpha = 0.35 + Math.sin(now / 120) * 0.1;
    ctx.strokeStyle = '#a569bd';
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.arc(pf.x, pf.y, pf.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 내부 소용돌이 점 (회전)
    const rot = (now / 800) % (Math.PI * 2);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle   = '#ce93d8';
    for (let k = 0; k < 6; k++) {
      const angle = rot + (k / 6) * Math.PI * 2;
      const r     = pf.radius * 0.55;
      ctx.beginPath();
      ctx.arc(pf.x + Math.cos(angle) * r, pf.y + Math.sin(angle) * r * 0.5, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 지속 시간 표시
    ctx.globalAlpha = 0.85;
    ctx.fillStyle   = '#ce93d8';
    ctx.font        = 'bold 10px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText(`독 ${pf.duration.toFixed(1)}s`, pf.x, pf.y - pf.radius - 5);
    ctx.textAlign   = 'left';
    ctx.globalAlpha = 1;
  }
}

function drawDrops(viewIdx) {
  const now = Date.now();
  for (const d of gameState.drops) {
    if (d.stageIdx !== viewIdx) continue;
    const e    = EQUIPMENT[d.equipId];
    const col  = e ? (GRADE_COLORS[e.grade] || '#aaa') : '#aaa';
    const fade = Math.min(1, d.timer / 5);
    // 위아래 둥실 효과
    const bob  = Math.sin(now / 400 + d.uid) * 3;

    ctx.globalAlpha = fade;

    // 외곽 발광
    ctx.shadowColor = col;
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = col;
    ctx.beginPath();
    ctx.arc(d.x, d.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;

    // 흰 테두리
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(d.x, d.y + bob, 9, 0, Math.PI * 2);
    ctx.stroke();

    // 이름 첫 글자
    ctx.fillStyle   = '#fff';
    ctx.font        = 'bold 9px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText(e ? e.name[0] : '?', d.x, d.y + bob + 3);
    ctx.textAlign   = 'left';
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

function drawMeteors(viewIdx) {
  const now = Date.now();
  for (const mt of gameState.meteors) {
    if (mt.stageIdx !== viewIdx) continue;

    // 착지 예정 지점 표시 (바닥 링)
    const progress = Math.max(0, 1 - mt.fallTimer / mt.totalFall);
    const ringAlpha = 0.15 + progress * 0.45;
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth   = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(mt.targetX, mt.targetY, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 낙하 중인 불덩어리
    const cx = mt.x, cy = mt.y;
    const size = 22 + Math.sin(now / 80) * 4;

    // 외곽 광염
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur  = 40;
    ctx.globalAlpha = 0.5 + Math.sin(now / 100) * 0.15;
    ctx.fillStyle   = '#e74c3c';
    ctx.beginPath();
    ctx.arc(cx, cy, size + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;

    // 중간 불꽃
    ctx.globalAlpha = 0.85;
    ctx.fillStyle   = '#f39c12';
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill();

    // 코어
    ctx.globalAlpha = 1;
    ctx.fillStyle   = '#fff5a0';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 캐스팅 잔여 시간 (낙하 중엔 표시 안함)
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }
}

function drawMeteorImpacts(viewIdx) {
  if (!gameState.meteorImpacts) return;
  for (const imp of gameState.meteorImpacts) {
    if (imp.stageIdx !== viewIdx) continue;
    const prog  = 1 - imp.timer / imp.maxTimer;  // 0→1
    const alpha = imp.timer / imp.maxTimer;       // 1→0 (페이드 아웃)

    // 3개의 링이 간격을 두고 바깥으로 퍼져나감
    for (let k = 0; k < 3; k++) {
      const kProg  = Math.max(0, prog - k * 0.12);
      const radius = kProg * imp.maxRange;
      const kAlpha = Math.max(0, alpha - k * 0.2) * (1 - kProg * 0.5);
      if (radius <= 0) continue;

      ctx.globalAlpha = kAlpha;
      ctx.strokeStyle = k === 0 ? '#ff6b35' : k === 1 ? '#e74c3c' : '#f39c12';
      ctx.lineWidth   = 4 - k;
      ctx.shadowColor = '#e74c3c';
      ctx.shadowBlur  = 20;
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur  = 0;
    }

    // 중심 섬광
    if (prog < 0.25) {
      const flashAlpha = (1 - prog / 0.25) * 0.8;
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle   = '#fff5a0';
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur  = 40;
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, 30 * (1 - prog / 0.25), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

    ctx.globalAlpha = 1;
  }
}

function drawHawks(viewIdx) {
  const field = gameState.stageFields[viewIdx];
  if (!field || !field.hawks || !field.hawks.length) return;

  for (const hawk of field.hawks) {
    if (hawk.duration <= 0) continue;

    const flying = hawk.state === 'flying' || hawk.state === 'returning';
    const t = Date.now() / 250;
    const floatY = hawk.y + (flying ? 0 : Math.sin(t) * 3);
    const wingFlap = flying ? Math.abs(Math.sin(t * 4)) * 0.4 : Math.abs(Math.sin(t * 2)) * 0.25;

    ctx.save();
    ctx.translate(hawk.x, floatY);

    // 날개 펄럭임
    ctx.fillStyle = flying ? 'rgba(160,216,255,0.95)' : 'rgba(192,220,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(-11, 1, 13, 4 + wingFlap * 6, -0.3 - wingFlap, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(11, 1, 13, 4 + wingFlap * 6, 0.3 + wingFlap, 0, Math.PI * 2);
    ctx.fill();

    // 몸통
    ctx.fillStyle = flying ? '#c8e8ff' : '#ddeeff';
    ctx.strokeStyle = '#4488bb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 머리
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#4488bb';
    ctx.beginPath();
    ctx.arc(0, -5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

function drawDecoys(viewIdx) {
  const field = gameState.stageFields[viewIdx];
  if (!field || !field.decoys) return;

  for (const d of field.decoys) {
    if (d.currentHp <= 0) continue;

    // 피격 빛 효과
    if ((d.hitAnim || 0) > 0) {
      ctx.globalAlpha = (d.hitAnim / 0.2) * 0.6;
      ctx.fillStyle   = '#ffe000';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 통나무 몸체 (갈색 원)
    ctx.fillStyle   = '#8B4513';
    ctx.strokeStyle = '#6B3410';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 나무 결 (가로 줄)
    ctx.strokeStyle = '#6B3410';
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.5;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(d.x - 12, d.y + k * 5);
      ctx.lineTo(d.x + 12, d.y + k * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // "분신" 레이블
    ctx.fillStyle   = '#f0e68c';
    ctx.font        = 'bold 10px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText('분신', d.x, d.y + 29);
    ctx.textAlign   = 'left';

    // HP 바
    const barW = 40, barH = 5;
    const barX = d.x - barW / 2;
    const barY = d.y - 28;
    const ratio = d.currentHp / d.maxHp;
    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);
  }
}
