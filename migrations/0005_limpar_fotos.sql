-- Foto em data-URL estourava o cookie de sessão no Cloudflare.
update "user" set image = null
where image is not null and (image like 'data:%' or char_length(image) > 500);
