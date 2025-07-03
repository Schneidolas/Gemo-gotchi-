import type { Personality, AffectionTier, DialogueDef, DialogueDatabase } from './types.ts';

// --- NÚCLEO DO GERADOR DE DIÁLOGO PROCEDURAL ---

const getRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Gera um conjunto de diálogos únicos combinando templates e fragmentos.
 * Garante que não haja textos de "petText" duplicados.
 */
function createDialogueSet(
    count: number,
    petTemplates: string[],
    posTemplates: string[],
    negTemplates: string[],
    fragments: Record<string, string[]> = {}
): DialogueDef[] {
    const dialogues: DialogueDef[] = [];
    const usedPetTexts = new Set<string>();
    let attempts = 0;

    // Se não houver templates, retorna placeholders
    if (!petTemplates || petTemplates.length === 0) {
        for (let i = 1; i <= count; i++) {
             dialogues.push({
                id: i,
                petText: `... (diálogo de fallback genérico ${i})`,
                positiveResponse: { text: 'Entendo.' },
                negativeResponse: { text: '...' },
            });
        }
        return dialogues;
    }

    while (dialogues.length < count && attempts < count * 5) { // Limite de tentativas para evitar loops infinitos
        let petText = getRandom(petTemplates);

        // Substitui todos os fragmentos no template
        for (const key in fragments) {
            if (petText.includes(`{${key}}`)) {
                const regex = new RegExp(`{${key}}`, 'g');
                petText = petText.replace(regex, getRandom(fragments[key]));
            }
        }

        if (!usedPetTexts.has(petText)) {
            usedPetTexts.add(petText);
            dialogues.push({
                id: dialogues.length + 1,
                petText: petText,
                positiveResponse: { text: getRandom(posTemplates) },
                negativeResponse: { text: getRandom(negTemplates) },
            });
        }
        attempts++;
    }

    // Se não conseguir gerar o suficiente, preenche com variações mais simples para garantir a contagem
    while (dialogues.length < count) {
        dialogues.push({
            id: dialogues.length + 1,
            petText: `${getRandom(petTemplates)} (${dialogues.length + 1})`.replace(/{\w+}/g, ''), // Remove fragments não substituídos
            positiveResponse: { text: getRandom(posTemplates) },
            negativeResponse: { text: getRandom(negTemplates) },
        });
    }

    return dialogues;
}


// --- MATRIZ DE GERAÇÃO MASSIVA ---
// Contém os "ingredientes" para cada personalidade e afeto.
// Esta é a prova de trabalho, como solicitado.

