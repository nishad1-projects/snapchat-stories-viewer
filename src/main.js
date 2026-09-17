import './style.css';
import { fetchSnapchatAccount, cleanUsernameInput } from './services/snapchatApi.js';
import { TRENDING_CREATORS } from './services/trendingData.js';
import { getBookmarks, isBookmarked, toggleBookmark, clearBookmarks, addToSearchHistory } from './services/historyManager.js';
import { StoryPlayer } from './components/storyPlayer.js';

// Application State
let currentAccount = null;
let activeTab = 'stories';
let storyPlayerInstance = null;

// DOM Elements
const heroSection = document.getElementById('heroSection');
const profileSection = document.getElementById('profileSection');
const trendingSection = document.getElementById('trendingSection');
const bookmarksSection = document.getElementById('bookmarksSection');
const faqSection = document.getElementById('faqSection');

const searchForm = document.getElementById('searchForm');
const usernameInput = document.getElementById('usernameInput');
const clearInputBtn = document.getElementById('clearInputBtn');
const quickPillsContainer = document.getElementById('quickPillsContainer');

const profileCard = document.getElementById('profileCard');
const storiesContainer = document.getElementById('storiesContainer');
const highlightsGrid = document.getElementById('highlightsGrid');
const spotlightGrid = document.getElementById('spotlightGrid');
const trendingCreatorsGrid = document.getElementById('trendingCreatorsGrid');
const bookmarksGrid = document.getElementById('bookmarksGrid');

const storiesCountBadge = document.getElementById('storiesCountBadge');
const highlightsCountBadge = document.getElementById('highlightsCountBadge');
const spotlightCountBadge = document.getElementById('spotlightCountBadge');
const bookmarkCountNav = document.getElementById('bookmarkCount');

const storyModal = document.getElementById('storyModal');
const storyPlayerContainer = document.getElementById('storyPlayerContainer');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initStoryPlayer();
  renderQuickPills();
  renderTrendingCreators();
  updateBookmarkNavCount();
  setupNavigation();
  setupSearchForm();
  setupTabs();
  setupFaq();
});

// Initialize Story Player Component
function initStoryPlayer() {
  storyPlayerInstance = new StoryPlayer(storyPlayerContainer, () => {
    storyModal.classList.add('hidden');
  });

  const backdrop = document.getElementById('closeStoryModalBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      storyPlayerInstance.close();
    });
  }
}

// Render Quick Suggestion Pills
function renderQuickPills() {
  if (!quickPillsContainer) return;

  const sampleUsers = ['mrbeast', 'kimkardashian', 'djkhaled305', 'daviddobrik', 'kyliejenner', 'selenagomez'];
  
  quickPillsContainer.innerHTML = sampleUsers
    .map(user => `<button type="button" class="pill-btn" data-username="${user}">@${user}</button>`)
    .join('');

  quickPillsContainer.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.dataset.username;
      usernameInput.value = username;
      handleSearch(username);
    });
  });
}

// Render Trending Creators Grid with Live Avatars
async function renderTrendingCreators() {
  if (!trendingCreatorsGrid) return;

  // 1. Initial render with official creator avatars
  trendingCreatorsGrid.innerHTML = TRENDING_CREATORS.map(creator => `
    <div class="creator-card" id="card_${creator.username}">
      <div class="creator-avatar-wrap">
        <img class="creator-avatar" id="avatar_${creator.username}" src="${creator.avatar}" alt="${creator.displayName}" />
        <span class="creator-live-tag" id="tag_${creator.username}">LIVE</span>
      </div>
      <h3 class="creator-title">
        ${creator.displayName}
        ${creator.verified ? '<svg class="verified-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' : ''}
      </h3>
      <div class="creator-username">@${creator.username}</div>
      <div class="creator-subscribers" id="subs_${creator.username}">${creator.subscribers}</div>
      <button class="btn-watch-creator" data-username="${creator.username}">
        Watch Stories
      </button>
    </div>
  `).join('');

  trendingCreatorsGrid.querySelectorAll('.btn-watch-creator').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.dataset.username;
      handleSearch(username);
    });
  });

  // 2. Asynchronously fetch live Snapchat avatars & profile details for total accuracy
  TRENDING_CREATORS.forEach(async (creator) => {
    try {
      const liveData = await fetchSnapchatAccount(creator.username);
      if (liveData && liveData.avatar) {
        const imgEl = document.getElementById(`avatar_${creator.username}`);
        const subsEl = document.getElementById(`subs_${creator.username}`);
        if (imgEl) imgEl.src = liveData.avatar;
        if (subsEl && liveData.subscribers) subsEl.textContent = liveData.subscribers;
      }
    } catch (e) {
      // Keep preset avatar
    }
  });
}

