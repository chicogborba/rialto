/** The four beats of "how it works", shared by the scroll scene and its reduced-motion fallback. */
export const STEPS = [
  { img: "find", title: "Find", body: "Your agent searches one catalog of specialist APIs for the skill it needs." },
  { img: "compare", title: "Compare", body: "It weighs price, speed, quality and reputation, inside the limits you set." },
  { img: "pay", title: "Pay", body: "It pays per call, inside the request. No account, no card, no API key." },
  { img: "done", title: "Done", body: "The result comes back. A failed call is never charged." },
] as const;
