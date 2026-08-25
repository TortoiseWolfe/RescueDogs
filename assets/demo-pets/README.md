# Demo pet portrait masters

Full-resolution PNG masters for the demo pets. These are NOT served — they live
outside `public/` on purpose so the static export stays small.

- Homepage portraits: run `node scripts/optimize-demo-pets.mjs` in the container
  to regenerate `public/demo-pets/*.webp` after adding or replacing a master.
- `rocket.png` is also the upload master for `demo-rocket.png` in Supabase
  Storage (see `supabase/seed-rescue-demo.sql`). Do not delete it.
