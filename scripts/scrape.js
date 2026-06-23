const fs = require('fs');
const path = require('path');

// Helper to strip HTML tags from a string
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Strip tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Scrape General Twitter Trends from getdaytrends.com
async function scrapeTrends() {
  console.log('Fetching general trends from getdaytrends.com...');
  try {
    const response = await fetch('https://getdaytrends.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    
    const trendRegex = /href="\/trend\/[^"]*"\s*[^>]*>([^<]+)<\/a>/g;
    const trends = [];
    let match;
    
    while ((match = trendRegex.exec(html)) !== null) {
      const trendName = match[1].trim();
      const decodedTrend = trendName
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
        
      if (!trends.includes(decodedTrend) && decodedTrend.length > 0) {
        trends.push(decodedTrend);
      }
      
      if (trends.length >= 15) {
        break;
      }
    }
    
    console.log(`Successfully scraped ${trends.length} general trends.`);
    return trends;
  } catch (error) {
    console.error('Error in scrapeTrends:', error);
    return [];
  }
}

// Parse single RSS Feed XML string
function parseRssFeed(xmlText, maxItems = 4) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const titleRegex = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/;
  const linkRegex = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/;
  const descRegex = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/;
  
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null && items.length < maxItems) {
    const itemContent = match[1];
    
    const titleMatch = titleRegex.exec(itemContent);
    const linkMatch = linkRegex.exec(itemContent);
    const descMatch = descRegex.exec(itemContent);
    
    if (titleMatch && linkMatch) {
      const title = stripHtml(titleMatch[1]);
      const url = linkMatch[1].trim();
      let summary = descMatch ? stripHtml(descMatch[1]) : '';
      
      // Truncate summary if too long
      if (summary.length > 200) {
        summary = summary.substring(0, 197) + '...';
      }
      
      items.push({ title, summary, url });
    }
  }
  return items;
}

// Scrape AI-specific news from major RSS feeds
async function scrapeAINewsFromRSS() {
  console.log('Fetching AI news from TechCrunch & VentureBeat RSS feeds...');
  const feeds = [
    { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
    { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' }
  ];
  
  let allNews = [];
  
  for (const feed of feeds) {
    try {
      console.log(`Loading RSS feed: ${feed.name}...`);
      const response = await fetch(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!response.ok) {
        console.warn(`Failed to fetch ${feed.name}: ${response.statusText}`);
        continue;
      }
      const xml = await response.text();
      const parsedItems = parseRssFeed(xml, 3); // Take top 3 from each
      allNews = allNews.concat(parsedItems);
    } catch (e) {
      console.error(`Error fetching RSS feed ${feed.name}:`, e);
    }
  }
  
  console.log(`Successfully scraped ${allNews.length} AI news items.`);
  return allNews;
}

// If run directly, print output
if (require.main === module) {
  Promise.all([scrapeTrends(), scrapeAINewsFromRSS()]).then(([trends, aiNews]) => {
    console.log('\n--- Scraped Trends ---');
    console.log(trends);
    console.log('\n--- Scraped AI RSS News ---');
    console.log(aiNews);
  });
}

module.exports = { scrapeTrends, scrapeAINewsFromRSS };
