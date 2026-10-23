import type { BoardTemplate } from "./template-primitives";
import { rectangle, circle, label, arrow } from "./template-primitives";

export const coreTemplates: readonly BoardTemplate[] = [
  {
    id: "blank",
    name: "Blank page",
    description: "Start with an empty graph-paper canvas.",
    preview: "blank",
    objects: []
  },
  {
    id: "organization-chart",
    name: "Organization chart",
    description: "Map reporting lines from a team lead to direct reports.",
    preview: "hierarchy",
    objects: [
      rectangle("lead", 460, 45, 280, 82), label("lead-label", "Executive lead", 480, 68, 240, 36, "lead"),
      rectangle("department-a", 100, 250, 250, 80), label("department-a-label", "Product", 120, 272, 210, 36, "department-a"),
      rectangle("department-b", 475, 250, 250, 80), label("department-b-label", "Engineering", 495, 272, 210, 36, "department-b"),
      rectangle("department-c", 850, 250, 250, 80), label("department-c-label", "Operations", 870, 272, 210, 36, "department-c"),
      rectangle("team-a", 45, 500, 160, 72), label("team-a-label", "Research", 55, 519, 140, 34, "team-a"),
      rectangle("team-b", 235, 500, 160, 72), label("team-b-label", "Design", 245, 519, 140, 34, "team-b"),
      rectangle("team-c", 425, 500, 160, 72), label("team-c-label", "Web", 435, 519, 140, 34, "team-c"),
      rectangle("team-d", 615, 500, 160, 72), label("team-d-label", "Platform", 625, 519, 140, 34, "team-d"),
      rectangle("team-e", 805, 500, 160, 72), label("team-e-label", "Customer success", 815, 519, 140, 34, "team-e"),
      rectangle("team-f", 995, 500, 160, 72), label("team-f-label", "Finance", 1005, 519, 140, 34, "team-f"),
      arrow("lead-product", { x: 600, y: 127 }, { x: 225, y: 250 }),
      arrow("lead-engineering", { x: 600, y: 127 }, { x: 600, y: 250 }),
      arrow("lead-operations", { x: 600, y: 127 }, { x: 975, y: 250 }),
      arrow("product-research", { x: 160, y: 330 }, { x: 125, y: 500 }),
      arrow("product-design", { x: 290, y: 330 }, { x: 315, y: 500 }),
      arrow("engineering-web", { x: 535, y: 330 }, { x: 505, y: 500 }),
      arrow("engineering-platform", { x: 665, y: 330 }, { x: 695, y: 500 }),
      arrow("operations-success", { x: 910, y: 330 }, { x: 885, y: 500 }),
      arrow("operations-finance", { x: 1040, y: 330 }, { x: 1075, y: 500 })
    ]
  },
  {
    id: "entity-relationship",
    name: "Entity relationship diagram",
    description: "Sketch entities and the relationship between them.",
    preview: "entities",
    objects: [
      rectangle("customer", 100, 95, 230, 130), label("customer-label", "Customer", 120, 140, 190, 34, "customer"),
      rectangle("product", 870, 95, 230, 130), label("product-label", "Product", 890, 140, 190, 34, "product"),
      rectangle("order", 485, 285, 230, 130), label("order-label", "Order", 505, 330, 190, 34, "order"),
      rectangle("order-item", 100, 505, 230, 130), label("order-item-label", "Order item", 120, 550, 190, 34, "order-item"),
      rectangle("shipment", 870, 505, 230, 130), label("shipment-label", "Shipment", 890, 550, 190, 34, "shipment"),
      arrow("customer-orders", { x: 330, y: 170 }, { x: 485, y: 320 }),
      label("customer-orders-label", "places", 335, 225, 120, 30),
      arrow("order-items", { x: 485, y: 380 }, { x: 330, y: 555 }),
      label("order-items-label", "contains", 350, 445, 120, 30),
      arrow("products-in-items", { x: 870, y: 185 }, { x: 330, y: 540 }),
      label("products-in-items-label", "referenced by", 575, 400, 170, 30),
      arrow("order-shipment", { x: 715, y: 380 }, { x: 870, y: 555 }),
      label("order-shipment-label", "fulfilled as", 735, 445, 140, 30)
    ]
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "Expand a central idea into connected branches.",
    preview: "mind-map",
    objects: [
      circle("central-idea", 500, 300, 200, 150), label("central-label", "Project plan", 520, 355, 160, 40, "central-idea"),
      rectangle("branch-one", 65, 85, 220, 82), label("branch-one-label", "Goals", 80, 109, 190, 36, "branch-one"),
      rectangle("branch-two", 915, 85, 220, 82), label("branch-two-label", "People", 930, 109, 190, 36, "branch-two"),
      rectangle("branch-three", 35, 345, 220, 82), label("branch-three-label", "Research", 50, 369, 190, 36, "branch-three"),
      rectangle("branch-four", 945, 345, 220, 82), label("branch-four-label", "Delivery", 960, 369, 190, 36, "branch-four"),
      rectangle("branch-five", 235, 600, 220, 82), label("branch-five-label", "Timeline", 250, 624, 190, 36, "branch-five"),
      rectangle("branch-six", 745, 600, 220, 82), label("branch-six-label", "Risks", 760, 624, 190, 36, "branch-six"),
      arrow("branch-one-link", { x: 500, y: 335 }, { x: 285, y: 167 }),
      arrow("branch-two-link", { x: 700, y: 335 }, { x: 915, y: 167 }),
      arrow("branch-three-link", { x: 500, y: 375 }, { x: 255, y: 386 }),
      arrow("branch-four-link", { x: 700, y: 375 }, { x: 945, y: 386 }),
      arrow("branch-five-link", { x: 530, y: 450 }, { x: 400, y: 600 }),
      arrow("branch-six-link", { x: 670, y: 450 }, { x: 800, y: 600 })
    ]
  },
];
