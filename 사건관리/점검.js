'use strict';

/*
 * 사건폴더 점검·정리 스크립트
 *
 * 보관 위치의 사건폴더를 훑어 ① 표준 폴더의 누락, ② 사건표지·진행점검표의 누락,
 * ③ 비어 있는 폴더, ④ 미처리 점검항목을 보고하고, 사건대장을 다시 만듭니다.
 *
 * 실행 예)
 *   node 사건관리/점검.js                 점검 결과만 보고합니다
 *   node 사건관리/점검.js --보정          누락된 표준 폴더를 만들고 사건대장을 다시 만듭니다
 *   node 사건관리/점검.js --루트 /경로     보관 위치를 지정합니다
 *
 * 의존성 없음. 사건관리/사건유형.js만 사용합니다.
 */

const fs = require('fs');
const path = require('path');
const { 기본폴더, 유형찾기 } = require('./사건유형');

const 저장소루트 = path.resolve(__dirname, '..');

function 인수읽기(argv) {
  const 값 = {};
  for (let i = 0; i < argv.length; i += 1) {
    const 토큰 = argv[i];
    if (!토큰.startsWith('--')) continue;
    const 키 = 토큰.slice(2);
    const 다음 = argv[i + 1];
    if (다음 === undefined || 다음.startsWith('--')) 값[키] = true;
    else {
      값[키] = 다음;
      i += 1;
    }
  }
  return 값;
}

function 보관루트(인수) {
  const 지정 = 인수['루트'] || process.env.CASE_ROOT || process.env['사건폴더루트'];
  if (지정 && 지정 !== true) return path.resolve(String(지정));
  return path.resolve(저장소루트, '..', '사건폴더');
}

