const fetch = require('node-fetch');
const xml2js = require('xml2js');
const config = require('./config');
const logger = require('./utils/logger');

// Fetch and parse the RSS feed
async function fetchRssFeed() {
  try {
    logger.info(`Fetching RSS feed from ${config.rss.feedUrl}`);
    const response = await fetch(config.rss.feedUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
    }
    
    const xml = await response.text();
    
    // Parse XML to JavaScript object
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xml);
    
    logger.info('Successfully fetched and parsed RSS feed');
    return result;
  } catch (error) {
    logger.error(`RSS feed error: ${error.message}`);
    throw error;
  }
}

// Extract the latest post from the RSS feed
async function fetchLatestPost() {
  try {
    const feed = await fetchRssFeed();
    
    if (!feed || !feed.rss || !feed.rss.channel || !feed.rss.channel.item) {
      throw new Error('Invalid RSS feed format');
    }
    
    // Handle both array and single item cases
    const items = Array.isArray(feed.rss.channel.item) 
      ? feed.rss.channel.item 
      : [feed.rss.channel.item];
    
    // Sort by publication date (most recent first)
    items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    
    // Get the most recent post
    const latestPost = items[0];
    
    // Extract OG image if available
    let ogImage = null;
    if (latestPost.description && latestPost.description.includes('og:image')) {
      const match = latestPost.description.match(/<meta property="og:image" content="([^"]+)"/);
      if (match && match[1]) {
        ogImage = match[1];
      }
    }
    
    const post = {
      id: latestPost.guid || latestPost.link,
      title: latestPost.title,
      link: latestPost.link,
      pubDate: latestPost.pubDate,
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
  fetchRssFeed,
  fetchLatestPost
};
