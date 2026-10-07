# Demo pet portrait masters

Full-resolution PNG masters for the demo pets. These are NOT served — they live
outside `public/` on purpose so the static export stays small.

- Run `node scripts/optimize-demo-pets.mjs` in the container after adding or
  replacing a master. It regenerates the homepage portraits
  (`public/demo-pets/*.webp`) and the demo shelter's listing photos
  (`public/demo-pets/listing/*.webp`, referenced by
  `supabase/seed-rescue-demo.sql`). Listing photos stay out of Supabase Storage
  because Storage egress is metered (#427).
