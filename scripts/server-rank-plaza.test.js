import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const collectorWorkflow = fs.readFileSync(new URL("../.github/workflows/collect.yml", import.meta.url), "utf8");

test("서버 순위 효율 화면은 직업 보정 없이 두 서버 순위를 표시한다", () => {
  assert.match(html, /서버 순위 효율/);
  assert.match(html, /서버 투력 순위/);
  assert.match(html, /서버 토벌 순위/);
  assert.match(html, /직업 보정 없음/);
  assert.doesNotMatch(html, /직업 기준 기대 점수/);
});

test("광장 탭과 캐릭터 입장, 빠른 채팅 기능이 공개되어 있다", () => {
  assert.equal((html.match(/data-page="virtual"/g) || []).length, 2);
  assert.match(html, /id="page-virtual"/);
  assert.match(html, /id="virtual-character-select"/);
  assert.match(html, /id="virtual-chat-input"/);
  assert.equal((html.match(/data-virtual-quick=/g) || []).length, 3);
  assert.match(css, /\.main-nav\.desktop-nav \[data-page="virtual"\][^{]*\{[^}]*display:\s*inline-flex\s*!important/s);
  assert.match(css, /#page-virtual\.content-page\.active\s*\{[^}]*display:\s*block\s*!important/s);
});

test("광장 채팅과 접속 상태는 Firebase 실시간 저장소에 연결된다", () => {
  assert.match(main, /createVirtualLobbyClient/);
  assert.match(main, /sendVirtualChat/);
  assert.match(rules, /chungjuVirtualLobby/);
  assert.match(rules, /\/plaza\/participants\/\{participantId\}/);
  assert.match(rules, /\/plaza\/messages\/\{messageId\}/);
});

test("토벌 비교 화면과 자동 수집은 월요일~일요일 주차를 보존한다", () => {
  assert.match(main, /이번 주 누적/);
  assert.match(main, /지난주 최종/);
  assert.match(main, /현재−지난주/);
  assert.match(collectorWorkflow, /20,40,55 14 \* \* 0/);
  assert.match(collectorWorkflow, /scripts\/mgf-parser\.js/);
});

test("지난주 MGF 점수가 새 주에 그대로 남으면 이번 주 미참여로 표시한다", () => {
  assert.match(main, /normalizeRaidCarryoverMembers/);
  assert.match(main, /지난주 점수 유지 · 이번 주 미참여/);
  assert.match(main, /effectiveTotalTobeolValue/);
  assert.match(css, /\.status-badge\.carryover/);
});
