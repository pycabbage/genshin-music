import type { INSTRUMENTS } from "$/Config";

export type InstrumentName = typeof INSTRUMENTS[number]
export type ApproachingScore = {
    correct: number
    wrong: number
    score: number
    combo: number
}
export type InstrumentNotesLayout = 8 | 15 | 21
export type Pages = 'Composer' | 'Player' | 'Donate' | 'ErrorPage' | 'Help' | 'Main' | 'MidiSetup' | 'SheetVisualizer'
    | 'Theme' | '404' | 'Changelog'

export type NoteStatus = 'clicked' | 'toClick' | 'toClickNext' | 'toClickAndNext' | 'approach-wrong' | 'approach-correct' | ''


export type SearchedSongType = {
    name: string
    file: string
    error: string
}

export enum ClickType{
    Left = 1,
    Right = 2,
    Unknown = -1
}



export type Timer = ReturnType<typeof setTimeout> | 0