'use strict';

/*
 * 폴더 정리 스크립트 (사무실 PC의 흩어진 사건 자료용)
 *
 * 한 폴더에 뒤섞여 있는 파일을 파일명의 낱말로 판별하여 사건폴더 표준 체계의
 * 해당 폴더로 분류합니다. 기본은 정리계획만 만들고 아무것도 옮기지 아니합니다.
 *
 * 실행 예)
 *   node 사건관리/정리.js "D:\사무소자료\김OO"
 *   node 사건관리/정리.js "D:\사무소자료\김OO" --실행
 *   node 사건관리/정리.js "D:\사무소자료\김OO" --실행 --복사
 *   node 사건관리/정리.js --규칙
 *
 * 분류 규칙은 아래 규칙표에 있습니다. 사무소의 파일명 습관에 맞추어 낱말을
 * 더하거나 빼면 그대로 반영됩니다.
 *
 * 의존성 없음.
 */

const fs = require('fs');
const path = require('path');
const { 기본폴더 } = require('./사건유형');

// 파일명에 아래 낱말이 있으면 해당 폴더로 분류합니다. 위에서부터 먼저 맞는 것을 씁니다.
const 규칙표 = [
  ['01_수임·위임', ['위임장', '위임약정', '수임계약', '수임약정', '보수약정', '견적', '영수증', '세금계산서']],
  ['02_채권자료', ['여신거래', '여신약정', '기본약관', '근저당권설정계약', '연대보증', '대출거래내역', '대출내역', '원리금', '부채증명', '채권양도', '양수금']],
  ['08_부수절차', ['사해행위', '물상대위', '가압류', '가처분', '보전처분', '회생', '파산', '면책', '변제계획', '채권신고', '고소', '고발', '수사', '진정']],
  ['05_집행권원', ['판결', '결정문', '지급명령', '집행문', '확정증명', '송달증명', '공정증서', '소장', '준비서면', '답변서', '청구취지', '보정서', '소제기증명']],
  ['06_집행·경매', ['경매', '압류', '추심', '전부명령', '개시결정', '현황조사', '매각물건', '매각허가', '입찰', '제3채무자', '진술최고']],
  ['07_배당·회수', ['배당', '채권계산서', '교부청구', '배당요구']],
  ['03_당사자·송달', ['주민등록', '초본', '가족관계', '기본증명', '혼인관계', '입양관계', '친양자', '제적', '법인등기', '등기사항전부증명서(법인', '출입국', '주소보정', '송달', '상속', '사망']],
  ['04_담보·재산조사', ['등기사항증명', '등기부', '토지대장', '건축물대장', '지적도', '감정평가', '시세', '실거래', '재산조회', '재산목록', '소득금액증명', '부가가치세', '건강보험', '국민연금', '지방세', '납부확인', '보험가입', '통장', '거래내역', '계좌', '급여', '임대차']],
  ['09_종결·보고', ['정산', '회수결과', '종결', '결과보고', '완료보고']],
];

const 작업중확장자 = new Set(['.tmp', '.bak', '.log', '.ini', '.lnk', '.url']);

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

function 분류(파일명) {
  const 이름 = 파일명.normalize('NFC');
  for (const [폴더, 낱말들] of 규칙표) {
    for (const 낱말 of 낱말들) {
      if (이름.includes(낱말)) return { 폴더, 근거: 낱말 };
    }
  }
  if (작업중확장자.has(path.extname(이름).toLowerCase())) {
    return { 폴더: '99_작업중', 근거: '임시파일 확장자' };
  }
  return { 폴더: '99_작업중', 근거: '판별 못함' };
}

function 훑기(뿌리) {
  const 결과 = [];
  const 쌓기 = [''];
  const 표준 = new Set(기본폴더.map((f) => f.split('/')[0]));
  while (쌓기.length > 0) {
    const 상대 = 쌓기.pop();
    const 절대 = path.join(뿌리, 상대);
    let 목록;
    try {
      목록 = fs.readdirSync(절대, { withFileTypes: true });
    } catch (e) {
      console.error(`  읽지 못한 폴더: ${절대}  (${e.code})`);
      continue;
    }
    for (const 항목 of 목록) {
      const 자식 = path.join(상대, 항목.name);
      if (항목.isDirectory()) {
        // 이미 표준 폴더로 정리된 곳은 건드리지 아니합니다.
        if (상대 === '' && 표준.has(항목.name)) continue;
        쌓기.push(자식);
      } else if (항목.isFile()) {
        if (항목.name === '정리계획.csv' || 항목.name === '중복보고서.csv') continue;
        결과.push(자식);
      }
    }
  }
  return 결과;
}

