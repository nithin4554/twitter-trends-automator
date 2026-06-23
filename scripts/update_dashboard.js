const fs = require('fs');
const path = require('path');
const { scrapeTrends, scrapeAINewsFromRSS } = require('./scrape');

// Helper to get formatted date
function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalTimeString() {
  const d = new Date();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  return `${hours}:${minutes} ${ampm}`;
}

async function main() {
  console.log('Starting dashboard data update...');
  
  // Parse arguments
  let aiNewsFilePath = null;
  let fetchCloudAI = false;
  
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--ai-news-file' && i + 1 < process.argv.length) {
      aiNewsFilePath = process.argv[i + 1];
    }
    if (process.argv[i] === '--fetch-cloud-ai') {
      fetchCloudAI = true;
    }
  }

  // 1. Fetch general trends
  const generalTrends = await scrapeTrends();
  
  // 2. Fetch/Load AI news
  let aiNews = [];
  if (fetchCloudAI) {
    console.log('Running in Cloud mode: Fetching AI news via RSS feeds...');
    aiNews = await scrapeAINewsFromRSS();
  } else if (aiNewsFilePath) {
    try {
      if (fs.existsSync(aiNewsFilePath)) {
        const fileContent = fs.readFileSync(aiNewsFilePath, 'utf8');
        aiNews = JSON.parse(fileContent);
        console.log(`Loaded ${aiNews.length} AI news items from ${aiNewsFilePath}`);
      } else {
        console.warn(`AI news file not found at: ${aiNewsFilePath}`);
      }
    } catch (e) {
      console.error('Error loading AI news file:', e);
    }
  } else {
    console.log('No AI news input provided. Database will update with general trends only.');
  }

  const currentDate = getLocalDateString();
  const currentTime = getLocalTimeString();

  // 3. Load database
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'trends.json');
  
  let db = [];
  if (fs.existsSync(dbPath)) {
    try {
      db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      console.error('Error parsing trends.json database:', e);
      db = [];
    }
  }

  // 4. Update or append current day's record
  const existingRecordIndex = db.findIndex(r => r.date === currentDate);
  const newRecord = {
    date: currentDate,
    timestamp: currentTime,
    general_trends: generalTrends,
    ai_trends: aiNews
  };

  if (existingRecordIndex !== -1) {
    db[existingRecordIndex] = newRecord;
    console.log(`Updated existing record for date: ${currentDate}`);
  } else {
    db.push(newRecord);
    console.log(`Added new record for date: ${currentDate}`);
  }

  // Sort by date descending (latest first)
  db.sort((a, b) => b.date.localeCompare(a.date));

  // Cap history at 14 days
  if (db.length > 14) {
    db = db.slice(0, 14);
  }

  // Save database
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Saved database to ${dbPath}`);

  // 5. Generate Markdown Report Artifact
  generateMarkdownReport(newRecord);
}

function generateMarkdownReport(record) {
  const artifactDir = '/Users/nitinkandula/.gemini/antigravity/brain/40ad0ccc-9333-4fec-a66e-401f1265e912';
  
  // Make sure artifact directory exists before writing (in local environment)
  if (!fs.existsSync(artifactDir)) {
    console.warn(`Artifact directory does not exist locally: ${artifactDir}`);
    // If running in cloud, we don't need to write to the agent's absolute app data directory
    return;
  }
  
  const reportPath = path.join(artifactDir, 'trends_report.md');
  
  let markdown = `# Daily X/Twitter & AI Trends Report 

**Date:** ${record.date}  
**Last Updated:** ${record.timestamp} (Local Time)

---

## 🤖 Trending AI News & Insights

`;

  if (record.ai_trends && record.ai_trends.length > 0) {
    record.ai_trends.forEach((item, index) => {
      markdown += `### ${index + 1}. ${item.title}\n\n`;
      markdown += `> [!NOTE]\n`;
      markdown += `> **Summary:** ${item.summary}\n`;
      if (item.url) {
        markdown += `> \n> **Link:** [View Discussion/Post](${item.url})\n`;
      }
      markdown += `\n`;
    });
  } else {
    markdown += `> [!IMPORTANT]\n> No AI-specific trending news loaded for today. Update the scheduler or import AI news to populate this section.\n\n`;
  }

  markdown += `---

## 🌐 Top General Trends on X

Here are the top trending topics currently captured from Twitter/X:

| Rank | Trend Topic |
| :---: | :--- |
`;

  record.general_trends.forEach((trend, index) => {
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(trend)}`;
    markdown += `| **#${index + 1}** | [${trend}](${searchUrl}) |\n`;
  });

  markdown += `\n\n*Note: Click on any general trend topic to open its search page directly on Twitter/X.*\n`;

  try {
    fs.writeFileSync(reportPath, markdown, 'utf8');
    console.log(`Generated markdown report artifact at: ${reportPath}`);
  } catch (e) {
    console.error('Error generating markdown report artifact:', e);
  }
}

if (require.main === module) {
  main();
}
