interface ItemCardProps {
  item: {
    id: string;
    title: string;
    imageUrl: string;
    category: string;
    location: string;
  };
  isInterested: boolean;
  onToggleInterest: (itemId: string) => void;
}

const categoryColors: Record<string, string> = {
  Art: "bg-purple-100 text-purple-800",
  Pictures: "bg-blue-100 text-blue-800",
  Decor: "bg-green-100 text-green-800",
  Furniture: "bg-amber-100 text-amber-800",
  Electronics: "bg-gray-100 text-gray-800",
  Kitchen: "bg-red-100 text-red-800",
  Books: "bg-indigo-100 text-indigo-800",
  Other: "bg-slate-100 text-slate-800",
};

export default function ItemCard({
  item,
  isInterested,
  onToggleInterest,
}: ItemCardProps) {
  const colorClass = categoryColors[item.category] || categoryColors.Other;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-medium text-gray-900 text-sm mb-2 line-clamp-2">
          {item.title}
        </h3>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {item.category && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}
            >
              {item.category}
            </span>
          )}
          {item.location && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-100 text-sky-800">
              {item.location}
            </span>
          )}
        </div>
        <button
          onClick={() => onToggleInterest(item.id)}
          className={`mt-auto w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
            isInterested
              ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
        >
          <svg
            className="w-4 h-4"
            fill={isInterested ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
          {isInterested ? "I'm interested" : "I'm interested"}
        </button>
      </div>
    </div>
  );
}
