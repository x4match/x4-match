export type CheckoutPayload = {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: 'MERCADOPAGO' | 'WHATSAPP';
  couponCode?: string;
  shippingMethodId?: string;
  shippingPostalCode?: string;
  shippingAddress?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
};

export type ShippingQuote = {
  methods: Array<{ id: string; name: string; type: string; price: number }>;
  freeShippingThreshold: number | null;
  freeShippingRemaining: number | null;
};
