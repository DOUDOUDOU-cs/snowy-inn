export type SceneId = "arrival" | "forest" | "ruins" | "tiredSearch" | "ringFind" | "ringUncovered" | "portrait" | "doorplates" | "entrance" | "well" | "ropeSlips" | "ropeOnWindlass" | "ropeWrapped" | "ropeWoundOnce" | "ropeWoundTwice" | "ringDropped" | "silverKey" | "reception" | "emptyDesk" | "newGuest" | "innkeeperEnding" | "hallPortrait" | "registry" | "checkIn" | "keyHandover" | "guestRoom" | "nightNoise" | "hallway" | "neighborDoor" | "neighborRoom" | "neighborWater" | "neighborWaterAfterDrink" | "morningRoom" | "wardrobe" | "wardrobeUntangled" | "cabinet" | "photoFind" | "basementDoor" | "basementStairs" | "basementShore" | "floodedPassage" | "drainHole" | "fleshCorridor" | "brokenPillar" | "wallTap" | "wallVoice" | "wallVoiceReply" | "underwater" | "underwaterRescue" | "recoveryRoom" | "lingeringNight" | "drownedEnding" | "confrontationOpening" | "emilyAnswer" | "truthHub" | "kitchenQuestion" | "banquetQuestion" | "weddingMemory" | "snowNight" | "whyTheyStayed" | "edwardAnswer" | "identityAnswer" | "identityDoubt" | "innNature" | "checkoutHint" | "checkoutEnding" | "rescueQuestion" | "breakfastOffer" | "breakfastPlate" | "breakfastInspect" | "breakfastResult" | "groundHall" | "nightKitchen" | "nightKitchenTalk" | "nightKitchenMeat" | "kitchenThreshold" | "banquetDoor" | "banquetHall" | "banquetTable" | "banquetEcho" | "deskDrawer" | "escape";
export type ItemId = "ring" | "portrait" | "silverKey" | "roomKey" | "oldLedger" | "bronzeKey" | "adultPhoto";

export interface GameState {
  scene: SceneId;
  day: number;
  time: "night" | "morning";
  forestSteps: number;
  inventory: ItemId[];
  cordOrder?: number[];
  ringDroppedOnDay: number | null;
  fusion: number;
  breakfast: "unresolved" | "eaten" | "pretended" | "declined";
  flags: {
    ringFound: boolean;
    portraitSeen: boolean;
    doorplatesSeen: boolean;
    ruinsSeen: boolean;
    enteredInn: boolean;
    emilySawRing: boolean;
    ringInscriptionRead: boolean;
    registrySeen: boolean;
    checkedIn: boolean;
    ownEntrySeen: boolean;
    hallPortraitSeen: boolean;
    neighborRoomSeen: boolean;
    firstNightSlept: boolean;
    foodExamined: boolean;
    basementUnlocked: boolean;
    peacefulSleepUsed: boolean;
    basementTruthSeen: boolean;
    pillarExamined: boolean;
    tapExamined: boolean;
    rescuedFromBasement: boolean;
    choseToStay: boolean;
    emilyAdmittedHouse: boolean;
    weddingStoryHeard: boolean;
    innNatureHeard: boolean;
    checkoutHintSeen: boolean;
    checkedOut: boolean;
    // 2.0 新场景标记可缺省，旧版自动存档仍能直接读取。
    neighborWaterSeen?: boolean;
    neighborWaterDrank?: boolean;
    nightKitchenSeen?: boolean;
    nightKitchenSpoken?: boolean;
    banquetTableSeen?: boolean;
    banquetEchoHeard?: boolean;
    basementVoiceHeard?: boolean;
  };
}

export interface Choice {
  id: string;
  text: string;
  next: SceneId | ((state: GameState) => SceneId);
  available?: (state: GameState) => boolean;
  apply?: (state: GameState) => GameState;
}

export interface Scene {
  location: string;
  title: string;
  paragraphs: string[];
  choices: Choice[];
  previewEnd?: string;
  ending?: string;
}
