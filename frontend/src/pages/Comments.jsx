import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import {
  Search,
  Filter,
  Download,
  Star,
  Calendar,
  User,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Smile,
  Frown,
  Meh,
  Tag,
  AlertCircle,
  RotateCcw,
  LayoutDashboard,
  X,
} from 'lucide-react';

const CATEGORIES = [
  'Teaching',
  'Facilities',
  'Food',
  'Internet',
  'Service',
  'Pricing',
  'Support',
  'Other',
];

export default function Comments() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Search and filter states initialized from URL params if present
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [sentiment, setSentiment] = useState(() => searchParams.get('sentiment') || '');
  const [category, setCategory] = useState(() => searchParams.get('category') || '');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Data states
  const [feedbackList, setFeedbackList] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Sync state to URL search parameters
  useEffect(() => {
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (sentiment) params.sentiment = sentiment;
    if (category) params.category = category;
    setSearchParams(params, { replace: true });
  }, [searchTerm, sentiment, category, setSearchParams]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        page,
        limit,
        sort,
      };
      if (searchTerm) params.search = searchTerm;
      if (sentiment) params.sentiment = sentiment;
      if (category) params.category = category;

      const response = await apiClient.get('/feedback', { params });
      setFeedbackList(response.data.data || []);
      setPagination(response.data.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setError('Failed to load feedback records. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, sort, searchTerm, sentiment, category]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Export CSV handler
  const handleExportCsv = async () => {
    setExporting(true);
    setExportError('');
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (sentiment) params.sentiment = sentiment;
      if (category) params.category = category;
      if (sort) params.sort = sort;

      const response = await apiClient.get('/feedback/export.csv', {
        params,
        responseType: 'blob',
      });

      // Create download anchor
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `feedback_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      setExportError(
        'Failed to generate CSV export. Please check your connection and try again.'
      );
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setSentiment('');
    setCategory('');
    setSort('newest');
    setPage(1);
    setExportError('');
  };

  const getSentimentBadge = (sentimentValue, confidence) => {
    switch (sentimentValue?.toLowerCase()) {
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Smile className="w-3.5 h-3.5 text-emerald-600" />
            <span>Positive</span>
            {confidence && (
              <span className="text-[10px] text-emerald-500 font-normal">
                {Math.round(confidence * 100)}%
              </span>
            )}
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Frown className="w-3.5 h-3.5 text-rose-600" />
            <span>Negative</span>
            {confidence && (
              <span className="text-[10px] text-rose-500 font-normal">
                {Math.round(confidence * 100)}%
              </span>
            )}
          </span>
        );
      case 'neutral':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Meh className="w-3.5 h-3.5 text-slate-500" />
            <span>Neutral</span>
          </span>
        );
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-900">Comments</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Feedback Directory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Filter, search, inspect, and export all collected submissions.
          </p>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExportCsv}
          disabled={exporting || pagination.total === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
        >
          {exporting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>Export Filtered CSV</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {exportError && (
        <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="flex-1">{exportError}</span>
          <button
            type="button"
            onClick={() => setExportError('')}
            aria-label="Dismiss export error"
            className="p-1 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center gap-3">
        {/* Search Box */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search within comments or submitter names..."
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sentiment Filter */}
          <select
            value={sentiment}
            onChange={(e) => {
              setSentiment(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Sort Controls */}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="rating_desc">Highest Rating</option>
            <option value="rating_asc">Lowest Rating</option>
          </select>

          {/* Reset Filters Button */}
          {(searchTerm || sentiment || category || sort !== 'newest') && (
            <button
              onClick={handleResetFilters}
              title="Reset all filters"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Comments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Feedback Comment</th>
                <th className="py-3.5 px-4 w-28">Rating</th>
                <th className="py-3.5 px-4 w-36">Sentiment</th>
                <th className="py-3.5 px-4 w-32">Category</th>
                <th className="py-3.5 px-4 w-36">Submitter</th>
                <th className="py-3.5 px-4 w-28">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                // Skeletons
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4 sm:px-6">
                      <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-slate-100 rounded w-1/3" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-6 bg-slate-100 rounded-full w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                  </tr>
                ))
              ) : feedbackList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                        <Filter className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-base mb-1">
                        No comments found
                      </h3>
                      <p className="text-xs text-slate-500 mb-4">
                        Try adjusting your search query, sentiment, or category filters.
                      </p>
                      <button
                        onClick={handleResetFilters}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                feedbackList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    {/* Comment text + keywords */}
                    <td className="py-4 px-4 sm:px-6 align-top">
                      <p className="text-slate-900 font-medium leading-relaxed">
                        {item.comment}
                      </p>
                      {item.keywords && item.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.keywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600"
                            >
                              #{kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Rating */}
                    <td className="py-4 px-4 align-top whitespace-nowrap">
                      {item.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="font-bold text-slate-800 text-xs">
                            {item.rating}
                          </span>
                          <span className="text-[10px] text-slate-400">/ 5</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Sentiment */}
                    <td className="py-4 px-4 align-top whitespace-nowrap">
                      {getSentimentBadge(item.sentiment, item.confidence)}
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4 align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>{item.category || 'Other'}</span>
                      </span>
                    </td>

                    {/* Submitter */}
                    <td className="py-4 px-4 align-top text-xs text-slate-600 whitespace-nowrap">
                      {item.is_anonymous ? (
                        <span className="text-slate-400 italic">Anonymous</span>
                      ) : (
                        <div className="flex items-center gap-1 font-medium text-slate-800">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.submitter_name || 'Named'}</span>
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-4 px-4 align-top text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.total > 0 && (
          <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-800">
                {(page - 1) * limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(page * limit, pagination.total)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-800">
                {pagination.total}
              </span>{' '}
              submissions
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="font-medium text-slate-600">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}