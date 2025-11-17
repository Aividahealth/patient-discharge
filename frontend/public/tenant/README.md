# Tenant Logos

Place tenant logo files in this directory.

## File Naming Convention

Logo files should be named using the tenant ID:
- `{tenantId}.png` - e.g., `demo.png`, `rainbow-healing.png`

Or use the exact filename from the tenant config:
- `Rainbow_Healing_logo.png`

## Supported Formats

- PNG (recommended)
- JPG/JPEG
- SVG

## Usage

The logo path in tenant config should reference the filename:
- `Rainbow_Healing_logo.png` → will be served as `/tenant/Rainbow_Healing_logo.png`
- `demo.png` → will be served as `/tenant/demo.png`

## Example

For tenant ID `demo`:
1. Place logo file: `frontend/public/tenant/demo.png`
2. In tenant config, set: `logo: "demo.png"` or `logo: "/tenant/demo.png"`
3. The app will serve it as: `https://yourdomain.com/tenant/demo.png`

