import {
  collectProductUrlsFromSitemap,
  detectProductListingNextPage,
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
      externalUrl: 'https://partner.mitiendanube.com/productos/remera-tecnica/',
    });
  });
});
