'use strict';

/* 런타임 소량 JS: 다크모드 토글 + 카테고리 필터. 프레임워크 없음. */

(function () {
  var root = document.documentElement;

  // --- 다크모드 토글 ---
  var toggle = document.getElementById('theme-toggle');

  function stored() {
    try {
      return localStorage.getItem('theme');
    } catch (e) {
      return null;
    }
  }
  function systemDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function effectiveTheme() {
    var t = stored();
    if (t === 'dark' || t === 'light') return t;
    return systemDark() ? 'dark' : 'light';
  }
  function syncToggleLabel() {
    if (!toggle) return;
    var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', next === 'dark' ? '다크 모드로 전환' : '라이트 모드로 전환');
    toggle.setAttribute('title', next === 'dark' ? '다크 모드' : '라이트 모드');
  }

  if (toggle) {
    syncToggleLabel();
    toggle.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) {}
      syncToggleLabel();
    });
  }

  // 사용자가 명시 선택하지 않았을 때만 OS 변경을 따라감
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (!stored()) syncToggleLabel();
    });
  }

  // --- 카테고리 필터 (홈에서만) ---
  var chips = document.querySelectorAll('.filters .chip');
  var cards = document.querySelectorAll('.post-list .card');

  if (chips.length && cards.length) {
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var filter = chip.getAttribute('data-filter');
        chips.forEach(function (c) {
          c.classList.toggle('is-active', c === chip);
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        cards.forEach(function (card) {
          var show = filter === '전체' || card.getAttribute('data-category') === filter;
          card.style.display = show ? '' : 'none';
        });
      });
    });
  }
})();
