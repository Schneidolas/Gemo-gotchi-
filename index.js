import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { FALLBACK_DIALOGUES_BY_ID } from './dialogues.js';

// --- PERSISTENCE ---
const SAVE_KEY = 'gemochi_save_v2';

const saveState = (state) => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, serializedState);
  } catch (err)
{
    console.warn("Could not save game state.", err);
  }
};

const loadState = () => {
  try {
    const serializedState = localStorage.getItem(SAVE_KEY);
    if (serializedState === null) return undefined;
    return JSON.parse(serializedState);
  } catch (err) {
    console.warn("Could not load game state.", err);
    return undefined;
  }
};


// --- CONSTANTS, TYPES & DATA ---

const STAT_MAX = 100;
const STAT_DECAY_RATE = 1;
const DECAY_INTERVAL = 6000;
const DEATH_TIMER_DURATION = 30000;
const TIME_SPEED_MULTIPLIER = 20;

const FEMALE_NAMES = ["Lia", "Pixel", "Nina", "Gabi", "Tete", "Carol", "Emi", "Flora", "Maya", "Yuki"];
const PERSONALITIES = ['TIMIDA', 'CALADA', 'IMPULSIVA', 'BOCA_SUJA', 'FOFA', 'MALANDRA', 'PIADISTA', 'SAFADA', 'BAGUNCEIRA', 'NORMAL', 'MENTE_FECHADA'];
const PERSONALITY_NAMES = {
    TIMIDA: "Tímida", CALADA: "Calada", IMPULSIVA: "Impulsiva", BOCA_SUJA: "Boca Suja",
    FOFA: "Fofa", MALANDRA: "Malandra", PIADISTA: "Piadista", SAFADA: "Safada",
    BAGUNCEIRA: "Bagunceira", NORMAL: "Normal", MENTE_FECHADA: "Mente Fechada"
};

const PERSONALITY_PROMPTS = {
    TIMIDA: "Você é muito tímida e envergonhada. Fale baixo, hesite um pouco (sem usar hífens para gaguejar), e demonstre nervosismo ou admiração pelo jogador.",
    CALADA: "Você fala muito pouco. Suas frases são curtas e diretas, às vezes monossilábicas. O silêncio não te incomoda.",
    IMPULSIVA: "Você age por impulso, sem pensar muito. Suas falas são cheias de energia, decisões rápidas e ideias repentinas e talvez um pouco caóticas.",
    BOCA_SUJA: "Você é direta e sem filtros, falando muitos palavrões. Use gírias e palavrões como 'porra', 'caralho', 'merda' de forma natural na conversa.",
    FOFA: "Você é extremamente fofa, doce e carinhosa. Use diminutivos, emoticons de texto como (o´▽`o), e fale sobre coisas adoráveis.",
    MALANDRA: "Você é esperta, tem a manha das coisas e um jeito meio malandro. Use gírias, seja um pouco provocadora e talvez fale sobre dar um 'jeitinho' nas coisas.",
    PIADISTA: "Você adora contar piadas, trocadilhos e fazer graça com tudo. Suas falas são quase sempre tentativas de ser engraçada, mesmo que as piadas sejam ruins.",
    SAFADA: "Você tem uma mente maliciosa e gosta de fazer insinuações e provocações com duplo sentido. Seja sutilmente sedutora e brincalhona.",
    BAGUNCEIRA: "Você é desorganizada e adora o caos. Fale sobre ideias malucas, coisas que você quebrou ou perdeu, ou sobre como a desordem é divertida.",
    NORMAL: "Você é equilibrada. Fale sobre o cotidiano, sentimentos comuns ou observações simples sobre o que está acontecendo.",
    MENTE_FECHADA: "Você é cética, teimosa e se irrita fácil com o que não entende ou não concorda. Reclame de algo ou seja resistente a uma ideia nova. Evite dar fatos ou curiosidades.",
};

const AFFECTION_TIERS = {
    PSYCHOPATH:   { min: -Infinity, max: -81, name: 'PSYCHOPATH' },
    HATE:         { min: -80, max: -41, name: 'HATE' },
    ENMITY:       { min: -40, max: -11, name: 'ENMITY' },
    UNKNOWN:      { min: -10, max: 10,  name: 'UNKNOWN' },
    ACQUAINTANCE: { min: 11,  max: 30,  name: 'ACQUAINTANCE' },
    FRIEND:       { min: 31,  max: 60,  name: 'FRIEND' },
    BEST_FRIEND:  { min: 61,  max: 90,  name: 'BEST_FRIEND' },
    GIRLFRIEND:   { min: 91,  max: 150, name: 'GIRLFRIEND' },
    WIFE:         { min: 151, max: Infinity, name: 'WIFE' },
};

const AFFECTION_STATUS_NAMES = {
    PSYCHOPATH: 'Psicopata', HATE: 'Ódio', ENMITY: 'Inimizade', UNKNOWN: 'Desconhecida', ACQUAINTANCE: 'Conhecida',
    FRIEND: 'Amiga', BEST_FRIEND: 'Melhor Amiga', GIRLFRIEND: 'Namorada', WIFE: 'Esposa'
};

const LOCATION_NAMES = {
    QUARTO: 'Quarto', SALA_DE_ESTAR: 'Sala de Estar', COZINHA: 'Cozinha', BANHEIRO: 'Banheiro',
    QUINTAL: 'Quintal', SORVETERIA: 'Sorveteria', SHOPPING: 'Shopping', BOLICHE: 'Boliche',
    FLIPERAMAS: 'Fliperamas', MOTEL: 'Motel',
};

