export type Personality = 'TIMIDA' | 'CALADA' | 'IMPULSIVA' | 'BOCA_SUJA' | 'FOFA' | 'MALANDRA' | 'PIADISTA' | 'SAFADA' | 'BAGUNCEIRA' | 'NORMAL' | 'MENTE_FECHADA';

export type AffectionTier = 'PSYCHOPATH' | 'HATE' | 'ENMITY' | 'UNKNOWN' | 'ACQUAINTANCE' | 'FRIEND' | 'BEST_FRIEND' | 'GIRLFRIEND' | 'WIFE';

export type Location = 'QUARTO' | 'SALA_DE_ESTAR' | 'COZINHA' | 'BANHEIRO' | 'QUINTAL' | 'SORVETERIA' | 'SHOPPING' | 'BOLICHE' | 'FLIPERAMAS' | 'MOTEL';

export type View = 'HOME' | 'MENU_COMODOS' | 'MENU_INTERACOES' | 'MENU_VIAGEM' | 'MENU_ARMARIO';

export type GameTime = { year: number; month: number; day: number; hour: number; minute: number; };

export interface DialogueOption { text: string; moodEffect?: number; affectionEffect?: number; }

export interface Dialogue { petText: string; positiveResponse: DialogueOption; negativeResponse: DialogueOption; isProposal?: boolean; }

export interface AiRoomAction { name: string; result: string; }

export interface DialogueDef {
    id: number;
    petText: string;
    positiveResponse: { text: string };
    negativeResponse: { text: string };
}

export type DialogueDatabase = Record<Personality, Record<AffectionTier, DialogueDef[]>>;
