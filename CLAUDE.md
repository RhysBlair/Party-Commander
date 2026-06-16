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

### 세션 3 (현재)
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
