import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import Header from "../components/Header";
import { Navigate } from "react-router-dom";

interface Item {
  id: string;
  title: string;
  category: string;
  location: string;
}

interface Interest {
  id: string;
  itemId: string;
  userName: string;
  userEmail: string;
}

export default function AdminPage() {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  if (!userProfile?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    async function fetchAll() {
      const [itemsSnap, interestsSnap] = await Promise.all([
        getDocs(collection(db, "items")),
        getDocs(collection(db, "interests")),
      ]);
      setItems(
        itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Item))
      );
      setInterests(
        interestsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Interest)
        )
      );
      setLoading(false);
    }
    fetchAll();
  }, []);

  const interestsByItem = interests.reduce<
    Record<string, { userName: string; userEmail: string }[]>
  >((acc, interest) => {
    if (!acc[interest.itemId]) acc[interest.itemId] = [];
    acc[interest.itemId].push({
      userName: interest.userName,
      userEmail: interest.userEmail,
    });
    return acc;
  }, {});

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort();

  let filteredItems = items.filter((item) => {
    const matchesCategory = !filterCategory || item.category === filterCategory;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sort by interest count descending
  filteredItems = filteredItems.sort(
    (a, b) =>
      (interestsByItem[b.id]?.length || 0) -
      (interestsByItem[a.id]?.length || 0)
  );

  const totalInterests = interests.length;
  const itemsWithInterest = Object.keys(interestsByItem).length;
  const uniqueUsers = new Set(interests.map((i) => i.userEmail)).size;

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const syncAirtable = httpsCallable<
        Record<string, never>,
        { synced: number; errors: number; total: number }
      >(functions, "syncAirtable");
      const result = await syncAirtable({});
      setSyncResult(
        `Synced ${result.data.synced} of ${result.data.total} items` +
          (result.data.errors > 0 ? ` (${result.data.errors} errors)` : "")
      );
      // Refresh the items list
      const itemsSnap = await getDocs(collection(db, "items"));
      setItems(
        itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Item))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setSyncResult(`Sync failed: ${message}`);
    } finally {
      setSyncing(false);
    }
  }

  function exportCsv() {
    const rows = [["Item Title", "Category", "Location", "Interested Users", "Count"]];
    for (const item of filteredItems) {
      const users = interestsByItem[item.id] || [];
      rows.push([
        item.title,
        item.category || "",
        item.location || "",
        users.map((u) => `${u.userName} (${u.userEmail})`).join("; "),
        String(users.length),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "moms-mementos-interests.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Admin — Interest Overview
        </h2>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">
              {totalInterests}
            </div>
            <div className="text-sm text-gray-500">Total Interests</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">
              {itemsWithInterest}
            </div>
            <div className="text-sm text-gray-500">Items with Interest</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">
              {uniqueUsers}
            </div>
            <div className="text-sm text-gray-500">Active Users</div>
          </div>
        </div>

        {/* Filters & Export */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm hover:bg-green-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? "Syncing…" : "Sync Airtable"}
          </button>
          <button
            onClick={exportCsv}
            className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm hover:bg-purple-800 transition-colors cursor-pointer"
          >
            Export CSV
          </button>
        </div>

        {syncResult && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg text-sm ${
              syncResult.startsWith("Sync failed")
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-green-50 text-green-800 border border-green-200"
            }`}
          >
            {syncResult}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    Item
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    Category
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    Location
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    Interested Users
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 text-center">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.map((item) => {
                  const users = interestsByItem[item.id] || [];
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {item.title}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.location}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {users.length > 0
                          ? users
                              .map((u) => u.userName || u.userEmail)
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            users.length > 0
                              ? "bg-purple-100 text-purple-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {users.length}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
