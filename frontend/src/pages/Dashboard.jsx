import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import DateRangeFilter from '../components/DateRangeFilter';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import {
  MessageSquare,
  Smile,
  Frown,
  Star,
  TrendingUp,
  Tag,
  Hash,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const SENTIMENT_COLORS = {
  positive: '#10b981', // Emerald-500
  neutral: '#94a3b8',  // Slate-400
  negative: '#ef4444', // Rose-500
};

export default function Dashboard() {
  const navigate = useNavigate();

  // Filters state
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [trendInterval, setTrendInterval] = useState('week');

  // Data states
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [categories, setCategories] = useState([]);
  const [keywords, setKeywords] = useState([]);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch all dashboard data when dateRange changes
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {};
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;

      const [summaryRes, trendRes, categoriesRes, keywordsRes] = await Promise.all([
        apiClient.get('/analytics/summary', { params }),
        apiClient.get('/analytics/trend', {
          params: { ...params, interval: trendInterval },
        }),
        apiClient.get('/analytics/categories', { params }),
        apiClient.get('/analytics/keywords', { params }),
      ]);

      setSummary(summaryRes.data);
      setTrends(trendRes.data);
      setCategories(categoriesRes.data);
      setKeywords(keywordsRes.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Unable to load analytics data. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, trendInterval]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Derived metrics for summary cards
  const total = summary?.totalFeedback || 0;
  const positiveCount = summary?.sentimentCounts?.positive || 0;
  const negativeCount = summary?.sentimentCounts?.negative || 0;
  const neutralCount = summary?.sentimentCounts?.neutral || 0;
  const avgRating = summary?.averageRating || 0;

  const positivePercent = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
  const negativePercent = total > 0 ? Math.round((negativeCount / total) * 100) : 0;

  // Donut chart dataset
  const donutData = [
    { name: 'Positive', value: positiveCount, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: neutralCount, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: negativeCount, color: SENTIMENT_COLORS.negative },
  ].filter((d) => d.value > 0);

  // Formatter for trend dates
  const formatTrendDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (trendInterval === 'month') {
      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Navigations on chart segment click
  const handleDonutClick = (entry) => {
    if (entry && entry.name) {
      navigate(`/admin/comments?sentiment=${entry.name.toLowerCase()}`);
    }
  };

  const handleBarClick = (data) => {
    if (data && data.category) {
      navigate(`/admin/comments?category=${encodeURIComponent(data.category)}`);
    }
  };

  const handleKeywordClick = (keyword) => {
    navigate(`/admin/comments?search=${encodeURIComponent(keyword)}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Title and Global Date Range Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Analytics Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time sentiment telemetry, volume trends, and categorized feedback.
          </p>
        </div>

        <DateRangeFilter onChange={setDateRange} />
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Background analysis status banner */}
      {!loading && summary && (summary.pendingAnalysis > 0 || summary.failedAnalysis > 0) && (
        <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {summary.pendingAnalysis > 0 && (
              <>
                {summary.pendingAnalysis} comment{summary.pendingAnalysis === 1 ? '' : 's'} awaiting analysis
              </>
            )}
            {summary.pendingAnalysis > 0 && summary.failedAnalysis > 0 && ' · '}
            {summary.failedAnalysis > 0 && (
              <>
                {summary.failedAnalysis} failed analysis
              </>
            )}
            . These appear in the charts as the background worker finishes.
          </span>
        </div>
      )}

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Card 1: Total Feedback */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Feedback
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{total}</span>
              <span className="text-xs text-slate-400">submissions</span>
            </div>
          )}
        </div>

        {/* Card 2: % Positive */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Positive Sentiment
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Smile className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600">{positivePercent}%</span>
              <span className="text-xs text-slate-400">({positiveCount} comments)</span>
            </div>
          )}
        </div>

        {/* Card 3: % Negative */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Negative Sentiment
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Frown className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-600">{negativePercent}%</span>
              <span className="text-xs text-slate-400">({negativeCount} comments)</span>
            </div>
          )}
        </div>

        {/* Card 4: Average Rating */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Average Rating
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-slate-400">/ 5.0 stars</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Donut Chart: Sentiment Breakdown (1 column on large screens) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sentiment Distribution</h2>
              <p className="text-xs text-slate-400">Click a slice to filter comments</p>
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="relative w-40 h-40">
                <div className="absolute inset-0 rounded-full bg-slate-100 animate-pulse" />
                <div className="absolute inset-7 rounded-full bg-white" />
              </div>
            </div>
          ) : donutData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
              <Sparkles className="w-8 h-8 mb-2 opacity-50" />
              <span>No feedback recorded for this period</span>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    cursor="pointer"
                    onClick={handleDonutClick}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val, name) => [`${val} (${Math.round((val / total) * 100)}%)`, name]}
                    contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(val) => <span className="text-xs text-slate-600 font-medium">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Sentiment Trend Area/Line Chart (2 columns on large screens) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sentiment Timeline</h2>
              <p className="text-xs text-slate-400">Tracking feedback sentiment trends over time</p>
            </div>

            {/* Day / Week / Month Interval Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              {['day', 'week', 'month'].map((interval) => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => setTrendInterval(interval)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                    trendInterval === interval
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {interval}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex flex-col justify-center gap-3 px-1">
              <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-11/12" />
              <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-8/12 ml-auto" />
              <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-9/12" />
              <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-10/12 ml-4" />
              <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-7/12 ml-auto" />
              <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-8/12" />
            </div>
          ) : trends.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
              <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
              <span>No trend data available for this range</span>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SENTIMENT_COLORS.positive} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={SENTIMENT_COLORS.positive} stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradNeu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SENTIMENT_COLORS.neutral} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={SENTIMENT_COLORS.neutral} stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SENTIMENT_COLORS.negative} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={SENTIMENT_COLORS.negative} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatTrendDate}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <RechartsTooltip
                    labelFormatter={formatTrendDate}
                    contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(val) => <span className="text-xs text-slate-600 capitalize">{val}</span>}
                  />
                  <Area
                    type="monotone"
                    dataKey="positive"
                    name="Positive"
                    stroke={SENTIMENT_COLORS.positive}
                    fillOpacity={1}
                    fill="url(#gradPos)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="neutral"
                    name="Neutral"
                    stroke={SENTIMENT_COLORS.neutral}
                    fillOpacity={1}
                    fill="url(#gradNeu)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="negative"
                    name="Negative"
                    stroke={SENTIMENT_COLORS.negative}
                    fillOpacity={1}
                    fill="url(#gradNeg)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown & Keyword Cloud Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Stacked Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Categories Breakdown</h2>
              <p className="text-xs text-slate-400">Click a bar to view matching comments</p>
            </div>
            <Tag className="w-5 h-5 text-slate-400" />
          </div>

          {loading ? (
            <div className="h-72 flex items-end justify-around gap-4 px-6 pb-8 pt-4">
              {[42, 68, 52, 84, 47, 74, 56, 62].map((height, idx) => (
                <div
                  key={idx}
                  className="w-8 rounded-t-lg bg-slate-100 animate-pulse"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
              <span>No categorized comments found</span>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categories}
                  margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                  onClick={(e) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      handleBarClick(e.activePayload[0].payload);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="category"
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    formatter={(val) => <span className="text-xs text-slate-600 capitalize">{val}</span>}
                  />
                  <Bar dataKey="positive" name="Positive" stackId="a" fill={SENTIMENT_COLORS.positive} cursor="pointer" />
                  <Bar dataKey="neutral" name="Neutral" stackId="a" fill={SENTIMENT_COLORS.neutral} cursor="pointer" />
                  <Bar dataKey="negative" name="Negative" stackId="a" fill={SENTIMENT_COLORS.negative} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Keywords Cloud / Chips */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Extracted Keywords Cloud</h2>
              <p className="text-xs text-slate-400">Click a keyword to search comments table</p>
            </div>
            <Hash className="w-5 h-5 text-slate-400" />
          </div>

          {loading ? (
            <div className="h-72 flex flex-wrap content-start gap-2 p-1">
              {[64, 96, 72, 112, 60, 84, 100, 68, 88, 76].map((width, idx) => (
                <div
                  key={idx}
                  className="h-7 rounded-xl bg-slate-100 animate-pulse"
                  style={{ width }}
                />
              ))}
            </div>
          ) : keywords.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
              <span>No keywords extracted for this range</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-72 p-1">
              <div className="flex flex-wrap gap-2">
                {keywords.map(({ keyword, count }) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => handleKeywordClick(keyword)}
                    className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition"
                  >
                    <span>{keyword}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[10px] group-hover:bg-indigo-100 group-hover:text-indigo-800">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick link to Comments Page */}
      <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
        <div className="text-xs sm:text-sm">
          Want to inspect granular submissions, filter individual rows, or export CSV records?
        </div>
        <button
          onClick={() => navigate('/admin/comments')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shrink-0 ml-4"
        >
          <span>View Comments Table</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}