function csv칸(값) {
  const s = 값 === undefined || 값 === null ? '' : String(값);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const 대장머리 = [
  '사건번호', '접수일', '채권자', '채무자', '사건유형', '법원',
  '법원사건번호', '청구금액', '진행상태', '담당', '폴더명',
];

// 00_사건표지.txt의 [사건정보] 구역을 읽습니다.
function 사건정보읽기(표지경로) {
  if (!fs.existsSync(표지경로)) return null;
  const 본문 = fs.readFileSync(표지경로, 'utf8');
  const m = 본문.match(/\[사건정보\]([\s\S]*?)\[\/사건정보\]/);
  if (!m) return null;
  const 정보 = {};
  for (const 줄 of m[1].split('\n')) {
    const kv = 줄.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
    if (kv) 정보[kv[1].trim()] = kv[2].trim();
  }
  return 정보;
}

function 사건폴더목록(루트) {
  const 결과 = [];
  if (!fs.existsSync(루트)) return 결과;
  for (const 연도 of fs.readdirSync(루트)) {
    const 연도경로 = path.join(루트, 연도);
    if (!fs.statSync(연도경로).isDirectory()) continue;
    if (!/^\d{4}$/.test(연도)) continue;
    for (const 이름 of fs.readdirSync(연도경로)) {
      const 경로 = path.join(연도경로, 이름);
      if (fs.statSync(경로).isDirectory()) 결과.push({ 연도, 이름, 경로 });
    }
  }
  return 결과.sort((a, b) => a.이름.localeCompare(b.이름, 'ko'));
}

function 비어있는폴더(사건경로) {
  const 결과 = [];
  const 훑기 = (상대) => {
    const 절대 = path.join(사건경로, 상대);
    const 목록 = fs.readdirSync(절대);
    if (목록.length === 0) {
      if (상대) 결과.push(상대);
      return;
    }
    for (const 이름 of 목록) {
      const 자식 = path.join(절대, 이름);
      if (fs.statSync(자식).isDirectory()) 훑기(path.join(상대, 이름));
    }
  };
  훑기('');
  return 결과;
}

function 미처리항목(점검표경로) {
  if (!fs.existsSync(점검표경로)) return null;
  const 본문 = fs.readFileSync(점검표경로, 'utf8');
  const 전체 = (본문.match(/\[[ xX]\]/g) || []).length;
  const 미처리 = (본문.match(/\[ \]/g) || []).length;
  return { 전체, 미처리 };
}

function 실행() {
  const 인수 = 인수읽기(process.argv.slice(2));
  const 루트 = 보관루트(인수);
  const 보정 = Boolean(인수['보정']);

  if (!fs.existsSync(루트)) {
    console.error(`보관 위치가 없습니다.\n  ${루트}\n먼저 새사건.js로 사건폴더를 만들거나 --루트 로 위치를 지정합니다.`);
    process.exitCode = 1;
    return;
  }

  const 사건들 = 사건폴더목록(루트);
  console.log(`보관 위치: ${루트}`);
  console.log(`사건 수: ${사건들.length}건${보정 ? '  (보정 모드)' : ''}\n`);

  const 대장행 = [];
  let 문제건수 = 0;

  for (const 사건 of 사건들) {
    const 표지 = path.join(사건.경로, '00_사건표지.txt');
    const 점검표 = path.join(사건.경로, '00_진행점검표.txt');
    const 정보 = 사건정보읽기(표지);
    const 지적 = [];

    if (!정보) 지적.push('00_사건표지.txt 가 없거나 [사건정보] 구역을 읽지 못하였습니다');
    if (!fs.existsSync(점검표)) 지적.push('00_진행점검표.txt 가 없습니다');

    const 유형정보 = 정보 ? 유형찾기(정보['사건유형']) : null;
    const 있어야할폴더 = [...기본폴더, ...(유형정보 ? 유형정보.추가폴더 : [])];
    const 누락 = 있어야할폴더.filter((f) => !fs.existsSync(path.join(사건.경로, f)));

    if (누락.length > 0) {
      if (보정) {
        for (const f of 누락) fs.mkdirSync(path.join(사건.경로, f), { recursive: true });
        지적.push(`표준 폴더 ${누락.length}개를 새로 만들었습니다: ${누락.join(', ')}`);
      } else {
        지적.push(`표준 폴더가 없습니다: ${누락.join(', ')}`);
      }
    }

    const 빈폴더 = 비어있는폴더(사건.경로);
    const 진행 = 미처리항목(점검표);

    if (정보) {
      const 행 = {};
      for (const k of 대장머리) 행[k] = 정보[k] || '';
      if (!행['폴더명']) 행['폴더명'] = 사건.이름;
      대장행.push(행);
    }

    const 상태 = 정보 ? 정보['진행상태'] || '미기재' : '알 수 없음';
    console.log(`■ ${사건.이름}`);
    console.log(`   진행상태: ${상태}${진행 ? `   점검표: 미처리 ${진행.미처리}/${진행.전체}` : ''}`);
    if (빈폴더.length > 0) console.log(`   비어 있는 폴더(${빈폴더.length}): ${빈폴더.join(', ')}`);
    for (const s of 지적) console.log(`   · ${s}`);
    if (지적.length > 0) 문제건수 += 1;
    console.log('');
  }

  if (보정 && 대장행.length > 0) {
    const 대장 = path.join(루트, '사건대장.csv');
    const 본문 = [대장머리.join(','), ...대장행.map((행) => 대장머리.map((k) => csv칸(행[k])).join(','))].join('\n');
    fs.writeFileSync(대장, `﻿${본문}\n`, 'utf8');
    console.log(`사건대장을 다시 만들었습니다: ${대장}  (${대장행.length}건)`);
  }

  console.log(`점검을 마쳤습니다. 지적사항이 있는 사건: ${문제건수}건`);
  if (!보정 && 문제건수 > 0) console.log('--보정 을 붙이면 누락된 표준 폴더를 만들고 사건대장을 다시 만듭니다.');
}

실행();
