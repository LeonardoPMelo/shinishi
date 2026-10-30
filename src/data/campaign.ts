/** Campaign chapters shown in the Jornada panel. Missions point here through `chapter`. */
export const CHAPTERS = [
  { id: 1, title: 'O Faro do Gato Ninja', blurb: 'Os peixes sumiram, uma receita voou e um gato de cachecol vermelho anda pela floresta.' },
  { id: 2, title: 'As Lanternas da Vila', blurb: 'Um festival, uma escada quebrada e lanternas que se apagam de uma vez.' },
  { id: 3, title: 'Os Saberes da Vila', blurb: 'Banquetes, chás, máquinas, hortas, uma balança antiga e um rival que precisa de um amigo.' },
  { id: 4, title: 'O Templo dos Enigmas', blurb: 'Atrás do pagode, um templo fechado há anos: espelhos, frações e gongos guardam o santuário.' },
  { id: 5, title: 'A Academia e a Sede', blurb: 'Quatro provas na Academia Ninja, uma audiência com o Mikage e os segredos da Sede do líder.' },
  { id: 6, title: 'As Terras Selvagens', blurb: 'Um acampamento além da cerca oeste, um cartógrafo numa árvore, uma caverna de névoa e o posto do General Hissui.' },
  { id: 7, title: 'O Pacto das Duas Margens', blurb: 'Quem é o General Hissui, o que o Disco Solar abre e o que ficou para trás na noite da Grande Cheia.' },
] as const;

/** Shown after the last chapter until new content exists. */
export const NEXT_CHAPTER_TEASER = 'Próximo capítulo: em breve. O General Hissui quer o Disco Solar... e o que ele abre na Vila das Patas.';
/** Shown instead of the teaser once the last chapter is done. */
export { STORY_EPILOGUE, CHAPTER_RECAPS } from './story';
