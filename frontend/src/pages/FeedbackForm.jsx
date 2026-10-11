import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StarRating from '../components/StarRating';
import { Send, CheckCircle2, AlertCircle, RefreshCw, Tag, Smile, Frown, Meh } from 'lucide-react';

export default function FeedbackForm() {
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [submitterName, setSubmitterName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successId, setSuccessId] = useState(null);
  const [analysis, setAnalysis] = useState({
    status: 'pending',
    sentiment: null,
    category: null,
    confidence: null,
  });

  const maxChars = 2000;
  const remainingChars = maxChars - comment.length;

  // Analysis now runs in the background: poll the public status endpoint until
  // the worker finishes (or permanently fails) and update the success card.
  useEffect(() => {
    if (!successId || analysis.status === 'done' || analysis.status === 'failed') {
      return undefined;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await apiClient.get(`/feedback/${successId}/status`);
        if (cancelled) return;
        setAnalysis({
          status: res.data.analysis_status,
          sentiment: res.data.sentiment,
          category: res.data.category,
          confidence: res.data.confidence,
        });
      } catch (_) {
        // Transient polling error — the next tick will retry.
      }
    };

    poll();
    const timer = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [successId, analysis.status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!comment.trim()) {
      setError('Please provide feedback comments.');
      return;
    }

    if (comment.length > maxChars) {
      setError(`Comment exceeds maximum limit of ${maxChars} characters.`);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        comment: comment.trim(),
        rating: rating > 0 ? rating : null,
        submitter_name: isAnonymous ? null : submitterName.trim(),
        is_anonymous: isAnonymous,
      };

      const response = await apiClient.post('/feedback', payload);
      setAnalysis({ status: 'pending', sentiment: null, category: null, confidence: null });
      setSuccessId(response.data.id);
    } catch (err) {
      const errorMsg =
        err.response?.data?.error ||
        err.message ||
        'Failed to submit feedback. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setComment('');
    setRating(0);
    setSubmitterName('');
    setIsAnonymous(true);
    setError('');
    setSuccessId(null);
    setAnalysis({ status: 'pending', sentiment: null, category: null, confidence: null });
  };

  // Helper for styling sentiment badges
  const getSentimentDetails = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return {
          label: 'Positive',
          icon: <Smile className="w-5 h-5 text-emerald-600" />,
          containerClass: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'negative':
        return {
          label: 'Negative',
          icon: <Frown className="w-5 h-5 text-rose-600" />,
          containerClass: 'bg-rose-50 border-rose-200 text-rose-900',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        };
      case 'neutral':
      default:
        return {
          label: 'Neutral',
          icon: <Meh className="w-5 h-5 text-slate-600" />,
          containerClass: 'bg-slate-50 border-slate-200 text-slate-900',
          badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
        };
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
          Share Your Feedback
        </h1>
        <p className="mt-2 text-slate-600 text-sm sm:text-base">
          Help us improve your experience. Your submission is analyzed in real-time by AI.
        </p>
      </div>

      {successId ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm transition-all animate-fadeIn">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Feedback Submitted!</h2>
              <p className="text-xs text-slate-500">Record ID #{successId}</p>
            </div>
          </div>

          {analysis.status === 'pending' ? (
            <div className="mb-6 p-4 rounded-xl border bg-slate-50 border-slate-200 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-800">AI analysis in progress…</p>
                <p className="text-xs text-slate-500">
                  Your feedback is safely stored. Sentiment and category will appear here in a moment.
                </p>
              </div>
            </div>
          ) : analysis.status === 'failed' ? (
            <div className="mb-6 p-4 rounded-xl border bg-amber-50 border-amber-200 text-amber-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Your feedback was submitted.</p>
                <p className="text-xs">
                  Automated analysis could not be completed right now, so this record may appear
                  without a sentiment tag.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl border bg-slate-50 border-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                AI Analysis Breakdown
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Sentiment card */}
                {(() => {
                  const details = getSentimentDetails(analysis.sentiment);
                  return (
                    <div className={`p-3.5 rounded-lg border flex items-center gap-3 ${details.containerClass}`}>
                      {details.icon}
                      <div>
                        <span className="text-xs text-slate-500 font-medium block">Detected Sentiment</span>
                        <span className="font-bold text-base capitalize">{details.label}</span>
                        {analysis.confidence !== null && (
                          <span className="text-xs text-slate-500 block">
                            Confidence: {Math.round(analysis.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Category card */}
                <div className="p-3.5 rounded-lg border bg-white border-slate-200 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">Assigned Category</span>
                    <span className="font-bold text-base text-slate-900">
                      {analysis.category || 'General'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Submit Another Response</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Rating */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Overall Rating (Optional)
            </label>
            <StarRating rating={rating} onChange={setRating} disabled={loading} />
          </div>

          {/* Comment */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="comment" className="block text-sm font-semibold text-slate-900">
                Your Comments <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-xs ${
                  remainingChars < 100 ? 'text-amber-600 font-semibold' : 'text-slate-400'
                }`}
              >
                {comment.length} / {maxChars}
              </span>
            </div>
            <textarea
              id="comment"
              rows={5}
              disabled={loading}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what you liked or how we can improve..."
              className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50"
            />
          </div>

          {/* Anonymous toggle */}
          <div className="mb-5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => {
                  setIsAnonymous(e.target.checked);
                  if (e.target.checked) setSubmitterName('');
                }}
                disabled={loading}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Submit feedback anonymously</span>
            </label>
          </div>

          {/* Name (if not anonymous) */}
          {!isAnonymous && (
            <div className="mb-6 animate-fadeIn">
              <label htmlFor="name" className="block text-sm font-semibold text-slate-900 mb-1.5">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                disabled={loading}
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-indigo-100"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting…</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Feedback</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
