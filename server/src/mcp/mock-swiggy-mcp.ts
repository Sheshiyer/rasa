import type { McpTransport } from "./transport";

/**
 * Deterministic in-memory Swiggy Food MCP. Routes SWIGGY_MCP_MODE=mock and is the
 * permanent CI backend + the pre-live-access dev harness. Fixtures are chosen to
 * exercise the discovery filters: veg/non-veg dishes and a peanut (allergen) dish.
 */

interface MockMenuItem {
  restaurant_id: string;
  restaurant_name: string;
  dish_id: string;
  dish_name: string;
  description: string;
  price: number;
  is_veg: boolean;
}

const ADDRESSES = [
  { id: "addr-koramangala", label: "Home", lat: 12.93, lng: 77.62 },
];

const RESTAURANTS = [
  {
    id: "r-grill",
    name: "Grill House",
    cuisines: ["North Indian", "Continental"],
    rating: 4.3,
    is_open: true,
    eta_min: 30,
  },
  {
    id: "r-paneer",
    name: "Paneer Palace",
    cuisines: ["North Indian"],
    rating: 4.1,
    is_open: true,
    eta_min: 25,
  },
  {
    id: "r-thai",
    name: "Thai Basil",
    cuisines: ["Thai"],
    rating: 4.0,
    is_open: true,
    eta_min: 40,
  },
];

const MENU: Record<string, MockMenuItem[]> = {
  "r-grill": [
    {
      restaurant_id: "r-grill",
      restaurant_name: "Grill House",
      dish_id: "d-chicken",
      dish_name: "Grilled Chicken Bowl",
      description: "Grilled chicken, brown rice, veggies",
      price: 280,
      is_veg: false,
    },
    {
      restaurant_id: "r-grill",
      restaurant_name: "Grill House",
      dish_id: "d-fish",
      dish_name: "Grilled Fish Fillet",
      description: "Grilled fish with a side salad",
      price: 320,
      is_veg: false,
    },
  ],
  "r-paneer": [
    {
      restaurant_id: "r-paneer",
      restaurant_name: "Paneer Palace",
      dish_id: "d-pbm",
      dish_name: "Paneer Butter Masala",
      description: "Creamy tomato paneer curry",
      price: 260,
      is_veg: true,
    },
    {
      restaurant_id: "r-paneer",
      restaurant_name: "Paneer Palace",
      dish_id: "d-dal",
      dish_name: "Dal Tadka",
      description: "Yellow dal with a ghee tempering",
      price: 180,
      is_veg: true,
    },
  ],
  "r-thai": [
    {
      restaurant_id: "r-thai",
      restaurant_name: "Thai Basil",
      dish_id: "d-padthai",
      dish_name: "Chicken Pad Thai",
      description: "Rice noodles tossed with crushed peanuts",
      price: 340,
      is_veg: false,
    },
    {
      restaurant_id: "r-thai",
      restaurant_name: "Thai Basil",
      dish_id: "d-green",
      dish_name: "Thai Green Curry",
      description: "Coconut curry with jasmine rice",
      price: 320,
      is_veg: false,
    },
  ],
};

const ALL_ITEMS: MockMenuItem[] = Object.values(MENU).flat();
const ITEM_BY_ID = new Map(ALL_ITEMS.map((i) => [i.dish_id, i]));

const COUPONS = [
  {
    code: "SAVE40",
    title: "₹40 off orders over ₹200",
    discount_inr: 40,
    min_order_inr: 200,
  },
];