const LOCATION_BACKGROUNDS = {
    SALA_DE_ESTAR: 'url(./living_room.png)',
    QUARTO: 'url(./bedroom.png)',
    COZINHA: 'url(./kitchen.png)',
    BANHEIRO: 'url(./bathroom.png)',
    QUINTAL: 'url(./backyard.png)',
    SORVETERIA: 'url(https://i.imgur.com/eBwZ8r2.png)',
    SHOPPING: 'url(https://i.imgur.com/bT6nB6j.png)',
    BOLICHE: 'url(https://i.imgur.com/sSgWnFf.png)',
    FLIPERAMAS: 'url(https://i.imgur.com/7bJdGjG.png)',
    MOTEL: 'url(https://i.imgur.com/5lG2m6V.png)',
};

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getAffectionTier = (affection) => {
    for (const tier in AFFECTION_TIERS) {
        if (affection >= AFFECTION_TIERS[tier].min && affection <= AFFECTION_TIERS[tier].max) return AFFECTION_TIERS[tier].name;
    }
    return 'UNKNOWN';
};

const PROPOSAL_DIALOGUE = {
    petText: "Eu... preciso te dizer algo. Sinto que o que temos é mais que amizade. Você... quer namorar comigo?",
    isProposal: true, positiveResponse: { text: "Sim! Eu quero!", moodEffect: 50 }, negativeResponse: { text: "Desculpe, não sinto o mesmo.", moodEffect: -50 },
};
const MARRIAGE_PROPOSAL_SEQUENCE = [ "Meu amor... posso te falar uma coisa? Vem aqui pertinho.", "Desde que a gente começou a namorar, cada dia com você tem sido... mágico. Você me faz tão feliz.", "Eu fico toda boba e tímida só de pensar...", "É que... eu não consigo mais imaginar um futuro que não seja com você nele.", "Você aceita... se casar comigo?", ];

// --- HELPER COMPONENTS ---

const StatusBar = ({ label, value }) => React.createElement("div", { className: "status-bar-container" }, React.createElement("p", { className: "status-label" }, label), React.createElement("div", { className: "progress-bar-outline" }, React.createElement("div", { className: "progress-bar-fill", style: { width: `${value}%` } })));
const SpeechBubble = ({ text }) => React.createElement("div", { className: "speech-bubble" }, text);
const InteractionPopup = ({ text }) => React.createElement("div", { className: "interaction-popup" }, text);
const Character = ({ imageUrl, animationState, isSleeping, isTalking, isWalking, facingDirection, transitionDuration }) => {
    const characterClasses = `character ${isSleeping ? 'sleeping' : ''} ${isTalking ? 'talking' : ''} ${isWalking ? 'walking' : 'idling'} ${animationState ? 'anim-' + animationState : ''}`;
    const characterStyle = { transition: `transform ${transitionDuration} linear`, transform: `scaleX(${facingDirection === 'right' ? 1 : -1})` };
    return (
        React.createElement("div", { className: characterClasses, style: characterStyle },
            animationState === 'sadness' && React.createElement("div", { className: "rope" }),
            React.createElement("div", { className: "character-bob" },
                React.createElement("div", { className: "character-shadow" }),
                React.createElement("div", { className: "character-sprite" },
                    React.createElement("img", { src: imageUrl, alt: "Character", className: "character-image" }),
                    animationState === 'psycho' && React.createElement("div", { className: "knife" }),
                    isSleeping && React.createElement("div", { className: "zzz-bubble" }, "Zzz")
                )
            )
        )
    );
};

// --- MAIN APP ---

