// The story: Jax Moreno, fresh out of prison, lands in Solmar Bay owing a
// debt to the man who got him out. Four missions, in order, each a list of
// steps the game checks: reach a place, get into a marked car, take out every
// enemy, or deliver a car. A mission starts by walking into its yellow marker.

export const MISSIONS = [
  {
    id: 0,
    title: 'Welcome to Solmar',
    briefing: 'Rico sprung you out of lockup and now he owns you. Meet him at the marina, then drive him to the Neon Palms club.',
    reward: 400,
    steps: [
      { type: 'reach', text: 'Meet Rico at the marina pier', target: 'marina', radius: 6 },
      { type: 'reach', text: 'Drive Rico to the Neon Palms club', target: 'club', radius: 8 },
    ],
  },
  {
    id: 1,
    title: 'Hot Wheels',
    briefing: 'Rico needs a Comet GT for a buyer. Steal the yellow sports car from the east strip and bring it to the lockup garage. The owner will not be pleased.',
    reward: 700,
    steps: [
      { type: 'steal', text: 'Steal the yellow Comet GT', target: 'casino', radius: 10 },
      { type: 'deliver', text: 'Deliver the Comet GT to the lockup garage', target: 'garage', radius: 8 },
    ],
  },
  {
    id: 2,
    title: 'Payback',
    briefing: 'The Vipers jumped Rico\'s crew at the old warehouse. Go to the warehouse and deal with every last one of them.',
    reward: 900,
    steps: [
      { type: 'reach', text: 'Reach the old warehouse', target: 'warehouse', radius: 10 },
      { type: 'kill', text: 'Take out the Vipers', target: 'warehouse', radius: 40 },
    ],
  },
  {
    id: 3,
    title: 'The Big Score',
    briefing: 'One last job: walk into the Palms casino, lift the vault cash, and lose the whole Solmar police department on your way to the safehouse.',
    reward: 2500,
    steps: [
      { type: 'reach', text: 'Enter the Palms casino', target: 'casino', radius: 8 },
      { type: 'reach', text: 'Grab the vault cash and get out', target: 'casino', radius: 6 },
      { type: 'escape', text: 'Escape to the safehouse garage', target: 'garage', radius: 8 },
    ],
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

export function nextMissionId(doneId) {
  return doneId + 1 < MISSIONS.length ? doneId + 1 : -1;
}