function csv칸(값) {
  const s = String(값 === undefined || 값 === null ? '' : 값);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function 겹치지않는이름(목적) {
  if (!fs.existsSync(목적)) return 목적;
  const 디렉터리 = path.dirname(목적);
  const 확장 = path.extname(목적);
  const 밑이름 = path.basename(목적, 확장);
  for (let n = 2; n < 1000; n += 1) {
    const 후보 = path.join(디렉터리, `${밑이름}_${n}${확장}`);
    if (!fs.existsSync(후보)) return 후보;
  }
  throw new Error(`이름이 겹쳐 옮기지 못하였습니다: ${목적}`);
}

// 파일을 옮기고 난 뒤 남은 빈 폴더를 지웁니다. 표준 폴더는 남겨 둡니다.
function 빈폴더지우기(뿌리) {
  const 표준 = new Set(기본폴더.map((f) => f.split('/')[0]));
  const 훑고지우기 = (상대) => {
    const 절대 = path.join(뿌리, 상대);
    let 목록;
    try {
      목록 = fs.readdirSync(절대, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const 항목 of 목록) {
      if (항목.isDirectory()) 훑고지우기(path.join(상대, 항목.name));
    }
    if (상대 === '') return;
    if (표준.has(상대.split(path.sep)[0])) return;
    try {
      if (fs.readdirSync(절대).length === 0) fs.rmdirSync(절대);
    } catch (e) {
      /* 지우지 못하여도 넘어갑니다 */
    }
  };
  훑고지우기('');
}

function 실행() {
  const 인수 = 인수읽기(process.argv.slice(2));

  if (인수['규칙']) {
    console.log('분류 규칙표\n');
    for (const [폴더, 낱말들] of 규칙표) {
      console.log(`  ${폴더}`);
      console.log(`      ${낱말들.join(', ')}\n`);
    }
    console.log('  99_작업중');
    console.log('      위 어느 낱말에도 걸리지 아니한 파일\n');
    console.log('규칙을 고치려면 사건관리/정리.js의 규칙표를 편집합니다.');
    return;
  }

  const 대상 = 인수._[0];
  if (!대상) {
    console.log(`
폴더 정리

  node 사건관리/정리.js <대상폴더> [선택항목]

선택
  --실행     정리계획대로 실제로 옮깁니다. 붙이지 아니하면 계획만 만듭니다
  --복사     옮기지 아니하고 복사합니다. 원본을 그대로 두고 싶을 때 씁니다
  --규칙     분류 규칙표를 보여 줍니다

기본은 대상폴더에 정리계획.csv만 만들고 아무것도 옮기거나 지우지 아니합니다.
계획을 확인하신 다음 --실행을 붙이십시오.
`);
    return;
  }

  const 뿌리 = path.resolve(대상);
  if (!fs.existsSync(뿌리)) {
    console.error(`대상 폴더가 없습니다: ${뿌리}`);
    process.exitCode = 1;
    return;
  }

  const 실제이동 = Boolean(인수['실행']);
  const 복사 = Boolean(인수['복사']);

  console.log(`대상: ${뿌리}`);
  const 파일들 = 훑기(뿌리);
  console.log(`정리할 파일 ${파일들.length.toLocaleString()}개${실제이동 ? (복사 ? '  (복사 실행)' : '  (이동 실행)') : '  (계획만 작성)'}\n`);

  const 집계 = new Map();
  const 줄 = ['처리,분류폴더,근거,파일명,현재위치,옮길위치'];
  let 옮김 = 0;
  let 실패 = 0;

  for (const 상대 of 파일들) {
    const 현재 = path.join(뿌리, 상대);
    const 파일명 = path.basename(상대);
    const { 폴더, 근거 } = 분류(파일명);
    집계.set(폴더, (집계.get(폴더) || 0) + 1);

    let 목적 = path.join(뿌리, 폴더, 파일명);
    let 처리 = '계획';

    if (실제이동) {
      if (path.dirname(현재) === path.dirname(목적)) {
        처리 = '그대로';
      } else {
        try {
          fs.mkdirSync(path.dirname(목적), { recursive: true });
          목적 = 겹치지않는이름(목적);
          if (복사) fs.copyFileSync(현재, 목적);
          else {
            try {
              fs.renameSync(현재, 목적);
            } catch (e) {
              // 다른 드라이브로 옮길 때에는 복사한 다음 지웁니다.
              fs.copyFileSync(현재, 목적);
              fs.unlinkSync(현재);
            }
          }
          처리 = 복사 ? '복사' : '이동';
          옮김 += 1;
        } catch (e) {
          처리 = `실패(${e.code || e.message})`;
          실패 += 1;
          console.error(`  ${처리}  ${상대}`);
        }
      }
    }

    줄.push([처리, 폴더, 근거, csv칸(파일명), csv칸(상대), csv칸(path.relative(뿌리, 목적))].join(','));
  }

  if (실제이동 && !복사) 빈폴더지우기(뿌리);

  const 계획 = path.join(뿌리, '정리계획.csv');
  fs.writeFileSync(계획, `\uFEFF${줄.join('\n')}\n`, 'utf8');

  console.log('분류 결과');
  for (const [폴더, 수] of [...집계.entries()].sort()) {
    console.log(`  ${폴더.padEnd(22, ' ')} ${String(수).padStart(6, ' ')}개`);
  }
  const 미판별 = 집계.get('99_작업중') || 0;
  console.log(`\n정리계획: ${계획}`);
  if (실제이동) {
    console.log(`${복사 ? '복사' : '이동'} ${옮김}개, 실패 ${실패}개`);
  } else {
    console.log('아무것도 옮기지 아니하였습니다. 계획을 확인하신 다음 --실행을 붙이십시오.');
  }
  if (미판별 > 0) {
    console.log(`\n99_작업중으로 간 ${미판별}개는 파일명만으로 판별하지 못한 것입니다.`);
    console.log('정리계획.csv의 근거 열이 "판별 못함"인 줄을 보시고, 자주 나오는 낱말은');
    console.log('사건관리/정리.js의 규칙표에 더하신 다음 다시 실행하십시오.');
  }
}

실행();