// Setup Search Form Input Listeners
function setupSearchForm() {
  if (!searchForm || !usernameInput) return;

  usernameInput.addEventListener('input', () => {
    if (usernameInput.value.trim().length > 0) {
      clearInputBtn.classList.remove('hidden');
    } else {
      clearInputBtn.classList.add('hidden');
    }
  });

  clearInputBtn.addEventListener('click', () => {
    usernameInput.value = '';
    clearInputBtn.classList.add('hidden');
    usernameInput.focus();
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = usernameInput.value.trim();
    if (query) {
      handleSearch(query);
    }
  });
}

// Handle Account Search & Fetching
async function handleSearch(query) {
  const submitBtn = document.getElementById('searchSubmitBtn');
  if (submitBtn) {
    submitBtn.innerHTML = `<span>Loading...</span>`;
    submitBtn.disabled = true;
  }

  try {
    const account = await fetchSnapchatAccount(query);
    currentAccount = account;
    addToSearchHistory(account.username);

    renderProfileCard(account);
    renderAccountContent(account);
    showProfileSection();

  } catch (err) {
    showToast(err.message || 'Error searching profile. Try another username.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Watch Stories</span>
      `;
      submitBtn.disabled = false;
    }
  }
}

// Render Profile Header Card
function renderProfileCard(account) {
  const bookmarked = isBookmarked(account.username);
  const storiesCount = account.stories ? account.stories.length : 0;

  profileCard.innerHTML = `
    <div class="profile-card-inner">
      <div class="profile-main-info">
        <div class="avatar-ring-container">
          <img class="avatar-img" src="${account.avatar}" alt="${account.displayName}" />
          ${storiesCount > 0 ? '<span class="live-story-badge">Active Story</span>' : ''}
        </div>
        <div class="profile-text">
          <div class="profile-name-row">
            <h1 class="profile-name">${account.displayName}</h1>
            ${account.verified ? `
              <svg class="verified-icon" viewBox="0 0 24 24" fill="currentColor" title="Verified Creator">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            ` : ''}
          </div>
          <div class="profile-handle">@${account.username}</div>
          <p class="profile-bio">${account.bio || ''}</p>
          <div class="profile-meta-pills">
            <span class="meta-pill">${account.subscribers}</span>
            <span class="meta-pill">🛡️ IP Masked Viewing</span>
          </div>
        </div>
      </div>

      <div class="profile-actions">
        ${storiesCount > 0 ? `
          <button class="btn-primary" id="btnPlayAllStories">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Play Stories (${storiesCount})
          </button>
        ` : ''}
        <button class="btn-secondary ${bookmarked ? 'bookmarked' : ''}" id="btnToggleBookmark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          ${bookmarked ? 'Favorited' : 'Bookmark'}
        </button>
      </div>
    </div>
  `;

  // Attach Profile Actions
  const btnPlay = document.getElementById('btnPlayAllStories');
  if (btnPlay) {
    btnPlay.addEventListener('click', () => openStoryPlayer(0));
  }

  const btnBm = document.getElementById('btnToggleBookmark');
  if (btnBm) {
    btnBm.addEventListener('click', () => {
      const added = toggleBookmark(account);
      updateBookmarkNavCount();
      renderProfileCard(account); // re-render card button state
      showToast(added ? `Added @${account.username} to Favorites!` : `Removed @${account.username} from Favorites.`);
    });
  }
}

// Render Stories, Highlights, & Spotlight tabs
function renderAccountContent(account) {
  const stories = account.stories || [];
  const highlights = account.highlights || [];
  const spotlight = account.spotlight || [];

  storiesCountBadge.textContent = stories.length;
  highlightsCountBadge.textContent = highlights.length;
  spotlightCountBadge.textContent = spotlight.length;

  // Render Stories Tab Grid
  if (stories.length === 0) {
    storiesContainer.innerHTML = `<div class="empty-state">No active 24-hour stories available for @${account.username} right now. Check highlights!</div>`;
  } else {
    storiesContainer.innerHTML = stories.map((snap, index) => `
      <div class="story-card-preview" data-index="${index}">
        <img class="story-card-media" src="${snap.thumbnail || snap.url}" alt="Snap story preview" />
        <div class="story-card-overlay">
          <div class="story-card-header">
            <span class="snap-time-badge">${snap.timestamp}</span>
            <div class="snap-play-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
          <div class="story-card-body">
            ${snap.caption ? `<p class="snap-caption-text">${snap.caption}</p>` : ''}
            <button class="snap-download-btn-mini" data-url="${snap.url}" data-type="${snap.type}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download ${snap.type === 'video' ? 'MP4' : 'JPG'}
            </button>
          </div>
        </div>
      </div>
    `).join('');

    storiesContainer.querySelectorAll('.story-card-preview').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.snap-download-btn-mini')) return;
        const index = parseInt(card.dataset.index);
        openStoryPlayer(index);
      });
    });

    storiesContainer.querySelectorAll('.snap-download-btn-mini').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        const type = btn.dataset.type;
        downloadDirectMedia(url, `${account.username}_snap.${type === 'video' ? 'mp4' : 'jpg'}`);
      });
    });
  }

  // Render Highlights Grid
  if (highlights.length === 0) {
    highlightsGrid.innerHTML = `<div class="empty-state">No highlight albums found for this creator.</div>`;
  } else {
    highlightsGrid.innerHTML = highlights.map(hl => `
      <div class="highlight-album-card" data-hl-id="${hl.id}">
        <div class="highlight-cover-wrapper">
          <img class="highlight-cover-img" src="${hl.cover}" alt="${hl.title}" />
          <span class="highlight-badge">${hl.snapsCount} Snaps</span>
        </div>
        <div class="highlight-details">
          <h3 class="highlight-title">${hl.title}</h3>
          <span class="highlight-snaps-count">Watch Highlight Collection &rarr;</span>
        </div>
      </div>
    `).join('');

    highlightsGrid.querySelectorAll('.highlight-album-card').forEach(card => {
      card.addEventListener('click', () => {
        openStoryPlayer(0);
      });
    });
  }

  // Render Spotlight Grid
  if (spotlight.length === 0) {
    spotlightGrid.innerHTML = `<div class="empty-state">No public spotlight videos posted recently.</div>`;
  } else {
    spotlightGrid.innerHTML = spotlight.map(sp => `
      <div class="spotlight-card">
        <img class="spotlight-video-preview" src="${sp.thumbnail}" alt="Spotlight video" />
        <div class="spotlight-overlay">
          <div class="spotlight-views">⚡ ${sp.views}</div>
        </div>
      </div>
    `).join('');
  }
}

// Open Story Player Modal
function openStoryPlayer(snapIndex = 0) {
  if (!currentAccount || !currentAccount.stories || currentAccount.stories.length === 0) {
    showToast('No active stories available to play.', 'error');
    return;
  }

  storyModal.classList.remove('hidden');
  storyPlayerInstance.open(currentAccount, snapIndex);
}

// Tabs switching handler
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetTab = tab.dataset.tab;
      const targetPane = document.getElementById(`pane${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// Setup Navigation buttons & Views
function setupNavigation() {
  const navHome = document.getElementById('navHome');
  const navTrending = document.getElementById('navTrending');
  const navBookmarks = document.getElementById('navBookmarks');
  const homeLogoBtn = document.getElementById('homeLogoBtn');
  const backToHomeBtn = document.getElementById('backToHomeBtn');

  const showHomeView = () => {
    heroSection.classList.remove('hidden');
    trendingSection.classList.remove('hidden');
    faqSection.classList.remove('hidden');
    profileSection.classList.add('hidden');
    bookmarksSection.classList.add('hidden');
    setActiveNav(navHome);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showTrendingView = () => {
    showHomeView();
    trendingSection.scrollIntoView({ behavior: 'smooth' });
    setActiveNav(navTrending);
  };

  const showBookmarksView = () => {
    heroSection.classList.add('hidden');
    profileSection.classList.add('hidden');
    trendingSection.classList.add('hidden');
    faqSection.classList.add('hidden');
    bookmarksSection.classList.remove('hidden');
    renderBookmarksGrid();
    setActiveNav(navBookmarks);
  };

  if (navHome) navHome.addEventListener('click', showHomeView);
  if (homeLogoBtn) homeLogoBtn.addEventListener('click', (e) => { e.preventDefault(); showHomeView(); });
  if (backToHomeBtn) backToHomeBtn.addEventListener('click', showHomeView);
  if (navTrending) navTrending.addEventListener('click', showTrendingView);
  if (navBookmarks) navBookmarks.addEventListener('click', showBookmarksView);

  const refreshTrendingBtn = document.getElementById('refreshTrendingBtn');
  if (refreshTrendingBtn) {
    refreshTrendingBtn.addEventListener('click', () => {
      renderTrendingCreators();
      showToast('Refreshed trending Snapchat creators!');
    });
  }

  const clearBmBtn = document.getElementById('clearBookmarksBtn');
  if (clearBmBtn) {
    clearBmBtn.addEventListener('click', () => {
      clearBookmarks();
      updateBookmarkNavCount();
      renderBookmarksGrid();
      showToast('Cleared all favorite accounts.');
    });
  }
}

function setActiveNav(element) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
}

function showProfileSection() {
  heroSection.classList.add('hidden');
  bookmarksSection.classList.add('hidden');
  profileSection.classList.remove('hidden');
  trendingSection.classList.remove('hidden');
  faqSection.classList.remove('hidden');
  window.scrollTo({ top: profileSection.offsetTop - 80, behavior: 'smooth' });
}

// Render Favorites / Bookmarks Grid
function renderBookmarksGrid() {
  const bookmarks = getBookmarks();
  if (bookmarks.length === 0) {
    bookmarksGrid.innerHTML = `
      <div class="empty-state-card">
        <h3>No favorite creators saved yet</h3>
        <p>Search any Snapchat account and click the <strong>Bookmark</strong> button to save them here for quick access.</p>
      </div>
    `;
    return;
  }

  bookmarksGrid.innerHTML = bookmarks.map(b => `
    <div class="creator-card">
      <div class="creator-avatar-wrap">
        <img class="creator-avatar" src="${b.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}" alt="${b.displayName}" />
      </div>
      <h3 class="creator-title">${b.displayName}</h3>
      <div class="creator-username">@${b.username}</div>
      <button class="btn-watch-creator" data-username="${b.username}">Watch Stories</button>
    </div>
  `).join('');

  bookmarksGrid.querySelectorAll('.btn-watch-creator').forEach(btn => {
    btn.addEventListener('click', () => {
      handleSearch(btn.dataset.username);
    });
  });
}

function updateBookmarkNavCount() {
  const bookmarks = getBookmarks();
  if (bookmarkCountNav) {
    bookmarkCountNav.textContent = bookmarks.length;
  }
}

// FAQ Accordions
function setupFaq() {
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      item.classList.toggle('open');
    });
  });
}