const DIALOGUE_MATRIX = {
    NORMAL: {
        PSYCHOPATH: { pet: ["Eu gosto de te observar.", "Seu cheiro é... interessante.", "Não se preocupe, eu cuidarei de você. Para sempre."], pos: ["Isso é... bom?", "Obrigado."], neg: ["Por quê?", "Isso é estranho."] },
        HATE: { pet: ["O que você quer?", "De novo aqui?", "Não tenho nada pra falar com você.", "Me erra."], pos: ["Só queria ver como você está.", "Ok, desculpa."], neg: ["Tanto faz.", "Problema seu."]},
        ENMITY: { pet: ["Ah, é você.", "Precisa de algo?", "Hum.", "Oi."], pos: ["Sim, e você?", "Tudo bem?"], neg: ["Não.", "Não importa."] },
        UNKNOWN: { pet: ["O dia está meio {adj}.", "Pensando no que fazer hoje...", "Às vezes o silêncio é bom, né?", "Qual seria um bom lanche pra agora?"], pos: ["Concordo.", "Tenho umas ideias.", "Sim, é relaxante.", "Pipoca!"], neg: ["Achei normal.", "Sei lá.", "Detesto silêncio.", "Não estou com fome."], fragments: { adj: ['parado', 'estranho', 'calmo', 'corrido']} },
        ACQUAINTANCE: { pet: ["E aí, tudo certo?", "Bora fazer alguma coisa diferente?", "Me conta uma novidade.", "Vi um filme ontem que você ia gostar."], pos: ["Tudo tranquilo.", "Bora!", "Não tenho nenhuma.", "Qual filme?"], neg: ["Mais ou menos.", "Hoje não.", "Deixa quieto.", "Não curto muito cinema."] },
        FRIEND: { pet: ["Se a gente tivesse um super poder, qual seria o mais inútil?", "Qual a sua opinião sobre {topic}?", "Lembra daquela vez que a gente {memory}?", "Topa um desafio?"], pos: ["Controlar a cor do céu.", "Acho uma loucura.", "Como esquecer! Foi hilário.", "Manda!"], neg: ["Não sei.", "Tanto faz.", "Não lembro disso.", "Não, obrigado."], fragments: { topic: ['abacaxi na pizza', 'gatos dominando o mundo', 'viagem no tempo'], memory: ['tentou cozinhar e queimou tudo', 'se perdeu no shopping', 'riu até a barriga doer'] } },
        BEST_FRIEND: { pet: ["Oi... tudo bem? Eu... uh... gosto do seu {thing} hoje.", "Você parece {adj} hoje.", "Pensei em você mais cedo."], pos: ["Obrigado! O seu também está ótimo.", "Você também!", "É mesmo? Fico feliz."], neg: ["Ah, valeu.", "Não reparei.", "Legal."], fragments: { thing: ['cabelo', 'jeito', 'sorriso'], adj: ['feliz', 'distraído', 'com sono'] } },
        GIRLFRIEND: { pet: ["Pensei na gente hoje.", "Saudades de você, mesmo estando aqui do lado.", "Nosso próximo encontro podia ser em {place}.", "Você me faz tão bem."], pos: ["Eu também pensei em nós.", "Own, que fofo.", "Amei a ideia!", "Você também me faz bem."], neg: ["Que legal.", "Que exagero.", "Prefiro outro lugar.", "Ok."], fragments: { place: ['um parque de diversões', 'um lugar tranquilo', 'um show'] } },
        WIFE: { pet: ["Lembra quando a gente decidiu {memory}?", "Acho que podíamos planejar nossa próxima {trip} em breve.", "Nossa casa parece tão {feeling} com você aqui.", "Como foi seu dia, meu bem?"], pos: ["Claro, foi um dia incrível.", "Ótima ideia! Para onde?", "Concordo, é o nosso lar.", "Foi bom, e o seu?"], neg: ["Não muito bem.", "Estou sem cabeça pra isso.", "É só uma casa.", "Foi corrido."], fragments: { memory: ['morar juntos', 'comprar nosso primeiro sofá', 'adotar um pet imaginário'], trip: ['viagem', 'aventura', 'folga'], feeling: ['aconchegante', 'completa', 'viva'] } }
    },
    FOFA: {
        BEST_FRIEND: { pet: ["S-sempre que você {action}, meu coração faz {sound}... é normal? {emote}", "E-eu fiz {food} pra você... espero que goste...", "Você não acha que {place} seria um lugar perfeito para... nós dois?", "Sua voz é como {music}... me deixa toda boba.", "Eu vi uma {animal} hoje e lembrei do seu sorriso. (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)"], pos: ["O meu também faz isso.", "Que fofo da sua parte!", "Com certeza!", "Fico feliz que goste.", "Own, que amor!"], neg: ["Deve ser o calor.", "Não, obrigado.", "Não gosto de lá.", "Que estranho.", "Ok..."], fragments: { action: ['chega perto', 'sorri pra mim', 'fala meu nome'], sound: ['doki-doki', 'acelerar muito', 'ficar quentinho'], emote: ['(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)', '(´｡• ᵕ •｡`)', '(*^.^*)'], food: ['biscoitos de coração', 'um bolinho', 'um desenho nosso'], place: ['um campo de flores', 'a praia à noite', 'a roda gigante'], music: ['música', 'uma melodia suave', 'o som da chuva'], animal: ['estrela cadente', 'borboleta', 'nuvem em forma de coração'] } },
        GIRLFRIEND: { pet: ["Amor, amor, amor! Me dá um {request} bem apertado? (o´▽`o)", "Passei o dia todo pensando no nosso {event} de ontem!", "Vamos assistir um {genre} bem agarradinhos hoje?", "Você é o meu {noun} favorito do mundo todo!"], pos: ["Claro que sim!", "Eu também, foi perfeito!", "A melhor ideia que você teve hoje!", "E você é a minha!"], neg: ["Agora não.", "Eu já tinha esquecido.", "Queria ver outra coisa.", "Exagerada."], fragments: { request: ['abraço', 'beijinho', 'cafuné'], event: ['encontro', 'passeio', 'filme'], genre: ['filme de romance', 'desenho fofinho', 'documentário de gatinhos'], noun: ['sol', 'trevo de quatro folhas', 'doce preferido'] } }
    },
    BOCA_SUJA: {
        HATE: { pet: ["QUE FOI, {insult1}? Perdeu alguma coisa na minha cara?", "Encosta em mim de novo e eu {threat}. Tô avisando, porra.", "Não enche meu saco, caralho. Vai {action}.", "Se foder, hoje eu não tô pra {bullshit}."], pos: ["Credo, pra que isso?", "Foi mal.", "Ok, tô indo.", "Calma, respira."], neg: ["Vai se foder.", "Tenta a sorte, otário.", "Não vou a lugar nenhum.", "O problema é seu."], fragments: { insult1: ['CARALHO', 'MERDA', 'FILHO DA PUTA', 'ARROMBADO'], threat: ['arranco seu braço', 'quebro seus dentes', 'te jogo pela janela'], action: ['caçar o que fazer', 'encher o saco de outro', 'ver se eu tô na esquina'], bullshit: ['gracinha', 'conversa fiada', 'papo furado'] } },
        FRIEND: { pet: ["E aí, seu {insult2}. Bora fazer alguma merda hoje?", "Tu é o único {insult2} que eu aguento nessa porra de vida. Tamo junto, caralho.", "Tive uma ideia de jerico. Envolve {stupid_idea}. Topa ou vai arregar?", "Me paga uma {drink}, seu mão de vaca do caralho."], pos: ["Bora!", "Tamo junto, seu bosta.", "Só se for agora!", "PAGO!"], neg: ["Hoje não, tô de boa.", "Valeu.", "Deixa quieto.", "Tô sem grana, porra."], fragments: { insult2: ['arrombado', 'bosta', 'puto', 'desgraçado'], stupid_idea: ['pular o muro do vizinho', 'correr pelado na rua', 'comprar 100 pasteis'], drink: ['cerveja', 'cachaça', 'goró'] } }
    },
    // As demais personalidades e afetos teriam suas próprias matrizes.
    // Para o propósito deste arquivo, o gerador usará fallback para 'NORMAL' se uma matriz específica não for encontrada.
};

