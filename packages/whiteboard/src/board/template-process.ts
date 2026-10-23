import type { BoardTemplate } from "./template-primitives";
import { rectangle, circle, diamond, label, arrow } from "./template-primitives";

export const processTemplates: readonly BoardTemplate[] = [
  {
    id: "kanban",
    name: "Simple Kanban board",
    description: "Organize work into To do, In progress, and Done columns.",
    preview: "kanban",
    objects: [
      rectangle("todo", 55, 65, 340, 660, "#f1f4f8"), label("todo-label", "To do", 85, 88, 280, 42, "todo"),
      rectangle("doing", 430, 65, 340, 660, "#e8f1fb"), label("doing-label", "In progress", 460, 88, 280, 42, "doing"),
      rectangle("done", 805, 65, 340, 660, "#edf8ef"), label("done-label", "Done", 835, 88, 280, 42, "done"),
      rectangle("todo-card", 85, 160, 280, 112), label("todo-card-label", "Define user needs", 105, 197, 240, 38, "todo-card"),
      rectangle("todo-card-two", 85, 315, 280, 112), label("todo-card-two-label", "Review open questions", 105, 352, 240, 38, "todo-card-two"),
      rectangle("todo-card-three", 85, 470, 280, 112), label("todo-card-three-label", "Plan next milestone", 105, 507, 240, 38, "todo-card-three"),
      rectangle("doing-card", 460, 160, 280, 112, "#ffffff"), label("doing-card-label", "Build the first draft", 480, 197, 240, 38, "doing-card"),
      rectangle("doing-card-two", 460, 315, 280, 112, "#ffffff"), label("doing-card-two-label", "Connect the main flow", 480, 352, 240, 38, "doing-card-two"),
      rectangle("doing-card-three", 460, 470, 280, 112, "#ffffff"), label("doing-card-three-label", "Check edge cases", 480, 507, 240, 38, "doing-card-three"),
      rectangle("done-card", 835, 160, 280, 112, "#ffffff"), label("done-card-label", "Create the board", 855, 197, 240, 38, "done-card"),
      rectangle("done-card-two", 835, 315, 280, 112, "#ffffff"), label("done-card-two-label", "Agree on scope", 855, 352, 240, 38, "done-card-two"),
      rectangle("done-card-three", 835, 470, 280, 112, "#ffffff"), label("done-card-three-label", "Set up the team", 855, 507, 240, 38, "done-card-three")
    ]
  },
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Show a start, process, decision, and outcome.",
    preview: "flow",
    objects: [
      circle("start", 500, 45, 180, 78), label("start-label", "Start", 520, 67, 140, 36, "start"),
      rectangle("input", 450, 170, 280, 82), label("input-label", "Collect request", 470, 193, 240, 36, "input"),
      diamond("decision", 490, 310, 200, 130), label("decision-label", "Information\ncomplete?", 510, 348, 160, 52, "decision"),
      rectangle("fix-input", 100, 500, 270, 82), label("fix-input-label", "Request missing details", 115, 523, 240, 36, "fix-input"),
      rectangle("review", 465, 500, 250, 82), label("review-label", "Review request", 480, 523, 220, 36, "review"),
      circle("finish", 910, 505, 180, 78, "#edf8ef"), label("finish-label", "Complete", 930, 527, 140, 36, "finish"),
      arrow("start-input", { x: 590, y: 123 }, { x: 590, y: 170 }),
      arrow("input-decision", { x: 590, y: 252 }, { x: 590, y: 310 }),
      arrow("decision-missing", { x: 490, y: 375 }, { x: 370, y: 540 }),
      label("missing-label", "No", 385, 430, 60, 28),
      arrow("missing-input", { x: 235, y: 500 }, { x: 450, y: 211 }),
      arrow("decision-review", { x: 690, y: 375 }, { x: 590, y: 500 }),
      label("complete-label", "Yes", 700, 425, 65, 28),
      arrow("review-finish", { x: 715, y: 541 }, { x: 910, y: 541 })
    ]
  },
  {
    id: "cross-functional-flowchart",
    name: "Cross-functional flowchart",
    description: "Show process steps across two team lanes.",
    preview: "lanes",
    objects: [
      rectangle("lane-a", 45, 55, 1_110, 300, "#f8fafc"), label("lane-a-label", "Customer team", 70, 75, 220, 42, "lane-a"),
      rectangle("lane-b", 45, 420, 1_110, 300, "#f1f6fc"), label("lane-b-label", "Operations team", 70, 440, 250, 42, "lane-b"),
      rectangle("request", 90, 170, 210, 86), label("request-label", "Submit request", 105, 195, 180, 36, "request"),
      rectangle("triage", 390, 170, 210, 86), label("triage-label", "Triage", 405, 195, 180, 36, "triage"),
      rectangle("approval", 700, 170, 210, 86), label("approval-label", "Approve", 715, 195, 180, 36, "approval"),
      rectangle("fulfill", 260, 535, 210, 86), label("fulfill-label", "Fulfill request", 275, 560, 180, 36, "fulfill"),
      rectangle("quality-check", 570, 535, 210, 86), label("quality-check-label", "Quality check", 585, 560, 180, 36, "quality-check"),
      rectangle("complete", 870, 535, 210, 86), label("complete-label", "Notify customer", 885, 560, 180, 36, "complete"),
      arrow("request-triage", { x: 300, y: 213 }, { x: 390, y: 213 }),
      arrow("triage-approval", { x: 600, y: 213 }, { x: 700, y: 213 }),
      arrow("approval-fulfill", { x: 805, y: 256 }, { x: 365, y: 535 }),
      arrow("fulfill-quality", { x: 470, y: 578 }, { x: 570, y: 578 }),
      arrow("quality-complete", { x: 780, y: 578 }, { x: 870, y: 578 })
    ]
  },
  {
    id: "workflow",
    name: "Workflow",
    description: "Lay out a practical sequence of work and handoffs.",
    preview: "workflow",
    objects: [
      circle("trigger", 45, 330, 150, 82), label("trigger-label", "Request", 60, 353, 120, 36, "trigger"),
      rectangle("step-one", 235, 315, 190, 110), label("step-one-label", "Intake", 255, 352, 150, 36, "step-one"),
      rectangle("step-two", 475, 315, 190, 110), label("step-two-label", "Analyze", 495, 352, 150, 36, "step-two"),
      diamond("decision", 715, 300, 210, 140), label("decision-label", "Ready?", 735, 352, 170, 36, "decision"),
      rectangle("step-three", 975, 185, 190, 100), label("step-three-label", "Resolve gaps", 990, 217, 160, 36, "step-three"),
      circle("outcome", 995, 490, 150, 82, "#edf8ef"), label("outcome-label", "Complete", 1_010, 513, 120, 36, "outcome"),
      arrow("flow-one", { x: 195, y: 371 }, { x: 235, y: 371 }),
      arrow("flow-two", { x: 425, y: 371 }, { x: 475, y: 371 }),
      arrow("flow-three", { x: 665, y: 371 }, { x: 715, y: 371 }),
      arrow("flow-rework", { x: 820, y: 300 }, { x: 1_000, y: 285 }),
      label("rework-label", "No", 870, 265, 55, 26),
      arrow("flow-repeat", { x: 975, y: 235 }, { x: 570, y: 315 }),
      arrow("flow-complete", { x: 820, y: 440 }, { x: 1_045, y: 490 }),
      label("complete-label", "Yes", 870, 445, 65, 26)
    ]
  },
];
