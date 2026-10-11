import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ rating, onChange, disabled = false }) {
  const [hoverRating, setHoverRating] = useState(0);

  const labels = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = (hoverRating || rating) >= star;
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className={`p-1 rounded transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
              aria-label={`Rate ${star} stars out of 5`}
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  isFilled
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-300 stroke-[1.5]'
                }`}
              />
            </button>
          );
        })}
      </div>
      {(hoverRating || rating) > 0 && (
        <span className="text-xs font-semibold text-slate-500">
          {labels[hoverRating || rating]}
        </span>
      )}
    </div>
  );
}