const App = () => {
  const savedState = useMemo(() => loadState(), []);
  
  // --- STATE ---
  const [name, setName] = useState(savedState?.name || getRandom(FEMALE_NAMES));
  const [personality, setPersonality] = useState(savedState?.personality || getRandom(PERSONALITIES));
  const [characterImageUrl, setCharacterImageUrl] = useState(savedState?.characterImageUrl || './character.png');
  const [hunger, setHunger] = useState(savedState?.hunger ?? 80);
  const [hygiene, setHygiene] = useState(savedState?.hygiene ?? 80);
  const [mood, setMood] = useState(savedState?.mood ?? 80);
  const [affection, setAffection] = useState(savedState?.affection ?? 0);
  const [isAlive, setIsAlive] = useState(savedState?.isAlive ?? true);
  const [deathType, setDeathType] = useState(savedState?.deathType ?? null);
  const [gameOverMessage, setGameOverMessage] = useState('');
  const [gameTime, setGameTime] = useState(savedState?.gameTime || { year: 1, month: 1, day: 1, hour: 8, minute: 0 });
  const [zeroHungerTime, setZeroHungerTime] = useState(savedState?.zeroHungerTime ?? null);
  const [zeroMoodTime, setZeroMoodTime] = useState(savedState?.zeroMoodTime ?? null);
  const [isTalking, setIsTalking] = useState(false);
  const [isGeneratingDialogue, setIsGeneratingDialogue] = useState(false);
  const [currentDialogue, setCurrentDialogue] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(savedState?.currentLocation || 'SALA_DE_ESTAR');
  const [view, setView] = useState('HOME');
  const [interactionMessage, setInteractionMessage] = useState(null);
  const [isProposingMarriage, setIsProposingMarriage] = useState(false);
  const [marriageProposalStep, setMarriageProposalStep] = useState(0);
  const charPositionRef = useRef({ x: savedState?.charPositionX ?? 0 });
  const [facingDirection, setFacingDirection] = useState('right');
  const [isWalking, setIsWalking] = useState(false);
  const [transitionDuration, setTransitionDuration] = useState('0s');
  const [aiRoomActions, setAiRoomActions] = useState(savedState?.aiRoomActions || {});
  const [isGeneratingRoomAction, setIsGeneratingRoomAction] = useState(false);
  const [apiQuotaExceeded, setApiQuotaExceeded] = useState(savedState?.apiQuotaExceeded ?? false);
  const abandonSequenceRef = useRef('');
  const abandonTimeoutRef = useRef(null);
  
  // --- DERIVED STATE & MEMO ---
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);
  const affectionTier = useMemo(() => getAffectionTier(affection), [affection]);
  const isDirty = useMemo(() => hygiene <= 30, [hygiene]);
  const isSad = useMemo(() => mood < 30, [mood]);
  const isNight = useMemo(() => gameTime.hour >= 22 || gameTime.hour < 7, [gameTime]);
  const isSleeping = useMemo(() => isNight && currentLocation === 'QUARTO' && !isProposingMarriage && !isTalking, [isNight, currentLocation, isProposingMarriage, isTalking]);
  const isDatingOrMarried = useMemo(() => affectionTier === 'GIRLFRIEND' || affectionTier === 'WIFE', [affectionTier]);

  // --- SAVE/LOAD & RESTART ---
  const stateToSave = useMemo(() => ({
      name, personality, characterImageUrl, hunger, hygiene, mood, affection, isAlive, deathType, gameTime,
      zeroHungerTime, zeroMoodTime, currentLocation, aiRoomActions, apiQuotaExceeded, charPositionX: charPositionRef.current.x
  }), [name, personality, characterImageUrl, hunger, hygiene, mood, affection, isAlive, deathType, gameTime, zeroHungerTime, zeroMoodTime, currentLocation, aiRoomActions, apiQuotaExceeded]);
  
  useEffect(() => { saveState(stateToSave); }, [stateToSave]);

  const handleRestart = useCallback(() => {
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  }, []);

  // --- DEBUG COMMAND ---
  useEffect(() => {
    const handleKeyDown = (event) => {
        if (event.key.length > 1) return; 

        if(abandonTimeoutRef.current) clearTimeout(abandonTimeoutRef.current);

        abandonSequenceRef.current += event.key.toLowerCase();

        if (!'abandon'.startsWith(abandonSequenceRef.current)) {
            abandonSequenceRef.current = '';
        } else if (abandonSequenceRef.current === 'abandon') {
            console.log('ABANDON sequence detected. Restarting...');
            handleRestart(); 
            abandonSequenceRef.current = '';
        } else {
            abandonTimeoutRef.current = setTimeout(() => {
                abandonSequenceRef.current = '';
            }, 3000);
        }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if(abandonTimeoutRef.current) clearTimeout(abandonTimeoutRef.current);
    };
  }, [handleRestart]);

  // --- CORE GAME LOOPS (Clock, Decay, Movement) ---
  useEffect(() => {
    const clockInterval = setInterval(() => {
        setGameTime(prevTime => {
            let { year, month, day, hour, minute } = prevTime;
            minute += TIME_SPEED_MULTIPLIER;
            if (minute >= 60) { hour += Math.floor(minute / 60); minute %= 60; }
            if (hour >= 24) { day += Math.floor(hour / 24); hour %= 24; }
            if (day > 30) { month += Math.floor(day / 30); day %= 30; if(day === 0) day = 1; }
            if (month > 12) { year += Math.floor(month / 12); month %= 12; if(month === 0) month = 1; }
            return { year, month, day, hour, minute };
        });
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);
  
  useEffect(() => {
    if (!isAlive || deathType || isSleeping) return;
    const tick = setInterval(() => {
        setHunger(h => Math.max(0, h - STAT_DECAY_RATE));
        setHygiene(h => Math.max(0, h - (STAT_DECAY_RATE / 2)));
        let moodDecay = STAT_DECAY_RATE;
        if(isDirty) moodDecay *= 1.5;
        if(affectionTier === 'HATE' || affectionTier === 'PSYCHOPATH') moodDecay *= 1.5;
        setMood(m => Math.max(0, m - moodDecay));
    }, DECAY_INTERVAL);
    return () => clearInterval(tick);
  }, [isAlive, deathType, isDirty, affectionTier, isSleeping]);
  
  useEffect(() => {
      const characterElement = document.querySelector('.character');
      if (!characterElement) return;
      if (isTalking || isSleeping || deathType || view !== 'HOME' || !isAlive) { setIsWalking(false); return; }
      let timeoutId;
      const decideNextAction = () => {
          const isCurrentlyWalking = Math.random() > 0.4;
          if (isCurrentlyWalking) {
              const currentX = charPositionRef.current.x;
              const newTargetX = (Math.random() - 0.5) * 400;
              setFacingDirection(newTargetX > currentX ? 'right' : 'left');
              const distance = Math.abs(newTargetX - currentX);
              const walkSpeed = 50;
              const walkDuration = Math.max(1000, (distance / walkSpeed) * 1000);
              setTransitionDuration(`${walkDuration / 1000}s`);
              characterElement.style.transform = `translateX(${newTargetX}px)`;
              charPositionRef.current.x = newTargetX;
              setIsWalking(true);
              timeoutId = setTimeout(() => { setIsWalking(false); timeoutId = setTimeout(decideNextAction, Math.random() * 3000 + 2000); }, walkDuration);
          } else {
              setIsWalking(false);
              timeoutId = setTimeout(decideNextAction, Math.random() * 3000 + 2000);
          }
      };
      timeoutId = setTimeout(decideNextAction, Math.random() * 2000 + 1000);
      return () => clearTimeout(timeoutId);
  }, [isTalking, isSleeping, deathType, view, isAlive]);

  // --- DEATH LOGIC ---
  useEffect(() => {
    if (!isAlive || deathType) return;
    if (hunger <= 0 && zeroHungerTime === null) { setZeroHungerTime(Date.now()); }
    else if (hunger > 0 && zeroHungerTime !== null) { setZeroHungerTime(null); }
    if (zeroHungerTime !== null && Date.now() - zeroHungerTime > DEATH_TIMER_DURATION) { setDeathType('hunger'); setIsAlive(false); }
    if (mood <= 0 && zeroMoodTime === null) { setZeroMoodTime(Date.now()); }
    else if (mood > 0 && zeroMoodTime !== null) { setZeroMoodTime(null); }
    if (zeroMoodTime !== null && Date.now() - zeroMoodTime > DEATH_TIMER_DURATION) { setDeathType('sadness'); setIsAlive(false); }
    if (affectionTier === 'PSYCHOPATH') { setDeathType('psycho'); setIsAlive(false); }
  }, [isAlive, deathType, hunger, mood, affectionTier, zeroHungerTime, zeroMoodTime]);

  useEffect(() => {
    if (deathType) {
        let msg = '';
        switch (deathType) {
            case 'hunger': msg = `${name} desmaiou de fraqueza e não acordou mais.`; break;
            case 'sadness': msg = `A tristeza foi demais para ${name}. Ela se foi.`; break;
            case 'psycho': msg = `Ela te olhou com um vazio aterrorizante... Você apagou.`; break;
        }
        setTimeout(() => setGameOverMessage(msg), 2500);
    }
  }, [deathType, name]);
  
  // --- USER ACTIONS ---
  const showInteractionMessage = (text, duration = 3000) => { setInteractionMessage(text); setTimeout(() => setInteractionMessage(null), duration); };
  const handleFeed = () => { if (!isAlive || isTalking || deathType || isSleeping) return; setHunger(h => Math.min(STAT_MAX, h + 25)); setMood(m => Math.min(STAT_MAX, m + 5)); showInteractionMessage(`${name} comeu e parece satisfeita.`); if(view !== 'HOME') setView('HOME'); };
  const handleWash = () => { if (!isAlive || isTalking || deathType || isSleeping) return; setHygiene(STAT_MAX); showInteractionMessage(`Você limpou ${name}. Ela está brilhando!`); if(view !== 'HOME') setView('HOME'); };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        setCharacterImageUrl(result);
        showInteractionMessage("Visual atualizado!", 2000);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateAndSetDialogue = async () => {
    const personaInstruction = `Você é ${name}, minha parceira virtual.

INFORMAÇÕES DE CONTEXTO:
- Jogador: Homem.
- Local: ${LOCATION_NAMES[currentLocation]}
- Status do Relacionamento: ${AFFECTION_STATUS_NAMES[affectionTier]} (Nível de Afeto: ${affection})
- Seu Humor (0-100): ${mood}

INSTRUÇÕES DE PERSONAGEM:
- Sua Personalidade Base: ${PERSONALITY_NAMES[personality]}.
- Como Agir (REGRA MAIS IMPORTANTE): Seu comportamento é uma mistura da sua personalidade e do seu nível de afeto. O afeto dita a INTENSIDADE e o TIPO de interação.
  - Exemplo: Uma personalidade "Malandra" com afeto baixo pode fazer uma piada esperta ou ser um pouco debochada. Com afeto alto (Namorando), a mesma personalidade pode fazer uma provocação mais íntima ou sugestiva. NUNCA seja sexualmente sugestiva com afeto baixo ou normal.
- CONSCIÊNCIA DO AMBIENTE: Use o "Local" atual como inspiração principal para suas falas. Se estiverem na Cozinha, comente sobre comida ou cheiros. Se estiverem no Quintal, sobre o tempo ou natureza. No Fliperama, sobre os jogos. Faça o diálogo parecer parte do ambiente.
- Instrução da Personalidade: ${PERSONALITY_PROMPTS[personality]}

REGRAS DE GERAÇÃO:
- VARIEDADE É ESSENCIAL: Mesmo com foco no ambiente, fale sobre QUALQUER COISA: o que você está pensando, uma memória que o local traz, um plano, uma pergunta. NÃO repita o mesmo tema ou a mesma estrutura de frase. Surpreenda-me.
- Gere uma única fala curta e impactante (1-2 frases).
- A fala DEVE ser criativa e seguir TODAS as instruções acima.
- NÃO use asteriscos (*) para descrever ações.
- NÃO gagueje com hífens (ex: "e-eu...").
- NÃO use emojis (ex: 😅). Emoticons de texto (ex: (o´▽\`o) ) são permitidos APENAS se combinarem com a personalidade (ex: FOFA).
- Além da sua fala, crie duas opções de resposta para o jogador: uma "positiva" e uma "negativa", que façam sentido com a sua fala.`;

    const prompt = `${personaInstruction}
Responda APENAS com um objeto JSON no seguinte formato, sem nenhum texto adicional, explicações ou markdown:
{ "petText": "Sua fala aqui.", "positiveResponse": { "text": "Texto da resposta positiva." }, "negativeResponse": { "text": "Texto da resposta negativa." } }`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", temperature: 1.0, topK: 40 },
        });

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }
        return JSON.parse(jsonStr);
  };
  
  const useFallbackDialogue = () => {
    const dialogueSet = FALLBACK_DIALOGUES_BY_ID[personality]?.[affectionTier];

    if (!dialogueSet || dialogueSet.length === 0) {
        showInteractionMessage("Ela parece sem palavras no momento. (Fallback DB vazio)");
        return;
    }

    const chosenDialogue = getRandom(dialogueSet);

    const dialogue = {
        petText: chosenDialogue.petText,
        positiveResponse: { ...chosenDialogue.positiveResponse, affectionEffect: 2, moodEffect: 5 },
        negativeResponse: { ...chosenDialogue.negativeResponse, affectionEffect: -2, moodEffect: -5 },
    };
    setCurrentDialogue(dialogue);
    setIsTalking(true);
  };

  const handleTalk = async () => {
    if (!isAlive || isTalking || deathType || isSleeping || isGeneratingDialogue || affectionTier === 'PSYCHOPATH') return;

    if (apiQuotaExceeded) {
        useFallbackDialogue();
        return;
    }

    setIsGeneratingDialogue(true);
    try {
        const generatedDialogue = await generateAndSetDialogue();
        const dialogue = {
            petText: generatedDialogue.petText,
            positiveResponse: { ...generatedDialogue.positiveResponse, affectionEffect: 2, moodEffect: 5 },
            negativeResponse: { ...generatedDialogue.negativeResponse, affectionEffect: -2, moodEffect: -5 },
        };
        setCurrentDialogue(dialogue);
        setIsTalking(true);
    } catch (error) {
        console.error("Gemini API error or parsing failed:", error);
        const errorMessage = error.toString().toLowerCase();
        if (errorMessage.includes('quota') || errorMessage.includes('billing') || errorMessage.includes('rate limit')) {
            showInteractionMessage("Ela parece cansada... (Cota da IA esgotada)", 4000);
            setApiQuotaExceeded(true);
            useFallbackDialogue();
        } else {
            showInteractionMessage("Ela não está com vontade de conversar agora. (Erro)");
        }
    } finally {
        setIsGeneratingDialogue(false);
    }
  };
  
  useEffect(() => {
    if (!isAlive || !isDatingOrMarried || view !== 'HOME' || aiRoomActions[currentLocation] || isGeneratingRoomAction || apiQuotaExceeded) {
        return;
    }

    const generateRoomAction = async () => {
        setIsGeneratingRoomAction(true);
        try {
            const prompt = `Você é a IA de um jogo. A personagem ${name} (personalidade: ${PERSONALITY_NAMES[personality]}) e o jogador (homem) estão em um relacionamento de "${AFFECTION_STATUS_NAMES[affectionTier]}" e estão no local "${LOCATION_NAMES[currentLocation]}".
Gere UMA ÚNICA ação contextual, criativa e inesperada que eles possam fazer juntos. A ação não pode ser uma das seguintes: ${['Dormir', 'Deitar', 'Oba-oba', 'Limpar', 'Tomar Banho Juntos', 'Assistir um Filme', 'Relaxar', 'Maratonar séries', 'Alimentar', 'Cozinhar Junto', 'Vasculhar Geladeira', 'Brincar ao ar livre', 'Apreciar a vista', 'Viagem', 'Comprar Sorvete', 'Comprar Roupas', 'Trabalhar', 'Passear', 'Jogar Boliche', 'Ir aos Fliperamas', 'Jogar "Pixel Fighter"', 'Jogar "Star Racer"', 'Relaxar na Hidro'].join(', ')}.
Responda APENAS com um objeto JSON no formato {"actionName": "Nome curto para o botão da ação", "resultText": "Texto que descreve o resultado divertido/interessante da ação."}.`;

             const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17", contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.9 },
            });

            let jsonStr = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
              jsonStr = match[2].trim();
            }
            const resultAction = JSON.parse(jsonStr);
            
            setAiRoomActions(prev => ({...prev, [currentLocation]: { name: resultAction.actionName, result: resultAction.resultText }}));

        } catch (error) {
            console.error("Failed to generate room action:", error);
            const errorMessage = error.toString().toLowerCase();
            if (errorMessage.includes('quota') || errorMessage.includes('billing') || errorMessage.includes('rate limit')) {
                setApiQuotaExceeded(true);
            }
        } finally {
            setIsGeneratingRoomAction(false);
        }
    };

    generateRoomAction();
  }, [currentLocation, view, isDatingOrMarried, isAlive, aiRoomActions, isGeneratingRoomAction, apiQuotaExceeded]);


  const handleDialogueChoice = (option) => {
    setIsTalking(false);
    setCurrentDialogue(null);

    if (isProposingMarriage) {
        if (option.text.startsWith("Sim")) { setAffection(151); showInteractionMessage("É o dia mais feliz da vida de vocês!", 5000); }
        else { setAffection(40); showInteractionMessage("O coração dela se partiu... talvez pra sempre.", 5000); }
        setIsProposingMarriage(false); setMarriageProposalStep(0); return;
    }

    if (currentDialogue?.isProposal) {
        if (option.text.startsWith("Sim")) { setAffection(91); showInteractionMessage("Vocês estão namorando!", 4000) }
        else { setAffection(-20); showInteractionMessage("Ela ficou de coração partido.", 4000)}
        setMood(m => Math.max(0, Math.min(STAT_MAX, m + (option.moodEffect || 0)))); return;
    }

    if (option.text === '[Sair]') return;

    if (option.moodEffect) setMood(m => Math.max(0, Math.min(STAT_MAX, m + option.moodEffect)));

    if (option.affectionEffect) {
        const oldAffection = affection;
        const newAffectionValue = oldAffection + option.affectionEffect;
        const oldTier = getAffectionTier(oldAffection);

        if (oldTier === 'GIRLFRIEND' && newAffectionValue >= 151) {
            setAffection(150);
            setIsProposingMarriage(true);
            setMarriageProposalStep(0);
        } else if (oldTier !== 'GIRLFRIEND' && oldTier !== 'WIFE' && newAffectionValue >= 91) {
            setAffection(90);
            setCurrentDialogue(PROPOSAL_DIALOGUE);
            setIsTalking(true);
        } else {
            setAffection(a => {
                const currentTierCheck = getAffectionTier(a);
                if (currentTierCheck === 'WIFE') return a;
                if (oldTier === 'GIRLFRIEND' && getAffectionTier(newAffectionValue) !== 'GIRLFRIEND' && newAffectionValue < 91) {
                    showInteractionMessage("As coisas não estavam dando certo... Ela terminou com você.", 5000);
                    return 30;
                }
                return newAffectionValue;
            });
        }
    }
  };
  
  const getSkyColor = () => {
      const hour = gameTime.hour;
      if (hour < 7) return 'rgba(15, 56, 15, 0.5)'; if (hour < 8) return 'rgba(255, 147, 41, 0.2)';
      if (hour < 18) return 'rgba(0,0,0,0)'; if (hour < 20) return 'rgba(255, 147, 41, 0.3)';
      if (hour < 22) return 'rgba(23, 76, 133, 0.4)'; return 'rgba(15, 56, 15, 0.5)';
  }

  // --- RENDER LOGIC ---
  const renderActions = () => {
    if (!isAlive) return null;
    if (isSleeping) return React.createElement("p", { className: "action-info-text" }, "Ela est\u00E1 dormindo... Shhh.");
    if(isProposingMarriage) {
        if (marriageProposalStep < MARRIAGE_PROPOSAL_SEQUENCE.length - 1) return React.createElement("button", { className: "action-btn wide-btn", onClick: () => setMarriageProposalStep(s => s + 1) }, "... (Continuar)");
        return (React.createElement(React.Fragment, null, " ", React.createElement("button", { className: "action-btn", onClick: () => handleDialogueChoice({text: "Sim"}) }, "Sim, mil vezes sim!"), " ", React.createElement("button", { className: "action-btn", onClick: () => handleDialogueChoice({text: "Não"}) }, "Eu... n\u00E3o posso."), " "));
    }
    if (isTalking && currentDialogue) {
        return (React.createElement(React.Fragment, null,
            React.createElement("button", { className: "action-btn", onClick: () => handleDialogueChoice(currentDialogue.positiveResponse) }, currentDialogue.positiveResponse.text),
            React.createElement("button", { className: "action-btn", onClick: () => handleDialogueChoice(currentDialogue.negativeResponse) }, currentDialogue.negativeResponse.text),
            !currentDialogue.isProposal && React.createElement("button", { className: "action-btn wide-btn", onClick: () => handleDialogueChoice({ text: '[Sair]' }) }, "[Sair]")
        ));
    }

    if (isDatingOrMarried) {
        switch(view) {
            case 'HOME': return (React.createElement(React.Fragment, null, " ", React.createElement("button", { className: "action-btn", onClick: () => setView('MENU_COMODOS') }, "C\u00F4modos"), " ", React.createElement("button", { className: "action-btn", onClick: () => setView('MENU_INTERACOES') }, "Interagir"), " ", React.createElement("button", { className: "action-btn", onClick: handleTalk, disabled: isGeneratingDialogue }, isGeneratingDialogue ? 'Pensando...' : 'Conversar'), " "));
            case 'MENU_COMODOS':
                const rooms = ['QUARTO', 'SALA_DE_ESTAR', 'COZINHA', 'BANHEIRO']; if (affectionTier === 'WIFE') { rooms.push('QUINTAL'); }
                return (React.createElement(React.Fragment, null, " ", rooms.map(room => ( React.createElement("button", { key: room, className: "action-btn", onClick: () => { setCurrentLocation(room); setView('HOME'); } }, LOCATION_NAMES[room]))), " ", React.createElement("button", { className: "action-btn wide-btn", onClick: () => setView('HOME') }, "Voltar"), " "));
            case 'MENU_VIAGEM': return (React.createElement(React.Fragment, null, " ", React.createElement("button", { className: "action-btn", onClick: () => { setCurrentLocation('SORVETERIA'); setView('HOME'); } }, "Sorveteria"), " ", React.createElement("button", { className: "action-btn", onClick: () => { setCurrentLocation('SHOPPING'); setView('HOME'); } }, "Shopping"), " ", React.createElement("button", { className: "action-btn", onClick: () => { setCurrentLocation('BOLICHE'); setView('HOME'); } }, "Boliche"), " ", React.createElement("button", { className: "action-btn", onClick: () => { setCurrentLocation('MOTEL'); setView('HOME'); } }, "Motel"), " ", React.createElement("button", { className: "action-btn wide-btn", onClick: () => setView('MENU_INTERACOES') }, "Voltar"), " "));
            case 'MENU_ARMARIO': return(React.createElement(React.Fragment, null, " ", React.createElement("label", { className: "action-btn file-upload-label" }, " Importar Imagem ", React.createElement("input", { type: "file", accept: "image/*", onChange: handleImageUpload, style: { display: 'none' } }), " "), " ", React.createElement("button", { className: "action-btn wide-btn", onClick: () => setView('MENU_INTERACOES') }, "Voltar"), " "));
            case 'MENU_INTERACOES':
                let interactions = [];
                const aiAction = aiRoomActions[currentLocation];
                switch(currentLocation) {
                    case 'QUARTO': interactions.push({ text: 'Oba-oba', action: () => { showInteractionMessage('As luzes diminuem e a tela fica preta... :)', 4000); setMood(m => Math.min(STAT_MAX, m + 15)); }}); break;
                    case 'BANHEIRO': interactions.push({ text: 'Limpar', action: handleWash }); interactions.push({ text: 'Tomar Banho Juntos', action: () => { showInteractionMessage("Um banho quente e relaxante...", 5000); setHygiene(STAT_MAX); setView('HOME'); }}); break;
                    case 'SALA_DE_ESTAR': interactions.push({ text: 'Assistir um Filme', action: () => showInteractionMessage('Vocês assistem a um filme romântico no sofá.')}); if(affectionTier === 'WIFE') { interactions.push({ text: 'Maratonar séries', action: () => showInteractionMessage('Pipoca, cobertor e uma temporada inteira. Que noite!')}); } break;
                    case 'COZINHA': interactions.push({ text: 'Alimentar', action: handleFeed }); if(affectionTier === 'WIFE') { interactions.push({ text: 'Cozinhar Junto', action: () => showInteractionMessage('Vocês preparam uma refeição deliciosa juntos.')}); } break;
                    case 'QUINTAL': interactions.push({ text: 'Brincar ao ar livre', action: () => showInteractionMessage('[MINIGAME] Você chuta e... ela defende!')}); interactions.push({ text: 'Viagem', action: () => setView('MENU_VIAGEM')}); break;
                    case 'SORVETERIA': interactions.push({ text: 'Comprar Sorvete', action: () => showInteractionMessage('(Vocês tomam sorvete) Ela diz: "A gente podia vir aqui mais vezes!"', 5000) }); break;
                    case 'SHOPPING': interactions.push({ text: 'Comprar Roupas', action: () => showInteractionMessage('[LOJA] Vocês olham as vitrines.') }); break;
                    case 'BOLICHE': interactions.push({ text: 'Jogar Boliche', action: () => showInteractionMessage('[MINIGAME] STRIKE! Você é demais nisso!') }); interactions.push({ text: 'Ir aos Fliperamas', action: () => { setCurrentLocation('FLIPERAMAS'); setView('HOME') } }); break;
                    case 'FLIPERAMAS': interactions.push({ text: 'Jogar "Pixel Fighter"', action: () => showInteractionMessage('[MINIGAME] Hadouken!') }); break;
                    case 'MOTEL': interactions.push({ text: 'Relaxar na Hidro', action: () => showInteractionMessage("Vocês chegam no motel... e pedem o maior balde de pipoca para maratonar uma série B de terror. Foi divertido!", 5000)}); break;
                }
                 return (React.createElement(React.Fragment, null,
                    interactions.map(i => React.createElement("button", { key: i.text, className: "action-btn", onClick: i.action }, i.text)),
                    !apiQuotaExceeded && aiAction && React.createElement("button", { className: "action-btn ai-action", onClick: () => { showInteractionMessage(aiAction.result, 4000); setView('HOME'); } }, aiAction.name),
                    !apiQuotaExceeded && isGeneratingRoomAction && React.createElement("button", { className: "action-btn", disabled: true }, "Gerando ideia..."),
                    React.createElement("button", { className: "action-btn", onClick: () => setView('MENU_ARMARIO') }, "Arm\u00E1rio"),
                    React.createElement("button", { className: "action-btn wide-btn", onClick: () => {
                        if (currentLocation === 'FLIPERAMAS') { setCurrentLocation('BOLICHE'); }
                        else if (['SORVETERIA', 'SHOPPING', 'BOLICHE', 'MOTEL'].includes(currentLocation)) { setCurrentLocation('SALA_DE_ESTAR'); }
                        setView('HOME');
                    } }, ['FLIPERAMAS'].includes(currentLocation) ? 'Voltar p/ Boliche' : 'Voltar para Casa')
                ));
            default: return null;
        }
    }
    return ( React.createElement(React.Fragment, null, " ", React.createElement("button", { className: "action-btn", onClick: handleFeed }, "Alimentar"), " ", React.createElement("button", { className: "action-btn", onClick: handleWash }, "Limpar"), " ", React.createElement("button", { className: "action-btn", onClick: handleTalk, disabled: isGeneratingDialogue || affectionTier === 'HATE' || affectionTier === 'PSYCHOPATH' }, isGeneratingDialogue ? 'Pensando...' : 'Conversar'), " "));
  };

  const pad = (num) => num.toString().padStart(2, '0');

  return (
    React.createElement(React.Fragment, null,
    React.createElement("style", null, `
      :root { --black: #0f380f; --dark: #306230; --medium: #8bac0f; --light: #9bbc0f; --char-shadow: rgba(0,0,0,0.15); --ai-action-color: #7b2cbf; }
      body { font-family: 'Press Start 2P', cursive; background: #222; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .app-wrapper { width: 800px; background: #2c3e50; border-radius: 10px; box-shadow: 0 10px 20px rgba(0,0,0,0.4); padding: 15px; display: flex; flex-direction: column; }
      .app-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: var(--black); color: var(--light); border-radius: 5px; margin-bottom: 15px; font-size: 14px; flex-wrap: wrap; }
      .header-info { display: flex; flex-direction: column; gap: 4px;}
      .personality-display { color: var(--medium); font-size: 12px; }
      .game-container { background: #c4cfa1; border-radius: 5px; padding: 8px; position: relative; display: flex; flex-direction: column; }
      .screen { background: var(--light); width: 100%; height: 450px; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; background-repeat: no-repeat; background-size: cover; background-position: center bottom; transition: background-color 2s linear; }
      .controls { background: var(--dark); padding-top: 8px; margin: 8px -8px -8px -8px; border-radius: 0 0 10px 0; }
      .stats-container { display: flex; justify-content: space-around; padding: 0 8px; }
      .status-bar-container { width: 30%; }
      .status-label { font-size: 12px; color: var(--light); margin: 0 0 4px; text-align: center; }
      .progress-bar-outline { background: var(--black); padding: 2px; height: 10px; border-radius: 4px; }
      .progress-bar-fill { background: var(--medium); height: 100%; border-radius: 2px; transition: width 0.5s ease; }
      .actions-container { display: flex; flex-wrap: wrap; justify-content: center; padding: 10px; gap: 10px; }
      .action-btn { font-family: inherit; font-size: 14px; background: var(--medium); color: var(--black); border: none; border-radius: 5px; padding: 12px; cursor: pointer; flex-grow: 1; text-align: center; min-width: 150px; }
      .action-btn:disabled { background: #5a7409; color: #306230; cursor: not-allowed; }
      .action-btn.ai-action { background: var(--ai-action-color); color: white; }
      .file-upload-label { display: inline-block; text-align: center; }
      .affection-status { font-size: 14px; color: var(--light); text-align: center; padding: 8px 0; }
      .affection-tier-name { color: var(--medium); font-weight: bold; }
      .character { position: absolute; bottom: 30px; left: 50%; transform: translateX(0px); transform-origin: center bottom; z-index: 5; width: 96px; margin-left: -48px; }
      @keyframes walking-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      .character.walking .character-bob { animation: walking-bob 0.5s ease-in-out infinite; }
      .character.talking .character-bob { animation: walking-bob 2s ease-in-out infinite; }
      .character-bob { position: relative; transform-origin: center bottom; }
      .character-shadow { width: 80px; height: 15px; background: var(--char-shadow); border-radius: 50%; position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); }
      .character-sprite { width: 100%; height: 160px; position: relative; }
      .character-image { width: 100%; height: 100%; object-fit: contain; }
      .speech-bubble { position: absolute; bottom: 300px; left: 50%; transform: translateX(-50%); background: white; color: black; padding: 12px 18px; border-radius: 10px; font-size: 14px; z-index: 20; max-width: 90%; text-align: center; border: 3px solid var(--black); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
      .speech-bubble::after { content: ''; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); border-width: 13px 13px 0; border-style: solid; border-color: white transparent; display: block; width: 0; filter: drop-shadow(0 2px 1px rgba(0,0,0,0.1)); }
      .interaction-popup { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(15, 56, 15, 0.9); color: var(--light); padding: 10px 15px; border-radius: 5px; font-size: 14px; z-index: 25; text-align: center; animation: fadeIn 0.3s, fadeOut 0.3s 2.7s; }
      @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
      @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
      .cutscene-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 30; animation: fadeIn 2s; }
      .cutscene-overlay.psycho-end { background: black; }
      .game-over-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 50; display: flex; align-items: center; justify-content: center; }
      .game-over-box { background: var(--light); color: var(--black); padding: 25px; border-radius: 5px; text-align: center; border: 3px solid var(--black); }
      .game-over-box h2 { font-size: 24px; margin: 0 0 10px; } .game-over-box p { font-size: 14px; margin: 0 0 20px; max-width: 300px; }
      .anim-hunger .character-bob { animation: convulse 0.2s infinite; }
      @keyframes convulse { 0%, 100% { transform: translate(0, 0) rotate(0); } 25% { transform: translate(-2px, 0) rotate(-3deg); } 75% { transform: translate(2px, 0) rotate(3deg); } }
      .anim-sadness .character-bob { animation: hang-sway 4s ease-in-out infinite; }
      .rope { position: absolute; top: -40px; left: 50%; width: 2px; height: 40px; background: #8B4513; transform: translateX(-50%); }
      @keyframes hang-sway { 0%, 100% { transform: rotate(5deg); } 50% { transform: rotate(-5deg); } }
      .anim-psycho .character-bob { animation: psycho-twitch 0.5s infinite; }
      .knife { width: 10px; height: 30px; background: #ccc; position: absolute; z-index: 10; top: 80px; right: 10px; transform: rotate(20deg); border: 1px solid #333; border-radius: 4px 0 0 4px; }
      @keyframes psycho-twitch { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(2px); } }
      .character.sleeping .character-bob { animation: sleep-bob 5s ease-in-out infinite; transform-origin: center bottom; }
      .character.sleeping .character-image { filter: brightness(0.6); }
      .zzz-bubble { position: absolute; top: -10px; right: -15px; font-size: 14px; animation: zzz-float 2s infinite; }
      @keyframes sleep-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      @keyframes zzz-float { 0% { opacity: 0; transform: translate(0,0) scale(0.5); } 50% { opacity: 1; } 100% { opacity: 0; transform: translate(10px, -20px) scale(1.2); } }
      .action-info-text { color: var(--light); text-align: center; width: 100%; font-size: 14px; padding: 15px 0; }
      .wide-btn { flex-basis: 100% !important; flex-grow: 1 !important; }
    `),
      React.createElement("div", { className: "app-wrapper" },
         React.createElement("header", { className: "app-header" },
            React.createElement("div", { className: "header-info" },
              React.createElement("div", { className: "location-display" }, name, " em ", LOCATION_NAMES[currentLocation]),
              React.createElement("div", { className: "personality-display" }, "Personalidade: ", PERSONALITY_NAMES[personality])
            ),
            React.createElement("div", { className: "time-display" }, "D", gameTime.day, "/", gameTime.month, "/", gameTime.year, " - ", pad(gameTime.hour), ":", pad(gameTime.minute))
        ),
        React.createElement("div", { className: "game-container" },
            deathType && React.createElement("div", { className: 'cutscene-overlay ' + (deathType === 'psycho' ? 'psycho-end' : '') }),
            !isAlive && gameOverMessage && (
                React.createElement("div", { className: "game-over-overlay" },
                    React.createElement("div", { className: "game-over-box" },
                        React.createElement("h2", null, "Fim de Jogo"), React.createElement("p", null, gameOverMessage),
                        React.createElement("button", { className: "action-btn", onClick: handleRestart }, "Reiniciar")
                    )
                )
            ),
            React.createElement("div", { className: "screen", style: { backgroundImage: LOCATION_BACKGROUNDS[currentLocation], backgroundColor: getSkyColor() } },
                isTalking && currentDialogue && React.createElement(SpeechBubble, { text: currentDialogue.petText }),
                isProposingMarriage && React.createElement(SpeechBubble, { text: MARRIAGE_PROPOSAL_SEQUENCE[marriageProposalStep] }),
                interactionMessage && React.createElement(InteractionPopup, { text: interactionMessage }),
                React.createElement(Character, { 
                    imageUrl: characterImageUrl,
                    isSleeping: isSleeping, animationState: deathType,
                    isTalking: isTalking, isWalking: isWalking,
                    facingDirection: facingDirection, transitionDuration: transitionDuration
                })
            ),
            React.createElement("div", { className: "controls" },
                React.createElement("div", { className: "stats-container" },
                    React.createElement(StatusBar, { label: "Fome", value: hunger }),
                    React.createElement(StatusBar, { label: "Higiene", value: hygiene }),
                    React.createElement(StatusBar, { label: "Humor", value: mood })
                ),
                React.createElement("div", { className: "affection-status" }, " Afeto: ", React.createElement("span", { className: "affection-tier-name" }, AFFECTION_STATUS_NAMES[affectionTier]), " "),
                React.createElement("div", { className: "actions-container" }, " ", renderActions(), " ")
            )
        )
      )
    )
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(React.createElement(App, null));