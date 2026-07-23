# Deploying the dashboard

The dashboard is a **static SPA** (Vite build). It fetches `dashboard-data.json` at runtime, so
you refresh analytics by regenerating that one file — no rebuild needed.

## Build & generate data

```bash
pnpm install
pnpm --filter @zeus/core build          # core lib used by the data generator
tsx scripts/build-dashboard-data.ts     # -> packages/dashboard/public/dashboard-data.json
pnpm --filter @zeus/dashboard build     # -> packages/dashboard/dist/
```

## Serve behind nginx + Cloudflare (this host, 92.39.53.229)

```bash
sudo mkdir -p /var/www/zeus_power
sudo cp -r packages/dashboard/dist/* /var/www/zeus_power/
sudo chown -R www-data:www-data /var/www/zeus_power
sudo nginx -t && sudo systemctl reload nginx
```

- nginx vhost: `/etc/nginx/sites-available/zeus_power.conf` — `server_name
  zeus_power.ackedberryes.store`, static root `/var/www/zeus_power`, SPA `try_files` fallback.
- Cloudflare is in **Full** mode, so the origin serves `:443` with a self-signed cert at
  `/etc/ssl/cloudflare/zeus_power.ackedberryes.store.{pem,key}` (CF does not validate the chain).
  Port `:80` is also served for CF Flexible / direct-IP.

## Refresh only the data

```bash
tsx scripts/build-dashboard-data.ts --out /var/www/zeus_power/dashboard-data.json
```
`dashboard-data.json` is served `no-cache`; hashed `/assets/*` are cached immutably.

## Verify

```bash
curl -s -H "Host: zeus_power.ackedberryes.store" http://127.0.0.1/ -o /dev/null -w "%{http_code}\n"
curl -s https://zeus_power.ackedberryes.store/ -o /dev/null -w "%{http_code}\n"
```
