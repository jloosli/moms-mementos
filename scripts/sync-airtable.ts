/**
 * Airtable -> Firestore sync script
 *
 * Usage:
 *   AIRTABLE_PAT=your_token npx tsx scripts/sync-airtable.ts
 *
 * Environment variables:
 *   AIRTABLE_PAT        - Airtable Personal Access Token (required)
 *   AIRTABLE_BASE_ID    - Airtable Base ID (default: app7RdC0Wt7qn7Xdc)
 *   AIRTABLE_TABLE_NAME - Airtable Table Name (default: Inventory Items)
 *
 * Firebase auth: uses Application Default Credentials
 *   Run `gcloud auth application-default login` first
 *   OR set GOOGLE_APPLICATION_CREDENTIALS to a service account key file
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";

// ─── Config ───────────────────────────────────────────────────
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = process.env.AIRTABLE_BASE_ID || "app7RdC0Wt7qn7Xdc";
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Inventory Items";

if (!AIRTABLE_PAT) {
  console.error("Error: AIRTABLE_PAT environment variable is required.");
  console.error("Create one at https://airtable.com/create/tokens");
  process.exit(1);
}

// ─── Firebase Admin Init ──────────────────────────────────────
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let firebaseConfig: { projectId: string; credential?: ReturnType<typeof cert> } = {
  projectId: "moms-mementos",
};
if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  const sa = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
  firebaseConfig.credential = cert(sa as ServiceAccount);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "default");
db.settings({ preferRest: true });

// ─── Airtable API ─────────────────────────────────────────────
interface AirtableRecord {
  id: string;
  fields: {
    "Item Title"?: string;
    "Item Picture"?: Array<{
      id: string;
      url: string;
      filename: string;
      type: string;
      thumbnails?: {
        large?: { url: string; width: number; height: number };
      };
    }>;
    "Category (Select)"?: string;
    "Location (Select)"?: string;
  };
}

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
    );
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
    console.log(`  Fetched ${records.length} records...`);
  } while (offset);

  return records;
}

// ─── Main Sync ────────────────────────────────────────────────
async function main() {
  console.log("Fetching records from Airtable...");
  const records = await fetchAllRecords();
  console.log(`Found ${records.length} records.\n`);

  let synced = 0;
  let errors = 0;
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const record of records) {
    try {
      const title = record.fields["Item Title"] || "Untitled";
      const category = record.fields["Category (Select)"] || "";
      const location = record.fields["Location (Select)"] || "";
      const pictures = record.fields["Item Picture"] || [];

      // Use the large thumbnail URL from Airtable.
      // These URLs expire after ~2 hours, so re-run this script to refresh.
      // Future improvement: upload to Firebase Storage for permanent URLs.
      let imageUrl = "";
      if (pictures.length > 0) {
        const pic = pictures[0];
        imageUrl = pic.thumbnails?.large?.url || pic.url;
      }

      const docRef = db.collection("items").doc(record.id);
      batch.set(docRef, {
        title,
        imageUrl,
        category,
        location,
        airtableRecordId: record.id,
        lastSynced: new Date(),
      });

      batchCount++;
      synced++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`  Committed batch of ${batchCount} records.`);
        batch = db.batch();
        batchCount = 0;
      }

      if (synced % 50 === 0) {
        console.log(`  Processed ${synced}/${records.length}...`);
      }
    } catch (err) {
      console.error(`  Error syncing record ${record.id}: ${err}`);
      errors++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} records.`);
  }

  console.log(`\nSync complete: ${synced} synced, ${errors} errors.`);
}

main().catch(console.error);
