import express from 'express';
import cors from 'cors';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/**
 * Helper to fetch HTTPS content following redirects
 */
function fetchHttps(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    https.get(url, options, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http') 
          ? res.headers.location 
          : `https://www.snapchat.com${res.headers.location}`;
        return fetchHttps(redirectUrl).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

/**
 * Format timestamp to relative time (e.g. "3h ago")
 */
function formatTimestamp(secStr) {
  if (!secStr) return 'Recently';
  const sec = parseInt(secStr);
  if (isNaN(sec)) return 'Recently';
  
  const diffSec = Math.floor(Date.now() / 1000) - sec;
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

/**
 * API Route: GET /api/snapchat?username=xxx
 * Fetches real live public story data from Snapchat
 */
app.get('/api/snapchat', async (req, res) => {
  const queryUser = req.query.username;
  if (!queryUser) {
    return res.status(400).json({ error: 'Username query parameter is required' });
  }

  // Clean username
  let cleanName = queryUser.trim();
  cleanName = cleanName.replace(/^@+/, '');
  if (cleanName.includes('snapchat.com')) {
    const parts = cleanName.split('/').filter(Boolean);
    cleanName = parts[parts.length - 1];
  }
  cleanName = cleanName.toLowerCase();

  try {
    const targetUrl = `https://www.snapchat.com/@${cleanName}`;
    console.log(`[API] Fetching live Snapchat data for @${cleanName} from ${targetUrl}...`);

    const response = await fetchHttps(targetUrl);
    
    if (response.statusCode === 404) {
      return res.status(404).json({ error: `Snapchat user @${cleanName} was not found.` });
    }

    const html = response.body;
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);

    if (!match) {
      return res.status(500).json({ error: 'Could not extract Snapchat metadata.' });
    }

    const nextData = JSON.parse(match[1]);
    const pageProps = nextData.props ? nextData.props.pageProps : {};
    const rawProfile = pageProps.userProfile ? pageProps.userProfile.publicProfileInfo : null;

    if (!rawProfile) {
      return res.status(404).json({ error: `No public profile found for @${cleanName}.` });
    }

    // Format Profile Info
    const displayName = rawProfile.title || rawProfile.username || cleanName;
    const avatar = rawProfile.profilePictureUrl || rawProfile.squareHeroImageUrl || rawProfile.snapcodeImageUrl;
    const verified = rawProfile.badge === 1;
    
    // Format Subscriber Count
    let subscriberText = 'Public Profile';
    if (rawProfile.subscriberCount && rawProfile.subscriberCount !== '0') {
      const count = parseInt(rawProfile.subscriberCount);
      if (!isNaN(count)) {
        subscriberText = count >= 1000000 
          ? `${(count / 1000000).toFixed(1)}M Subscribers` 
          : `${(count / 1000).toFixed(0)}K Subscribers`;
      }
    }

    // Parse Active 24-hour Stories
    const activeStories = [];
    if (pageProps.story && pageProps.story.snapList) {
      pageProps.story.snapList.forEach((snap, idx) => {
        const isVideo = snap.snapMediaType === 1;
        const mediaUrl = snap.snapUrls ? snap.snapUrls.mediaUrl : '';
        const thumbUrl = snap.snapUrls && snap.snapUrls.mediaPreviewUrl 
          ? snap.snapUrls.mediaPreviewUrl.value 
          : mediaUrl;

        if (mediaUrl) {
          activeStories.push({
            id: `live_${cleanName}_${idx}`,
            type: isVideo ? 'video' : 'image',
            url: mediaUrl,
            thumbnail: thumbUrl,
            timestamp: formatTimestamp(snap.timestampInSec ? snap.timestampInSec.value : null),
            caption: snap.snapTitle || snap.snapSubtitles || `Snap #${idx + 1}`,
            duration: isVideo ? 8 : 5
          });
        }
      });
    }

    // Parse Curated Highlights Albums
    const highlights = [];
    if (pageProps.curatedHighlights && Array.isArray(pageProps.curatedHighlights)) {
      pageProps.curatedHighlights.forEach((album, idx) => {
        const title = album.storyTitle ? album.storyTitle.value : `Highlight #${idx + 1}`;
        const cover = album.thumbnailUrl ? album.thumbnailUrl.value : avatar;
        const snapCount = album.snapList ? album.snapList.length : 0;
        const albumSnaps = [];

        if (album.snapList) {
          album.snapList.forEach((s, sIdx) => {
            const isVideo = s.snapMediaType === 1;
            const mediaUrl = s.snapUrls ? s.snapUrls.mediaUrl : '';
            const thumbUrl = s.snapUrls && s.snapUrls.mediaPreviewUrl ? s.snapUrls.mediaPreviewUrl.value : mediaUrl;
            if (mediaUrl) {
              albumSnaps.push({
                id: `hl_snap_${idx}_${sIdx}`,
                type: isVideo ? 'video' : 'image',
                url: mediaUrl,
                thumbnail: thumbUrl,
                timestamp: formatTimestamp(s.timestampInSec ? s.timestampInSec.value : null),
                caption: title,
                duration: isVideo ? 8 : 5
              });
            }
          });
        }

        highlights.push({
          id: album.highlightId ? album.highlightId.value : `hl_${idx}`,
          title: title,
          snapsCount: snapCount,
          cover: cover,
          snaps: albumSnaps
        });
      });
    }

    // Parse Spotlight Posts
    const spotlight = [];
    if (pageProps.spotlightHighlights && Array.isArray(pageProps.spotlightHighlights)) {
      pageProps.spotlightHighlights.forEach((sp, idx) => {
        const snap = sp.snapList && sp.snapList[0];
        if (snap && snap.snapUrls) {
          spotlight.push({
            id: `sp_${idx}`,
            views: 'Public Spotlight',
            videoUrl: snap.snapUrls.mediaUrl,
            thumbnail: snap.snapUrls.mediaPreviewUrl ? snap.snapUrls.mediaPreviewUrl.value : snap.snapUrls.mediaUrl
          });
        }
      });
    }

    // Assemble final structured account payload
    const payload = {
      username: cleanName,
      displayName: displayName,
      verified: verified,
      subscribers: subscriberText,
      bio: rawProfile.bio || `Official public Snapchat profile of ${displayName}.`,
      avatar: avatar,
      stories: activeStories,
      highlights: highlights,
      spotlight: spotlight
    };

    console.log(`[API] Successfully retrieved payload for @${cleanName}: ${activeStories.length} stories, ${highlights.length} highlights.`);
    return res.json(payload);

  } catch (err) {
    console.error(`[API Error] Failed to fetch @${cleanName}:`, err.message);
    return res.status(500).json({ error: 'Server error while retrieving Snapchat data.' });
  }
});

/**
 * API Route: GET /api/download?url=xxx&filename=xxx
 * Proxies media binary streams directly from Snapchat CDN to browser with attachment filename header
 */
app.get('/api/download', (req, res) => {
  const targetUrl = req.query.url;
  const filename = req.query.filename || `snapchat_media_${Date.now()}.mp4`;

  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  // Ensure safe filename with valid extension
  let safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safeFilename.match(/\.(mp4|jpg|jpeg|webp)$/i)) {
    safeFilename += '.mp4';
  }

  const isVideo = safeFilename.endsWith('.mp4');
  const contentType = isVideo ? 'video/mp4' : 'image/jpeg';

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*'
    }
  };

  https.get(targetUrl, options, (streamRes) => {
    if ([301, 302, 307, 308].includes(streamRes.statusCode) && streamRes.headers.location) {
      const redirectUrl = streamRes.headers.location.startsWith('http')
        ? streamRes.headers.location
        : `https://cf-st.sc-cdn.net${streamRes.headers.location}`;
      req.query.url = redirectUrl;
      return app.handle(req, res);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    if (streamRes.headers['content-length']) {
      res.setHeader('Content-Length', streamRes.headers['content-length']);
    }

    streamRes.pipe(res);
  }).on('error', (err) => {
    console.error('[Download Proxy Error]', err.message);
    if (!res.headersSent) {
      res.status(500).send('Error downloading file');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Snapchat Live Proxy Server running on http://localhost:${PORT}`);
});

