# Party Commander — Claude 지시사항

## 언어
항상 한국어로 대답할 것.

## 작업 규칙
- 작업 완료 후 반드시 git commit + git push 할 것.
- 커밋 메시지는 한국어로 작성할 것. (예: `feat: 메디테이션 스킬 추가`)
- CLAUDE.md 개발 이력도 함께 업데이트하고 커밋에 포함할 것.

---

## 프로젝트 개요
브라우저 방치형 파티 RPG. Canvas 전투 렌더링, ES 모듈 없음 (file:// 호환).

**스크립트 로드 순서:** data → stats → state → loot → upgrade → combat → render → ui → game → main

---

## 직업 시스템 (data.js CLASSES)

| classId | 이름 | 주스탯 | 범위 | jobLevel | parent |
|---------|------|--------|------|----------|--------|
| novice | 초보자 | - | melee | 0 | - |
| warrior | 전사 | STR | melee | 1 | - |
| mage | 마법사 | INT | ranged | 1 | - |
| archer | 궁수 | DEX | ranged | 1 | - |
| rogue | 도적 | LUK | ranged_short | 1 | - |
| page | 페이지 | STR | melee | 2 | warrior |
| spearman | 스피어맨 | STR | melee | 2 | warrior |
| knight | 나이트 | STR | melee | 2 | warrior |
| wizard_tl | 썬콜 | INT | ranged | 2 | mage |
| wizard_fp | 불독 | INT | ranged | 2 | mage |
| cleric | 클레릭 | INT | ranged | 2 | mage |
| marksman | 사수 | DEX | ranged | 2 | archer |
| hunter | 헌터 | DEX | ranged | 2 | archer |
| assassin | 어쌔신 | LUK | ranged_short | 2 | rogue |
| thief | 시프 | LUK | melee | 2 | rogue |

**전직 레벨:** 1차 Lv.10, 2차 Lv.30 (`JOB_ADVANCE_LEVEL`, `JOB_ADVANCE_LEVEL_2`)

---

## 스킬 시스템

### 스킬 정의 위치: `js/data.js` SKILLS 객체

| skillId | 이름 | classId | targeting |
|---------|------|---------|-----------|
| orb_strike | 오브 스트라이크 | warrior | passive (orbsRequired:5, dmgMult:20) |
| threat | 위협 | page | debuff_area |
| spear_aura | 하이퍼바디 | spearman | party_buff |
| rage | 분노 | knight | party_buff |
| mage_blast | 마력 폭발 | mage | aoe |
| ice_strike | 아이스 스트라이크 | wizard_tl | aoe_freeze |
| meditation_tl | 메디테이션 | wizard_tl | party_buff |
| cleric_heal | 신성한 치유 | cleric | heal |
| double_shot | 더블샷 | archer | double_hit |
| archer_shot | 연사 | hunter | passive |
| piercing | 피어싱 | marksman | piercing |
| sharp_eyes_mk | 샤프아이즈 | marksman | party_buff |
| sharp_eyes_ht | 샤프아이즈 | hunter | party_buff |
| shadow_partner | 쉐도우파트너 | rogue | shadow |
| triple_throw | 트리플 스로우 | assassin | passive |
| savage_blow | 세비지 블로우 | thief | savage_blow |
| meditation_fp | 메디테이션 | wizard_fp | party_buff |
| poison_field | 포이즌 | wizard_fp | poison_area |
| meteor | 메테오 | wizard_fp | meteor_cast |
| log_decoy | 통나무분신술 | rogue | log_decoy |

### 스킬 레벨 관련 상수 (data.js)
- `SKILL_LEVEL_MULTS[1..10]`: 레벨별 데미지 배율
- `SKILL_SP_COSTS[1..10]`: 레벨업 SP 소모
- `SKILL_MAX_LEVEL = 10`
- `SKILL_SP_PER_LEVEL`: 레벨당 SP 획득

### targeting 타입별 combat.js 처리
- `passive`: dealDamage/getSkillAtkMult에서 처리 (attackInterval 또는 hits)
- `aoe`: 최대 N마리 범위 공격
- `aoe_freeze`: 레벨별 최대 대상 수 (maxTargetsBase~maxTargets), 빙결
- `debuff_area`: 범위 내 몬스터 받는 피해 증가
- `party_buff`: 파티 전원 버프 (buffHp/buffCdMult/buffAtk/buffCritDmg)
- `heal`: 범위 아군 HP 회복
- `shadow`: 분신 소환 (60초 지속, 50% 추가 데미지)
- `savage_blow`: 연속 10타
- `piercing`: 충전 후 단일 강타
- `poison_area`: 독 장판 설치
- `double_hit`: 2회 연속 타격
- `meteor_cast`: 5초 캐스팅 → 3초 낙하 → AoE 폭격 (dmgMultiplier+dmgPerLv*lv, 피격 시 취소)
- `log_decoy`: 분신 소환 (decoyHp+decoyHpPerLv*lv), 몬스터가 분신 우선 공격/이동

### party_buff 레벨 스케일 속성
- `buffHp` + `buffHpPerLv`: HP 배율 (하이퍼바디: Lv1=+20%, Lv10=+200%)
- `buffAtk` + `buffAtkPerLv`: 공격력 배율 (메디테이션: Lv1=+100%, Lv10=+200%)
- `buffCritDmg` + `buffCritDmgPerLv`: 크리 데미지 (샤프아이즈: Lv1=+20%, Lv10=+150%)
- `buffCdMult`: 쿨타임 가속 (고정)
- `buffDuration`: 지속시간 (레벨 비례 12%/lv 증가)

### cooldownDecay (지수 감소 쿨타임)
신성한 치유: cooldown:5.0, cooldownDecay:0.647 → Lv1=5초, Lv10=0.1초

---

## 장비 시스템 (data.js EQUIPMENT)

### 장비 슬롯
- `weapon`: 무기 (모든 직업)
- `weapon2`: 무기 2 (시프만, 2차 전직 시 생성)
- `throwable`: 표창 (도적/어쌔신만; 시프 전직 시 제거)
- `armor`: 방어구
- `accessory`: 장신구

**subweapon 슬롯은 존재하지 않음**

### 아대 (isAedae)
- 무기 타입(`type:'weapon'`)이지만 `isAedae:true` 플래그
- 도적/어쌔신 계열만 착용 가능 (`req:{classId:'rogue'}`)
- 아대 착용 시 throwable 공격력이 stats에 합산됨
- 시프 전직 시 자동 해제 (`tryAdvanceJob2`)
- 아이템: shadow_subweapon, silence_subweapon, moon_subweapon

### sumEquipStat (stats.js)
throwable 슬롯의 atk는 무기(weapon)에 isAedae가 있을 때만 합산.

### 장비 등급: 노멀/레어/에픽
### 강화: +15% atk per enhance level

---

## 스탯 시스템 (stats.js)

### 크리티컬
- **크리티컬 확률:** LUK ≤ 100 → `LUK × 0.3%`, LUK > 100 → `30% + (LUK-100) × 0.2%`
- **크리티컬 데미지:** 기본 3.0배 + `activeBuffs.critDmg.bonus` (샤프아이즈 버프)

### 버프 적용
- `char.activeBuffs.hp.mult`: HP 최대치 배율
- `char.activeBuffs.cd.mult`: 쿨타임 단축 배율
- `char.activeBuffs.atk.mult`: 공격력 배율
- `char.activeBuffs.critDmg.bonus`: 크리 데미지 추가

---

## UI 시스템 (ui.js)

### 탭 구성 (index.html)
- `characters` (캐릭터) — 스탯 정보 통합
- `skills` (스킬)
- `equipment` (장비)
- `shop` (상점)
- ~~stats탭 제거됨~~  ~~stage탭 제거됨~~

### 스테이지 바
- `#stage-bar`: canvas-wrap 상단, 가로 점 바 (o-o-o-o)
- `initStageBar()`: DOM 1회 생성 + addEventListener (innerHTML 교체 금지)
- `updateStageBar()`: class/text만 업데이트 (getElementById 사용)
- `#char-list-panel { top: 50px }` — stage-bar 아래로 내림

### 캐릭터 탭 (renderCharacterTab)
- 각 카드: 이름/직업/레벨, 배정 스테이지, 장비 슬롯
- 스탯 인라인: STR/DEX/INT/LUK + 플러스 버튼 (수동 분배 시)
- 자동배분 ON/OFF 토글 + 스텟초기화 버튼
- 최종 스탯 한 줄: HP/공격력/물리방어/마법방어/명중/회피/크리
- 카드 클릭 → 해당 캐릭터 스테이지로 이동; 현재 스테이지 재클릭 → 배정 해제

### 스킬 탭 (renderSkillTab)
- 1차 스킬 / 2차 스킬 각각 가로 행
- 미습득 시 Lv.1 효과 표시
- 스킬초기화 버튼 (골드 소모)
- 실시간 쿨다운 표시 없음

### 상점 탭 (renderShopTab)
- HP 물약 / MP 물약 각각 가로 미니 카드 행

---

## 전투 시스템 (combat.js)

### 캐릭터 업데이트 흐름 (updateCharacter)
1. HP/MP 초기화 및 자연회복 (HP 1%/s, MP 0.5%/s)
2. 버프 타이머 감소
3. 포션 자동 사용 (HP<50%→HP포션, MP<30%→MP포션)
4. 포션 재충전 중엔 행동 불가 (`hpRefillTimer`/`mpRefillTimer`)
5. useSkills 호출
6. 일반 공격 처리

### 도적 계열 공격
- 도적/어쌔신 + throwable → 따닥(2타, 각 0.5배) 또는 triple_throw(3타)
- 시프(thief) → melee 일반 공격
- rogueThrow 조건: `(classId==='rogue' || (parent==='rogue' && classId!=='thief')) && throwable 장착`

### 쉐도우파트너
- 분신 활성 중 모든 공격에 50% 추가 데미지
- 60초 지속 / 1.5초 쿨타임 → 사실상 상시 유지
- **스킬탭에서 배우기 버튼을 눌러야 작동** (자동 습득 아님)

### 스테이지 제한
- 일반 스테이지: 캐릭터 최대 6명

### 저장 제외 필드 (RUNTIME_CHAR_KEYS, state.js)
x, y, attackTimer, skillTimers, shadowActive, shadowTimer, currentHp, currentMp, activeBuffs 등 — 로드 시 초기화됨

---

## 개발 이력 (최신순)

### 세션 10 (현재)
- 파티 탭 추가: 캐릭터들을 파티로 묶고 파티 단위로 스테이지에 배치 (state.js parties[], renderPartyTab)
  - 파티 생성/해산, 멤버 추가/제거, 스테이지 배치/해제 기능
  - 파티 미소속 캐릭터 섹션에서 파티에 합류 가능
  - advanceStageField 시 파티 assignedStage 자동 동기화
  - 파티당 최대 6명, 스테이지당 6명 제한 유지
- 스킬탭 완전 제거 → 캐릭터탭으로 통합 (charSkillMiniSection → 풀 스킬 카드)
  - 1차 스킬 / 2차 스킬 tier 라벨 구분, 스킬 설명(현재/다음레벨), 스킬초기화 버튼 포함
  - 배치 필드 라인 제거 → 캐릭터 카드 내부 스킬 섹션으로 교체

### 세션 9
- 부활 시 상태이상·버프 초기화: 일반 리스폰 및 리저렉션 스킬 부활 모두 frozen/burned/activeBuffs/petShieldActive 초기화
- 쉐도우파트너 재사용 버그 수정: 발동 후 skillTimers=9999 고착 방식 제거 → 분신 활성 중 타이머 0 유지, 소멸 즉시 재발동하도록 변경
- 주스탯 공격력 균등화: 기존 STR 전용 기본 공격력 보너스(effSTR×0.5)를 주스탯(primary)×0.5로 변경 (stats.js)
- 결정 제작 비용 통일: 무기/표창 25개, 방어구/장신구 15개 (grade 무관, `CRAFT_COST_WEAPON`/`CRAFT_COST_ARMOR` 상수로 관리)
- 인벤토리 일괄분해 버튼 추가: 노멀/레어/에픽 각각 (`tryDecomposeByGrade`), 스테이지 4 이상 해금
- 에픽 석궁 `epic_crossbow` 추가: ATK 30, 크리+20%, 크리피해+1.0배, Lv30 궁수계열, minDropStage 7
- 장비 스탯 표기에 `bonusCritRate`(크리+N%), `bonusCritDmg`(크리피해+N배) 추가 (`equipStatText`)
- canEquipItem 방어적 코딩: `e.req || {}` 처리, 시프(thief) throwable/아대 착용 불가 조건 명시적 추가
- 불꽃 도마뱀 화상 중첩 최대 3개 제한: `burnStack` 카운터 도입, 표시 "화상!(N/3)", 만료·부활 시 초기화
- 스테이지 4~6 경험치 15% 상향: 화산 2000→2300, 죽은자의숲 7200→8280, 지하묘지 26000→29900
- 설녀 데미지 2배: atk 136→272, aoeAtk 100→200
- 설녀 빙결 면역: `freezeImmune: true` 속성, 아이스 스트라이크 명중 시 "빙결 내성!" 플로팅 텍스트 표시
- 분노(rage) 스킬: 물리공격력 Lv1=+100%(2배)~Lv10=+300%(4배), buffAtkPerLv=0.2222 추가, buffAtkLabel 도입
- 메디테이션/분노 스킬 표기 분리: buffAtkLabel='물리공격력'/'마법공격력', skillEffectDesc에서 라벨 사용
- 제작탭 결정 업그레이드: 은은한결정 3개→빛나는결정 1개, 빛나는결정 5개→찬란한결정 1개 (`tryUpgradeCrystal`)
  - Lucky(10%,×2) / Big Lucky(1%,×10) 보너스, 결과 플로팅 텍스트 (`showCrystalFloat`)
  - 버그 수정: 업그레이드 버튼 onclick에서 `renderCraftTab()` → `setTimeout(renderCraftTab,0)` 로 변경, opacity:1 초기값 명시
    (renderCraftTab() 즉시 호출 시 rAF 애니메이션 시작 전 DOM 재렌더링으로 플로팅 텍스트가 보이지 않던 타이밍 버그 수정)
- 모래골렘 atk 72→87 (+20%), expDrop 560→616 (+10%), 불꽃 도마뱀 화상데미지 40→20 (1/2)
- 인벤토리 장비에 착용 가능 직업 표시: `getEquipClassLabel(e)` 함수 추가, 아이템 이름 옆에 [전사계열] 형태로 표시
  - 전사계열/마법사계열/궁수계열/시프/도적,어쌔신/도적,시프/도적계열/전 직업 구분
  - 아대(isAedae)/표창(throwable) → "도적, 어쌔신"; rogue용 단검 → "도적, 시프"; thief → "시프"
- 어쌔신 전직 시 rogue용 단검 자동 해제 (tryAdvanceJob2)
- 어쌔신은 rogue용 단검 착용 불가 조건 추가 (canEquipItem)
- 정복완료 표시: maxStageReached > stageIdx 이면 HUD/스테이지탭에 "정복완료", 스테이지 바 점에 ✓ 표시
- 펫 보유중 시스템: char.ownedPets[] 추가, 구매 후 다른 펫 장착 시 "보유중 (장착)" 무료 전환, 재구매 불가
- 장비탭 판매/분해 버튼: 아이템 오른쪽에 나란히 배치 (justify-content:space-between)
- 빙결 내성 버그 수정: 빙결 중 내성 +20%/3s 로직이 frozen return에 막히던 문제 수정 (else 블록 내부로 이동)
- 메디테이션/분노 버프 스킬 데미지 미적용 버그 수정: executeSkill 내 atkBufMult 도입, 모든 스킬 데미지에 적용
- 메테오(wizard_fp 2차): 5초 캐스팅 → 3초 낙하 → 반경 800px AoE, Lv1=3000%~Lv10=100000%, 피격 시 취소
  - dmgPerLv = (1000-30)/9 ≈ 107.78 (SKILL_LEVEL_MULTS 무시, 자체 선형 스케일)
  - gameState.meteors[] 추적, updateMeteors(dt)로 낙하 및 AoE 처리
  - render.js: 낙하 불덩어리 + 착지 예정 링 + 캐스팅 진행바 렌더링
- 통나무분신술(rogue 1차): 분신 소환 (Lv1=1000HP, Lv10=50000HP), 30초 쿨
  - field.decoys[] 에 디코이 엔티티 추가
  - 몬스터 공격 + 이동 모두 aggro range 내 디코이 우선 타게팅
  - render.js: 갈색 원 + 나무결 + HP바 + "분신" 레이블 렌더링

### 세션 8
- 에픽 지팡이 `epic_staff` (INT+22, Lv30 마법사), 에픽 활 `epic_bow` (DEX+18, Lv30 궁수) 추가
- 석궁 계열: `crossbow`(노멀 bonusCritRate+5%), `heavy_crossbow`(레어 +12%/+0.5배) — 궁수 계열 착용, 활보다 낮은 atk
- stats.js: bonusCritRate/bonusCritDmg를 장비 합산에 반영 (sumEquipStat + calcFinalStats)
- 고대 골렘 (STAGES[7]): atk 520→2600 (5배), monsterAtkInterval 8.0s (4배 느림)
- 스테이지 8 변경: 어비스 궁수→설산/설녀 (원거리, freezeOnHit:true, projColor '#a8d8f0')
- 빙결 내성 (iceResist): 몬스터에 0~100%. 3초마다 빙결 중 +20%, 비빙결 -20%. ice_strike에서 확률 체크
- 설녀 공격 맞은 캐릭터 빙결: 프로젝타일 freezeOnHit 플래그, 빙결 중 이동/공격 불가 3초
- 레이드 탭 해금 버그 수정: advanceStageField 마지막 스테이지 클리어 시 maxStageReached 업데이트 후 return
- 펫탭 가로 레이아웃: 각 캐릭터 카드 안에 펫 가로 나열 (flex-wrap row)
- 펫 레벨 제한: Lv30 미만→미니슬라임만 표시, Lv30 이상→전체 표시
- 제작탭 방어구/장신구 비용 4배 (armor·accessory: base×4)
- 업그레이드 탭 해금: 스테이지 5 이후 (세션7에서 구현됨)

### 세션 7
- 탭 해금 시스템: 시작=캐릭터·장비·스킬만 / 1명 영입→상점·업그레이드 / 스테이지3 클리어→펫·레이드
- 새 펫 6종: 미니슬라임(1000G,80px 픽업), 미니래빗(공속+30%), 꼬마박쥐(크리+20%), 아기곰(HP+50%), 아기뱀(5초 HP전회복), 아기거북이(5초 방어막)
- 펫 없음: 아이템 드랍 발생 시 전투 중단하고 즉시 수집 우선
- 장비탭 상단 헤더(타이틀/필터/일괄판매) sticky 고정 (.eq-sticky-head)
- 장비탭 2단 레이아웃: 장착 중(왼쪽) / 인벤토리(오른쪽), 각 패널 독립 스크롤
- 인벤토리 드래그앤드랍 장착: `equipDragStart/Over/Leave/Drop` 함수, drag-over 슬롯 하이라이트
- 기존 X장착/무기1/무기2 버튼 제거 (드래그앤드랍으로 대체)
- 인벤토리 등급 필터 버튼: 전체/노멀/레어/에픽 (`_equipGradeFilter` 상태, `setEquipFilter()`)
- 일괄판매 버튼 인벤토리 패널 상단으로 이동

### 세션 6
- 매직가드 (mage 1차): passive ML=1, 피해의 80%를 HP 대신 MP로 흡수 (mgAbsorb:0.8)
- 리저렉션 (cleric 2차): ML=3, 쿨타임 Lv1=180s → Lv3=60s (cooldownPerLv:-60), 동 스테이지 사망 아군 전원 부활 HP 30%

### 세션 5
- 클레릭 스킬 "신성한 치유" → "힐" 이름 변경
- 심층 던전 몬스터 "어둠의 기사" → "쿨리좀비" (undead: true 속성 추가)
- 언데드 메커니즘: 클레릭 힐 스킬이 언데드 속성 몬스터에게 healAmt만큼 데미지 (방어 무시, 노란색 텍스트)
- 쿨리좀비 물리방어력 3배 (78 → 234)
- 강화 버튼에 성공 확률 표기 (xx%)
- 모래골렘 지속 당김 메커니즘 (35px/s smooth pull, pullForce/pullRange)
- 불꽃도마뱀 화상 상태이상: 중첩 데미지, 0.2s 틱 간격 (burnDmg/burnTimer/burnTickInterval)
- 불독 포이즌 dmgMultiplier: 2.5 → 25.0 (5배 추가 강화)

### 세션 4
- 포션 사용 쿨타임: 3.0초 → 0.5초 (combat.js, raid.js 동일 적용)
- 스테이지 1 몬스터: 슬라임 → 고블린 (HP 300, ATK 14)
- 스테이지 2 몬스터: 고블린 → 오크 (HP 1000, ATK 32)
- 스테이지 3 보스 스테이지 신설 (isBossStage): 킹슬라임 (HP 5000, 1마리) → 사망 시 슬라임 5마리 스폰 (ATK 60) → 슬라임 1마리 사망 시 미니슬라임 3마리 스폰 (ATK 90) → 전체 전멸 시 웨이브 클리어 5회 → 다음 스테이지
- 킹슬라임: 사망 즉시 리스폰 타이머(3초) 시작
- 보스 웨이브 구현: 몬스터별 def 필드, noRespawn 플래그, spawnBossWaveMonsters/killMonster 분기, render.js 몬스터 이름 표시 수정

### 세션 3
- 아이스 스트라이크: 레벨별 빙결 대상 수 1→8 (maxTargetsBase 추가)
- 메디테이션: wizard_tl/wizard_fp 2차 스킬 추가 (마법공격력 +100%~+200%)
- 하이퍼바디: HP 상승 퍼센트 레벨별 스케일 (Lv1=+20%, Lv10=+200%), buffCdMult 제거
- 크리티컬 확률: LUK당 0.3% (100 이하), 0.2% (100 초과), 50% 하드캡 제거
- 크리티컬 데미지 기본배율: 2.0 → 3.0배
- 쉐도우파트너 미사용 원인 분석: 도적(1차) 스킬탭에서 "2차 스킬"로 잘못 표기됨 (수동으로 배워야 작동)
- party_buff buffAtk/buffHp 레벨 스케일 시스템 추가 (buffAtkPerLv, buffHpPerLv)

### 세션 2
- 샤프아이즈: marksman/hunter 2차 스킬, party_buff (크리 데미지 +20%~+150%)
- 신성한 치유: cooldownDecay 적용 (Lv1=5초, Lv10=0.1초)
- 스킬 설명 전면 개편: 한국어 자연어, 쿨타임·MP 표기, "CD" → "쿨타임"
- 오브스트라이크: mpCost 30 추가
- 스킬탭: 1차/2차 가로 행 분리, 미습득 Lv.1 효과 표시, 실시간 쿨다운 제거
- 상점탭: HP/MP 물약 가로 미니 카드
- 스테이지 바: 점 형태 가로 바, 클릭 시 스테이지 이동 (initStageBar/updateStageBar 분리로 클릭 버그 수정)
- 스탯창 → 캐릭터창 통합: 인라인 STR/DEX/INT/LUK, 자동배분, 스텟초기화
- 스테이지탭 제거

### 세션 1
- 아대 시스템: isAedae 플래그, weapon 슬롯 사용, 도적/어쌔신만 착용
- 시프 전직: weapon2 슬롯 추가, throwable/아대 자동 해제
- subweapon 슬롯 완전 제거 (stats/upgrade/ui 전체)
- 검류 장비: 전사 전용, STR/DEX 보너스, 기사검 에픽 등급
- 그림자 검 → 그림자 단검 이름 변경
- 강화 성공/실패 플로팅 텍스트
- 캐릭터 카드 클릭 → 스테이지 이동 / 재클릭 → 배정 해제
- 스탯 미배정 표시

---

## 주요 파일 역할
- `js/data.js`: CLASSES, SKILLS, EQUIPMENT, POTIONS, STAGES 정의
- `js/stats.js`: calcFinalStats, sumEquipStat, autoAssignStats
- `js/state.js`: gameState, createCharacter, saveGame/loadGame, getCharSlotList
- `js/upgrade.js`: tryAdvanceJob/Job2, tryLearnSkill, tryEquipItem, canEquipItem
- `js/combat.js`: updateCombat, updateCharacter, useSkills, executeSkill, dealDamage
- `js/render.js`: Canvas 렌더링 전체
- `js/ui.js`: 모든 탭 렌더링, 이벤트 핸들러, skillEffectDesc
- `js/loot.js`: 드랍/보상 처리
- `js/raid.js`: 레이드 전투
- `js/game.js`: 게임 루프
