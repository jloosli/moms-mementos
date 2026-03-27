import { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import Header from "../components/Header";
import ItemCard from "../components/ItemCard";

interface Item {
  id: string;
  title: string;
  imageUrl: string;
  imageUrls?: string[];
  category: string;
  location: string;
}

interface Interest {
  id: string;
  itemId: string;
}

export default function GalleryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState("title-asc");
  const [showMyInterests, setShowMyInterests] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [itemsSnap, interestsSnap] = await Promise.all([
        getDocs(collection(db, "items")),
        getDocs(
          query(
            collection(db, "interests"),
            where("userId", "==", user!.uid)
          )
        ),
      ]);

      setItems(
        itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Item))
      );
      setInterests(
        interestsSnap.docs.map((d) => ({
          id: d.id,
          itemId: d.data().itemId,
        }))
      );
      setLoading(false);
    }
    fetchData();
  }, [user]);

  const interestedItemIds = useMemo(
    () => new Set(interests.map((i) => i.itemId)),
    [interests]
  );

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );
  const locations = useMemo(
    () => [...new Set(items.map((i) => i.location).filter(Boolean))].sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }
    if (categoryFilter) {
      result = result.filter((i) => i.category === categoryFilter);
    }
    if (locationFilter) {
      result = result.filter((i) => i.location === locationFilter);
    }
    if (showMyInterests) {
      result = result.filter((i) => interestedItemIds.has(i.id));
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "category":
          return (a.category || "").localeCompare(b.category || "");
        case "location":
          return (a.location || "").localeCompare(b.location || "");
        default:
          return 0;
      }
    });
    return result;
  }, [items, search, categoryFilter, locationFilter, sortBy, showMyInterests, interestedItemIds]);

  async function toggleInterest(itemId: string) {
    const existing = interests.find((i) => i.itemId === itemId);
    if (existing) {
      await deleteDoc(doc(db, "interests", existing.id));
      setInterests((prev) => prev.filter((i) => i.id !== existing.id));
    } else {
      const docRef = await addDoc(collection(db, "interests"), {
        userId: user!.uid,
        userEmail: user!.email,
        userName: user!.displayName || user!.email,
        itemId,
        createdAt: serverTimestamp(),
      });
      setInterests((prev) => [...prev, { id: docRef.id, itemId }]);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading items...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Inventory Items
          </h2>
          <p className="text-gray-500 text-sm">
            Browse items and indicate your interest
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
            <option value="category">Category</option>
            <option value="location">Location</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showMyInterests}
              onChange={(e) => setShowMyInterests(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
            />
            My interests only
          </label>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
        </p>

        {/* Item Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isInterested={interestedItemIds.has(item.id)}
              onToggleInterest={toggleInterest}
            />
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No items match your filters.
          </div>
        )}
      </main>
    </div>
  );
}
