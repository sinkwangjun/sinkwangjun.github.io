'use strict';

/*
 * 중복 파일 찾기 스크립트 (원드라이브·내 PC 폴더용)
 *
 * 파일의 내용을 SHA-256으로 해시하여 내용이 완전히 같은 파일만 중복으로 판정합니다.
 * 이름이 같다는 이유만으로 중복으로 보지 아니합니다. 사무소의 사건폴더에는
 * 주민등록등본.pdf 처럼 의뢰인마다 이름이 같고 내용이 다른 문서가 많기 때문입니다.
 *
 * 실행 예)
 *   node 사건관리/중복찾기.js "C:\Users\사용자\OneDrive"
 *   node 사건관리/중복찾기.js "C:\Users\사용자\OneDrive" --보고서 "D:\중복보고서.csv"
 *   node 사건관리/중복찾기.js "C:\Users\사용자\OneDrive" --격리 "D:\중복격리"
 *
 * 기본은 보고서만 만들고 아무것도 지우지 아니합니다. --격리를 붙이면 중복본을 지우지
 * 아니하고 지정한 폴더로 옮기기만 합니다. 옮긴 뒤 내용을 확인하고 직접 지우십시오.
 *
 * 의존성 없음.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// 건너뛸 폴더와 파일
const 제외폴더 = new Set(['node_modules', '.git', '$RECYCLE.BIN', 'System Volume Information', '.tmp.drivedownload']);
const 제외파일 = new Set(['desktop.ini', 'Thumbs.db', '.DS_Store']);

function 훑기(뿌리) {
  const 결과 = [];
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
      const 경로 = path.join(현재, 항목.name);
      if (항목.isDirectory()) {
        if (!제외폴더.has(항목.name)) 쌓기.push(경로);
      } else if (항목.isFile()) {
        if (제외파일.has(항목.name)) continue;
        try {
          const 정보 = fs.statSync(경로);
          if (정보.size > 0) 결과.push({ 경로, 크기: 정보.size, 수정일: 정보.mtime });
        } catch (e) {
          console.error(`  읽지 못한 파일: ${경로}  (${e.code})`);
        }
      }
    }
  }
  return 결과;
}

function 해시(경로) {
  const 해시기 = crypto.createHash('sha256');
  const 버퍼 = Buffer.alloc(1024 * 1024);
  const fd = fs.openSync(경로, 'r');
  try {
    let 읽음;
    while ((읽음 = fs.readSync(fd, 버퍼, 0, 버퍼.length, null)) > 0) {
      해시기.update(버퍼.subarray(0, 읽음));
    }
  } finally {
    fs.closeSync(fd);
  }
  return 해시기.digest('hex');
}

function csv칸(값) {
  const s = String(값 === undefined || 값 === null ? '' : 값);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function 용량표기(바이트) {
  const 단위 = ['B', 'KB', 'MB', 'GB'];
  let v = 바이트;
  let i = 0;
  while (v >= 1024 && i < 단위.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)}${단위[i]}`;
}

function 실행() {
  const 인수 = 인수읽기(process.argv.slice(2));
  const 대상 = 인수._[0];

  if (!대상) {
    console.log(`
중복 파일 찾기

  node 사건관리/중복찾기.js <대상폴더> [선택항목]

선택
  --보고서 <경로>   결과 csv의 저장 위치. 기본값은 대상폴더\\중복보고서.csv
  --격리   <경로>   중복본을 지우지 아니하고 이 폴더로 옮깁니다
  --최소   <바이트> 이 크기보다 작은 파일은 건너뜁니다. 기본값 1024

  기본은 보고서만 만들고 아무것도 지우거나 옮기지 아니합니다.
`);
    return;
  }

  if (!fs.existsSync(대상)) {
    console.error(`대상 폴더가 없습니다: ${대상}`);
    process.exitCode = 1;
    return;
  }

  const 최소 = 인수['최소'] && 인수['최소'] !== true ? Number(인수['최소']) : 1024;
  console.log(`대상: ${대상}`);
  console.log('파일 목록을 훑습니다.');
  const 전체 = 훑기(대상).filter((f) => f.크기 >= 최소);
  console.log(`  파일 ${전체.length.toLocaleString()}개`);

  // 크기가 같은 파일만 해시합니다. 크기가 다르면 내용이 같을 수 없습니다.
  const 크기별 = new Map();
  for (const f of 전체) {
    if (!크기별.has(f.크기)) 크기별.set(f.크기, []);
    크기별.get(f.크기).push(f);
  }
  const 해시대상 = [...크기별.values()].filter((v) => v.length > 1).flat();
  console.log(`  크기가 겹쳐 내용을 확인할 파일 ${해시대상.length.toLocaleString()}개`);

  const 해시별 = new Map();
  let 진행 = 0;
  for (const f of 해시대상) {
    진행 += 1;
    if (진행 % 200 === 0) process.stdout.write(`\r  내용 확인 ${진행}/${해시대상.length}`);
    let h;
    try {
      h = 해시(f.경로);
    } catch (e) {
      console.error(`\n  읽지 못한 파일: ${f.경로}  (${e.code})`);
      continue;
    }
    if (!해시별.has(h)) 해시별.set(h, []);
    해시별.get(h).push(f);
  }
  if (진행 >= 200) process.stdout.write('\n');

  const 묶음 = [...해시별.entries()].filter(([, v]) => v.length > 1);
  let 낭비 = 0;
  const 줄 = ['구분,해시,처리,파일명,크기,수정일,경로'];

  for (const [h, v] of 묶음) {
    // 가장 오래된 것을 원본으로 보존하고 나머지를 중복본으로 봅니다.
    v.sort((a, b) => a.수정일 - b.수정일);
    v.forEach((f, i) => {
      if (i > 0) 낭비 += f.크기;
      줄.push(
        [
          '내용동일',
          h.slice(0, 16),
          i === 0 ? '보존(최초)' : '중복본',
          csv칸(path.basename(f.경로)),
          f.크기,
          f.수정일.toISOString().slice(0, 10),
          csv칸(f.경로),
        ].join(',')
      );
    });
  }

  const 보고서 =
    인수['보고서'] && 인수['보고서'] !== true
      ? String(인수['보고서'])
      : path.join(대상, '중복보고서.csv');
  fs.writeFileSync(보고서, `\uFEFF${줄.join('\n')}\n`, 'utf8');

  console.log(`\n내용이 완전히 같은 묶음 ${묶음.length}개`);
  console.log(`중복본 ${묶음.reduce((a, [, v]) => a + v.length - 1, 0)}개, 되찾을 용량 ${용량표기(낭비)}`);
  console.log(`보고서: ${보고서}`);

  const 격리 = 인수['격리'];
  if (격리 && 격리 !== true) {
    const 격리폴더 = path.resolve(String(격리));
    fs.mkdirSync(격리폴더, { recursive: true });
    let 옮김 = 0;
    for (const [, v] of 묶음) {
      v.sort((a, b) => a.수정일 - b.수정일);
      for (const f of v.slice(1)) {
        const 상대 = path.relative(대상, f.경로);
        const 목적 = path.join(격리폴더, 상대);
        fs.mkdirSync(path.dirname(목적), { recursive: true });
        try {
          fs.renameSync(f.경로, 목적);
          옮김 += 1;
        } catch (e) {
          try {
            fs.copyFileSync(f.경로, 목적);
            fs.unlinkSync(f.경로);
            옮김 += 1;
          } catch (e2) {
            console.error(`  옮기지 못하였습니다: ${f.경로}  (${e2.code})`);
          }
        }
      }
    }
    console.log(`중복본 ${옮김}개를 격리 폴더로 옮겼습니다: ${격리폴더}`);
    console.log('내용을 확인하신 다음 격리 폴더를 직접 지우십시오.');
  } else {
    console.log('아무것도 지우거나 옮기지 아니하였습니다. 옮기려면 --격리 <폴더>를 붙입니다.');
  }
}

실행();
