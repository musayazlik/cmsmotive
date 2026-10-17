// static-site pages imported as strings (turbopack rule `*.html` -> raw-loader in next.config.ts).
declare module "*.html" {
  const html: string;
  export default html;
}
