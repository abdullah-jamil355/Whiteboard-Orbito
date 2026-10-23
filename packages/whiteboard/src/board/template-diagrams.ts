import type { BoardTemplate } from "./template-primitives";
import { rectangle, circle, diamond, label, arrow } from "./template-primitives";

export const diagramTemplates: readonly BoardTemplate[] = [
  {
    id: "data-flow",
    name: "Data flow diagram",
    description: "Trace information between an external source, process, and store.",
    preview: "data-flow",
    objects: [
      rectangle("customer", 55, 170, 190, 110), label("customer-label", "Customer", 70, 207, 160, 36, "customer"),
      circle("api", 320, 165, 210, 120), label("api-label", "Order API", 345, 207, 160, 36, "api"),
      rectangle("order-store", 620, 170, 220, 110, "#fff5df"), label("order-store-label", "Orders DB", 645, 207, 170, 36, "order-store"),
      circle("fulfillment", 620, 475, 220, 130), label("fulfillment-label", "Fulfillment", 645, 522, 170, 36, "fulfillment"),
      rectangle("analytics", 945, 485, 210, 110, "#fff5df"), label("analytics-label", "Analytics store", 960, 522, 180, 36, "analytics"),
      arrow("customer-request", { x: 245, y: 225 }, { x: 320, y: 225 }),
      label("request-label", "request", 250, 190, 75, 28),
      arrow("api-order", { x: 530, y: 225 }, { x: 620, y: 225 }),
      label("save-label", "save", 545, 190, 60, 28),
      arrow("order-fulfillment", { x: 730, y: 280 }, { x: 730, y: 475 }),
      label("dispatch-label", "dispatch", 750, 360, 100, 28),
      arrow("order-analytics", { x: 840, y: 225 }, { x: 1_045, y: 485 }),
      label("event-label", "events", 880, 350, 80, 28),
      arrow("fulfillment-analytics", { x: 840, y: 540 }, { x: 945, y: 540 }),
      label("results-label", "results", 850, 505, 90, 28)
    ]
  },
  {
    id: "uml-sequence",
    name: "UML sequence diagram",
    description: "Map messages exchanged between two participants over time.",
    preview: "sequence",
    objects: [
      rectangle("participant-a", 90, 65, 230, 72), label("participant-a-label", "Client", 110, 83, 190, 36, "participant-a"),
      rectangle("participant-b", 485, 65, 230, 72), label("participant-b-label", "Whiteboard API", 505, 83, 190, 36, "participant-b"),
      rectangle("participant-c", 880, 65, 230, 72), label("participant-c-label", "Database", 900, 83, 190, 36, "participant-c"),
      rectangle("lifeline-a", 203, 137, 4, 540, "#d9e0e9"),
      rectangle("lifeline-b", 598, 137, 4, 540, "#d9e0e9"),
      rectangle("lifeline-c", 993, 137, 4, 540, "#d9e0e9"),
      arrow("request", { x: 207, y: 220 }, { x: 598, y: 220 }), label("request-label", "open board", 335, 185, 150, 28),
      arrow("load", { x: 602, y: 330 }, { x: 993, y: 330 }), label("load-label", "load document", 725, 294, 160, 28),
      arrow("document", { x: 993, y: 415 }, { x: 602, y: 415 }), label("document-label", "board data", 725, 425, 150, 28),
      arrow("render", { x: 598, y: 520 }, { x: 207, y: 520 }), label("render-label", "render board", 335, 530, 150, 28),
      arrow("save", { x: 207, y: 610 }, { x: 598, y: 610 }), label("save-label", "save changes", 335, 575, 150, 28)
    ]
  },
  {
    id: "uml-use-case",
    name: "UML use case diagram",
    description: "Connect an actor to the system actions they use.",
    preview: "use-case",
    objects: [
      rectangle("system-boundary", 340, 55, 790, 690, "#f8fafc"), label("system-label", "Whiteboard system", 370, 72, 270, 40, "system-boundary"),
      circle("use-case-one", 455, 160, 250, 88, "#ffffff"), label("use-case-one-label", "View board", 480, 186, 200, 36, "use-case-one"),
      circle("use-case-two", 760, 160, 250, 88, "#ffffff"), label("use-case-two-label", "Edit board", 785, 186, 200, 36, "use-case-two"),
      circle("use-case-three", 455, 355, 250, 88, "#ffffff"), label("use-case-three-label", "Save project", 480, 381, 200, 36, "use-case-three"),
      circle("use-case-four", 760, 355, 250, 88, "#ffffff"), label("use-case-four-label", "Invite editor", 785, 381, 200, 36, "use-case-four"),
      circle("use-case-five", 610, 550, 250, 88, "#ffffff"), label("use-case-five-label", "Present board", 635, 576, 200, 36, "use-case-five"),
      label("actor", "Member", 65, 265, 190, 44),
      label("admin-actor", "Owner", 65, 550, 190, 44),
      arrow("member-view", { x: 255, y: 285 }, { x: 455, y: 205 }),
      arrow("member-edit", { x: 255, y: 290 }, { x: 760, y: 205 }),
      arrow("member-save", { x: 255, y: 300 }, { x: 455, y: 400 }),
      arrow("member-present", { x: 255, y: 305 }, { x: 610, y: 595 }),
      arrow("owner-invite", { x: 255, y: 572 }, { x: 760, y: 400 }),
      arrow("owner-present", { x: 255, y: 580 }, { x: 610, y: 595 })
    ]
  },
  {
    id: "uml-activity",
    name: "UML activity diagram",
    description: "Describe an activity with actions and a decision branch.",
    preview: "activity",
    objects: [
      circle("initial", 505, 35, 190, 82), label("initial-label", "Start", 525, 58, 150, 36, "initial"),
      rectangle("action", 455, 165, 290, 88), label("action-label", "Validate request", 475, 190, 250, 38, "action"),
      diamond("branch", 490, 300, 220, 140), label("branch-label", "Valid?", 510, 350, 180, 38, "branch"),
      rectangle("retry", 80, 500, 260, 88), label("retry-label", "Ask for corrections", 95, 525, 230, 38, "retry"),
      rectangle("persist", 470, 500, 260, 88), label("persist-label", "Save changes", 485, 525, 230, 38, "persist"),
      rectangle("notify", 860, 500, 260, 88), label("notify-label", "Notify members", 875, 525, 230, 38, "notify"),
      circle("final", 505, 665, 190, 82, "#edf8ef"), label("final-label", "Complete", 525, 688, 150, 36, "final"),
      arrow("initial-action", { x: 600, y: 117 }, { x: 600, y: 165 }),
      arrow("action-branch", { x: 600, y: 253 }, { x: 600, y: 300 }),
      arrow("branch-retry", { x: 490, y: 370 }, { x: 340, y: 540 }), label("retry-condition", "No", 400, 445, 55, 28),
      arrow("retry-action", { x: 210, y: 500 }, { x: 500, y: 210 }),
      arrow("branch-persist", { x: 710, y: 370 }, { x: 600, y: 500 }), label("valid-condition", "Yes", 720, 430, 60, 28),
      arrow("persist-notify", { x: 730, y: 544 }, { x: 860, y: 544 }),
      arrow("notify-final", { x: 990, y: 588 }, { x: 600, y: 665 })
    ]
  }
];
