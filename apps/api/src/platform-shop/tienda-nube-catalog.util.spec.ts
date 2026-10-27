import {
  categorySlugFromUrl,
  collectProductUrlsFromSitemap,
  detectListingNextPage,
  detectProductListingNextPage,
  extractStorefrontCategories,
  extractProductHandle,
  mapTiendaNubeApiProduct,
  normalizeStoreBaseUrl,
  parseJsonLdProductsFromHtml,
  withX4AffiliateParams,
} from './tienda-nube-catalog.util';

describe('tienda-nube-catalog.util', () => {
  it('normaliza la URL base de la tienda', () => {
    expect(normalizeStoreBaseUrl('https://demo.mitiendanube.com/productos/')).toBe(
      'https://demo.mitiendanube.com',
    );
    expect(normalizeStoreBaseUrl('bullpadelargentina.com.ar')).toBe(
      'https://bullpadelargentina.com.ar',
    );
  });

  it('agrega UTM de x4match', () => {
    expect(withX4AffiliateParams('https://tienda.com/productos/pala/')).toContain(
      'utm_source=x4match',
    );
  });

  it('extrae handle de producto y ignora páginas', () => {
    expect(extractProductHandle('https://t.com/productos/overgrip-azul/')).toBe('overgrip-azul');
    expect(extractProductHandle('https://t.com/productos/page/2/')).toBeNull();
  });

  it('parsea productos JSON-LD del listado', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": "Pala Pro",
        "image": "https://cdn.example/pala.jpg",
        "description": "Pala de padel",
        "sku": "SKU-1",
        "offers": {
          "@type": "Offer",
          "url": "https://tienda.com/productos/pala-pro/",
          "priceCurrency": "ARS",
          "price": "120000",
          "availability": "https://schema.org/InStock",
          "inventoryLevel": { "@type": "QuantitativeValue", "value": "4" }
        }
      }
      </script>`;
    const products = parseJsonLdProductsFromHtml(html, 'https://tienda.com');
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      externalId: 'SKU-1',
      name: 'Pala Pro',
      price: 120000,
      currency: 'ARS',
      stockQuantity: 4,
      photoUrl: 'https://cdn.example/pala.jpg',
      externalUrl: 'https://tienda.com/productos/pala-pro/',
    });
  });

  it('detecta página siguiente del listado', () => {
    expect(detectProductListingNextPage('href="/productos/page/2/"', 1)).toBe(2);
    expect(detectProductListingNextPage('sin paginado', 1)).toBeNull();
  });

  it('colecciona URLs de producto desde sitemap', () => {
    const xml = `
      <urlset>
        <url><loc>https://t.com/</loc></url>
        <url><loc>https://t.com/productos/</loc></url>
        <url><loc>https://t.com/productos/page/2/</loc></url>
        <url><loc>https://t.com/productos/grip-x3/</loc></url>
      </urlset>`;
    expect(collectProductUrlsFromSitemap(xml)).toEqual(['https://t.com/productos/grip-x3/']);
  });

  it('extrae categorías del filtro del listado', () => {
    const html = `
      <ul class="list-unstyled pills-container">
        <li data-item="1" class="pill"><a href="https://t.com/accesorios/" title="Accesorios" class="pill-link">Accesorios</a></li>
        <li data-item="2" class="pill"><a href="https://t.com/indumentaria/remeras/" title="Remeras &amp; Musculosas">R</a></li>
        <li data-item="3" class="pill"><a href="https://otra.com/pelotas/" title="Pelotas">P</a></li>
        <li data-item="4" class="pill"><a href="https://t.com/productos/" title="Productos">P</a></li>
      </ul>`;
    expect(extractStorefrontCategories(html, 'https://t.com')).toEqual([
      { slug: 'accesorios', name: 'Accesorios', url: 'https://t.com/accesorios/' },
      {
        slug: 'indumentaria-remeras',
        name: 'Remeras & Musculosas',
        url: 'https://t.com/indumentaria/remeras/',
      },
    ]);
  });

  it('usa el menú si no hay filtro de categorías', () => {
    const html = `
      <li data-component="menu.item">
        <a class="nav-list-link" href="https://t.com/pelotas/">Pelotas</a>
      </li>`;
    expect(extractStorefrontCategories(html, 'https://t.com')).toEqual([
      { slug: 'pelotas', name: 'Pelotas', url: 'https://t.com/pelotas/' },
    ]);
  });

  it('detecta paginado de una categoría', () => {
    const html = 'href="https://t.com/accesorios/page/2/"';
    expect(detectListingNextPage(html, 'https://t.com/accesorios/', 1)).toBe(2);
    expect(detectListingNextPage(html, 'https://t.com/pelotas/', 1)).toBeNull();
  });

  it('slug de categoría ignora rutas que no son categorías', () => {
    expect(categorySlugFromUrl('https://t.com/Pelotas/', 'https://t.com')).toBe('pelotas');
    expect(categorySlugFromUrl('https://t.com/account/login/', 'https://t.com')).toBeNull();
    expect(categorySlugFromUrl('https://t.com/accesorios/page/2/', 'https://t.com')).toBeNull();
  });

  it('mapea producto de la API oficial', () => {
    const mapped = mapTiendaNubeApiProduct(
      {
        id: 99,
        name: { es: 'Remera técnica' },
        description: { es: '<p>Dry fit</p>' },
        handle: { es: 'remera-tecnica' },
        published: true,
        images: [{ src: 'https://cdn.example/remera.jpg' }],
        categories: [{ name: { es: 'Indumentaria' } }],
        variants: [{ price: '24990', promotional_price: '19990', stock: 12, stock_management: true }],
      },
      'https://partner.mitiendanube.com',
    );
    expect(mapped).toMatchObject({
      externalId: '99',
      name: 'Remera técnica',
      description: 'Dry fit',
      price: 19990,
      compareAtPrice: 24990,
      photoUrl: 'https://cdn.example/remera.jpg',
      stockQuantity: 12,
      category: 'Indumentaria',
      categorySlug: 'indumentaria',
      externalUrl: 'https://partner.mitiendanube.com/productos/remera-tecnica/',
    });
  });
});
