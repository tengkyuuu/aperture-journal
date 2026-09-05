import { redirect } from 'next/navigation';

import { ProfileView } from '@/components/profile/profile-view';
import { getSession } from '@/lib/server/auth';
import { getProfile, getProfileStats } from '@/lib/server/queries';
import { CLEAR_SESSION_PATH } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect(CLEAR_SESSION_PATH);

  const [profile, stats] = await Promise.all([
    getProfile(session.uid),
    getProfileStats(session.uid),
  ]);

  const memberSince = stats.firstEntry
    ? new Date(stats.firstEntry).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-8 lg:py-16">
      <header className="mb-10">
        <p className="label">Account</p>
        <h1 className="mt-3 text-[34px] font-bold uppercase leading-[0.95] tracking-tight text-ink">
          Profile
        </h1>
      </header>

      <ProfileView
        user={{
          ...profile,
          displayName: profile.displayName ?? session.name ?? null,
          email: profile.email ?? session.email ?? null,
        }}
        stats={stats}
        memberSince={memberSince}
      />
    </div>
  );
}
