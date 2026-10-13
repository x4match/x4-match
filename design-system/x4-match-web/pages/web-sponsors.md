# Web Sponsors (v0)

Overrides del MASTER para panel partner + storefront — rediseño v0 + theming profundo.

## Dashboard (Night Match / Commerce OS)

- Layout: `AppSidebar` + `DashboardTopBar` + main (`dash-canvas`)
- TopBar: búsqueda de secciones, selector de sponsor, CTA Ver tienda, menú usuario
- Sidebar: grupos Tienda / Ventas / Cuenta; badge de pedidos pendientes
- Patrones: `PageShell` (`bento` | `table` | `form`), `DataTable`, `FormSection`, `StatBento`, `ConfirmDialog`
- Login: split brand panel + form glass
- **Apariencia:** presets + tabs (marca / colores / layout / contenido) + live preview; persiste `store_theme` JSONB

## Storefront (Marketplace Light · themeable)

- Header único: `StorefrontHeader` (search + cart sheet) respetando `headerStyle`
- `StoreThemeScope` inyecta CSS variables del partner (colores, radius, font)
- Home: hero (`full-bleed` | `split` | `minimal` | `banner-only`), category rail, ofertas, grid
- Toggles: search, categorías, ofertas, tagline, CTA/headline/footer custom
- Tipografías: Jakarta, Inter, Outfit, DM Sans, Space Grotesk, Playfair, Rubik
- `primary_color` + paleta completa + favicon

## Tipografía

- Plus Jakarta Sans en root layout; storefront puede override vía Google Fonts
