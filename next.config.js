/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep pdfkit external (not bundled) so its relative font-data paths resolve,
    // and make sure the AFM font metrics ship with the function.
    serverComponentsExternalPackages: ["pdfkit"],
    outputFileTracingIncludes: {
      "/api/send-proposal-email": ["./node_modules/pdfkit/js/data/**/*"],
    },
  },
}
module.exports = nextConfig