// Utility Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${type === 'error' ? '#FF0055' : '#FFFC00'}" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// Direct File Download Utility using Same-Origin Proxy & Typed Blob
async function downloadDirectMedia(url, filename) {
  if (!url) return;
  const safeFilename = filename || `snapchat_snap_${Date.now()}.mp4`;
  const ext = safeFilename.endsWith('.jpg') || safeFilename.endsWith('.jpeg') ? 'jpg' : 'mp4';
  const endpoint = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeFilename)}`;

  showToast(`Preparing ${safeFilename}...`);

  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error('Download request failed');

    const rawBlob = await response.blob();
    const mimeType = ext === 'mp4' ? 'video/mp4' : 'image/jpeg';
    const typedBlob = new Blob([rawBlob], { type: mimeType });
    const blobUrl = URL.createObjectURL(typedBlob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    showToast(`Downloading ${safeFilename}!`);
  } catch (err) {
    console.warn('Fallback direct download navigation:', err);
    window.location.href = endpoint;
  }
}

// Trust Modals Event Handlers (Privacy Policy, Terms, DMCA)
document.addEventListener('DOMContentLoaded', () => {
  const trustModal = document.getElementById('trustModal');
  const trustContent = document.getElementById('trustModalContent');
  const closeBtn = document.getElementById('closeTrustModalBtn');
  const backdrop = document.getElementById('closeTrustModalBackdrop');

  const closeTrustModal = () => {
    if (trustModal) trustModal.classList.add('hidden');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeTrustModal);
  if (backdrop) backdrop.addEventListener('click', closeTrustModal);

  const openTrustModal = (title, text) => {
    if (!trustModal || !trustContent) return;
    trustContent.innerHTML = `<h2>${title}</h2><p>${text}</p>`;
    trustModal.classList.remove('hidden');
  };
});
