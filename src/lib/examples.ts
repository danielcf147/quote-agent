export interface Example {
  id: string;
  title: string;
  blurb: string;
  text: string;
}

/** The four requests shown in demo mode. Their results are precomputed by `npm run precompute`. */
export const EXAMPLES: Example[] = [
  {
    id: "lab-restock",
    title: "Lab restock",
    blurb: "Everyday shorthand vs. formal catalog names",
    text: "Hi! Could you send me a quote for 10 boxes of nitrile gloves size M, 5 liters of isopropyl alcohol and two of those 100 microliter pipettes? Also 3 racks of the 200ul tips. Thanks, Maria",
  },
  {
    id: "office-order",
    title: "Office order",
    blurb: "Casual email, units in sheets and pieces",
    text: "hey, office is out of basically everything lol. we need 2000 sheets of A4 printer paper, a dozen post-its, 24 blue pens, a couple of staplers + staples, and some whiteboard markers (4 packs). oh and coffee, 3 kg of ground coffee for the kitchen",
  },
  {
    id: "messy-request",
    title: "Messy request",
    blurb: "Typos, vague items and one product we don't sell",
    text: "need asap: 50ml falcon tubes x4 packs, petri dishs 200 pcs, parafim 1 roll, eppendorf tubes 1.5, a centrifuge for the 50ml tubes, and the kim wipes - 6 boxes",
  },
  {
    id: "spanish-request",
    title: "Spanish request",
    blurb: "Non-English input, same catalog",
    text: "Buenos días, necesitamos cotización de: 4 litros de etanol al 70% para desinfectar, 2 batas de laboratorio talla L, 3 gafas de seguridad y 1 caja de mascarillas quirúrgicas. Saludos.",
  },
];