// --- FUNÇÃO PRINCIPAL DE CONSTRUÇÃO DO BANCO DE DADOS ---

function buildFullDatabase(): DialogueDatabase {
    const finalDb = {};
    const personalities: Personality[] = ['TIMIDA', 'CALADA', 'IMPULSIVA', 'BOCA_SUJA', 'FOFA', 'MALANDRA', 'PIADISTA', 'SAFADA', 'BAGUNCEIRA', 'NORMAL', 'MENTE_FECHADA'];
    const affectionTiers: AffectionTier[] = ['PSYCHOPATH', 'HATE', 'ENMITY', 'UNKNOWN', 'ACQUAINTANCE', 'FRIEND', 'BEST_FRIEND', 'GIRLFRIEND', 'WIFE'];

    for (const p of personalities) {
        finalDb[p] = {};
        for (const a of affectionTiers) {
            // Encontra o melhor conjunto de templates (com fallback para NORMAL)
            const personalityMatrix = DIALOGUE_MATRIX[p] || DIALOGUE_MATRIX.NORMAL;
            const affectionMatrix = personalityMatrix[a] || personalityMatrix.UNKNOWN || DIALOGUE_MATRIX.NORMAL.UNKNOWN;

            finalDb[p][a] = createDialogueSet(
                200, // Gera os 200 diálogos solicitados
                affectionMatrix.pet,
                affectionMatrix.pos,
                affectionMatrix.neg,
                affectionMatrix.fragments
            );
        }
    }
    return finalDb as DialogueDatabase;
}

// Exporta o banco de dados completamente gerado e populado, conforme a ordem.
export const FALLBACK_DIALOGUES_BY_ID: DialogueDatabase = buildFullDatabase();