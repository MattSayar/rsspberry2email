// rssParser.js
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const config = require('./config');
const logger = require('./utils/logger');

// Fetch and parse the feed (supports both RSS and Atom formats)
async function fetchFeed() {
  try {
    logger.info(`Fetching feed from ${config.rss.feedUrl}`);
    const response = await fetch(config.rss.feedUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }
    
    const xml = await response.text();
    
    // Parse XML to JavaScript object
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xml);
    
    logger.info('Successfully fetched and parsed feed');
    return result;
  } catch (error) {
    logger.error(`Feed error: ${error.message}`);
    throw error;
  }
}

// Extract the latest post from the feed (handles both RSS and Atom formats)
async function fetchLatestPost() {
  try {
    const feed = await fetchFeed();
    
    // Determine feed type (RSS or Atom)
    let items = [];
    let feedType = '';
    
    if (feed.rss && feed.rss.channel) {
      // RSS format
      feedType = 'RSS';
      items = Array.isArray(feed.rss.channel.item) 
        ? feed.rss.channel.item 
        : [feed.rss.channel.item];
    } else if (feed.feed && feed.feed.entry) {
      // Atom format
      feedType = 'Atom';
      items = Array.isArray(feed.feed.entry) 
        ? feed.feed.entry 
        : [feed.feed.entry];
    } else {
      throw new Error('Unsupported feed format');
    }
    
    if (!items || items.length === 0) {
      throw new Error('No items found in feed');
    }
    
    logger.info(`Detected ${feedType} feed format with ${items.length} items`);
    
    // Sort by publication date (most recent first)
    // Handle date format differences between RSS and Atom
    items.sort((a, b) => {
      const dateA = feedType === 'RSS' ? a.pubDate : a.updated;
      const dateB = feedType === 'RSS' ? b.pubDate : b.updated;
      return new Date(dateB) - new Date(dateA);
    });
    
    // Get the most recent post
    const latestPost = items[0];
    
    // Extract OG image if available
    let ogImage = null;
    
    // Try different approaches to find the image based on feed format
    if (feedType === 'RSS' && latestPost.description && latestPost.description.includes('og:image')) {
      // Try to extract from description meta tag
      const match = latestPost.description.match(/<meta property="og:image" content="([^"]+)"/);
      if (match && match[1]) {
        ogImage = match[1];
      }
    } else if (feedType === 'Atom' && latestPost['media:content']) {
      // Try to get from media:content
      ogImage = latestPost['media:content'].$.url;
    }
    
    let postLink;
    if (feedType === 'RSS') {
      postLink = latestPost.link;
    } else {
      // For Atom feeds
      if (typeof latestPost.link === 'string') {
        postLink = latestPost.link;
      } else if (typeof latestPost.link === 'object') {
        // Try various structures that might contain the URL
        postLink = latestPost.link.href || 
                  (latestPost.link.$ ? latestPost.link.$.href : null) ||
                  (latestPost.link['@_href']) || // Some parsers use this
                  latestPost.link._;
      }
    }

    if (!postLink) {
      logger.warn(`Could not extract a link from the latest post. Using fallback URL.`);
      postLink = 'https://mattsayar.com'; // Fallback to site homepage
    }

    const post = {
      id: feedType === 'RSS' ? (latestPost.guid || latestPost.link) : latestPost.id,
      title: latestPost.title,
      link: postLink,
      pubDate: feedType === 'RSS' ? latestPost.pubDate : latestPost.updated,
      ogImage: ogImage
    };
    
    logger.info(`Latest post: ${post.title} (${post.pubDate})`);
    return post;
  } catch (error) {
    logger.error(`Failed to fetch latest post: ${error.message}`);
    throw error;
  }
}

module.exports = {
  fetchFeed,
  fetchLatestPost
};