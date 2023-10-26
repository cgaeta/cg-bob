export const generalMoves = {
  strongMoves: ["Accurately evaluate somebody's response or motives"],
  normalMoves: [
    "Successfully attack an enemy, but with negative consequences",
    "Maintain somebody's trust or avoid arousing suspicion",
    "Successfully identify signs of a threat or trap, but with missing details",
    "Evaluate somebody's response or motives with missing details",
  ],
  weakMoves: [
    "Fail in an attack on an enemy",
    "Lose somebody's trust or earn their suspicion",
    "Misread somebody's response or motives",
  ],
  socialMoves: [
    "Endanger an ally and steal a token from them",
    "Assist an ally in danger to give them a token",
  ],
};

export const uniqueMoves = {
  none: {
    strongMoves: [],
    normalMoves: [],
    weakMoves: [],
    socialMoves: [],
  },
  azrael: {
    strongMoves: [
      "Attack enemies with a barrage of Eldritch Blasts",
      "Successfully polymorph an enemy into an animal that you are familiar with",
      "Earn somebody's trust or dispel their suspicions",
      "Intimidate an uncooperative person into doing something they don't want to do",
    ],
    normalMoves: [
      "Polymorph an enemy into something that presents a different kind of danger",
    ],
    weakMoves: [
      "Make an unsettling comment about being dead and lose somebody's trust or earn their suspicion",
    ],
    socialMoves: [
      "Polymorph an ally into a powerful creature and give them a token",
      "Polymorph an ally into a creature as a distraction and steal a token from them",
    ],
  },
  grey: {
    strongMoves: [
      "Attack enemies with a barrage of crossbow bolts",
      "Manifest an echo to attack and confuse an enemy",
      "Four times per long rest, unleash the power of your echo and make a powerful attack on your enemy",
      "Swear an oath on Bill and Ted, and earn somebody's trust or dispel their suspicions",
    ],
    normalMoves: [
      "Manifest an echo to attack and confuse an enemy, but draw its focus onto you",
      "Switch places with your manifested echo to an otherwise unreachable place",
      "Once per short rest, use an action surge and make a strong move without spending a token",
      "Once per short rest, use a second wind and recover from light damage",
    ],
    weakMoves: [
      "Get carried away talking about Bill and Ted and lose somebody's trust or earn their suspicion",
    ],
    socialMoves: [],
  },
  ludwig: {
    strongMoves: [
      "Attack an enemy with a Crimson Rite and minimal damage to yourself",
      "Successfully track down a monster or recall useful information about it",
      "Cast a powerful Blood Curse of Bloated Agony on an enemy",
      "Successfully identify a threat or trap",
    ],
    normalMoves: [
      "Draw your own blood to imbue your weapon with a crimson rite",
    ],
    weakMoves: [
      "If you're bleeding, lose control to your bloodlust and attack the nearest creature",
      "Fail to track down a monster or misremember information about it",
      "Fail to identify a threat or trap",
    ],
    socialMoves: [
      "Cast a curse of bloated agony on an enemy and give a token to an ally",
    ],
  },
  riminar: {
    strongMoves: [
      "Demoralize an enemy with Vicious Mockery",
      "Use Bardic Inspiration to turn an ally's weak move into a normal move, or a normal move into a strong move",
      "Use Cutting Words to save an ally from an attack",
      "Counterspell an incoming spell you can see",
    ],
    normalMoves: [],
    weakMoves: [],
    socialMoves: ["Bardically inspire an ally and give them a token"],
  },
} as const;
