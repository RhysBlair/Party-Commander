# Party Commander — Claude 지시사항

## 언어
항상 한국어로 대답할 것.

## 프로젝트 개요
Party Commander는 브라우저에서 동작하는 방치형 파티 RPG 게임입니다.
- Canvas 기반 전투 렌더링
- ES 모듈 없이 일반 `<script>` 태그로 로드 (file:// 프로토콜 호환)
- 스크립트 로드 순서: data → stats → state → loot → upgrade → combat → render → ui → game → main
