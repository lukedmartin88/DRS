export const config = {
  // This ensures the middleware runs on all paths
  matcher: '/(.*)',
};

export default function middleware(request) {
  // Vercel automatically injects the user's country code into the headers
  const country = request.headers.get('x-vercel-ip-country');

  // 'AU' is the ISO 3166-1 alpha-2 country code for Australia
  if (country === 'AU') {
    return new Response(
      "Access to this application is currently restricted in your region to conserve bandwidth.",
      {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
  }
}