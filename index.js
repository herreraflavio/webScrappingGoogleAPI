const fs = require("fs");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

async function googleSearch(query, apiKey, cseId, start = 1) {
  const url = "https://www.googleapis.com/customsearch/v1";
  const params = {
    key: apiKey,
    cx: cseId,
    q: query,
    start: start,
  };

  try {
    const response = await axios.get(url, { params });
    const items = response.data.items;
    if (items) {
      return items.map((item) => item.link);
    } else {
      console.log("No results found for", query);
      return [];
    }
  } catch (error) {
    console.error("Error during API call", error);
    return [];
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performSearches(apiKey, cseId) {
  //   const baseQueries = [
  //     { query: `"arpa order no "`, numPosition: "end" },
  //     { query: `"arpa order "`, numPosition: "end" },
  //     { query: `"AO `, suffix: `" arpa`, numPosition: "middle" },
  //   ];
  const baseQueries = [
    { query: `"arpa order no `, suffix: `"`, numPosition: "middle" },
    { query: `"arpa order `, suffix: `"`, numPosition: "middle" },
    { query: `"AO `, suffix: `" arpa`, numPosition: "middle" },
  ];
  const results = [];
  let num = 500;
  const limit = 502;

  for (let num = 500; num <= limit; num++) {
    const urlsForCurrentNumber = [];
    for (const { query, suffix = "", numPosition } of baseQueries) {
      let searchQuery = query;
      if (numPosition === "end") {
        searchQuery += num;
      } else if (numPosition === "middle") {
        searchQuery = query + num + suffix;
      }

      const urls = await googleSearch(searchQuery, apiKey, cseId);
      urlsForCurrentNumber.push(urls);
    }

    results.push(urlsForCurrentNumber);
    console.log("Processed number", num);

    await delay(3000);
  }

  console.log("Finished processing.");
  return results;
}

const apiKey = process.env.GOOGLE_API_KEY;
const cseId = process.env.GOOGLE_CSE_ID;

async function downloadPdf(url, folder) {
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
    });

    const filename = url.split("/").pop();
    const filePath = path.join(folder, filename);

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`Error downloading from ${url}:`, error);
  }
}

async function processUrls(nestedUrls) {
  for (let i = 0; i < nestedUrls.length; i++) {
    const folderName = path.join(__dirname, `output/pdfs/folder${i + 500}`);
    for (let urls of nestedUrls[i]) {
      for (let url of urls) {
        if (url.endsWith(".pdf")) {
          await downloadPdf(url, folderName).then(() => {
            console.log(`Downloaded ${url} into ${folderName}`);
          });
        }
      }
    }
  }
}

(async () => {
  const results = await performSearches(apiKey, cseId);
  console.log(results);
  await processUrls(results);
})();
