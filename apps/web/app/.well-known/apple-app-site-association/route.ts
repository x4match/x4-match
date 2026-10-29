import { APP_LINK_PATHS, IOS_BUNDLE_ID } from '@/lib/app-links';

/** iOS Universal Links. Requiere APPLE_TEAM_ID (Apple Developer → Membership). */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const appIDs = teamId ? [`${teamId}.${IOS_BUNDLE_ID}`] : [];
  return Response.json(
    {
      applinks: {
        details: [
          {
            appIDs,
            components: APP_LINK_PATHS.map((path) => ({ '/': path })),
          },
        ],
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
