// LocalStorage Manager for Search History & Bookmarked Accounts

const STORAGE_KEY_BOOKMARKS = 'snapviewer_bookmarks_v1';
const STORAGE_KEY_HISTORY = 'snapviewer_history_v1';

export const getBookmarks = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading bookmarks', e);
    return [];
  }
};

export const isBookmarked = (username) => {
  const bookmarks = getBookmarks();
  return bookmarks.some(b => b.username.toLowerCase() === username.toLowerCase());
};

export const toggleBookmark = (account) => {
  let bookmarks = getBookmarks();
  const index = bookmarks.findIndex(b => b.username.toLowerCase() === account.username.toLowerCase());
  
  let added = false;
  if (index > -1) {
    bookmarks.splice(index, 1);
  } else {
    bookmarks.unshift({
      username: account.username,
      displayName: account.displayName || account.username,
      avatar: account.avatar || '',
      verified: account.verified || false,
      subscribers: account.subscribers || '',
      addedAt: Date.now()
    });
    added = true;
  }
  
  try {
    localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(bookmarks));
  } catch (e) {
    console.error('Error saving bookmark', e);
  }
  
  return added;
};

export const clearBookmarks = () => {
  try {
    localStorage.removeItem(STORAGE_KEY_BOOKMARKS);
  } catch (e) {
    console.error(e);
  }
};

export const getSearchHistory = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const addToSearchHistory = (username) => {
  if (!username) return;
  let history = getSearchHistory();
  history = history.filter(item => item.toLowerCase() !== username.toLowerCase());
  history.unshift(username);
  if (history.length > 10) history = history.slice(0, 10);
  
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  } catch (e) {
    console.error(e);
  }
};
