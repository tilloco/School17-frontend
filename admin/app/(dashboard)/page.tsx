import { redirect } from 'next/navigation';

// The old exam-prep dashboard was removed; the panel now starts at the teacher verification queue.
export default function Home() {
  redirect('/teachers');
}
