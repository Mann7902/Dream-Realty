
import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";
import fs from "fs";

// 🔹 Load Google credentials
// const credentials = JSON.parse(fs.readFileSync("credentials.json"));
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const { client_email, private_key } = credentials;

// 🔹 Setup Google Sheets API
const auth = new google.auth.JWT(
  client_email,
  null,
  private_key,
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = "1v9z4kEX5k6tpuTg_D7SCoNJubxmTHQjt53a4x7kd6D8"; // paste your Google Sheet ID

const app = express();
app.use(bodyParser.json());

// ---------- TEXT NORMALIZATION ----------

function normalizeEmail(email) {
  if (!email) return "";
  return email
    .replace(/\s+/g, "") // remove spaces
    .replace(/attherate|at\s*the\s*rate/gi, "@")
    .replace(/\s?at\s?/gi, "@")
    .replace(/\sdot\s/gi, ".")
    .replace(/dot/gi, ".")
    .replace(/,+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/@gmail\.com.*$/i, "@gmail.com")
    .toLowerCase();
}

function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/\D/g, ""); // keep only digits
}

function normalizePropertyType(text) {
  if (!text) return "";
  return text.replace(/\b(\d)\s*B\s*H\s*K\b/gi, "$1BHK");
}

function normalizeBudget(budget) {
  if (!budget) return "";

  let cleaned = budget.toLowerCase().trim();
  cleaned = cleaned.replace(/x/gi, "");
  cleaned = cleaned.replace(/[^a-z0-9., ]/gi, "").trim();

  // Convert words like "one million" → $1,000,000
  const wordsToNumbers = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10
  };

  const millionMatch = cleaned.match(/(\w+)\s*million/);
  if (millionMatch && wordsToNumbers[millionMatch[1]]) {
    return `$${wordsToNumbers[millionMatch[1]] * 1_000_000}`;
  }

  const thousandMatch = cleaned.match(/(\w+)\s*thousand/);
  if (thousandMatch && wordsToNumbers[thousandMatch[1]]) {
    return `$${wordsToNumbers[thousandMatch[1]] * 1_000}`;
  }

  // If numeric, format with commas
  const numeric = cleaned.match(/\d{4,}/);
  if (numeric) {
    const num = parseInt(numeric[0]);
    return `$${num.toLocaleString()}`;
  }

  return budget; // fallback
}


app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;

    // ✅ Navigate safely to the structured output result
    const structuredOutputs = data?.message?.artifact?.structuredOutputs || {};
    const firstOutputKey = Object.keys(structuredOutputs)[0]; // get the first key dynamically
    const result = structuredOutputs[firstOutputKey]?.result || {};

    // 🧠 Extract & normalize fields
    const name = result.caller_name || "";
    const phone = normalizePhone(result.caller_phone);
    const email = normalizeEmail(result.caller_email);
    const propertyType = normalizePropertyType(result.propertyType);
    const area = result.area || "";
    const budget = normalizeBudget(result.budget);
    const urgency = result.urgency || "";
    const notes = result.notes || "";

    // 🟢 Prepare clean row
    const newRow = [
      new Date().toLocaleString(),
      name,
      phone,
      email,
      propertyType,
      area,
      budget,
      urgency,
      notes,
      JSON.stringify(result)
    ];

    // 🧾 Save to Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [newRow] },
    });

    console.log("✅ Saved:", newRow);
    res.status(200).send("Success");
  } catch (err) {
    console.error("❌ Error saving data:", err);
    res.status(500).send("Error");
  }
});



// // ---------- MAIN ENDPOINT ----------

// app.post("/webhook", async (req, res) => {
//   try {
//     const data = req.body;
//     const caller = data.caller || {};
//     const details = data.details || {};
//     const summary = data.summary || {};

//     // 🧠 Preprocess and normalize
//     const name = caller.name || "";
//     const phone = normalizePhone(caller.phone);
//     const email = normalizeEmail(caller.email);
//     const propertyType = normalizePropertyType(details.propertyType);
//     const area = details.area || "";
//     const budget = normalizeBudget(details.budget);
//     const urgency = details.urgency || "";
//     const notes = summary.notes || "";

//     // 🟢 Prepare clean row
//     const newRow = [
//       new Date().toLocaleString(),
//       name,
//       phone,
//       email,
//       propertyType,
//       area,
//       budget,
//       urgency,
//       notes,
//       JSON.stringify(data)
//     ];

//     // 🧾 Save to Google Sheets
//     await sheets.spreadsheets.values.append({
//       spreadsheetId: SPREADSHEET_ID,
//       range: "Sheet1!A:J",
//       valueInputOption: "USER_ENTERED",
//       requestBody: { values: [newRow] }
//     });

//     console.log("✅ Saved:", newRow);
//     res.status(200).send("Success");
//   } catch (err) {
//     console.error("❌ Error saving data:", err);
//     res.status(500).send("Error");
//   }
// });

// ---------- SERVER START ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Webhook running on port ${PORT}`));




// // 🔹 Setup Express server
// const app = express();
// app.use(bodyParser.json());

// // 🔹 Webhook endpoint
// app.post("/webhook", async (req, res) => {
//   try {
//     const data = req.body;

//     // 🧠 Extract key fields
//     const caller = data.caller || {};
//     const details = data.details || {};
//     const summary = data.summary || {};

//     // 🧾 Create clean row
//     const newRow = [
//       new Date().toLocaleString(),
//       caller.name || "",
//       caller.phone || "",
//       caller.email || "",
//       details.propertyType || "",
//       details.area || "",
//       details.budget || "",
//       details.urgency || "",
//       summary.notes || "",
//       JSON.stringify(data)
//     ];

//     // 🟢 Append to Google Sheet
//     await sheets.spreadsheets.values.append({
//       spreadsheetId: SPREADSHEET_ID,
//       range: "Sheet1!A:J",
//       valueInputOption: "USER_ENTERED",
//       requestBody: { values: [newRow] }
//     });

//     console.log("✅ Data saved:", newRow);
//     res.status(200).send("Success");
//   } catch (err) {
//     console.error("❌ Error saving data:", err);
//     res.status(500).send("Error");
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 Webhook running on port ${PORT}`));
