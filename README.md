# LODS CAFE POS (Web-Based)

A React + TypeScript web POS for LODS CAFE with:

- Menu catalog with add/edit product items, search, stock tracking, and flexible ordering
- Checkout flow with discounts (percent/fixed), quick discount buttons, multi-payment methods, quick cash add, and change validation
- Official receipt generation with Download / Print / Close
- Sub-account and staff management with role-based access (admin/cashier/employee)
- Gross sales dashboard and analytics with date filtering and KPI cards
- Sales history list with auditing actions (View / Print / Void), current month quick filter, and true Excel (.xlsx) export

## Default Accounts

- admin / admin123
- cashier1 / cash123

Use these credentials in the `Staff Sign In` panel to start a session.

## Run (after Node.js install)

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Publish to GitHub Pages

1. Commit and push this project to a GitHub repository.
2. In the repository, go to `Settings` → `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main` (or `master`) to trigger the workflow in `.github/workflows/deploy.yml`.
5. After the action succeeds, your site will be available on the repo's GitHub Pages URL.

You can also run the deploy workflow manually from the `Actions` tab using `workflow_dispatch`.

### Custom Domain

This project includes `public/CNAME` configured as:

`lodscafepos.com`

After the first deployment:

1. Go to GitHub repository `Settings` → `Pages`.
2. Confirm `Custom domain` is set to `lodscafepos.com`.
3. In your DNS provider, point the domain to GitHub Pages.

For apex/root domains, add `A` records to these GitHub Pages IPs:

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

For `www` subdomain, add a `CNAME` record to `<your-github-username>.github.io`.

## Notes

- Data is saved in browser localStorage.
- `Export Excel` downloads a real `.xlsx` report.
