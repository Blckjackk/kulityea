/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Guests open their download page from a phone on the kiosk's Wi-Fi, which reaches
  // the dev server by its LAN IP. Allow private network ranges only.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
}

export default nextConfig
