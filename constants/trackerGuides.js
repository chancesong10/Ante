// Content for the tracker guides — the animated explainer behind the ⓘ in
// each tracker's header.
//
// Deliberately data, not JSX: the shape below is the only thing that changes
// when the copy needs reworking, and TrackerGuideSheet renders all six games
// from it. Adding a game means adding a key here, nothing else.
//
// Each panel is one screen of the sequence:
//   art      — which animated illustration to run (see components/GuideArt.js)
//   heading  — short, sentence case, the claim of the panel
//   body     — two or three lines max. Any longer and it stops being read.
//   points   — optional bullets, each a concrete thing the user does or gets
//   payoff   — set on the last panel only: the Insights screen this feeds,
//              and the real names of the stats it unlocks. These must match
//              the labels the insights screens actually render, or the guide
//              is promising something the user can't find.

export const TRACKER_GUIDES = {
  Blackjack: {
    accent: 'accentCyan',
    panels: [
      {
        art: 'chips',
        heading: 'Log each hand as you play it',
        body: 'Set your bet, then mark how the hand finished. One tap per hand is the whole loop.',
        points: [
          'Tap a chip to build your bet, or type an exact amount',
          'Win, loss or push — plus double, split and blackjack',
        ],
      },
      {
        art: 'cards',
        heading: 'Add the cards when it matters',
        body: "Card-level entry is optional. Turn it on in Profile and Ante can check your play against basic strategy.",
        points: [
          'Your two cards and the dealer upcard',
          'Skip it any night you just want the money tracked',
        ],
      },
      {
        art: 'insight',
        heading: 'What this turns into',
        body: 'A few hundred hands is enough for Ante to find the habit costing you money, and price it.',
        payoff: {
          route: 'Insights',
          params: { gameType: 'Blackjack' },
          stats: [
            'Bet size after a win vs after a loss — loss chasing, measured',
            'Basic strategy accuracy, and what the misplays cost',
            'Conditional win rate and bet sizing consistency',
          ],
        },
      },
    ],
  },

  Poker: {
    accent: 'accentViolet',
    panels: [
      {
        art: 'streets',
        heading: 'Every hand walks the streets',
        body: 'Pre-Flop, Flop, Turn, River, Showdown. You enter what each player puts in, and the pot follows.',
        points: [
          'A bet card for you and every other player at the table',
          'Your real SB and BB are quick-chips, so posting is one tap',
        ],
      },
      {
        art: 'flow',
        heading: 'The pot is never yours to babysit',
        body: "It's derived from what's been entered. Fold someone mid-street and their money stays in as dead money.",
        points: [
          "Mismatched bets block the street — Ante shows you who owes what",
          'Mark the result Won, Split or Lost; N-way chops included',
        ],
      },
      {
        art: 'insight',
        heading: 'What this turns into',
        body: "Poker math is the hardest to reconstruct from memory, so this tracker feeds the deepest read.",
        payoff: {
          route: 'PokerInsights',
          stats: [
            'Bluff-catcher score — how often you folded the best hand',
            'Money left on the table, and fold quality by street',
            'bb/100 hands, return on invested, and tilt after a bad beat',
          ],
        },
      },
    ],
  },

  'Sports Betting': {
    accent: 'accentOrange',
    panels: [
      {
        art: 'odds',
        heading: 'Log the slip, not the outcome',
        body: 'Enter the matchup, bet type and American odds. Ante works out the payout before anything settles.',
        points: [
          'Moneyline, spread, total, parlay — whatever you actually bet',
          'Odds drive the implied probability the book charged you',
        ],
      },
      {
        art: 'pending',
        heading: 'Pending bets stay open',
        body: "A slip can sit unsettled for days. It waits here until you grade it, and it never blocks another session.",
        points: [
          'Settle it whenever the result lands',
          'A live parlay never stops you logging a poker night',
        ],
      },
      {
        art: 'insight',
        heading: 'What this turns into',
        body: 'The only number that matters in betting is whether you beat the price. This is where you find out.',
        payoff: {
          route: 'SportsBettingInsights',
          stats: [
            'Your edge — real win rate against the implied probability',
            'Performance by bet type, and by sport',
            'Conditional win rate after a win vs after a loss',
          ],
        },
      },
    ],
  },

  Roulette: {
    accent: 'success',
    panels: [
      {
        art: 'spots',
        heading: 'Pick the bet, not the maths',
        body: 'Straight up, split, street, corner, dozen, column or an outside even-money bet. Ante applies the right odds.',
        points: [
          'Choose the bet type, enter your stake, mark the result',
          'Wheel type is set in Profile, so the house edge is yours',
        ],
      },
      {
        art: 'chips',
        heading: 'Stake size is the story',
        body: "Roulette has no skill to audit, so what Ante watches is how your stake moves after a result.",
        points: [
          'Quick-chips for the stakes you actually play',
          'Every spin logged is one more point of evidence',
        ],
      },
      {
        art: 'insight',
        heading: 'What this turns into',
        body: "With fixed odds, Ante can separate how you played from how you ran.",
        payoff: {
          route: 'TableGameInsights',
          params: { gameType: 'Roulette' },
          stats: [
            'Expected vs actual — how much was luck, in money',
            'Bet size after a win vs after a loss',
            'Longest doubling run, the martingale tell',
          ],
        },
      },
    ],
  },

  Baccarat: {
    accent: 'warning',
    panels: [
      {
        art: 'spots',
        heading: 'Player, Banker or Tie',
        body: 'Three spots, and the correct payout applied automatically — including the 5% commission on a Banker win.',
        points: [
          'Pick the side, enter your stake, mark the result',
          'Tie odds are configurable in Profile',
        ],
      },
      {
        art: 'chips',
        heading: 'Stake size is the story',
        body: 'The cards are out of your hands here. What Ante can see is what you do with your stake.',
        points: [
          'Quick-chips for your usual units',
          'Every shoe logged sharpens the read',
        ],
      },
      {
        art: 'insight',
        heading: 'What this turns into',
        body: 'Fixed, known odds mean your results can be measured against what should have happened.',
        payoff: {
          route: 'TableGameInsights',
          params: { gameType: 'Baccarat' },
          stats: [
            'Expected vs actual — luck, priced in money',
            'Bet size after a win vs after a loss',
            'Longest doubling run, and return on wagered',
          ],
        },
      },
    ],
  },

  General: {
    accent: 'info',
    panels: [
      {
        art: 'flow',
        heading: 'For anything without a template',
        body: 'Slots, craps, keno, a home game. Name what you played, then log a buy-in and a cash-out.',
        points: [
          'Label the session so History says "Craps", not "General"',
          'Two numbers is all it takes',
        ],
      },
      {
        art: 'chips',
        heading: 'Rough beats missing',
        body: "An approximate buy-in logged tonight is worth far more than an exact one you never write down.",
        points: [
          'Round it if you have to — just record it',
          'It still counts toward your lifetime numbers',
        ],
      },
      {
        art: 'insight',
        heading: 'What this turns into',
        body: 'Even buy-in and cash-out alone tells you which games are quietly funding the others.',
        payoff: {
          route: 'LifetimeInsights',
          stats: [
            'Per-game breakdown — what actually makes and costs you money',
            'Bankroll over time, best and worst sessions',
            'Cross-game patterns by day of week and session length',
          ],
        },
      },
    ],
  },
};

export function guideForGame(gameType) {
  return TRACKER_GUIDES[gameType] || null;
}