interface CartLine {
  dish_id: string;
  restaurant_id: string;
  dish_name: string;
  price: number;
  quantity: number;
}
interface OrderRecord {
  order_id: string;
  status: string;
  amount_inr: number;
  items: CartLine[];
  placed_at: string;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function createMockSwiggyMcp(): McpTransport {
  let cart: {
    restaurant_id: string | null;
    lines: CartLine[];
    coupon_code: string | null;
    discount_inr: number;
  } = {
    restaurant_id: null,
    lines: [],
    coupon_code: null,
    discount_inr: 0,
  };
  const orders: OrderRecord[] = [];
  let orderSeq = 0;

  function subtotal(): number {
    return cart.lines.reduce((s, l) => s + l.price * l.quantity, 0);
  }
  function serializeCart() {
    const sub = subtotal();
    return {
      restaurant_id: cart.restaurant_id,
      items: cart.lines,
      subtotal_inr: sub,
      coupon_code: cart.coupon_code,
      discount_inr: cart.discount_inr,
      total_inr: Math.max(0, sub - cart.discount_inr),
    };
  }
  function matches(item: MockMenuItem, q: string): boolean {
    const hay = `${item.dish_name} ${item.description}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  return {
    async callTool(name, args) {
      switch (name) {
        case "get_addresses":
          return { addresses: ADDRESSES };

        case "search_restaurants": {
          const q = str(args.query).toLowerCase();
          const restaurants = q
            ? RESTAURANTS.filter(
                (r) =>
                  r.name.toLowerCase().includes(q) ||
                  r.cuisines.some((c) => c.toLowerCase().includes(q)),
              )
            : RESTAURANTS;
          return { restaurants };
        }

        case "search_menu": {
          const q = str(args.query);
          const items = q ? ALL_ITEMS.filter((i) => matches(i, q)) : ALL_ITEMS;
          return { items };
        }

        case "get_restaurant_menu": {
          const rid = str(args.restaurant_id);
          const items = MENU[rid] ?? [];
          const rname = items[0]?.restaurant_name ?? "";
          return {
            restaurant_id: rid,
            restaurant_name: rname,
            categories: [{ name: "All", items }],
            page: 1,
            has_more: false,
          };
        }

        case "get_food_cart":
          return serializeCart();

        case "update_food_cart": {
          const rid = str(args.restaurant_id);
          const wanted =
            (args.items as
              { dish_id: string; quantity: number }[] | undefined) ?? [];
          cart.restaurant_id = rid;
          cart.lines = wanted
            .map((w) => {
              const item = ITEM_BY_ID.get(w.dish_id);
              if (!item) return null;
              return {
                dish_id: item.dish_id,
                restaurant_id: item.restaurant_id,
                dish_name: item.dish_name,
                price: item.price,
                quantity: w.quantity,
              } satisfies CartLine;
            })
            .filter((l): l is CartLine => l !== null);
          return serializeCart();
        }

        case "flush_food_cart":
          cart = {
            restaurant_id: null,
            lines: [],
            coupon_code: null,
            discount_inr: 0,
          };
          return serializeCart();

        case "fetch_food_coupons":
          return { coupons: COUPONS };

        case "apply_food_coupon": {
          const code = str(args.code);
          const coupon = COUPONS.find((c) => c.code === code);
          if (!coupon || subtotal() < coupon.min_order_inr) {
            return { applied: false, code, discount_inr: 0 };
          }
          cart.coupon_code = coupon.code;
          cart.discount_inr = coupon.discount_inr;
          return { applied: true, code, discount_inr: coupon.discount_inr };
        }

        case "place_food_order": {
          if (cart.lines.length === 0) throw new Error("cart is empty");
          const sub = subtotal();
          const order: OrderRecord = {
            order_id: `ord-${++orderSeq}`,
            status: "placed",
            amount_inr: Math.max(0, sub - cart.discount_inr),
            items: cart.lines,
            placed_at: "2026-07-06T12:35:00.000Z",
          };
          orders.push(order);
          cart = {
            restaurant_id: null,
            lines: [],
            coupon_code: null,
            discount_inr: 0,
          };
          return {
            order_id: order.order_id,
            status: order.status,
            amount_inr: order.amount_inr,
          };
        }

        case "get_food_orders":
          return {
            orders: orders.map((o) => ({
              order_id: o.order_id,
              status: o.status,
              amount_inr: o.amount_inr,
              placed_at: o.placed_at,
            })),
          };

        case "get_food_order_details": {
          const id = str(args.order_id);
          const o = orders.find((x) => x.order_id === id);
          if (!o) throw new Error(`order not found: ${id}`);
          return {
            order_id: o.order_id,
            status: o.status,
            amount_inr: o.amount_inr,
            items: o.items,
          };
        }

        case "track_food_order": {
          const id = str(args.order_id);
          const o = orders.find((x) => x.order_id === id);
          if (!o) throw new Error(`order not found: ${id}`);
          return { order_id: o.order_id, status: "on_the_way", eta_min: 20 };
        }

        case "report_error":
          return { received: true };

        default:
          throw new Error(`unknown tool: ${name}`);
      }
    },
  };
}
