// State Management
let currentView = 'home'; // 'home', 'subject', 'reader', 'bookmarks'
let activeSubject = null;
let activeCategory = null;
let bookmarks = new Set(JSON.parse(localStorage.getItem('studyPortal_bookmarks') || '[]'));
let searchQuery = '';

// Theme Initialization
const themeBtn = document.getElementById('theme-btn');
let currentTheme = localStorage.getItem('studyPortal_theme') || 
                   (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', currentTheme);

themeBtn.addEventListener('click', () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('studyPortal_theme', currentTheme);
});

// App Container
const appEl = document.getElementById('app');

// Navigation Events
document.getElementById('home-btn').addEventListener('click', () => navigate('home'));
document.getElementById('bookmarks-btn').addEventListener('click', () => navigate('bookmarks'));

function navigate(view, subject = null, category = null) {
  currentView = view;
  activeSubject = subject;
  activeCategory = category;
  searchQuery = '';
  render();
}

function toggleBookmark(id, btnElement) {
  if (bookmarks.has(id)) {
    bookmarks.delete(id);
    btnElement.classList.remove('bookmarked');
    btnElement.innerHTML = '☆';
  } else {
    bookmarks.add(id);
    btnElement.classList.add('bookmarked');
    btnElement.innerHTML = '⭐';
  }
  localStorage.setItem('studyPortal_bookmarks', JSON.stringify([...bookmarks]));
  if (currentView === 'bookmarks') render(); // Re-render if in bookmarks view
}

function toggleAccordion(bodyId) {
  const body = document.getElementById(bodyId);
  body.classList.toggle('open');
}

function toggleAllAccordions(forceOpen) {
  document.querySelectorAll('.qa-body').forEach(el => {
    if (forceOpen) el.classList.add('open');
    else el.classList.remove('open');
  });
}

// Rendering Logic
function render() {
  appEl.innerHTML = '';
  if (currentView === 'home') renderHome();
  else if (currentView === 'subject') renderSubject();
  else if (currentView === 'reader') renderReader();
  else if (currentView === 'bookmarks') renderBookmarks();
}

function renderHome() {
  const grid = document.createElement('div');
  grid.className = 'grid';
  
  db.forEach(sub => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2>${sub.title}</h2>
      <div class="meta">Code: ${sub.code}</div>
      <div>
        ${sub.cats.map(c => `<span class="tag">${c.name} (${c.qs.length})</span>`).join('')}
      </div>
    `;
    card.addEventListener('click', () => navigate('subject', sub));
    grid.appendChild(card);
  });
  appEl.appendChild(grid);
}

function renderSubject() {
  const header = document.createElement('div');
  header.innerHTML = `
    <div class="toolbar">
      <button onclick="navigate('home')">← Back to Subjects</button>
      <h2>${activeSubject.title}</h2>
    </div>
    <p class="source-files"><strong>Source Files:</strong><br>${activeSubject.files.join('<br>')}</p>
  `;
  appEl.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'grid';
  
  activeSubject.cats.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2>${cat.name}</h2>
      <div class="meta">${cat.qs.length} Questions</div>
      <button>Study Now</button>
    `;
    card.addEventListener('click', () => navigate('reader', activeSubject, cat));
    grid.appendChild(card);
  });
  
  appEl.appendChild(grid);
}

function renderReader() {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  
  toolbar.innerHTML = `
    <button onclick="navigate('subject', activeSubject)">← Back to Categories</button>
    <div>
      <button class="secondary" onclick="toggleAllAccordions(true)">Expand All</button>
      <button class="secondary" onclick="toggleAllAccordions(false)">Collapse All</button>
    </div>
    <input type="text" class="search-bar" id="search-input" placeholder="Search questions & answers..." value="${searchQuery}">
  `;
  appEl.appendChild(toolbar);

  const qContainer = document.createElement('div');
  qContainer.id = 'qa-container';
  appEl.appendChild(qContainer);

  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderQA(qContainer, activeCategory.qs, activeSubject.code);
  });

  renderQA(qContainer, activeCategory.qs, activeSubject.code);
}

function renderBookmarks() {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.innerHTML = `
    <button onclick="navigate('home')">← Home</button>
    <h2>Your Bookmarked Questions</h2>
  `;
  appEl.appendChild(toolbar);

  const qContainer = document.createElement('div');
  qContainer.id = 'qa-container';
  appEl.appendChild(qContainer);

  const bookmarkedQs = [];
  db.forEach(sub => {
    sub.cats.forEach(cat => {
      cat.qs.forEach((q, idx) => {
        const id = `${sub.code}-${cat.name}-${idx}`;
        if (bookmarks.has(id)) bookmarkedQs.push({ ...q, id, subTitle: sub.title, catName: cat.name });
      });
    });
  });

  if (bookmarkedQs.length === 0) {
    qContainer.innerHTML = '<p>No bookmarks found. Star a question to save it here!</p>';
    return;
  }

  bookmarkedQs.forEach(q => {
    const item = document.createElement('div');
    item.className = 'qa-item';
    const bodyId = `bookmark-body-${q.id}`;
    
    item.innerHTML = `
      <div class="qa-header" onclick="toggleAccordion('${bodyId}')">
        <div class="qa-question">
          <small class="meta">${q.subTitle} - ${q.catName}</small><br>
          ${q[0]}
        </div>
        <div class="qa-controls">
          <button class="bookmark-toggle bookmarked" onclick="event.stopPropagation(); toggleBookmark('${q.id}', this)">⭐</button>
        </div>
      </div>
      <div class="qa-body" id="${bodyId}">${q[1]}</div>
    `;
    qContainer.appendChild(item);
  });
}

function renderQA(container, questions, subjectCode) {
  container.innerHTML = '';
  questions.forEach((q, idx) => {
    const textToSearch = (q[0] + " " + q[1]).toLowerCase();
    if (searchQuery && !textToSearch.includes(searchQuery)) return;

    const id = `${subjectCode}-${activeCategory.name}-${idx}`;
    const bodyId = `qa-body-${id}`;
    const isBookmarked = bookmarks.has(id);
    
    const item = document.createElement('div');
    item.className = 'qa-item';
    
    item.innerHTML = `
      <div class="qa-header" onclick="toggleAccordion('${bodyId}')">
        <div class="qa-question">${q[0]}</div>
        <div class="qa-controls">
          <button class="bookmark-toggle ${isBookmarked ? 'bookmarked' : ''}" 
                  onclick="event.stopPropagation(); toggleBookmark('${id}', this)">
            ${isBookmarked ? '⭐' : '☆'}
          </button>
        </div>
      </div>
      <div class="qa-body ${searchQuery ? 'open' : ''}" id="${bodyId}">${q[1]}</div>
    `;
    container.appendChild(item);
  });
}

// Initial render
render();