/**
 * Snapchat Story Player Component
 * Renders Snapchat-style story player with segmented progress bars, 
 * touch/hold pause logic, sound controls, and HD media downloading.
 */

export class StoryPlayer {
  constructor(containerEl, onCloseCallback) {
    this.container = containerEl;
    this.onClose = onCloseCallback;

    this.currentAccount = null;
    this.snaps = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.isMuted = false;
    this.isHolding = false;
    
    this.timer = null;
    this.progressVal = 0;
    this.videoEl = null;

    this.bindKeyboard();
  }

  open(account, initialSnapIndex = 0) {
    this.currentAccount = account;
    this.snaps = account.stories || [];
    this.currentIndex = initialSnapIndex;
    
    if (this.snaps.length === 0) return;

    this.render();
    this.loadSnap(this.currentIndex);
  }

  close() {
    this.stopTimer();
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.src = '';
    }
    this.container.innerHTML = '';
    if (this.onClose) this.onClose();
  }

  render() {
    const snapCount = this.snaps.length;
    const authorAvatar = this.currentAccount.avatar || '';
    const authorName = this.currentAccount.displayName || this.currentAccount.username;

    // Segment progress bars markup
    const segmentTracks = Array.from({ length: snapCount })
      .map((_, i) => `<div class="segment-track"><div class="segment-fill" id="segFill_${i}"></div></div>`)
      .join('');

    this.container.innerHTML = `
      <div class="player-header" id="playerHeader">
        <div class="story-segments-bar">
          ${segmentTracks}
        </div>
        <div class="player-user-info">
          <div class="player-author">
            <img class="player-avatar" src="${authorAvatar}" alt="${authorName}" />
            <div>
              <div class="player-author-name">${authorName}</div>
              <div class="player-timestamp" id="playerTimestamp">Just now</div>
            </div>
          </div>
          <div class="player-controls">
            <button class="control-icon-btn" id="btnToggleSound" title="Toggle Mute/Sound">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="soundIcon">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            </button>
            <button class="control-icon-btn" id="btnDownloadCurrentSnap" title="Download HD Media">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button class="control-icon-btn" id="btnClosePlayer" title="Close Viewer">&times;</button>
          </div>
        </div>
      </div>

      <!-- Touch navigation areas -->
      <div class="story-nav-prev" id="navPrevArea"></div>
      <div class="story-nav-next" id="navNextArea"></div>

      <!-- Media viewport -->
      <div class="player-media-container" id="mediaContainer">
        <!-- Media inserted here -->
      </div>

      <div class="player-footer" id="playerFooter">
        <div class="story-caption-overlay hidden" id="captionOverlay"></div>
        <button class="btn-download-hd" id="btnDownloadFooter">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download HD Snap
        </button>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const btnClose = this.container.querySelector('#btnClosePlayer');
    const btnSound = this.container.querySelector('#btnToggleSound');
    const btnDlHeader = this.container.querySelector('#btnDownloadCurrentSnap');
    const btnDlFooter = this.container.querySelector('#btnDownloadFooter');
    
    const prevArea = this.container.querySelector('#navPrevArea');
    const nextArea = this.container.querySelector('#navNextArea');
    const mediaContainer = this.container.querySelector('#mediaContainer');

    if (btnClose) btnClose.addEventListener('click', () => this.close());
    if (btnSound) btnSound.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMute();
    });

    const downloadHandler = (e) => {
      e.stopPropagation();
      this.downloadCurrentSnap();
    };

    if (btnDlHeader) btnDlHeader.addEventListener('click', downloadHandler);
    if (btnDlFooter) btnDlFooter.addEventListener('click', downloadHandler);

    if (prevArea) prevArea.addEventListener('click', () => this.prevSnap());
    if (nextArea) nextArea.addEventListener('click', () => this.nextSnap());

    // Press & Hold to pause timer & hide UI overlays
    const startHold = () => {
      this.isHolding = true;
      this.pause();
      const header = this.container.querySelector('#playerHeader');
      const footer = this.container.querySelector('#playerFooter');
      if (header) header.classList.add('user-holding');
      if (footer) footer.classList.add('user-holding');
    };

    const endHold = () => {
      if (!this.isHolding) return;
      this.isHolding = false;
      this.resume();
      const header = this.container.querySelector('#playerHeader');
      const footer = this.container.querySelector('#playerFooter');
      if (header) header.classList.remove('user-holding');
      if (footer) footer.classList.remove('user-holding');
    };

    mediaContainer.addEventListener('mousedown', startHold);
    mediaContainer.addEventListener('mouseup', endHold);
    mediaContainer.addEventListener('touchstart', startHold);
    mediaContainer.addEventListener('touchend', endHold);
  }

  loadSnap(index) {
    this.stopTimer();
    this.currentIndex = index;

    if (index < 0 || index >= this.snaps.length) {
      this.close();
      return;
    }

    const snap = this.snaps[index];
    const mediaContainer = this.container.querySelector('#mediaContainer');
    const timestampEl = this.container.querySelector('#playerTimestamp');
    const captionEl = this.container.querySelector('#captionOverlay');

    if (timestampEl) timestampEl.textContent = snap.timestamp || 'Just now';

    if (captionEl) {
      if (snap.caption) {
        captionEl.textContent = snap.caption;
        captionEl.classList.remove('hidden');
      } else {
        captionEl.classList.add('hidden');
      }
    }

    // Update Segment Fills
    for (let i = 0; i < this.snaps.length; i++) {
      const fillEl = this.container.querySelector(`#segFill_${i}`);
      if (!fillEl) continue;
      if (i < index) {
        fillEl.style.width = '100%';
        fillEl.classList.add('completed');
      } else if (i > index) {
        fillEl.style.width = '0%';
        fillEl.classList.remove('completed');
      } else {
        fillEl.style.width = '0%';
        fillEl.classList.remove('completed');
      }
    }

    // Render Media
    mediaContainer.innerHTML = '';
    if (snap.type === 'video') {
      const video = document.createElement('video');
      video.className = 'player-media-element';
      video.src = snap.url;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = this.isMuted;

      video.onended = () => {
        this.nextSnap();
      };

      mediaContainer.appendChild(video);
      this.videoEl = video;
      
      // Start progress timer synced with video duration or fallback duration
      const durationSec = snap.duration || 8;
      this.startTimer(durationSec);

    } else {
      const img = document.createElement('img');
      img.className = 'player-media-element';
      img.src = snap.url;
      img.alt = snap.caption || 'Snapchat Story';
      mediaContainer.appendChild(img);
      this.videoEl = null;

      const durationSec = snap.duration || 5;
      this.startTimer(durationSec);
    }
  }

  startTimer(durationSec) {
    this.stopTimer();
    this.progressVal = 0;
    this.isPlaying = true;
    
    const intervalMs = 50;
    const increment = (intervalMs / (durationSec * 1000)) * 100;
    const currentFillEl = this.container.querySelector(`#segFill_${this.currentIndex}`);

    this.timer = setInterval(() => {
      if (!this.isPlaying) return;
      this.progressVal += increment;
      if (currentFillEl) {
        currentFillEl.style.width = `${Math.min(this.progressVal, 100)}%`;
      }

      if (this.progressVal >= 100) {
        this.stopTimer();
        this.nextSnap();
      }
    }, intervalMs);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPlaying = false;
  }

  pause() {
    this.isPlaying = false;
    if (this.videoEl) this.videoEl.pause();
  }

  resume() {
    this.isPlaying = true;
    if (this.videoEl) this.videoEl.play();
  }

  nextSnap() {
    if (this.currentIndex < this.snaps.length - 1) {
      this.loadSnap(this.currentIndex + 1);
    } else {
      this.close();
    }
  }

  prevSnap() {
    if (this.currentIndex > 0) {
      this.loadSnap(this.currentIndex - 1);
    } else {
      this.loadSnap(0);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.videoEl) this.videoEl.muted = this.isMuted;

    const soundIcon = this.container.querySelector('#soundIcon');
    if (soundIcon) {
      soundIcon.innerHTML = this.isMuted
        ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`
        : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
    }
  }

  async downloadCurrentSnap() {
    const snap = this.snaps[this.currentIndex];
    if (!snap) return;

    const ext = snap.type === 'video' ? 'mp4' : 'jpg';
    const username = this.currentAccount ? this.currentAccount.username : 'snapchat';
    const filename = `${username}_snap_${Date.now()}.${ext}`;
    const endpoint = `/api/download?url=${encodeURIComponent(snap.url)}&filename=${encodeURIComponent(filename)}`;

    try {
      // 1. Fetch from our SAME-ORIGIN API proxy
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Download failed');

      const rawBlob = await response.blob();
      const mimeType = ext === 'mp4' ? 'video/mp4' : 'image/jpeg';
      const typedBlob = new Blob([rawBlob], { type: mimeType });
      const blobUrl = URL.createObjectURL(typedBlob);

      // 2. Trigger same-origin anchor download (Chrome 100% respects filename for same-origin Blob URLs)
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      console.warn('Same-origin blob download fallback:', err);
      window.location.href = endpoint;
    }
  }

  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (this.container.classList.contains('hidden')) return;

      if (e.key === 'ArrowRight') this.nextSnap();
      if (e.key === 'ArrowLeft') this.prevSnap();
      if (e.key === 'Escape') this.close();
      if (e.key === ' ') {
        e.preventDefault();
        if (this.isPlaying) this.pause();
        else this.resume();
      }
      if (e.key === 'm' || e.key === 'M') this.toggleMute();
    });
  }
}
