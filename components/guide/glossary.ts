/**
 * The app's own words, in plain language.
 *
 * Aperture names things the way its designers think about them — "distilled",
 * "still open", "untangle", "seal". Those names stay, because they are the
 * product's voice. This is where each one is explained once, so the Help sheet
 * and every inline "?" say the same thing in the same words.
 */

export type Term =
  | 'entry'
  | 'distilled'
  | 'modes'
  | 'stillOpen'
  | 'mood'
  | 'weather'
  | 'themes'
  | 'echoes'
  | 'seal'
  | 'ask'
  | 'security';

export const GLOSSARY: Record<Term, { word: string; plain: string }> = {
  entry: {
    word: 'Entry',
    plain:
      'One conversation with the AI. Every one you start is saved and listed under Sessions.',
  },
  distilled: {
    word: 'Distilled',
    plain:
      'What happens when you press End session: the AI turns the conversation into a short summary, a mood, a few themes and one small thing to try.',
  },
  modes: {
    word: 'Modes',
    plain:
      'How the AI talks back. Reflect asks questions. Brainstorm throws ideas. Untangle points out the shape of a knotted thought. Rubber Duck makes you explain a problem until the gap shows.',
  },
  stillOpen: {
    word: 'Still open',
    plain:
      'Questions you left unresolved, taken from your summaries so you can pick them back up. Nothing to tick off.',
  },
  mood: {
    word: 'Mood dot',
    plain:
      'How a session felt, read from the summary. Green is lighter, pink is heavier, purple is about level. A fainter dot means lower energy.',
  },
  weather: {
    word: 'Emotional weather',
    plain:
      'One band per distilled session, oldest on the left. Colour is how it felt; height is how charged it was.',
  },
  themes: {
    word: 'Themes',
    plain:
      'Topics that keep coming up across your summaries. Bigger means more often; lines join themes that appear together. Click one to see those sessions.',
  },
  echoes: {
    word: 'Echoes',
    plain:
      'Optional. When you pause while writing, Aperture looks for an older entry about the same thing and tells you. Off until you turn it on in Profile.',
  },
  seal: {
    word: 'Seal / Vault',
    plain:
      'Sealing locks an entry with a passphrase only you know. Nobody can read it afterwards, including the AI, so it gets no summary and does not show up in search.',
  },
  ask: {
    word: 'Ask your past',
    plain:
      'Ask a question about your own entries. Answers only use what you wrote and link to the entry each point came from.',
  },
  security: {
    word: 'Security',
    plain:
      'A list of every request sent to the AI for you, what it contained, plus download-everything and delete-everything.',
  },
};

/** The order the Help sheet lists them in — roughly the order you meet them. */
export const GLOSSARY_ORDER: Term[] = [
  'entry',
  'modes',
  'distilled',
  'stillOpen',
  'mood',
  'weather',
  'themes',
  'ask',
  'echoes',
  'seal',
  'security',
];
