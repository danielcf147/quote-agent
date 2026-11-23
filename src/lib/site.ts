/** Author, links and public URL, shared by the page, the metadata and the share image. */
export const SITE = {
  name: "Quote Agent",
  url: "https://quote-agent-two.vercel.app",
  tagline: "Purchase requests in plain words, turned into priced quotes.",
  author: "Daniel Campos França",
  links: {
    upwork: "https://www.upwork.com/freelancers/~01dea53eda9fae8e0b",
    linkedin: "https://www.linkedin.com/in/danielcf147/",
    github: process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/danielcf147/quote-agent",
  },
} as const;

/** Attributes for every link that leaves the site. */
export const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;
