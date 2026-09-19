'use strict';

/*
 * 사건 색인 만들기
 *
 * 폴더 이름에 들어 있는 사건번호를 찾아 의뢰인과 사건번호로 정렬한 색인을 만듭니다.
 * 사건이 어느 폴더에 있는지 엑셀에서 바로 찾을 수 있습니다.
 *
 * 실행 예)
 *   node 사건관리/색인.js "D:\사무소자료"
 *   node 사건관리/색인.js "C:\Users\사용자\OneDrive" --색인 "D:\사건색인.csv"
 *
 * 아무것도 옮기거나 지우지 아니합니다. 읽기만 합니다.
 *
 * 의존성 없음.
 */

const fs = require('fs');
const path = require('path');

// 법원 사건번호 표기. 예) 2025가단102974, 25타경3646, 25카정346
const 법원식 = /(20\d{2}|\d{2})\s*(간회단|간회합|가단|가합|가소|차전|카단|카합|카정|카기|타경|타채|하단|하면|개회|개확|회단|회합|즈단|드단|드합|고단|고합|형제|너|머|본|나)\s*\d{1,6}/;
// 회생·파산 접수번호 표기. 예) 25-11687, 18-5062
const 회생식 = /(?:^|[^0-9])((?:1\d|2\d)-\d{3,6})(?![0-9])/;

// 의뢰인 이름을 뽑을 때 걸러낼 절차 낱말
const 절차어 = new Set(
  ('자료 제출 증거 보정 명령 회사 제시 서류 사건 집회 신청 추가 기록 준비 참고 접수 정리 이전 최종 ' +
   '사본 원본 수정 작업 폴더 첨부 발급 확인 메모 문제 특강 판례 강의 교재 부록 목차 양식 파일 사진 ' +
   '녹음 통화 계약 내역 증명 신고 결정 인가 각하 이의 청구 임금 매매 토지 가단 가합 가소 가압류 ' +
   '가처분 경매 강제경매 임의경매 강제집행 공탁 공탁금 지급 담보 배당 추심 압류 간이회생 회생 파산 ' +
   '면책 개인회생 채무 부존재 소송 본안 기타 과거 허가 불허가 취하 종결 상담 대여금 구상금 양수금 ' +
   '전부 채권 부동산 인도 철거 고소 진정 수사').split(/\s+/)
);

const 제외폴더 = new Set(['node_modules', '.git', '$RECYCLE.BIN', 'System Volume Information']);

function 인수읽기(argv) {
  const 값 = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const 토큰 = argv[i];
    if (토큰.startsWith('--')) {
      const 키 = 토큰.slice(2);
      const 다음 = argv[i + 1];
      if (다음 === undefined || 다음.startsWith('--')) 값[키] = true;
      else {
        값[키] = 다음;
        i += 1;
      }
    } else 값._.push(토큰);
  }
  return 값;
}

function 사건번호(이름) {
  const a = 법원식.exec(이름);
  if (a) return a[0].replace(/\s+/g, '');
  const b = 회생식.exec(이름);
  return b ? b[1] : '';
}

function 의뢰인(이름, 번호) {
  let s = 이름;
  if (번호) s = s.split(번호).join(' ');
  s = s.replace(/(20\d{2}|\d{2})\s*[가-힣]{1,3}\s*\d{1,6}/g, ' ');
  s = s.replace(/\d{2}-\d{3,6}/g, ' ').replace(/\d+/g, ' ');
  s = s.replace(/[()[\]_.,-]/g, ' ');
  const 후보 = (s.match(/[가-힣]{2,4}/g) || []).filter((w) => !절차어.has(w));
  return 후보.length > 0 ? 후보[0] : '';
}

function csv칸(값) {
  const s = String(값 === undefined || 값 === null ? '' : 값);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 폴더 하나의 하위 전체 파일 수를 셉니다.
function 파일수(절대) {
  let 수 = 0;
  const 쌓기 = [절대];
  while (쌓기.length > 0) {
    const 현재 = 쌓기.pop();
    let 목록;
    try {
      목록 = fs.readdirSync(현재, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const 항목 of 목록) {
      if (항목.isDirectory()) {
        if (!제외폴더.has(항목.name)) 쌓기.push(path.join(현재, 항목.name));
      } else if (항목.isFile()) 수 += 1;
    }
  }
  return 수;
}

function 실행() {
  const 인수 = 인수읽기(process.argv.slice(2));
  const 대상 = 인수._[0];

  if (!대상) {
    console.log(`
사건 색인 만들기

  node 사건관리/색인.js <대상폴더> [선택항목]

선택
  --색인 <경로>   색인 csv의 저장 위치. 기본값은 대상폴더\\사건색인.csv

폴더 이름에 사건번호가 들어 있는 폴더를 모두 찾아 의뢰인과 사건번호로 정렬합니다.
아무것도 옮기거나 지우지 아니합니다.
`);
    return;
  }

  const 뿌리 = path.resolve(대상);
  if (!fs.existsSync(뿌리)) {
    console.error(`대상 폴더가 없습니다: ${뿌리}`);
    process.exitCode = 1;
    return;
  }

  console.log(`대상: ${뿌리}`);
  console.log('폴더 이름을 훑습니다.');

  const 행 = [];
  const 쌓기 = [뿌리];
  while (쌓기.length > 0) {
    const 현재 = 쌓기.pop();
    let 목록;
    try {
      목록 = fs.readdirSync(현재, { withFileTypes: true });
    } catch (e) {
      console.error(`  읽지 못한 폴더: ${현재}  (${e.code})`);
      continue;
    }
    for (const 항목 of 목록) {
      if (!항목.isDirectory()) continue;
      if (제외폴더.has(항목.name)) continue;
      const 경로 = path.join(현재, 항목.name);
      쌓기.push(경로);
      const 이름 = 항목.name.normalize('NFC');
      const 번호 = 사건번호(이름);
      if (!번호) continue;
      const 수 = 파일수(경로);
      행.push({
        의뢰인추정: 의뢰인(이름, 번호),
        사건번호: 번호,
        폴더명: 이름,
        파일수: 수,
        상태: 수 > 0 ? '자료 있음' : '비어 있음',
        위치: path.relative(뿌리, path.dirname(경로)) || '(대상 폴더 바로 아래)',
      });
    }
  }

  행.sort((a, b) => {
    if (!a.의뢰인추정 !== !b.의뢰인추정) return a.의뢰인추정 ? -1 : 1;
    if (a.의뢰인추정 !== b.의뢰인추정) return a.의뢰인추정.localeCompare(b.의뢰인추정, 'ko');
    return a.사건번호.localeCompare(b.사건번호, 'ko');
  });

  const 머리 = ['의뢰인추정', '사건번호', '폴더명', '파일수', '상태', '위치'];
  const 줄 = [머리.join(',')];
  for (const r of 행) 줄.push(머리.map((k) => csv칸(r[k])).join(','));

  const 색인 =
    인수['색인'] && 인수['색인'] !== true
      ? path.resolve(String(인수['색인']))
      : path.join(뿌리, '사건색인.csv');
  fs.writeFileSync(색인, `\uFEFF${줄.join('\n')}\n`, 'utf8');

  const 자료있음 = 행.filter((r) => r.파일수 > 0).length;
  console.log(`\n사건번호가 들어 있는 폴더 ${행.length}개`);
  console.log(`  자료 있음 ${자료있음}개, 비어 있음 ${행.length - 자료있음}개`);
  console.log(`색인: ${색인}`);
  console.log('\n비어 있는 사건폴더는 지우지 마십시오. 사건이 있었다는 기록입니다.');
}

실행();
