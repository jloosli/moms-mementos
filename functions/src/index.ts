import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const app = initializeApp();
const db = getFirestore(app, "default");

const airtablePat = defineSecret("AIRTABLE_PAT");

const BASE_ID = "app7RdC0Wt7qn7Xdc";
const TABLE_NAME = "Inventory Items";

interface AirtablePicture {
  id: string;
  url: string;
  filename: string;
  type: string;
  thumbnails?: {
    large?: { url: string; width: number; height: number };
  };
}

interface AirtableRecord {
  id: string;
  fields: {
    "Item Title"?: string;
    "Item Picture"?: AirtablePicture[];
    "Category (Select)"?: string;
    "Location (Select)"?: string;
  };
}

async function fetchAllRecords(pat: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
    );
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${pat}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

export const syncAirtable = onCall(
  {
    secrets: [airtablePat],
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (request) => {
    // Verify the caller is an admin
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const userDoc = await db
      .collection("users")
      .doc(request.auth.uid)
      .get();
    const isAdmin = userDoc.exists && userDoc.data()?.isAdmin === true;

    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Must be an admin.");
    }

    const pat = airtablePat.value();
    if (!pat) {
      throw new HttpsError(
        "failed-precondition",
        "AIRTABLE_PAT secret is not configured."
      );
    }

    const records = await fetchAllRecords(pat);

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

        const imageUrls = pictures.map(
          (pic) => pic.thumbnails?.large?.url || pic.url
        );
        const imageUrl = imageUrls[0] || "";

        const docRef = db.collection("items").doc(record.id);
        batch.set(docRef, {
          title,
          imageUrl,
          imageUrls,
          category,
          location,
          airtableRecordId: record.id,
          lastSynced: new Date(),
        });

        batchCount++;
        synced++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      } catch (_err) {
        errors++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return { synced, errors, total: records.length };
  }
);
