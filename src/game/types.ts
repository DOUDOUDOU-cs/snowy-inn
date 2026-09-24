export type SceneId = "arrival" | "forest" | "ruins" | "tiredSearch" | "ringFind" | "ringUncovered" | "portrait" | "doorplates" | "entrance" | "well" | "ropeSlips" | "ropeOnWindlass" | "ropeWrapped" | "ropeWoundOnce" | "ropeWoundTwice" | "ringDropped" | "silverKey" | "reception" | "emptyDesk" | "newGuest" | "innkeeperEnding" | "hallPortrait" | "registry" | "checkIn" | "keyHandover" | "guestRoom" | "nightNoise" | "hallway" | "neighborDoor" | "neighborRoom" | "morningRoom" | "wardrobe" | "wardrobeUntangled" | "cabinet" | "photoFind" | "basementDoor" | "basementStairs" | "basementShore" | "floodedPassage" | "drainHole" | "fleshCorridor" | "brokenPillar" | "wallTap" | "underwater" | "underwaterRescue" | "recoveryRoom" | "lingeringNight" | "drownedEnding" | "confrontationOpening" | "emilyAnswer" | "truthHub" | "weddingMemory" | "snowNight" | "whyTheyStayed" | "edwardAnswer" | "identityAnswer" | "identityDoubt" | "innNature" | "checkoutHint" | "checkoutEnding" | "rescueQuestion" | "breakfastOffer" | "breakfastPlate" | "breakfastInspect" | "breakfastResult" | "groundHall" | "kitchenThreshold" | "deskDrawer" | "escape";
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
