(function () {
  'use strict';

  var STORAGE_KEY = 'todo-app:v1';
  var CATEGORY_LABELS = { work: '업무', personal: '개인', study: '공부' };
  var CATEGORY_ORDER = ['work', 'personal', 'study'];

  // 입력 내용에 이 낱말이 들어 있으면 해당 카테고리로 자동 분류한다.
  // 여러 카테고리 낱말이 섞이면 더 많이 맞은 쪽을 고르고, 같으면 고르지 않는다.
  var CATEGORY_KEYWORDS = {
    work: ['업무', '회의', '미팅', '보고서', '보고', '기획', '프로젝트', '발표', '팀장', '상사', '동료',
      '회사', '출근', '출장', '야근', '거래처', '고객', '클라이언트', '업체', '계약', '견적', '제안서',
      '결재', '메일', '이메일'],
    personal: ['장보기', '마트', '세탁', '빨래', '청소', '설거지', '요리', '병원', '약국', '운동', '헬스',
      '요가', '산책', '은행', '택배', '약속', '생일', '선물', '가족', '엄마', '아빠', '친구', '미용실',
      '쇼핑', '여행', '예약', '저녁', '점심'],
    study: ['공부', '과제', '숙제', '시험', '중간고사', '기말', '퀴즈', '강의', '인강', '수업', '학원',
      '복습', '예습', '암기', '단어', '영어', '토익', '자격증', '문제집', '독서', '책', '논문',
      '레포트', '리포트', '스터디']
  };

  // 상태: 할 일 배열, 입력창에서 직전에 고른 카테고리, 현재 수정 중인 항목 id, 현재 탭, 테마
  var todos = [];
  var lastCategory = 'work';
  var editingId = null;
  var currentFilter = 'all';
  var theme = 'system';

  // 방금 지운 항목을 되돌릴 수 있도록 원래 위치와 타이머를 기억한다.
  var pendingDelete = null;

  // 드래그로 옮기는 중인 항목의 id
  var dragSourceId = null;

  // 페이지: 현재 페이지(0부터)와 한 페이지에 보여 줄 항목 수. pageSize는 화면 높이에
  // 맞춰 render()가 다시 계산한다. 화면이 아주 낮아도 최소 MIN_PAGE_SIZE개는 보인다.
  var MIN_PAGE_SIZE = 3;
  var currentPage = 0;
  var pageSize = 6;

  // 드래그 중 화살표 위에 잠깐 머물면 페이지를 넘기기 위한 타이머
  var pageFlipTimer = null;

  // 페이지를 넘길 때 목록에 붙일 슬라이드 방향("next" 또는 "prev")
  var pendingSlide = null;

  // 첫 render()가 끝났는지. 처음 그릴 때는 카드를 미끄러뜨리지 않는다.
  var hasRendered = false;

  // localStorage에서 상태를 읽는다. 값이 없거나 JSON이 깨져 있으면 빈 목록으로 시작한다.
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        todos = [];
        lastCategory = 'work';
        theme = 'system';
        return;
      }
      var parsed = JSON.parse(raw);
      todos = Array.isArray(parsed.todos) ? parsed.todos : [];
      lastCategory = parsed.lastCategory || 'work';
      theme = (parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system') ? parsed.theme : 'system';
    } catch (e) {
      todos = [];
      lastCategory = 'work';
      theme = 'system';
    }
  }

  // 상태 전체를 localStorage에 다시 쓴다.
  function save() {
    var data = { todos: todos, lastCategory: lastCategory, theme: theme };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getFilteredTodos() {
    if (currentFilter === 'all') return todos;
    return todos.filter(function (t) {
      return t.category === currentFilter;
    });
  }

  function getEmptyMessage(filter) {
    if (filter === 'all') {
      return '아직 할 일이 없어요. 위에서 첫 항목을 추가해 보세요.';
    }
    return CATEGORY_LABELS[filter] + ' 항목이 없어요.';
  }

  function buildCategorySelect(selectedCategory) {
    var selectEl = document.createElement('select');
    selectEl.className = 'todo-edit-category';
    selectEl.setAttribute('aria-label', '카테고리 수정');
    CATEGORY_ORDER.forEach(function (cat) {
      var opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = CATEGORY_LABELS[cat];
      selectEl.appendChild(opt);
    });
    selectEl.value = selectedCategory;
    return selectEl;
  }

  // 현재 탭(currentFilter)에 맞게 목록을 통째로 다시 그린다. 수정 중인 항목이
  // 있으면 입력 내용과 커서 위치, 초점을 기억해 두었다가 다시 그린 뒤 그대로 복원한다.
  function renderList() {
    var listEl = document.getElementById('todo-list');

    var editDraft = null;
    if (editingId !== null) {
      var activeInput = listEl.querySelector('.todo-edit-input');
      if (activeInput) {
        var activeSelect = listEl.querySelector('.todo-edit-category');
        editDraft = {
          text: activeInput.value,
          category: activeSelect ? activeSelect.value : null,
          focusOnSelect: document.activeElement === activeSelect,
          selectionStart: activeInput.selectionStart,
          selectionEnd: activeInput.selectionEnd
        };
      }
    }

    listEl.innerHTML = '';

    var filtered = getFilteredTodos();
    var totalPages = getTotalPages(filtered.length);
    currentPage = Math.max(0, Math.min(currentPage, totalPages - 1));
    renderPager(totalPages);

    if (filtered.length === 0) {
      var emptyEl = document.createElement('li');
      emptyEl.className = 'empty-message';
      emptyEl.textContent = getEmptyMessage(currentFilter);
      listEl.appendChild(emptyEl);
      return;
    }

    var pageStart = currentPage * pageSize;
    filtered.slice(pageStart, pageStart + pageSize).forEach(function (todo) {
      var item = document.createElement('li');
      item.className = 'todo-item' + (todo.done ? ' done' : '');
      item.dataset.id = todo.id;

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo-checkbox';
      checkbox.checked = !!todo.done;
      checkbox.setAttribute('aria-label', '완료 체크');

      if (todo.id === editingId) {
        item.appendChild(checkbox);

        var editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'todo-edit-input';
        editInput.maxLength = 100;
        editInput.value = editDraft ? editDraft.text : todo.text;
        editInput.setAttribute('aria-label', '할 일 내용 수정');

        var editSelect = buildCategorySelect(editDraft ? editDraft.category : todo.category);

        item.appendChild(editInput);
        item.appendChild(editSelect);
      } else {
        item.draggable = true;

        var dragHandle = document.createElement('span');
        dragHandle.className = 'todo-drag-handle';
        dragHandle.setAttribute('aria-hidden', 'true');
        dragHandle.title = '드래그해서 순서 바꾸기 (키보드: Alt+↑/↓)';
        dragHandle.textContent = '⠿';
        item.appendChild(dragHandle);

        item.appendChild(checkbox);

        var textEl = document.createElement('span');
        textEl.className = 'todo-text';
        textEl.textContent = todo.text;

        var tagEl = document.createElement('span');
        tagEl.className = 'todo-tag todo-tag-' + todo.category;
        tagEl.textContent = CATEGORY_LABELS[todo.category] || todo.category;

        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'todo-edit-btn';
        editBtn.textContent = '수정';

        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'todo-delete-btn';
        deleteBtn.textContent = '삭제';

        item.appendChild(textEl);
        item.appendChild(tagEl);
        item.appendChild(editBtn);
        item.appendChild(deleteBtn);
      }

      listEl.appendChild(item);
    });

    // 포커스는 요소가 문서에 연결된 뒤에만 줄 수 있으므로, 모든 행을 목록에
    // 붙인 다음 수정 중인 입력창(또는 카테고리 선택)에 초점을 맞춘다.
    if (editingId !== null) {
      var editInputEl = listEl.querySelector('.todo-edit-input');
      var editSelectEl = listEl.querySelector('.todo-edit-category');
      if (editDraft && editDraft.focusOnSelect && editSelectEl) {
        editSelectEl.focus();
      } else if (editInputEl) {
        editInputEl.focus();
        var start = editDraft ? editDraft.selectionStart : editInputEl.value.length;
        var end = editDraft ? editDraft.selectionEnd : editInputEl.value.length;
        editInputEl.setSelectionRange(start, end);
      }
    }
  }

  // 탭의 활성 표시와 각 탭의 남은(미완료) 항목 수를 다시 그린다.
  function renderTabs() {
    var tabsEl = document.querySelector('.tabs');
    Array.prototype.forEach.call(tabsEl.querySelectorAll('.tab-btn'), function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === currentFilter);
    });

    var countAllEl = document.getElementById('count-all');
    countAllEl.textContent = todos.filter(function (t) {
      return !t.done;
    }).length;

    CATEGORY_ORDER.forEach(function (cat) {
      var countEl = document.getElementById('count-' + cat);
      countEl.textContent = todos.filter(function (t) {
        return t.category === cat && !t.done;
      }).length;
    });
  }

  // 할 일 배열 하나를 받아 전체/완료/남음/퍼센트와 카테고리별 수치를 계산한다.
  // byCategory는 항상 넘겨받은 배열 기준으로 세 카테고리를 모두 계산한다.
  function getStats(list) {
    var total = list.length;
    var done = list.filter(function (t) {
      return t.done;
    }).length;
    var left = total - done;
    var percent = total === 0 ? 0 : Math.round((done / total) * 100);

    var byCategory = {};
    CATEGORY_ORDER.forEach(function (cat) {
      var catList = list.filter(function (t) {
        return t.category === cat;
      });
      var catDone = catList.filter(function (t) {
        return t.done;
      }).length;
      byCategory[cat] = {
        total: catList.length,
        done: catDone,
        percent: catList.length === 0 ? 0 : Math.round((catDone / catList.length) * 100)
      };
    });

    return { total: total, done: done, left: left, percent: percent, byCategory: byCategory };
  }

  // 현재 탭 기준으로 전체 진행률 막대·요약 숫자를 다시 그리고, 카테고리별 줄은
  // 항상 전체 데이터 기준으로 그리면서 현재 탭만 강조한다.
  function renderProgress() {
    var fillEl = document.getElementById('progress-fill');
    var barEl = document.getElementById('overall-progress-bar');
    var textEl = document.getElementById('progress-text');
    var completeEl = document.getElementById('progress-complete-message');

    var fullStats = getStats(todos);
    var scopedStats = currentFilter === 'all' ? fullStats : getStats(getFilteredTodos());

    if (scopedStats.total === 0) {
      textEl.textContent = '할 일을 추가해 보세요';
      fillEl.style.width = '0%';
      barEl.setAttribute('aria-valuenow', '0');
      completeEl.hidden = true;
    } else {
      textEl.textContent = scopedStats.done + '/' + scopedStats.total + ' 완료 · ' + scopedStats.percent + '%';
      fillEl.style.width = scopedStats.percent + '%';
      barEl.setAttribute('aria-valuenow', String(scopedStats.percent));
      completeEl.hidden = scopedStats.done !== scopedStats.total;
    }

    document.getElementById('summary-total').textContent = scopedStats.total;
    document.getElementById('summary-done').textContent = scopedStats.done;
    document.getElementById('summary-left').textContent = scopedStats.left;

    CATEGORY_ORDER.forEach(function (cat) {
      var catStats = fullStats.byCategory[cat];
      var catFillEl = document.getElementById('cat-fill-' + cat);
      var catRowEl = document.getElementById('cat-row-' + cat);
      var catBarEl = catRowEl.querySelector('.progress-bar-small');
      var catCountEl = document.getElementById('cat-count-' + cat);

      catFillEl.style.width = catStats.percent + '%';
      catBarEl.setAttribute('aria-valuenow', String(catStats.percent));
      catCountEl.textContent = catStats.done + '/' + catStats.total;
      catRowEl.classList.toggle('active', currentFilter === cat);
    });
  }

  function getTotalPages(count) {
    return Math.max(1, Math.ceil(count / pageSize));
  }

  // 페이지 넘김 줄(이전 · 1 / 3 · 다음)을 그린다. 한 페이지뿐이면 보이지 않게 하되
  // 자리는 남겨서, 페이지가 생기고 없어질 때 카드 높이가 흔들리지 않게 한다.
  function renderPager(totalPages) {
    var pagerEl = document.getElementById('pager');
    pagerEl.classList.toggle('pager-hidden', totalPages <= 1);
    document.getElementById('page-indicator').textContent = (currentPage + 1) + ' / ' + totalPages;
    document.getElementById('page-prev').disabled = currentPage === 0;
    document.getElementById('page-next').disabled = currentPage >= totalPages - 1;
  }

  // 지금 화면 높이에 목록 항목이 몇 개 들어가는지 계산한다. 카드에서 목록을 뺀 나머지
  // 높이와, 지금 그려진 항목의 평균 높이를 재서 화면 밖으로 넘치지 않는 개수를 고른다.
  function computePageSize() {
    var appEl = document.querySelector('.app');
    var listEl = document.getElementById('todo-list');
    var items = listEl.querySelectorAll('.todo-item');
    if (items.length === 0) return pageSize;

    var gap = parseFloat(getComputedStyle(listEl).rowGap) || 0;
    var totalItemHeight = 0;
    Array.prototype.forEach.call(items, function (el) {
      totalItemHeight += el.offsetHeight;
    });
    var itemHeight = totalItemHeight / items.length;

    var bodyStyle = getComputedStyle(document.body);
    var bodyPadding = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
    var chromeHeight = appEl.offsetHeight - listEl.offsetHeight;
    var available = window.innerHeight - bodyPadding - chromeHeight;

    return Math.max(MIN_PAGE_SIZE, Math.floor((available + gap) / (itemHeight + gap)));
  }

  // direction이 1이면 다음 페이지, -1이면 이전 페이지로 넘긴다.
  function goToPage(direction) {
    var totalPages = getTotalPages(getFilteredTodos().length);
    var target = currentPage + direction;
    if (target < 0 || target >= totalPages) return;
    currentPage = target;
    pendingSlide = direction > 0 ? 'next' : 'prev';
    render();
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // 페이지를 넘겼다면 목록이 옆에서 밀려 들어오게 한다.
  function playPageSlide() {
    if (!pendingSlide) return;
    var listEl = document.getElementById('todo-list');
    var className = pendingSlide === 'next' ? 'slide-from-right' : 'slide-from-left';
    pendingSlide = null;
    if (prefersReducedMotion()) return;
    listEl.classList.remove('slide-from-right', 'slide-from-left');
    void listEl.offsetWidth;
    listEl.classList.add(className);
  }

  // 카드는 화면 세로 가운데에 놓이므로, 항목 수가 바뀌면 카드 위치가 달라진다.
  // 바뀌기 전 위치에서 새 위치로 미끄러지듯 옮겨 가게 한다.
  function playCardSlide(previousTop) {
    // 페이지를 처음 그릴 때는 옮겨 갈 이전 위치가 없으므로 움직이지 않는다.
    if (!hasRendered) {
      hasRendered = true;
      return;
    }
    var appEl = document.querySelector('.app');
    var delta = previousTop - appEl.getBoundingClientRect().top;
    if (Math.abs(delta) < 1 || prefersReducedMotion()) return;
    appEl.style.transition = 'none';
    appEl.style.transform = 'translateY(' + delta + 'px)';
    void appEl.offsetWidth;
    appEl.style.transition = '';
    appEl.style.transform = '';
  }

  // 테마, 목록, 탭 숫자, 진행률을 한 번에 다시 그린다.
  function render() {
    var appEl = document.querySelector('.app');
    var previousTop = appEl.getBoundingClientRect().top;

    applyTheme();

    var clearBtn = document.getElementById('clear-completed-btn');
    clearBtn.disabled = !todos.some(function (t) {
      return t.done;
    });
    document.getElementById('clear-all-btn').disabled = todos.length === 0;

    renderList();
    renderTabs();
    renderProgress();

    // 그려 본 결과로 한 페이지에 들어갈 개수를 다시 재고, 달라졌으면 목록만 한 번 더 그린다.
    var fittedSize = computePageSize();
    if (fittedSize !== pageSize) {
      var firstIndexOnPage = currentPage * pageSize;
      pageSize = fittedSize;
      currentPage = Math.floor(firstIndexOnPage / pageSize);
      renderList();
    }

    playPageSlide();
    playCardSlide(previousTop);
  }

  // 특정 항목의 체크박스나 버튼으로 포커스를 옮긴다. render()가 목록을 통째로
  // 다시 그리면서 원래 포커스가 있던 요소가 사라지므로, 키보드로 연달아 작업할
  // 때 포커스가 보이지 않는 <body>로 빠지지 않도록 같은 항목의 다른 컨트롤로 되돌린다.
  function focusItemControl(id, preferredClass) {
    var listEl = document.getElementById('todo-list');
    var itemEl = listEl.querySelector('.todo-item[data-id="' + id + '"]');
    if (itemEl) {
      var target = itemEl.querySelector('.' + preferredClass);
      if (target && target.disabled) target = null;
      if (!target) target = itemEl.querySelector('.todo-checkbox');
      if (target) {
        target.focus();
        return;
      }
    }
    document.getElementById('todo-input').focus();
  }

  // 항목을 지운 뒤, 같은 위치(또는 그 앞)의 항목이나 입력창으로 포커스를 옮긴다.
  function focusAfterDelete(filteredIndex) {
    var listEl = document.getElementById('todo-list');
    var items = listEl.querySelectorAll('.todo-item');
    if (items.length === 0) {
      document.getElementById('todo-input').focus();
      return;
    }
    var clamped = Math.max(0, Math.min(filteredIndex, items.length - 1));
    var target = items[clamped].querySelector('.todo-delete-btn') || items[clamped].querySelector('.todo-checkbox');
    if (target) target.focus();
  }

  // 탭을 바꾸고, 특정 카테고리 탭이면 입력창의 카테고리를 그 값으로 맞춘다.
  function switchTab(filter) {
    if (currentFilter === filter) return;
    currentFilter = filter;
    currentPage = 0;

    var categorySelectEl = document.getElementById('category-select');
    categorySelectEl.value = filter === 'all' ? lastCategory : filter;
    // 탭이 카테고리 선택을 새로 정했으므로, 전체 탭이면 입력 중인 내용으로 다시 자동 분류한다.
    categoryPickedByUser = false;
    applyAutoCategory();

    render();
  }

  // 항목을 todos 배열의 다른 위치로 옮긴다. toIndex는 항목을 뺀 뒤의 배열 기준이다.
  function moveTodo(id, toIndex) {
    var fromIndex = todos.findIndex(function (t) {
      return t.id === id;
    });
    if (fromIndex === -1) return;

    var item = todos[fromIndex];
    todos.splice(fromIndex, 1);
    var clamped = Math.max(0, Math.min(toIndex, todos.length));
    todos.splice(clamped, 0, item);
    save();
    render();
  }

  // 현재 탭(필터)에서 보이는 순서를 기준으로 한 칸 위/아래로 옮긴다. direction은 -1(위) 또는 1(아래).
  // 다른 카테고리 항목들 사이의 상대적인 순서는 그대로 두고, 바로 이웃한 같은 탭 항목과만 자리를 바꾼다.
  function moveWithinFilter(id, direction) {
    var filtered = getFilteredTodos();
    var posInFiltered = filtered.findIndex(function (t) {
      return t.id === id;
    });
    if (posInFiltered === -1) return;

    var neighborPos = posInFiltered + direction;
    if (neighborPos < 0 || neighborPos >= filtered.length) return;
    var neighborId = filtered[neighborPos].id;

    var fromIndex = todos.findIndex(function (t) {
      return t.id === id;
    });
    if (fromIndex === -1) return;
    var without = todos.slice(0, fromIndex).concat(todos.slice(fromIndex + 1));
    var neighborIndexInWithout = without.findIndex(function (t) {
      return t.id === neighborId;
    });
    if (neighborIndexInWithout === -1) return;

    var toIndex = direction < 0 ? neighborIndexInWithout : neighborIndexInWithout + 1;
    // 페이지 경계를 넘어가면 옮긴 항목이 보이는 페이지로 함께 넘어간다.
    var targetPage = Math.floor(neighborPos / pageSize);
    if (targetPage !== currentPage) {
      pendingSlide = targetPage > currentPage ? 'next' : 'prev';
      currentPage = targetPage;
    }
    moveTodo(id, toIndex);
    focusItemControl(id, 'todo-checkbox');
  }

  // 드래그한 항목을 targetId 항목 바로 앞(after가 true면 바로 뒤)으로 옮긴다.
  // 대상 항목을 기준으로 자리를 잡으므로 카테고리 탭에서 옮겨도 다른 카테고리
  // 항목들의 순서는 그대로 남는다.
  function moveNextToId(draggedId, targetId, after) {
    if (draggedId === targetId) return;
    var fromIndex = todos.findIndex(function (t) {
      return t.id === draggedId;
    });
    if (fromIndex === -1) return;
    var without = todos.slice(0, fromIndex).concat(todos.slice(fromIndex + 1));
    var targetIndexInWithout = without.findIndex(function (t) {
      return t.id === targetId;
    });
    if (targetIndexInWithout === -1) return;
    moveTodo(draggedId, after ? targetIndexInWithout + 1 : targetIndexInWithout);
  }

  // 포인터가 항목의 아래쪽 절반에 있으면 그 항목 뒤에 놓는다.
  function isLowerHalf(itemEl, clientY) {
    var rect = itemEl.getBoundingClientRect();
    return clientY > rect.top + rect.height / 2;
  }

  function clearDropMarkers(listEl) {
    Array.prototype.forEach.call(listEl.querySelectorAll('.drop-before, .drop-after'), function (el) {
      el.classList.remove('drop-before', 'drop-after');
    });
  }

  // 화면 상단에 오늘 날짜를 표시한다.
  function renderTodayDate() {
    var dateEl = document.getElementById('today-date');
    if (!dateEl) return;
    var now = new Date();
    dateEl.textContent = now.getFullYear() + '년 ' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일';
  }

  // 내용에 들어 있는 키워드 수를 카테고리별로 세어 가장 많은 카테고리를 돌려준다.
  // 맞는 낱말이 없거나 두 카테고리가 같은 수로 맞으면 null을 돌려준다.
  function guessCategory(text) {
    var normalized = text.toLowerCase();
    var best = null;
    var bestScore = 0;
    var tied = false;
    CATEGORY_ORDER.forEach(function (cat) {
      var score = CATEGORY_KEYWORDS[cat].filter(function (word) {
        return normalized.indexOf(word) !== -1;
      }).length;
      if (score > bestScore) {
        best = cat;
        bestScore = score;
        tied = false;
      } else if (score > 0 && score === bestScore) {
        tied = true;
      }
    });
    return tied ? null : best;
  }

  function generateId() {
    return Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  }

  // theme이 "system"이면 운영체제 설정을 따라 지금 실제로 적용돼야 하는 테마를 돌려준다.
  function getEffectiveTheme() {
    if (theme === 'light' || theme === 'dark') return theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // theme 값에 맞게 <html>의 data-theme 속성과 테마 버튼 아이콘을 맞춘다.
  // "system"이면 속성을 지워서 CSS의 prefers-color-scheme 규칙이 그대로 작동하게 한다.
  function applyTheme() {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    var toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      var isDark = getEffectiveTheme() === 'dark';
      var label = isDark ? '밝은 화면으로 전환' : '어두운 화면으로 전환';
      toggleBtn.textContent = isDark ? '🌙' : '☀️';
      toggleBtn.setAttribute('aria-label', label);
      toggleBtn.title = label;
    }
  }

  // 버튼을 누르면 지금 실제로 보이는 테마의 반대쪽으로 명시적으로 정하고 저장한다.
  function toggleTheme() {
    theme = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    save();
    render();
  }

  function formatDateForFilename(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // 현재 데이터를 날짜가 들어간 이름의 JSON 파일로 내려받는다.
  function exportTodos() {
    var data = { todos: todos, lastCategory: lastCategory, theme: theme };
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = 'todo-backup-' + formatDateForFilename(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 클릭 직후 바로 해제하면 일부 브라우저에서 내려받기가 취소되므로 조금 뒤에 해제한다.
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // todos가 배열이고, 그 안의 각 항목에 id, text, category, done이 모두 올바른
  // 형식으로 있는지 검사한다. id가 겹치면 수정·삭제·이동이 엉키므로 함께 막는다.
  function isValidBackup(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.todos)) return false;
    var seenIds = {};
    return data.todos.every(function (t) {
      if (!t || typeof t !== 'object') return false;
      if (typeof t.id !== 'string' || t.id === '' || seenIds[t.id]) return false;
      seenIds[t.id] = true;
      return typeof t.text === 'string' && t.text.trim() !== '' &&
        CATEGORY_ORDER.indexOf(t.category) !== -1 &&
        typeof t.done === 'boolean';
    });
  }

  // 검사를 통과한 백업 데이터를 확인 받은 뒤 현재 목록에 덮어쓴다.
  function applyImportedData(parsed) {
    if (!isValidBackup(parsed)) {
      window.alert('가져올 수 없는 파일이에요.');
      return;
    }
    if (!window.confirm('지금 목록을 이 파일 내용으로 덮어쓸까요?')) return;

    todos = parsed.todos.map(function (t) {
      return {
        id: t.id,
        text: t.text.trim().slice(0, 100),
        category: t.category,
        done: t.done,
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now()
      };
    });
    lastCategory = CATEGORY_ORDER.indexOf(parsed.lastCategory) !== -1 ? parsed.lastCategory : 'work';
    theme = (parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system') ? parsed.theme : theme;
    editingId = null;
    currentFilter = 'all';
    currentPage = 0;
    // 가져오기 전에 지운 항목은 새 목록에 되살리면 안 되므로 되돌리기 알림을 닫는다.
    clearPendingDelete();
    document.getElementById('undo-toast').hidden = true;
    document.getElementById('category-select').value = lastCategory;

    save();
    render();
  }

  // 사용자가 고른 파일을 읽어서 JSON으로 해석하고 적용한다.
  function handleImportFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        window.alert('가져올 수 없는 파일이에요.');
        return;
      }
      applyImportedData(parsed);
    };
    reader.onerror = function () {
      window.alert('가져올 수 없는 파일이에요.');
    };
    reader.readAsText(file);
  }

  // 목록 맨 아래에 새 항목을 추가한다. 앞뒤 공백 제거 후 비어 있으면 아무 일도 하지 않는다.
  function addTodo(text, category) {
    var trimmed = text.trim();
    if (!trimmed) return;
    trimmed = trimmed.slice(0, 100);

    todos.push({
      id: generateId(),
      text: trimmed,
      category: category,
      done: false,
      createdAt: Date.now()
    });
    lastCategory = category;
    // 새 항목은 맨 아래에 붙으므로 마지막 페이지를 보여 준다(넘치는 값은 renderList가 맞춘다).
    var lastPage = getTotalPages(getFilteredTodos().length) - 1;
    if (lastPage > currentPage) pendingSlide = 'next';
    currentPage = lastPage;
    save();
    render();
  }

  // 완료와 미완료를 전환한다.
  function toggleTodo(id) {
    var todo = todos.find(function (t) {
      return t.id === id;
    });
    if (!todo) return;
    todo.done = !todo.done;
    save();
    render();
    focusItemControl(id, 'todo-checkbox');
  }

  // 내용 또는 카테고리를 수정한다. 트리밍 후 내용이 비면 변경 전체를 취소하고
  // 원래 내용을 그대로 유지한다.
  function updateTodo(id, changes) {
    var todo = todos.find(function (t) {
      return t.id === id;
    });
    if (!todo) return;

    var trimmedText = typeof changes.text === 'string' ? changes.text.trim() : null;
    if (trimmedText === '') {
      return;
    }
    if (trimmedText !== null) {
      todo.text = trimmedText.slice(0, 100);
    }
    if (changes.category) {
      todo.category = changes.category;
    }
    save();
    render();
  }

  // 항목을 지우고, 되돌리기 알림을 띄우기 위해 원래 위치를 기억한다.
  function deleteTodo(id) {
    var index = todos.findIndex(function (t) {
      return t.id === id;
    });
    if (index === -1) return;

    var filteredIndex = getFilteredTodos().findIndex(function (t) {
      return t.id === id;
    });

    var removed = todos[index];
    todos.splice(index, 1);
    if (editingId === id) {
      editingId = null;
    }
    save();
    render();
    showUndoToast(removed, index);
    focusAfterDelete(filteredIndex);
  }

  function clearPendingDelete() {
    if (pendingDelete && pendingDelete.timeoutId) {
      clearTimeout(pendingDelete.timeoutId);
    }
    pendingDelete = null;
  }

  // "삭제됨 · 되돌리기" 알림을 5초간 띄운다. 이전 알림이 남아 있으면 그 삭제는 확정하고 새 알림으로 바꾼다.
  function showUndoToast(todo, index) {
    clearPendingDelete();
    var toastEl = document.getElementById('undo-toast');
    toastEl.hidden = false;
    var timeoutId = setTimeout(function () {
      pendingDelete = null;
      toastEl.hidden = true;
    }, 5000);
    pendingDelete = { todo: todo, index: index, timeoutId: timeoutId };
  }

  function undoDelete() {
    if (!pendingDelete) return;
    var insertAt = Math.min(pendingDelete.index, todos.length);
    var restoredId = pendingDelete.todo.id;
    todos.splice(insertAt, 0, pendingDelete.todo);
    clearTimeout(pendingDelete.timeoutId);
    pendingDelete = null;
    document.getElementById('undo-toast').hidden = true;
    save();
    render();
    focusItemControl(restoredId, 'todo-checkbox');
  }

  // 완료된 항목을 한꺼번에 지운다. 되돌릴 수 없으므로 한 번 확인을 받는다.
  function clearCompleted() {
    var hasCompleted = todos.some(function (t) {
      return t.done;
    });
    if (!hasCompleted) return;
    if (!window.confirm('완료된 항목을 모두 지울까요?')) return;

    todos = todos.filter(function (t) {
      return !t.done;
    });
    if (editingId !== null && !todos.some(function (t) { return t.id === editingId; })) {
      editingId = null;
    }
    save();
    render();

    // 버튼이 비활성화되면서 포커스를 잃으므로 남은 항목이나 입력창으로 옮긴다.
    var firstCheckbox = document.querySelector('#todo-list .todo-checkbox');
    if (firstCheckbox) {
      firstCheckbox.focus();
    } else {
      document.getElementById('todo-input').focus();
    }
  }

  // 지금 보고 있는 탭과 상관없이 모든 항목을 지운다. 되돌릴 수 없으므로 한 번 확인을 받는다.
  function clearAll() {
    if (todos.length === 0) return;
    if (!window.confirm('할 일 ' + todos.length + '개를 모두 지울까요? 되돌릴 수 없어요.')) return;

    todos = [];
    editingId = null;
    currentPage = 0;
    // 지우기 전에 삭제한 항목을 빈 목록에 되살리면 안 되므로 되돌리기 알림을 닫는다.
    clearPendingDelete();
    document.getElementById('undo-toast').hidden = true;
    save();
    render();

    // 버튼이 비활성화되면서 포커스를 잃으므로 입력창으로 옮긴다.
    document.getElementById('todo-input').focus();
  }

  function startEdit(id) {
    if (editingId === id) return;
    editingId = id;
    render();
  }

  function finishEdit(id, text, category) {
    if (editingId !== id) return;
    editingId = null;
    updateTodo(id, { text: text, category: category });
    render();
    focusItemControl(id, 'todo-edit-btn');
  }

  function cancelEdit(id) {
    if (editingId !== id) return;
    editingId = null;
    render();
    focusItemControl(id, 'todo-edit-btn');
  }

  // 사용자가 이번 항목을 입력하는 동안 카테고리를 직접 골랐는지. 직접 골랐다면
  // 자동 분류가 그 선택을 덮어쓰지 않는다. 항목을 추가하면 다시 false가 된다.
  var categoryPickedByUser = false;

  // 입력 중인 내용을 보고 카테고리 선택을 자동으로 맞춘다. 전체 탭에서만 동작한다.
  // 특정 카테고리 탭에서는 그 탭의 카테고리로 넣는 것이 정해진 동작이기 때문이다.
  // 맞는 키워드가 없으면 원래 값(직전에 고른 카테고리)으로 되돌린다.
  function applyAutoCategory() {
    var inputEl = document.getElementById('todo-input');
    var categorySelectEl = document.getElementById('category-select');
    if (categoryPickedByUser || currentFilter !== 'all') {
      categorySelectEl.classList.remove('auto-picked');
      return;
    }
    var guessed = guessCategory(inputEl.value);
    categorySelectEl.value = guessed || lastCategory;
    categorySelectEl.classList.toggle('auto-picked', !!guessed);
    categorySelectEl.title = guessed ? '내용을 보고 자동으로 골랐어요' : '';
  }

  // 입력창과 카테고리 선택값을 읽어 addTodo를 호출하고, 입력창을 비운 뒤 초점을 유지한다.
  function handleAddFromInput() {
    var inputEl = document.getElementById('todo-input');
    var categorySelectEl = document.getElementById('category-select');
    addTodo(inputEl.value, categorySelectEl.value);
    inputEl.value = '';
    categoryPickedByUser = false;
    categorySelectEl.classList.remove('auto-picked');
    categorySelectEl.title = '';
    inputEl.focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderTodayDate();
    load();

    var inputEl = document.getElementById('todo-input');
    var categorySelectEl = document.getElementById('category-select');
    var addBtn = document.getElementById('add-btn');
    var listEl = document.getElementById('todo-list');
    var clearBtn = document.getElementById('clear-completed-btn');
    var undoBtn = document.getElementById('undo-btn');
    var tabsEl = document.querySelector('.tabs');
    var dashboardCategoriesEl = document.querySelector('.dashboard-categories');
    var themeToggleBtn = document.getElementById('theme-toggle-btn');
    var exportBtn = document.getElementById('export-btn');
    var importBtn = document.getElementById('import-btn');
    var importFileInput = document.getElementById('import-file-input');

    categorySelectEl.value = lastCategory;

    render();

    themeToggleBtn.addEventListener('click', toggleTheme);

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (theme === 'system') applyTheme();
      });
    }

    exportBtn.addEventListener('click', exportTodos);

    importBtn.addEventListener('click', function () {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      handleImportFile(file);
      importFileInput.value = '';
    });

    addBtn.addEventListener('click', handleAddFromInput);

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        handleAddFromInput();
      }
    });

    inputEl.addEventListener('input', applyAutoCategory);

    categorySelectEl.addEventListener('change', function () {
      categoryPickedByUser = true;
      categorySelectEl.classList.remove('auto-picked');
      categorySelectEl.title = '';
    });

    listEl.addEventListener('change', function (e) {
      if (e.target.classList.contains('todo-checkbox')) {
        var itemEl = e.target.closest('.todo-item');
        toggleTodo(itemEl.dataset.id);
      }
    });

    listEl.addEventListener('click', function (e) {
      var itemEl = e.target.closest('.todo-item');
      if (!itemEl) return;
      var id = itemEl.dataset.id;
      if (e.target.classList.contains('todo-edit-btn')) {
        startEdit(id);
      } else if (e.target.classList.contains('todo-delete-btn')) {
        deleteTodo(id);
      }
    });

    listEl.addEventListener('dragstart', function (e) {
      var itemEl = e.target.closest('.todo-item');
      if (!itemEl || !itemEl.draggable) return;
      dragSourceId = itemEl.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', dragSourceId);
      } catch (err) {}
      itemEl.classList.add('dragging');
    });

    // 드래그가 끝나면 표시와 상태를 정리한다. 드래그 도중 페이지를 넘기면 끌던 항목이
    // 목록에서 빠지므로(dragend가 목록까지 올라오지 않는다) 문서 단위로도 정리한다.
    function endDrag() {
      var draggingEl = listEl.querySelector('.dragging');
      if (draggingEl) draggingEl.classList.remove('dragging');
      clearDropMarkers(listEl);
      clearTimeout(pageFlipTimer);
      pageFlipTimer = null;
      dragSourceId = null;
    }

    listEl.addEventListener('dragend', endDrag);
    document.addEventListener('dragend', endDrag);
    document.addEventListener('drop', endDrag);
    document.addEventListener('mousemove', function (e) {
      if (dragSourceId && e.buttons === 0) endDrag();
    });

    listEl.addEventListener('dragover', function (e) {
      if (!dragSourceId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      clearDropMarkers(listEl);
      var itemEl = e.target.closest('.todo-item');
      if (itemEl && itemEl.dataset.id !== dragSourceId) {
        itemEl.classList.add(isLowerHalf(itemEl, e.clientY) ? 'drop-after' : 'drop-before');
      }
    });

    listEl.addEventListener('drop', function (e) {
      e.preventDefault();
      clearDropMarkers(listEl);
      if (!dragSourceId) return;

      // 항목 사이의 빈틈에 놓으면 아무 일도 하지 않는다.
      var itemEl = e.target.closest('.todo-item');
      if (itemEl && itemEl.dataset.id !== dragSourceId) {
        moveNextToId(dragSourceId, itemEl.dataset.id, isLowerHalf(itemEl, e.clientY));
      }
      dragSourceId = null;
    });

    // 페이지 넘김: 화살표를 누르거나, 항목을 끌고 화살표 위에 잠깐 머물면 넘어간다.
    var pagePrevBtn = document.getElementById('page-prev');
    var pageNextBtn = document.getElementById('page-next');
    [[pagePrevBtn, -1], [pageNextBtn, 1]].forEach(function (pair) {
      var btn = pair[0];
      var direction = pair[1];

      btn.addEventListener('click', function () {
        goToPage(direction);
        if (btn.disabled) {
          (direction > 0 ? pagePrevBtn : pageNextBtn).focus();
        }
      });

      btn.addEventListener('dragover', function (e) {
        if (!dragSourceId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      btn.addEventListener('dragenter', function () {
        if (!dragSourceId || btn.disabled || pageFlipTimer) return;
        btn.classList.add('drag-hover');
        pageFlipTimer = setTimeout(function () {
          pageFlipTimer = null;
          btn.classList.remove('drag-hover');
          goToPage(direction);
        }, 500);
      });

      btn.addEventListener('dragleave', function (e) {
        if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
        btn.classList.remove('drag-hover');
        clearTimeout(pageFlipTimer);
        pageFlipTimer = null;
      });
    });

    // 창 크기가 바뀌면 한 페이지에 들어갈 항목 수를 다시 계산한다.
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 150);
    });

    tabsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      switchTab(btn.dataset.filter);
    });

    dashboardCategoriesEl.addEventListener('click', function (e) {
      var row = e.target.closest('.category-row');
      if (!row) return;
      switchTab(row.dataset.filter);
    });

    listEl.addEventListener('dblclick', function (e) {
      if (e.target.classList.contains('todo-text')) {
        var itemEl = e.target.closest('.todo-item');
        startEdit(itemEl.dataset.id);
      }
    });

    listEl.addEventListener('keydown', function (e) {
      var isEditField = e.target.classList.contains('todo-edit-input') ||
        e.target.classList.contains('todo-edit-category');

      // 마우스 없이 순서를 바꾸는 단축키: 항목 안에 초점이 있을 때 Alt+↑ / Alt+↓
      if (!isEditField && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        var movingItemEl = e.target.closest('.todo-item');
        if (!movingItemEl) return;
        e.preventDefault();
        moveWithinFilter(movingItemEl.dataset.id, e.key === 'ArrowUp' ? -1 : 1);
        return;
      }

      if (!isEditField) return;

      var itemEl = e.target.closest('.todo-item');
      var id = itemEl.dataset.id;

      if (e.key === 'Enter') {
        e.preventDefault();
        var inputField = itemEl.querySelector('.todo-edit-input');
        var selectField = itemEl.querySelector('.todo-edit-category');
        finishEdit(id, inputField.value, selectField.value);
      } else if (e.key === 'Escape') {
        cancelEdit(id);
      }
    });

    listEl.addEventListener('focusout', function (e) {
      var isEditField = e.target.classList.contains('todo-edit-input') ||
        e.target.classList.contains('todo-edit-category');
      if (!isEditField) return;

      var itemEl = e.target.closest('.todo-item');
      if (!itemEl) return;

      // 같은 줄 안에서 입력창과 카테고리 선택 사이로 초점이 옮겨간 경우는 저장하지 않는다.
      if (e.relatedTarget && itemEl.contains(e.relatedTarget)) return;

      var id = itemEl.dataset.id;
      var inputField = itemEl.querySelector('.todo-edit-input');
      var selectField = itemEl.querySelector('.todo-edit-category');
      if (inputField && selectField) {
        finishEdit(id, inputField.value, selectField.value);
      }
    });

    clearBtn.addEventListener('click', clearCompleted);
    document.getElementById('clear-all-btn').addEventListener('click', clearAll);
    undoBtn.addEventListener('click', undoDelete);
  });
})();
