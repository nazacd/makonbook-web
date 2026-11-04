import { Navigate, useParams } from 'react-router';

// A question's review is a modal over its results now: the old link
// (/practice/review/:id/:slot) opens the results with that question's review.
export function PracticeReview() {
  const { id = '', slot = '' } = useParams();
  return <Navigate to={`/practice/result/${encodeURIComponent(id)}?q=${encodeURIComponent(slot)}`} replace />;
}
