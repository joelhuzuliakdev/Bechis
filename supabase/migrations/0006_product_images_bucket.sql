insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "product_images_staff_insert"
on storage.objects for insert
with check (bucket_id = 'product-images' and current_user_is_staff());

create policy "product_images_staff_update"
on storage.objects for update
using (bucket_id = 'product-images' and current_user_is_staff());

create policy "product_images_staff_delete"
on storage.objects for delete
using (bucket_id = 'product-images' and current_user_is_staff());