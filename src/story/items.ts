import type { GameState, ItemId } from "../game/types.ts";

export const items: Record<ItemId, { name: string; description: (state: GameState) => string[] }> = {
  ring: {
    name: "戒指",
    description: state => state.flags.enteredInn
      ? ["你将戒指凑近旅馆的灯光。内侧有一行极细小的字迹：", "艾米莉，I love you forever。"]
      : ["从村庄遗迹里拾到的戒指，表面沾着一点泥土。", "内侧似乎刻着字，可这里光线太暗，暂时看不清。"],
  },
  portrait: {
    name: "全家福画像",
    description: () => ["一幅从半塌的小屋中找到的小画像，画中人笑得很幸福。", "画框背面有稚嫩的笔迹：艾米莉的全家福，1682。"],
  },
  silverKey: {
    name: "银白色钥匙",
    description: state => ["从井中的木桶里取出的钥匙。表面温润，看不出明显的锈迹。", state.flags.basementUnlocked ? "它打开了旅馆地下室的门。" : "你还不知道它能打开哪一扇门。"],
  },
  roomKey: {
    name: "客房钥匙",
    description: () => ["前台小姐交给你的普通铜钥匙，钥匙牌上写着你的房号。", "它能打开二楼那间分给你的客房。"],
  },
  oldLedger: {
    name: "旧账本",
    description: () => ["从前台抽屉中找到的旧账本，页角已经磨软。", "其中一页记着：为了迎接婚庆，厨房要赶制蛋糕、猪肉香肠，还要准备几大桶啤酒。"],
  },
  bronzeKey: {
    name: "古铜色钥匙",
    description: () => ["在隔壁客房虚掩的衣柜里找到的古铜色钥匙。", "钥匙齿很短，不像是用来开客房门的。"],
  },
  adultPhoto: {
    name: "旧合影",
    description: state => [state.flags.portraitSeen
      ? "画中的女孩已长大。她与一位男人站在一起，眉眼仍像那幅写着 1682 年的画像。"
      : "一位女子与一位男人站在一起。你觉得女子有些眼熟。",
    "背面写着：他终于向我表白了，还送我一枚亲手做的戒指。"],
  },
};
