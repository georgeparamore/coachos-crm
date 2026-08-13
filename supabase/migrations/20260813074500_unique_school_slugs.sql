-- Student portal URLs resolve globally, so every active school needs a unique slug.
with duplicates as (
  select id, slug, row_number() over (partition by slug order by created_at, id) as duplicate_number
  from public.businesses
)
update public.businesses b
set slug = left(b.slug, 50) || '-' || left(replace(b.id::text, '-', ''), 8)
from duplicates d
where d.id = b.id and d.duplicate_number > 1;

create unique index businesses_school_slug_uniq on public.businesses (slug);
