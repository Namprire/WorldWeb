import { z } from "zod";
const https = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "HTTPS source required");
export const companySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().max(80),
  sector: z.string().max(60),
  description: z.string().max(600),
  website: https,
  sourceUrl: https,
  reviewedAt: z.string().date(),
  founders: z.array(z.string()).nullable(),
  teamSize: z.string().nullable(),
  teamSource: https.optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  exhibit: z.boolean(),
  office: z.object({
    address: z.string().min(1),
    sourceUrl: https,
    lon: z.number().min(-180).max(180),
    lat: z.number().min(-90).max(90),
    osm: z.string().regex(/^(node|way)\/\d+$/),
    markerHeight: z.number().min(0).max(150),
  }).optional(),
  placement: z.object({
    kind: z.literal("exhibition"),
    label: z.string(),
    gx: z.number().finite(),
    gz: z.number().finite(),
  }),
  jobs: z.array(
    z.object({
      title: z.string(),
      location: z.string(),
      url: https,
      expiresAt: z.string().datetime(),
      verifiedAt: z.string().date(),
    }),
  ),
});
export const companiesSchema = z.array(companySchema);
export type Company = z.infer<typeof companySchema>;
export function activeJobs(company: Company, now = Date.now()) {
  return company.jobs.filter((job) => Date.parse(job.expiresAt) > now);
}
export function filterCompanies(
  companies: Company[],
  query: string,
  sector: string,
  hiring: boolean,
  now = Date.now(),
) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return companies.filter(
    (c) =>
      (!sector || c.sector === sector) &&
      (!hiring || activeJobs(c, now).length > 0) &&
      words.every((word) =>
        `${c.name} ${c.sector} ${c.description} ${activeJobs(c, now)
          .map((j) => j.title)
          .join(" ")}`
          .toLowerCase()
          .includes(word),
      ),
  );
}
